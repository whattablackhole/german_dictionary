/**
 * «Карточки: RU → DE голосом» — повторение слов Duolingo в стиле мобильного
 * приложения: показываем русское слово, игрок произносит немецкий перевод,
 * локальный Whisper (WhisperService) распознаёт речь, а AI-судья (AiService)
 * решает, верный ли это перевод.
 *
 * Микрофон работает по принципу «одна фраза — один запуск»: взводим его на
 * карточке, отпускаем, как только фраза распознана (WhisperService отпускает
 * микрофон сам), и включаем заново после озвучки ответа. Поэтому TTS-озвучка
 * никогда не попадает в распознавание, а индикатор микрофона не «горит»
 * во время проверки ответа.
 */
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AiService } from '../../services/ai.service';
import { DuoWordsService, altTranslations, shuffled } from '../../services/duo-words.service';
import { WHISPER_MODELS, WhisperService, modelDtype } from '../../services/whisper.service';
import type { MicError, WhisperModelInfo } from '../../services/whisper.service';
import { BROWSER_VOICE, PronunciationService } from '../../services/pronunciation.service';
import type { VoiceSource } from '../../services/pronunciation.service';
import { DuoWord, FlashcardsSessionResult, JudgeVerdict } from '../../models/flashcards';

type Phase = 'setup' | 'playing' | 'summary';

/** Событие панели отладки. */
interface DebugEvent {
  time: string;
  event: string;
  detail: string;
}

/** Настройки, которые запоминаем между сессиями. */
interface StoredSettings {
  unit?: number;
  size?: number;
  autoListen?: boolean;
  model?: string;
}

const SETTINGS_KEY = 'flashcards.settings';
const MIN_SESSION = 5;
const MAX_SESSION = 200;
/** Сколько раз автоматически перезапускать микрофон, если речи не слышно. */
const MAX_REARM_ATTEMPTS = 3;
const REARM_DELAY_MS = 700;
const DEBUG_HISTORY = 200;
/** Сколько столбиков рисуем в осциллограмме отладки. */
const LEVEL_BARS = 90;
/**
 * Пауза перед следующей карточкой. Раньше здесь стояли 2600/4200 мс — их
 * приходилось выбирать «на глаз», потому что длительность озвучки ответа
 * неизвестна. Теперь автопереход ждёт конца звука и эти значения — лишь
 * минимум, за который игрок успевает прочитать вердикт.
 */
const ADVANCE_DELAY_OK = 1200;
const ADVANCE_DELAY_WRONG = 2000;
/** Страховка: если озвучка почему-то не началась, не ждём её вечно. */
const ADVANCE_MAX_WAIT_MS = 6000;

