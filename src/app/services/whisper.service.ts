/**
 * Локальное распознавание немецкой речи для режима «Карточки» (RU → DE голосом).
 *
 * Что внутри:
 *  - захват микрофона через AudioWorklet (без устаревшего ScriptProcessorNode,
 *    который браузер помечает как deprecated);
 *  - VAD по RMS с адаптивным порогом шума: фраза завершается по паузе, поэтому
 *    отвечать можно без «нажми и держи»;
 *  - распознавание — Whisper (ONNX/WASM) из @huggingface/transformers;
 *    библиотека подгружается лениво, модель кэшируется браузером;
 *  - звук всегда приводится к 16 кГц (иначе Whisper получает «ускоренную» речь
 *    и выдаёт бессмыслицу — AudioContext по умолчанию работает на 44/48 кГц).
 *
 * Сервис одноразовый: `start()` взводит микрофон на одну фразу и сам отпускает
 * его после результата (или ошибки). Компонент вызывает `start()` заново на
 * следующей карточке — поэтому озвучка ответа (TTS) никогда не попадает в
 * распознавание, а индикатор микрофона честно гаснет на время проверки ответа.
 *
 * Движок выбирается моделью: `backend: 'local'` считает в браузере через
 * ONNX/WASM, `backend: 'cloud'` отдаёт нарезанную VAD-фразу в
 * OpenRouter Speech-to-Text. Захват звука и VAD в обоих случаях одни и те же.
 */
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import type { AutomaticSpeechRecognitionPipeline, ProgressInfo } from '@huggingface/transformers';
import { CloudSttService } from './cloud-stt.service';

/** Частота дискретизации, которую ожидает Whisper. */
export const WHISPER_SAMPLE_RATE = 16000;

/** Имя процессора AudioWorklet (см. WORKLET_SOURCE). */
const WORKLET_PROCESSOR = 'flashcards-mic-capture';
/** Размер блока, который worklet отдаёт в основной поток (16 кГц → 64 мс). */
const CAPTURE_BLOCK = 1024;
/** Порог «это уже речь», пока не измерен шумовой порог помещения. */
const MIN_SPEECH_RMS = 0.012;
const NOISE_FLOOR_MIN = 0.0005;
const NOISE_FLOOR_MAX = 0.05;
/** Пауза, после которой фраза считается законченной. */
const SILENCE_MS = 700;
/** «Всплеск» короче этого — шум, а не слово. */
const MIN_SPEECH_MS = 180;
/** Максимальная длина одной фразы (страховка от бесконечного буфера). */
const MAX_UTTERANCE_MS = 10_000;
/** Сколько звука оставляем перед началом речи: с контекстом Whisper точнее. */
const PREROLL_MS = 250;
/**
 * Потолок длины ответа. Карточки — это одно-два слова, а Whisper всё равно
 * досчитывает энкодер по всем 30 с. Ограничение даёт заметный выигрыш в скорости.
 */
const MAX_NEW_TOKENS = 24;

/**
 * Код процессора, который исполняется в AudioWorklet (отдельном потоке).
 * Копит сэмплы в блоки и отправляет их в основной поток — так на 128 сэмплов
 * аудиокванта приходится одно сообщение, а не ~8 000 в секунду.
 * Выход не заполняем: в destination уходит тишина (никакого самопрослушивания).
 */
const WORKLET_SOURCE = `
class FlashcardsMicCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.blockSize = opts.blockSize || 1024;
    this.buffer = new Float32Array(this.blockSize);
    this.offset = 0;
    this.active = true;
    this.port.onmessage = (event) => {
      if (event.data === 'stop') this.active = false;
    };
  }
  process(inputs) {
    if (!this.active) return false;
    const input = inputs[0];
    const channel = input && input[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset === this.blockSize) {
        this.port.postMessage(this.buffer.slice(0));
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('${WORKLET_PROCESSOR}', FlashcardsMicCapture);
`;

/** Модель распознавания, которую можно выбрать в UI. */
export interface WhisperModelInfo {
  id: string;
  label: string;
  hint: string;
  /**
   * Где считаем распознавание. `local` — в браузере через WASM (звук никуда
   * не уходит, но нужен долгий первый запуск); `cloud` — фраза уходит на
   * OpenRouter (мгновенный старт и высокое качество, но микрофон покидает
   * устройство).
   */
  backend: 'local' | 'cloud';
  /**
   * Квантизация ONNX-весов — только для `local`. У `base` q8 весит 73 МБ,
   * а у large-v3-turbo тот же q8 — целый гигабайт, поэтому для большой
   * модели разумнее q4 (~724 МБ).
   */
  dtype?: 'q8' | 'q4';
}

/**
 * Доступные модели — ровно две, обе кэшируются браузером, поэтому платим
 * за скачивание один раз.
 *
 * Важно: id — это всегда репозиторий **с ONNX-весами**. Оригинал
 * `primeline/whisper-large-v3-turbo-german` содержит только PyTorch
 * `model.safetensors` (1.6 ГБ) и в браузере не запускается; ONNX-конверсия
 * той же модели лежит в `onnx-community/…` (её `base_model` — ровно
 * `primeline/whisper-large-v3-turbo-german`).
 */
export const WHISPER_MODELS: readonly WhisperModelInfo[] = [
  {
    id: 'Xenova/whisper-base',
    label: 'base — локально, быстро',
    hint: '~73 МБ, звук не покидает устройство',
    backend: 'local',
    dtype: 'q8',
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo-german-ONNX',
    label: 'large-v3-turbo-german — локально, точнее',
    hint: '~724 МБ, звук не покидает устройство, но заметно медленнее',
    backend: 'local',
    dtype: 'q4',
  },
  {
    id: 'openai/whisper-large-v3-turbo',
    label: 'whisper-large-v3-turbo — в облаке',
    hint: 'мгновенный старт, ~$0.0001 за слово, запись уходит на OpenRouter',
    backend: 'cloud',
  },
];

/** Параметры загрузки локальной модели (для pipeline()). */
export function modelDtype(modelId: string): 'q8' | 'q4' {
  return WHISPER_MODELS.find((model) => model.id === modelId)?.dtype ?? 'q8';
}

/** Где считаем распознавание для модели. */
export function modelBackend(modelId: string): 'local' | 'cloud' {
  return WHISPER_MODELS.find((model) => model.id === modelId)?.backend ?? 'local';
}

/** Состояние микрофона (для индикаторов в UI). */
export type MicState = 'idle' | 'arming' | 'listening' | 'transcribing';

/** Состояние модели распознавания. */
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export type MicErrorCode =
  | 'unsupported'
  | 'mic-denied'
  | 'mic-missing'
  | 'mic-busy'
  | 'mic-unavailable'
  | 'model'
  | 'transcribe'
  | 'no-speech';

export interface MicError {
  code: MicErrorCode;
  /** Готовое к показу сообщение (по-русски). */
  message: string;
}

export interface WhisperListenOptions {
  /** Распознанная и прошедшая фильтр фраза. Сервис после этого замолкает. */
  onFinal: (text: string) => void;
  /** Сырой результат движка до фильтрации (Whisper не потоковый — вызывается один раз). */
  onInterim?: (text: string) => void;
  onError?: (error: MicError) => void;
}

/** Отладочное событие режима микрофона. */
export interface WhisperDebugEvent {
  time: string;
  event: string;
  detail: string;
}

/** Настраиваемое поведение детектора речи. */
export interface VadOptions {
  silenceMs?: number;
  minSpeechMs?: number;
  maxUtteranceMs?: number;
  prerollMs?: number;
}

// ── Чистые функции: без DOM, их удобно тестировать ────────────────────────────