@Component({
  selector: 'app-flashcards',
  imports: [FormsModule],
  templateUrl: './flashcards.component.html',
  styleUrl: './flashcards.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class FlashcardsComponent implements OnInit, OnDestroy {
  private readonly ai = inject(AiService);
  private readonly duoWords = inject(DuoWordsService);
  private readonly whisper = inject(WhisperService);
  /** Озвучка: API-голос с кэшем и prefetch, при неудаче — голос браузера. */
  readonly voice = inject(PronunciationService);

  /** Настройки прошлого запуска (читаются один раз при создании). */
  private readonly stored = readStoredSettings();

  // ── Сессия ───────────────────────────────────────────────────────────────────
  readonly phase = signal<Phase>('setup');
  readonly units = this.duoWords.units;
  readonly maxUnit = this.duoWords.maxUnit;
  readonly selectedUnit = signal(
    clampNumber(this.stored.unit, 1, this.duoWords.maxUnit, this.duoWords.maxUnit),
  );
  readonly sessionSize = signal(clampNumber(this.stored.size, MIN_SESSION, MAX_SESSION, 50));
  readonly poolSize = computed(() =>
    this.selectedUnit() > 0 ? this.duoWords.poolUpTo(this.selectedUnit()).length : 0,
  );
  readonly deck = signal<DuoWord[]>([]);
  readonly cardIndex = signal(0);
  readonly currentWord = computed<DuoWord | null>(() => this.deck()[this.cardIndex()] ?? null);
  readonly progress = computed(
    () => `${Math.min(this.cardIndex() + 1, this.deck().length)}/${this.deck().length}`,
  );
  readonly alts = computed<string[]>(() => {
    const word = this.currentWord();
    return word ? altTranslations(word) : [];
  });
  readonly showAlts = signal(false);
  readonly mistakes = signal<DuoWord[]>([]);
  readonly summary = signal<FlashcardsSessionResult | null>(null);

  // ── Микрофон и модель распознавания (состояние живёт в WhisperService) ──────
  readonly canUseMic = this.whisper.supported;
  readonly micState = this.whisper.state;
  readonly level = this.whisper.level;
  readonly speaking = this.whisper.speaking;
  readonly modelId = this.whisper.modelId;
  readonly modelStatus = this.whisper.modelStatus;
  readonly modelProgress = this.whisper.modelProgress;
  readonly modelError = this.whisper.modelError;
  /** Прогресс загрузки модели в процентах (для текста статуса). */
  readonly modelPercent = computed(() => Math.round(this.modelProgress() * 100));
  /** Выбрана тяжёлая локальная модель — предупреждаем о размере и медленной скорости. */
  readonly isHeavyModel = computed(() => modelDtype(this.modelId()) === 'q4');
  /**
   * Без ключа OpenRouter облачные модели показывать бессмысленно — они всё
   * равно вернут ошибку, поэтому прячем их и предупреждаем отдельно.
   */
  readonly cloudAvailable = computed(() => this.ai.hasApiKey());
  readonly models = computed<WhisperModelInfo[]>(() =>
    this.cloudAvailable() ? [...WHISPER_MODELS] : WHISPER_MODELS.filter((m) => m.backend === 'local'),
  );
  /** Выбрана облачная модель — предупреждаем, что запись покидает устройство. */
  readonly isCloudModel = computed(
    () => this.models().find((m) => m.id === this.modelId())?.backend === 'cloud',
  );
  readonly autoListen = signal(this.stored.autoListen ?? true);
  readonly micHint = signal('');

  // ── Голос ответа ─────────────────────────────────────────────────────────────
  readonly voiceSource = this.voice.voiceSource;
  /**
   * Без ключа OpenRouter варианты с API бессмысленны — оставляем в списке
   * только рабочий пункт, чтобы не предлагать то, что не сработает.
   */
  readonly voiceOptionsForApi = computed(() =>
    this.voice.apiAvailable() ? this.voice.options : [BROWSER_VOICE],
  );

  // ── Ответ ────────────────────────────────────────────────────────────────────
  readonly transcript = signal('');
  readonly rawTranscript = signal('');
  readonly typedAnswer = signal('');
  readonly judging = signal(false);
  readonly verdict = signal<JudgeVerdict | null>(null);
  readonly reveal = signal(false);
  readonly feedbackClass = signal<'correct' | 'wrong' | ''>('');
  readonly errorMessage = signal('');
  readonly retryable = signal(false);

  // ── Переход к следующей карточке ─────────────────────────────────────────────
  readonly advancing = signal(false);
  readonly nextCountdown = signal(0);

  // ── Отладка ──────────────────────────────────────────────────────────────────
  readonly debugEnabled = signal(false);
  readonly debugEvents = signal<DebugEvent[]>([]);
  /** Те же события, но свежими сверху — так не нужен автопрокрут лога. */
  readonly debugEventsDesc = computed(() => [...this.debugEvents()].reverse());
  readonly debugCanvas = viewChild<ElementRef<HTMLCanvasElement>>('debugCanvas');

  private readonly levels: number[] = [];
  private readonly subs = new Subscription();
  private nextTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private rearmTimer: ReturnType<typeof setTimeout> | null = null;
  /** Страховка: переход к следующей карточке, если озвучка не закончилась. */
  private advanceFloorTimer: ReturnType<typeof setTimeout> | null = null;
  /** Подписка на конец озвучки для автоперехода. */
  private speechEndSub: Subscription | null = null;
  /** Поколение автоперехода: старые таймеры игнорируются. */
  private advanceToken = 0;
  private drawTimer: ReturnType<typeof setTimeout> | null = null;
  private animFrame = 0;
  /** Поколение микрофона: старые колбэки после смены карточки игнорируются. */
  private micGeneration = 0;
  private rearmAttempts = 0;
  private isRetry = false;

  constructor() {
    // Осциллограмма в панели отладки рисуется только когда панель открыта.
    effect(() => {
      if (this.debugEnabled()) this.scheduleDraw();
      else this.stopDraw();
    });
  }

  // ── Жизненный цикл ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    const storedModel = this.stored.model;
    if (storedModel && WHISPER_MODELS.some((model) => model.id === storedModel)) {
      this.whisper.setModel(storedModel);
    }
    this.whisper.onDebug = (event) => this.pushDebugEvent(event.event, event.detail);
    // Озвучка ответа и микрофон не должны пересекаться.
    this.subs.add(this.voice.onStart.subscribe(() => this.stopMic()));
    this.subs.add(this.voice.onEnd.subscribe(() => this.maybeArmMic()));
    void this.prefetchModelIfAllowed();
  }

  ngOnDestroy(): void {
    this.micGeneration++;
    this.whisper.onDebug = undefined;
    this.whisper.stop();
    this.voice.stop();
    this.clearNextTimer();
    this.clearRearmTimer();
    this.stopDraw();
    this.subs.unsubscribe();
  }

  // ── Настройки сессии ─────────────────────────────────────────────────────────

  setUnit(unit: number): void {
    this.selectedUnit.set(clampNumber(unit, 1, this.maxUnit, this.maxUnit));
    this.saveSettings();
  }

  setSessionSize(size: number): void {
    this.sessionSize.set(clampNumber(size, MIN_SESSION, MAX_SESSION, 50));
    this.saveSettings();
  }

  setModel(modelId: string): void {
    this.whisper.setModel(modelId);
    this.saveSettings();
  }

  /** Смена голоса ответа: API-бесплатный, модель из настроек или браузер. */
  setVoiceSource(source: VoiceSource): void {
    if (this.voiceSource() === source) return;
    this.voice.setVoiceSource(source);
  }

  setAutoListen(enabled: boolean): void {
    if (this.autoListen() === enabled) return;
    this.autoListen.set(enabled);
    this.saveSettings();
    if (enabled) {
      void this.whisper.preload();
      this.maybeArmMic();
    } else {
      this.stopMic();
    }
  }

  /** Подготовить модель распознавания заранее (кнопка на экране настройки). */
  prepareModel(): void {
    void this.whisper.preload();
  }

  private async prefetchModelIfAllowed(): Promise<void> {
    if (!this.canUseMic() || !this.autoListen()) return;
    // Если микрофон уже разрешён, греем модель тихо — без лишних диалогов.
    try {
      const status = await navigator.permissions?.query({
        name: 'microphone' as PermissionName,
      });
      if (!status || status.state !== 'granted') return;
    } catch {
      return;
    }
    await this.whisper.preload();
  }

  private saveSettings(): void {
    this.stored.unit = this.selectedUnit();
    this.stored.size = this.sessionSize();
    this.stored.autoListen = this.autoListen();
    this.stored.model = this.modelId();
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.stored));
    } catch {
      // Приватный режим или переполненное хранилище — настройки просто не запомнятся.
    }
  }

  // ── Сессия ───────────────────────────────────────────────────────────────────

  startSession(): void {
    const deck = this.duoWords.buildDeck(this.selectedUnit(), this.sessionSize());
    if (!deck.length) return;
    this.saveSettings();
    this.deck.set(deck);
    this.mistakes.set([]);
    this.cardIndex.set(0);
    this.summary.set(null);
    this.levels.length = 0;
    this.isRetry = false;
    this.phase.set('playing');
    // Модель нужна только голосовому режиму — грузим её параллельно игре.
    if (this.autoListen()) void this.whisper.preload();
    this.enterCard();
  }

  backToSetup(): void {
    this.stopMic();
    this.clearNextTimer();
    this.voice.stop();
    this.phase.set('setup');
  }

  retryMistakes(): void {
    const mistakes = this.mistakes();
    if (!mistakes.length) return;
    this.deck.set(shuffled(mistakes));
    this.mistakes.set([]);
    this.cardIndex.set(0);
    this.summary.set(null);
    this.levels.length = 0;
    this.isRetry = true;
    this.phase.set('playing');
    this.enterCard();
  }

  // ── Карточки ─────────────────────────────────────────────────────────────────

  private enterCard(): void {
    this.clearNextTimer();
    this.clearRearmTimer();
    this.rearmAttempts = 0;
    this.micGeneration++;
    this.whisper.stop();
    this.verdict.set(null);
    this.reveal.set(false);
    this.feedbackClass.set('');
    this.transcript.set('');
    this.rawTranscript.set('');
    this.typedAnswer.set('');
    this.errorMessage.set('');
    this.micHint.set('');
    this.judging.set(false);
    this.retryable.set(false);
    this.showAlts.set(false);
    this.voice.stop();
    // Греем озвучку следующей карточки, пока игрок читает текущую.
    this.prefetchNextPronunciation();
    this.maybeArmMic();
  }

  /** Клик по карточке: до ответа — показать ответ, после — перейти дальше. */
  onCardClick(): void {
    if (!this.reveal()) {
      this.revealNow();
      return;
    }
    if (this.verdict()) this.advance();
  }

  toggleAlts(): void {
    this.showAlts.update((visible) => !visible);
  }

  revealNow(): void {
    const word = this.currentWord();
    if (!word || this.reveal() || this.judging()) return;
    this.stopMic();
    this.reveal.set(true);
    if (!this.verdict() && !this.isRetry) this.addMistake(word);
    this.pronounce(word);
  }

  skipCard(): void {
    const word = this.currentWord();
    if (word && !this.isRetry && !this.verdict()) this.addMistake(word);
    this.clearNextTimer();
    this.nextCard();
  }

  /** Кнопка «Далее» (или Space): не ждать автоперехода. */
  advance(): void {
    if (!this.reveal() && !this.verdict()) return;
    this.clearNextTimer();
    this.nextCard();
  }

  private nextCard(): void {
    this.voice.stop();
    const next = this.cardIndex() + 1;
    if (next >= this.deck().length) {
      this.finishSession();
      return;
    }
    this.cardIndex.set(next);
    this.enterCard();
  }

  private finishSession(): void {
    this.stopMic();
    const total = this.deck().length;
    const wrong = this.mistakes().length;
    this.summary.set({
      total,
      correct: total - wrong,
      wrong,
      mistakes: [...this.mistakes()],
    });
    this.phase.set('summary');
  }

  private addMistake(word: DuoWord): void {
    this.mistakes.update((list) =>
      list.some((item) => item.german === word.german) ? list : [...list, word],
    );
  }

  /**
   * Озвучка немецкого слова. Приоритет: родной звук Duolingo (мгновенно и
   * бесплатно, но есть не у всех слов) → PronunciationService (естественный
   * API-голос с кэшем) → голос браузера (внутри сервиса, при отказе API).
   */
  private pronounce(word: DuoWord): void {
    if (word.ttsUrl) {
      try {
        const audio = new Audio(word.ttsUrl);
        audio.play().catch(() => this.voice.speak(word.german));
        return;
      } catch {
        this.voice.speak(word.german);
        return;
      }
    }
    this.voice.speak(word.german);
  }

  /** Озвучить текущее слово ещё раз (кнопка на обратной стороне карточки). */
  repeatWord(): void {
    const word = this.currentWord();
    if (!word) return;
    this.pronounce(word);
  }

  /**
   * Озвучить слово, когда до него дойдёт очередь. Голос Duolingo мы не
   * трогаем — он и так мгновенный. А вот API-озвучку готовим заранее:
   * пока игрок читает вердикт, сеть успевает вернуть трек, и на следующей
   * карточке слово прозвучит без ожидания.
   */
  private prefetchNextPronunciation(): void {
    const next = this.deck()[this.cardIndex() + 1];
    if (!next || next.ttsUrl) return;
    this.voice.prefetch(next.german);
  }

  private scheduleNext(delayMs: number): void {
    this.clearNextTimer();
    const seconds = Math.ceil(delayMs / 1000);
    this.advancing.set(true);
    this.nextCountdown.set(seconds);
    this.nextTimer = setTimeout(() => {
      this.nextTimer = null;
      this.advancing.set(false);
      this.nextCountdown.set(0);
      this.nextCard();
    }, delayMs);
    this.countdownTimer = setInterval(() => {
      this.nextCountdown.update((left) => (left > 0 ? left - 1 : 0));
    }, 1000);
  }

  /**
   * Переход к следующей карточке: минимум — чтобы прочитать вердикт,
   * максимум — чтобы дослушать озвучку ответа. Раньше здесь стояли
   * фиксированные 2600/4200 мс: они либо обрывали голос на середине,
   * либо заставляли ждать впустую. Теперь ждём ровно до конца звука
   * (но не дольше ADVANCE_MAX_WAIT_MS) — это и есть «вдвое быстрее»
   * на коротких словах, где озвучка идёт меньше секунды.
   */
  private scheduleNextAfterSpeech(minDelayMs: number): void {
    // Сначала гасим прежние таймеры (это поднимет advanceToken), и только
    // потом запоминаем своё поколение — иначе проверка сразу провалится.
    this.clearNextTimer();
    const token = ++this.advanceToken;

    const go = () => {
      if (token !== this.advanceToken) return;
      this.unsubscribeSpeechEnd();
      this.scheduleNext(minDelayMs);
    };

    if (!this.voice.speaking()) {
      go();
      return;
    }
    // Звук ещё идёт: переход начнём, когда он закончится, но не позже
    // потолка — иначе «залипшая» озвучка блокировала бы игру навсегда.
    this.advanceFloorTimer = setTimeout(go, ADVANCE_MAX_WAIT_MS);
    this.speechEndSub = this.voice.onEnd.subscribe(go);
  }

  private unsubscribeSpeechEnd(): void {
    this.speechEndSub?.unsubscribe();
    this.speechEndSub = null;
    if (this.advanceFloorTimer) {
      clearTimeout(this.advanceFloorTimer);
      this.advanceFloorTimer = null;
    }
  }

  private clearNextTimer(): void {
    // Сбрасываем и «ожидание конца озвучки»: иначе старый обработчик
    // перевёл бы на следующую карточку посреди новой.
    this.advanceToken++;
    this.unsubscribeSpeechEnd();
    if (this.nextTimer) {
      clearTimeout(this.nextTimer);
      this.nextTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.advancing.set(false);
    this.nextCountdown.set(0);
  }

  // ── Микрофон ─────────────────────────────────────────────────────────────────

  toggleMic(): void {
    if (this.micState() !== 'idle') {
      this.stopMic();
      return;
    }
    void this.armMic();
  }

  /** Выключить микрофон немедленно (результаты в пути больше не применятся). */
  private stopMic(): void {
    this.micGeneration++;
    this.clearRearmTimer();
    this.whisper.stop();
  }

  private clearRearmTimer(): void {
    if (this.rearmTimer) {
      clearTimeout(this.rearmTimer);
      this.rearmTimer = null;
    }
  }

  /** Автоматически взвести микрофон, когда это уместно. */
  private maybeArmMic(): void {
    if (!this.autoListen() || !this.canListenNow()) return;
    void this.armMic();
  }

  private canListenNow(): boolean {
    return (
      this.canUseMic() &&
      this.phase() === 'playing' &&
      !this.reveal() &&
      !this.judging() &&
      !this.voice.speaking() &&
      this.micState() === 'idle' &&
      this.currentWord() !== null
    );
  }

  private async armMic(): Promise<void> {
    if (this.micState() !== 'idle' || !this.canListenNow()) return;
    const generation = ++this.micGeneration;
    this.micHint.set('');
    this.rawTranscript.set('');
    await this.whisper.start({
      onFinal: (text) => {
        if (generation !== this.micGeneration) return;
        this.onHeard(text);
      },
      onInterim: (raw) => {
        if (generation !== this.micGeneration) return;
        this.rawTranscript.set(raw);
        if (raw) this.pushDebugEvent('raw', raw);
      },
      onError: (error) => {
        if (generation !== this.micGeneration) return;
        this.onMicError(error);
      },
    });
  }

  private onHeard(text: string): void {
    if (this.reveal() || this.judging()) return;
    this.transcript.set(text);
    this.micHint.set('');
    void this.judgeAnswer(text);
  }

  private onMicError(error: MicError): void {
    if (error.code === 'no-speech') {
      this.micHint.set('Ничего не расслышал — скажите ещё раз.');
      if (this.autoListen()) this.scheduleRearm();
      return;
    }
    this.errorMessage.set(error.message);
    const fatal =
      error.code === 'mic-denied' || error.code === 'unsupported' || error.code === 'mic-missing';
    if (fatal) {
      // Смысла долбиться в закрытую дверь нет: отключаем автозапуск микрофона.
      this.autoListen.set(false);
      this.saveSettings();
    }
  }

  /** Тишина в ответ: пробуем ещё пару раз, потом просим нажать микрофон руками. */
  private scheduleRearm(): void {
    if (this.rearmAttempts >= MAX_REARM_ATTEMPTS) {
      this.rearmAttempts = 0;
      this.micHint.set('Микрофон не слышит речь. Нажмите 🎤 или введите ответ текстом.');
      return;
    }
    this.rearmAttempts++;
    this.clearRearmTimer();
    this.rearmTimer = setTimeout(() => {
      this.rearmTimer = null;
      this.maybeArmMic();
    }, REARM_DELAY_MS);
  }

  // ── Проверка ответа ──────────────────────────────────────────────────────────

  /** Ответ текстом — работает всегда, даже если микрофон недоступен. */
  submitTyped(): void {
    const text = this.typedAnswer().trim();
    if (!text || this.judging() || this.reveal()) return;
    this.typedAnswer.set('');
    void this.judgeAnswer(text);
  }

  /** Повторить проверку у судьи (после сетевой ошибки). */
  retryJudge(): void {
    const text = this.transcript().trim() || this.typedAnswer().trim();
    if (!text || this.judging() || this.reveal()) return;
    void this.judgeAnswer(text);
  }

  private async judgeAnswer(spoken: string): Promise<void> {
    const word = this.currentWord();
    if (!word || this.judging() || this.reveal()) return;

    this.stopMic();
    this.judging.set(true);
    this.retryable.set(false);
    this.errorMessage.set('');
    this.transcript.set(spoken);
    this.pushDebugEvent('judge', spoken);

    try {
      const verdict = await this.ai.judgeSpokenTranslation({
        russian: word.russian,
        translationsRaw: word.translationsRaw,
        expectedGerman: word.german,
        spokenText: spoken,
      });
      if (this.currentWord() !== word) return; // карточку успели сменить
      this.applyVerdict(verdict);
    } catch (error) {
      if (this.currentWord() !== word) return;
      this.errorMessage.set(describeJudgeError(error));
      this.retryable.set(true);
      this.judging.set(false);
    }
  }

  private applyVerdict(verdict: JudgeVerdict): void {
    const word = this.currentWord();
    if (!word) return;

    this.verdict.set(verdict);
    this.reveal.set(true);
    this.stopMic();
    if (verdict.correct) {
      this.feedbackClass.set('correct');
    } else {
      this.feedbackClass.set('wrong');
      this.addMistake(word);
    }
    this.judging.set(false);
    // Сначала озвучиваем: автопереход ниже ждёт конца этого звука, поэтому
    // пауза считается от реальной длительности слова, а не от «на глаз».
    this.pronounce(word);
    this.scheduleNextAfterSpeech(verdict.correct ? ADVANCE_DELAY_OK : ADVANCE_DELAY_WRONG);
  }

  // ── Клавиатура и отладка ─────────────────────────────────────────────────────

  onKeydown(event: KeyboardEvent): void {
    if (this.phase() !== 'playing') return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || target?.isContentEditable) {
      return;
    }
    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (this.reveal() || this.verdict()) this.advance();
        else this.revealNow();
        break;
      // «ь»/«Ь» — клавиша M на русской раскладке.
      case 'm':
      case 'M':
      case 'ь':
      case 'Ь':
        event.preventDefault();
        this.toggleMic();
        break;
      // «в»/«В» — клавиша D на русской раскладке.
      case 'd':
      case 'D':
      case 'в':
      case 'В':
        this.toggleDebug();
        break;
      default:
        break;
    }
  }

  toggleDebug(): void {
    this.debugEnabled.update((enabled) => !enabled);
  }

  private pushDebugEvent(event: string, detail: string): void {
    const now = new Date();
    const time =
      now.toLocaleTimeString('ru-RU', { hour12: false }) +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');
    this.debugEvents.update((list) => [...list, { time, event, detail }].slice(-DEBUG_HISTORY));
  }

  private scheduleDraw(): void {
    if (this.drawTimer || this.animFrame) return;
    // Даём Angular отрисовать canvas и только потом ищем его в DOM.
    this.drawTimer = setTimeout(() => {
      this.drawTimer = null;
      this.startDraw();
    }, 0);
  }

  /** Осциллограмма уровня микрофона: данные берём из WhisperService. */
  private startDraw(): void {
    const canvas = this.debugCanvas()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      this.animFrame = requestAnimationFrame(draw);
      this.levels.push(this.level());
      if (this.levels.length > LEVEL_BARS) this.levels.shift();

      ctx.clearRect(0, 0, width, height);
      const barWidth = width / LEVEL_BARS;
      ctx.fillStyle = this.speaking() ? '#58cc02' : '#1cb0f6';
      for (let i = 0; i < this.levels.length; i++) {
        const barHeight = Math.max(2, Math.min(1, this.levels[i] * 1.4) * height);
        ctx.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 1), barHeight);
      }

      // Порог, ниже которого детектор речи считает тишиной.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, height - height * 0.15);
      ctx.lineTo(width, height - height * 0.15);
      ctx.stroke();
    };
    draw();
  }

  private stopDraw(): void {
    if (this.drawTimer) {
      clearTimeout(this.drawTimer);
      this.drawTimer = null;
    }
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = 0;
    }
    this.levels.length = 0;
  }
}

// ── Чистые помощники ───────────────────────────────────────────────────────────

function readStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredSettings;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Понятное сообщение вместо английского стектрейса от судьи. */
function describeJudgeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/api key/i.test(message)) {
    return 'Нет API-ключа OpenRouter — добавьте его в разделе «Настройки».';
  }
  if (/failed to fetch|networkerror|load failed|network error/i.test(message)) {
    return 'Судья недоступен: проверьте интернет-соединение.';
  }
  return message ? `Ошибка судьи: ${message}` : 'Ошибка судьи. Попробуйте ещё раз.';
}