/** Среднеквадратичная амплитуда кадра (0..1). */
export function frameRms(frame: Float32Array): number {
  if (!frame || frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/** Перевод RMS в «уровень для индикатора»: тихая речь ≈ 0.2, крик ≈ 0.8+. */
export function levelFromRms(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.max(0, Math.min(1, rms * 6));
}

/** Склейка кадров в один буфер (с предварительным расчётом длины). */
export function concatFrames(frames: Float32Array[], totalSamples?: number): Float32Array {
  const total = totalSamples ?? frames.reduce((sum, frame) => sum + frame.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    if (offset + frame.length > total) break;
    out.set(frame, offset);
    offset += frame.length;
  }
  return out;
}

/**
 * Приведение звука к 16 кГц — то, что ожидает Whisper.
 * При понижении частоты сначала усредняем по окну (грубый анти-алиасинг),
 * иначе «шипящие» немецкие звуки превращаются в шум и портят распознавание.
 */
export function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (!input || input.length === 0) return new Float32Array(0);
  if (!Number.isFinite(inputRate) || inputRate <= 0) return input;
  if (inputRate === WHISPER_SAMPLE_RATE) return input;

  const ratio = inputRate / WHISPER_SAMPLE_RATE;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);

  if (ratio > 1) {
    for (let i = 0; i < outLength; i++) {
      const from = Math.floor(i * ratio);
      const to = Math.min(input.length, Math.max(from + 1, Math.ceil((i + 1) * ratio)));
      let sum = 0;
      for (let k = from; k < to; k++) sum += input[k];
      out[i] = sum / (to - from);
    }
  } else {
    for (let i = 0; i < outLength; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = input[idx] ?? 0;
      const b = input[idx + 1] ?? a;
      out[i] = a + (b - a) * frac;
    }
  }
  return out;
}

/** Типичные галлюцинации Whisper на тишине и шуме — не считаем их ответом. */
const HALLUCINATIONS: readonly RegExp[] = [
  /^[\s.,!?…\-–—]*$/,
  /^[[(].*[\])]$/,
  /продолжение следует/i,
  /редактор субтитров|корректор/i,
  /субтитры|subtitles/i,
  /amara\.org|untertitel|untertitelt/i,
  /thanks? (you )?for watching|please subscribe|subscribe to/i,
  /vielen dank (fürs|für das) zuschauen/i,
  /vielen dank für ihre aufmerksamkeit/i,
  /^[♪♫\s]+$/,
];

/** Очистка ответа модели: пробелы, пустые строки и известные галлюцинации. */
export function cleanTranscript(raw: string): string {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (HALLUCINATIONS.some((pattern) => pattern.test(text))) return '';
  return text;
}

// ── Сервис ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class WhisperService implements OnDestroy {
  /** Текущий уровень сигнала микрофона 0..1 (для индикатора в UI). */
  readonly level = signal(0);
  /** Идёт ли сейчас речь (по версии VAD). */
  readonly speaking = signal(false);
  /** Состояние микрофона. */
  readonly state = signal<MicState>('idle');
  /** Модель распознавания: состояние и прогресс загрузки. */
  readonly modelStatus = signal<ModelStatus>('idle');
  readonly modelProgress = signal(0);
  readonly modelError = signal('');
  /** Доступен ли звуковой захват в этом браузере. */
  readonly supported = signal(true);
  /** Выбранная модель распознавания. */
  readonly modelId = signal<string>(WHISPER_MODELS[0].id);

  /** Внутренние события для панели отладки. */
  onDebug?: (event: WhisperDebugEvent) => void;

  private readonly debugLog: WhisperDebugEvent[] = [];
  private readonly cloudStt = inject(CloudSttService);
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  private loadPromise: Promise<void> | null = null;
  private audioCtx: AudioContext | null = null;
  private sink: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private legacyProcessor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private options: WhisperListenOptions | null = null;
  private listening = false;
  /** Поколение запроса: гасит «опоздавшие» результаты после stop()/start(). */
  private generation = 0;
  private sampleRate = WHISPER_SAMPLE_RATE;

  // Состояние детектора речи
  private frames: Float32Array[] = [];
  private samples = 0;
  private preroll: Float32Array[] = [];
  private prerollSamples = 0;
  private noiseFloor = 0.004;
  private silenceMs = 0;
  private speechMs = 0;
  private config = {
    silenceMs: SILENCE_MS,
    minSpeechMs: MIN_SPEECH_MS,
    maxUtteranceMs: MAX_UTTERANCE_MS,
    prerollMs: PREROLL_MS,
  };

  constructor() {
    this.supported.set(WhisperService.isSupported());
  }

  /** Проверка возможностей браузера без запроса разрешений. */
  static isSupported(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return false;
    return WhisperService.audioContextCtor() !== null;
  }

  private static audioContextCtor(): (new (options?: AudioContextOptions) => AudioContext) | null {
    const w = window as unknown as Record<string, unknown>;
    const ctor = (w['AudioContext'] ?? w['webkitAudioContext']) as
      (new (options?: AudioContextOptions) => AudioContext) | undefined;
    return typeof ctor === 'function' ? ctor : null;
  }

  /** Тонкая настройка VAD (используется в тестах и экспериментах). */
  configure(options: VadOptions): void {
    this.config = { ...this.config, ...options };
  }

  /** Смена модели: следующая загрузка подтянет новый файл. */
  setModel(modelId: string): void {
    if (!modelId || this.modelId() === modelId) return;
    // Меняем движок — старый запрос мог быть в полёте, его ответ невалиден.
    this.cloudStt.abort();
    if (this.transcriber) {
      void this.transcriber.dispose?.();
    }
    this.transcriber = null;
    this.loadPromise = null;
    this.modelError.set('');
    this.modelProgress.set(0);
    this.modelStatus.set('idle');
    this.modelId.set(modelId);
  }

  /** Загрузка модели заранее (например, пока пользователь настраивает сессию). */
  async preload(): Promise<boolean> {
    if (!this.supported()) return false;
    try {
      await this.ensureModel();
      return true;
    } catch {
      return false;
    }
  }

  /** Последние отладочные события (последние сверху). */
  getDebugLog(): WhisperDebugEvent[] {
    return [...this.debugLog].reverse();
  }

  /**
   * Взвести микрофон на одну фразу. `true` — микрофон слушает.
   * После `onFinal`/`onError` сервис сам отпускает микрофон: вызывайте `start()`
   * заново для следующей попытки.
   */
  async start(options: WhisperListenOptions): Promise<boolean> {
    const generation = ++this.generation;
    this.releaseAll();

    this.options = options;
    if (!this.supported()) {
      this.fail({
        code: 'unsupported',
        message: 'Этот браузер не умеет записывать звук. Используйте Chrome.',
      });
      return false;
    }

    this.setState('arming');
    try {
      await this.ensureModel();
    } catch (error) {
      this.fail({
        code: 'model',
        message: `Не удалось загрузить модель распознавания: ${describeError(error)}`,
      });
      return false;
    }
    if (generation !== this.generation) return false;

    try {
      await this.openMic();
    } catch (error) {
      this.fail(this.mapMicError(error));
      return false;
    }
    if (generation !== this.generation) {
      this.closeMic();
      return false;
    }

    this.resetUtterance(true);
    this.listening = true;
    this.setState('listening');
    this.emitDebug('mic-open', `${this.sampleRate} Гц`);
    return true;
  }

  /** Остановить прослушивание и отпустить микрофон (результаты больше не придут). */
  stop(): void {
    this.generation++;
    // Облачный запрос тоже снимаем — иначе он докачает файл в никуда.
    this.cloudStt.abort();
    this.releaseAll();
    this.options = null;
    this.setState('idle');
    this.emitDebug('stop', 'микрофон отпущен');
  }

  isListening(): boolean {
    return this.listening;
  }

  ngOnDestroy(): void {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => undefined);
    }
    this.audioCtx = null;
    this.sink = null;
    this.worklet = null;
    this.onDebug = undefined;
  }

  // ── Модель ──────────────────────────────────────────────────────────────────

  private async ensureModel(): Promise<void> {
    if (modelBackend(this.modelId()) === 'cloud') {
      // Облачной модели нечего качать: проверяем только ключ OpenRouter.
      if (!this.cloudStt.isAvailable()) {
        this.modelStatus.set('error');
        this.modelError.set('Нет ключа OpenRouter — облачное распознавание недоступно.');
        throw new Error('Нет ключа OpenRouter — облачное распознавание недоступно.');
      }
      this.modelStatus.set('ready');
      this.modelProgress.set(1);
      return;
    }
    if (this.transcriber) return;
    if (!this.loadPromise) {
      this.modelStatus.set('loading');
      this.modelProgress.set(0);
      this.modelError.set('');
      this.loadPromise = this.loadModel().catch((error) => {
        // Провал не кэшируем: следующая попытка может сработать (например, сеть).
        this.loadPromise = null;
        this.modelStatus.set('error');
        this.modelError.set(describeError(error));
        throw error;
      });
    }
    return this.loadPromise;
  }

  private async loadModel(): Promise<void> {
    const modelId = this.modelId();
    this.emitDebug('model-load', modelId);
    // Ленивый импорт: библиотека (~10 МБ) не попадает в стартовый бандл страницы.
    const transformers = await import('@huggingface/transformers');
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = true;
    transformers.env.logLevel = transformers.LogLevel.ERROR;

    const transcriber = await transformers.pipeline('automatic-speech-recognition', modelId, {
      device: 'wasm',
      // Квантизация берётся из описания модели: у большой модели q8 — это
      // лишний гигабайт, поэтому для неё задан q4.
      dtype: modelDtype(modelId),
      progress_callback: (info: ProgressInfo) => this.reportProgress(info),
    });

    this.transcriber = transcriber as unknown as AutomaticSpeechRecognitionPipeline;
    this.modelStatus.set('ready');
    this.modelProgress.set(1);
    this.emitDebug('model-ready', modelId);
  }

  private lastLoggedProgress = -1;

  private reportProgress(info: ProgressInfo): void {
    if (!info || typeof info !== 'object') return;
    switch (info.status) {
      case 'progress':
      case 'progress_total': {
        const percent = Math.max(0, Math.min(100, Math.round(info.progress ?? 0)));
        this.modelProgress.set(percent / 100);
        const bucket = Math.floor(percent / 10) * 10;
        if (bucket !== this.lastLoggedProgress) {
          this.lastLoggedProgress = bucket;
          this.emitDebug('model-progress', `${percent}%`);
        }
        break;
      }
      case 'done':
        this.emitDebug('model-file', info.file ?? '');
        break;
      case 'ready':
        this.emitDebug('model-ready', info.model ?? this.modelId());
        break;
      default:
        break;
    }
  }

  // ── Захват звука ────────────────────────────────────────────────────────────

  private async openMic(): Promise<void> {
    this.closeMic();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.stream = stream;

    const ctx = await this.ensureContext();
    await ctx.resume().catch(() => undefined);
    if (!this.sink) {
      this.sink = ctx.createGain();
      this.sink.gain.value = 0;
      this.sink.connect(ctx.destination);
    }

    this.source = ctx.createMediaStreamSource(stream);
    if (this.worklet) {
      this.source.connect(this.worklet);
      this.worklet.connect(this.sink);
    } else if (this.legacyProcessor) {
      this.source.connect(this.legacyProcessor);
      this.legacyProcessor.connect(this.sink);
    } else {
      throw new Error('Нет доступного узла записи звука.');
    }
  }

  private closeMic(): void {
    this.source?.disconnect();
    this.source = null;
    this.worklet?.disconnect();
    if (this.legacyProcessor) {
      this.legacyProcessor.disconnect();
      this.legacyProcessor.onaudioprocess = null;
      this.legacyProcessor = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private async ensureContext(): Promise<AudioContext> {
    if (this.audioCtx && this.audioCtx.state !== 'closed') return this.audioCtx;

    const Ctor = WhisperService.audioContextCtor();
    if (!Ctor) throw new Error('AudioContext недоступен.');
    let ctx: AudioContext;
    try {
      // Просим сразу 16 кГц: тогда ресемплинг не нужен вовсе.
      ctx = new Ctor({ sampleRate: WHISPER_SAMPLE_RATE, latencyHint: 'interactive' });
    } catch {
      ctx = new Ctor();
    }
    this.audioCtx = ctx;
    this.sampleRate = ctx.sampleRate || WHISPER_SAMPLE_RATE;
    if (this.sampleRate !== WHISPER_SAMPLE_RATE) {
      this.emitDebug(
        'sample-rate',
        `${this.sampleRate} Гц → ресемплинг в ${WHISPER_SAMPLE_RATE} Гц`,
      );
    }

    const useWorklet = await this.setupWorklet(ctx);
    if (!useWorklet) this.setupLegacyCapture(ctx);
    return ctx;
  }

  /** Основной путь: AudioWorklet (браузер не помечает его как устаревший). */
  private async setupWorklet(ctx: AudioContext): Promise<boolean> {
    if (!ctx.audioWorklet) {
      this.emitDebug('capture', 'AudioWorklet недоступен — используется legacy-захват');
      return false;
    }
    try {
      const url = URL.createObjectURL(
        new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
      );
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const node = new AudioWorkletNode(ctx, WORKLET_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { blockSize: CAPTURE_BLOCK },
      });
      node.port.onmessage = (event: MessageEvent<Float32Array>) => this.handleFrame(event.data);
      this.worklet = node;
      this.emitDebug('capture', `AudioWorklet, блок ${CAPTURE_BLOCK} сэмплов`);
      return true;
    } catch (error) {
      this.emitDebug(
        'capture',
        `AudioWorklet не завёлся (${describeError(error)}) — legacy-захват`,
      );
      return false;
    }
  }

  /**
   * Резервный путь для браузеров без AudioWorklet (Safari < 14.1).
   * ScriptProcessorNode объявлен устаревшим, но альтернативы там нет — именно
   * в этом режиме браузер и печатает предупреждение о deprecated.
   */
  private setupLegacyCapture(ctx: AudioContext): void {
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      this.handleFrame(new Float32Array(channel));
    };
    this.legacyProcessor = processor;
    this.emitDebug('capture', 'ScriptProcessorNode (legacy fallback)');
  }

  /** Полное освобождение ресурсов микрофона и буферов текущей фразы. */
  private releaseAll(): void {
    this.listening = false;
    this.closeMic();
    this.frames = [];
    this.samples = 0;
    this.preroll = [];
    this.prerollSamples = 0;
    this.silenceMs = 0;
    this.speechMs = 0;
    this.level.set(0);
    this.speaking.set(false);
  }

  /** Сброс текущей фразы без остановки прослушивания. */
  private resetUtterance(resetNoiseFloor: boolean): void {
    this.frames = [];
    this.samples = 0;
    this.preroll = [];
    this.prerollSamples = 0;
    this.silenceMs = 0;
    this.speechMs = 0;
    // Если взводим микрофон заново — помещение могло смениться, начинаем
    // с консервативного порога и заново измеряем фон.
    if (resetNoiseFloor) this.noiseFloor = 0.004;
    this.speaking.set(false);
  }

  // ── Детектор речи и распознавание ───────────────────────────────────────────

  /** Обработка очередного блока сэмплов из AudioWorklet/ScriptProcessor. */
  private handleFrame(frame: Float32Array): void {
    if (!this.listening || !this.options || !frame || frame.length === 0) return;

    const rms = frameRms(frame);
    const ms = (frame.length / this.sampleRate) * 1000;
    const threshold = Math.max(MIN_SPEECH_RMS, this.noiseFloor * 2.5);
    this.level.set(levelFromRms(rms));

    if (!this.speaking()) {
      // До начала речи держим «предбуфер» — Whisper точнее с контекстом.
      this.preroll.push(frame);
      this.prerollSamples += frame.length;
      const prerollLimit = (this.config.prerollMs / 1000) * this.sampleRate;
      while (this.prerollSamples > prerollLimit && this.preroll.length > 1) {
        this.prerollSamples -= this.preroll.shift()!.length;
      }
      if (rms < threshold) {
        // Шумовой порог помещения: медленная EMA по тихим кадрам.
        this.noiseFloor = clamp(
          this.noiseFloor * 0.95 + rms * 0.05,
          NOISE_FLOOR_MIN,
          NOISE_FLOOR_MAX,
        );
      } else {
        this.speaking.set(true);
        this.frames = this.preroll.slice();
        this.samples = this.prerollSamples;
        this.preroll = [];
        this.prerollSamples = 0;
        this.speechMs = 0;
        this.silenceMs = 0;
        this.emitDebug('speech-start', `rms ${rms.toFixed(3)} ≥ ${threshold.toFixed(3)}`);
      }
      return;
    }

    this.frames.push(frame);
    this.samples += frame.length;
    if (rms >= threshold) {
      this.speechMs += ms;
      this.silenceMs = 0;
    } else {
      this.silenceMs += ms;
    }

    const maxSamples = (this.config.maxUtteranceMs / 1000) * this.sampleRate;
    if (this.samples >= maxSamples) {
      this.emitDebug('flush', `максимум ${this.config.maxUtteranceMs / 1000} с`);
      this.finishUtterance();
      return;
    }
    if (this.silenceMs < this.config.silenceMs) return;

    if (this.speechMs >= this.config.minSpeechMs) {
      this.emitDebug(
        'flush',
        `пауза ${Math.round(this.silenceMs)} мс, речь ${Math.round(this.speechMs)} мс`,
      );
      this.finishUtterance();
    } else {
      // Щелчок, стук, скрип стула — слушаем дальше, ничего не отправляем.
      this.emitDebug('discard', `короткий всплеск ${Math.round(this.speechMs)} мс`);
      this.resetUtterance(false);
    }
  }

  /** Фраза закончилась: отпускаем микрофон и отправляем звук на распознавание. */
  private finishUtterance(): void {
    const options = this.options;
    const generation = this.generation;
    const frames = this.frames;
    const total = this.samples;
    if (!options || total === 0) {
      this.resetUtterance(false);
      return;
    }

    // Микрофон отпускаем сразу: пока идёт распознавание, слушать нечего,
    // а индикатор «микрофон включён» должен погаснуть.
    this.releaseAll();
    this.setState('transcribing');

    const audio = resampleTo16k(concatFrames(frames, total), this.sampleRate);
    this.emitDebug(
      'audio',
      `${(audio.length / WHISPER_SAMPLE_RATE).toFixed(2)} с, ${audio.length} сэмплов`,
    );
    void this.transcribe(audio, options, generation);
  }

  private async transcribe(
    audio: Float32Array,
    options: WhisperListenOptions,
    generation: number,
  ): Promise<void> {
    if (modelBackend(this.modelId()) === 'cloud') {
      await this.transcribeInCloud(audio, options, generation);
      return;
    }

    const transcriber = this.transcriber;
    if (!transcriber) {
      this.fail({ code: 'model', message: 'Модель распознавания не загружена.' });
      return;
    }

    try {
      const started = performance.now();
      // Greedy-декодирование (do_sample: false) — без сэмплирования Whisper
      // заметно быстрее, а для короткого слова разницы в качестве нет.
      const output = await transcriber(audio, {
        language: 'de',
        task: 'transcribe',
        max_new_tokens: MAX_NEW_TOKENS,
        do_sample: false,
        num_beams: 1,
      });
      if (generation !== this.generation) return; // карточку уже сменили: результат не наш

      const raw = (typeof output === 'string' ? output : (output?.text ?? '')).trim();
      this.emitDebug(
        'text',
        `${((performance.now() - started) / 1000).toFixed(1)} с → ${raw || '(пусто)'}`,
      );
      options.onInterim?.(raw);

      const text = cleanTranscript(raw);
      if (!text) {
        this.fail({ code: 'no-speech', message: 'Не расслышал — попробуйте ещё раз.' });
        return;
      }
      this.setState('idle');
      options.onFinal(text);
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail({
        code: 'transcribe',
        message: `Ошибка распознавания: ${describeError(error)}`,
      });
    }
  }

  /**
   * Распознавание в облаке. Сюда попадает ровно одна нарезанная VAD-фраза:
   * тишина и щелчки отсекаются раньше, в `handleFrame`/`finishUtterance`.
   */
  private async transcribeInCloud(
    audio: Float32Array,
    options: WhisperListenOptions,
    generation: number,
  ): Promise<void> {
    // Дубль страхуем ещё раз: тишина уже отсечена, но дешевле не дергать сеть.
    if (audio.length < this.sampleRate * (this.config.minSpeechMs / 1000)) {
      this.fail({ code: 'no-speech', message: 'Слишком коротко — не расслышал.' });
      return;
    }

    try {
      const started = performance.now();
      const result = await this.cloudStt.transcribe(audio, {
        model: this.modelId(),
        sampleRate: this.sampleRate,
        language: 'de',
      });
      if (generation !== this.generation) return; // карточку сменили — результат не наш

      const raw = result.text;
      const cost = result.costUsd !== undefined ? `, $${result.costUsd.toFixed(5)}` : '';
      this.emitDebug(
        'text',
        `${((performance.now() - started) / 1000).toFixed(1)} с${cost} → ${raw || '(пусто)'}`,
      );
      options.onInterim?.(raw);

      const text = cleanTranscript(raw);
      if (!text) {
        this.fail({ code: 'no-speech', message: 'Не расслышал — попробуйте ещё раз.' });
        return;
      }
      this.setState('idle');
      options.onFinal(text);
    } catch (error) {
      if (generation !== this.generation) return;
      // Отмену (AbortError) не показываем как ошибку — это штатная смена карточки.
      if ((error as { name?: string })?.name === 'AbortError') {
        this.setState('idle');
        return;
      }
      this.fail({ code: 'transcribe', message: describeError(error) });
    }
  }

  // ── Служебное ───────────────────────────────────────────────────────────────

  private setState(state: MicState): void {
    this.state.set(state);
  }

  private fail(error: MicError): void {
    this.emitDebug('error', `${error.code}: ${error.message}`);
    this.setState('idle');
    this.level.set(0);
    this.speaking.set(false);
    this.options?.onError?.(error);
  }

  private mapMicError(error: unknown): MicError {
    const name = (error as { name?: string })?.name ?? '';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return {
          code: 'mic-denied',
          message:
            'Браузер запретил доступ к микрофону. Разрешите его (значок замка в адресной строке) и попробуйте снова.',
        };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          code: 'mic-missing',
          message: 'Микрофон не найден. Подключите его и повторите.',
        };
      case 'NotReadableError':
      case 'TrackStartError':
        return {
          code: 'mic-busy',
          message: 'Микрофон занят другим приложением. Закройте его и попробуйте снова.',
        };
      default:
        return {
          code: 'mic-unavailable',
          message: `Не удалось включить микрофон: ${describeError(error)}`,
        };
    }
  }

  private emitDebug(event: string, detail: string): void {
    const now = new Date();
    const time =
      now.toLocaleTimeString('ru-RU', { hour12: false }) +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');
    const entry: WhisperDebugEvent = { time, event, detail };
    this.debugLog.push(entry);
    if (this.debugLog.length > 200) this.debugLog.shift();
    this.onDebug?.(entry);
  }
}

/** Короткое описание ошибки для сообщений в UI. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? 'неизвестная ошибка');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
