// @vitest-environment jsdom
/**
 * Липкое состояние панели «ещё переводов»: открытая панель должна оставаться
 * открытой на следующих карточках и в следующих сессиях.
 */
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FlashcardsComponent } from './flashcards.component';
import { AiService } from '../../services/ai.service';
import { DuoWordsService } from '../../services/duo-words.service';
import { WhisperService } from '../../services/whisper.service';
import { PronunciationService } from '../../services/pronunciation.service';
import { BROWSER_VOICE } from '../../services/pronunciation.service';
import type { JudgeVerdict } from '../../models/flashcards';

const SETTINGS_KEY = 'flashcards.settings';

/** Сервисы, которые компонент трогает только косвенно (микрофон, сеть, звук). */
class FakeAiService {
  hasApiKey = () => true;
  /** Счётчик вызовов судьи: пустой ответ не должен уходить в сеть. */
  judgeSpokenTranslation = async (): Promise<JudgeVerdict> => {
    this.judgeCalls++;
    return { correct: true, reason: '' };
  };
  judgeCalls = 0;
}
class FakeWhisperService {
  supported = () => false;
  state = () => 'idle';
  level = () => 0;
  speaking = () => false;
  modelId = () => 'Xenova/whisper-base';
  modelStatus = () => 'idle';
  modelProgress = () => 0;
  modelError = () => '';
  stop = () => undefined;
  preload = async () => false;
  setModel = () => undefined;
}
class FakePronunciationService {
  voiceSource = () => BROWSER_VOICE.id;
  options = [BROWSER_VOICE];
  apiAvailable = () => false;
  speaking = () => false;
  /** ngOnInit подписывается на эти потоки, как в настоящем сервисе. */
  onStart = new Subject<void>();
  onEnd = new Subject<void>();
  speak = () => undefined;
  prefetch = () => undefined;
  stop = () => undefined;
}

/** Собирает компонент с фейковыми сервисами; возвращает и его, и фейк судьи. */
let lastAi: FakeAiService;
function create(): FlashcardsComponent {
  lastAi = new FakeAiService();
  TestBed.configureTestingModule({
    imports: [FlashcardsComponent],
    providers: [
      { provide: AiService, useValue: lastAi },
      { provide: WhisperService, useValue: new FakeWhisperService() },
      { provide: PronunciationService, useValue: new FakePronunciationService() },
    ],
  });
  return TestBed.createComponent(FlashcardsComponent).componentInstance;
}

describe('FlashcardsComponent — панель «ещё переводов»', () => {
  let component: FlashcardsComponent;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    component?.ngOnDestroy();
    TestBed.resetTestingModule();
  });

  it('по умолчанию панель закрыта', () => {
    component = create();
    expect(component.showAlts()).toBe(false);
  });

  it('переключатель открывает и закрывает панель', () => {
    component = create();
    component.toggleAlts();
    expect(component.showAlts()).toBe(true);
    component.toggleAlts();
    expect(component.showAlts()).toBe(false);
  });

  it('состояние панели переживает переход на следующую карточку', () => {
    component = create();
    component.startSession();
    component.toggleAlts();
    expect(component.showAlts()).toBe(true);

    // Переход на другую карточку не должен закрывать панель.
    component.advance();

    expect(component.showAlts()).toBe(true);
  });

  it('состояние панели сохраняется в localStorage', () => {
    component = create();
    component.toggleAlts();

    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    expect(saved.showAlts).toBe(true);

    component.toggleAlts();
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').showAlts).toBe(false);
  });

  it('восстанавливает открытую панель в новой сессии', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showAlts: true }));
    component = create();

    expect(component.showAlts()).toBe(true);
  });

  it('битое значение в localStorage не ломает компонент', () => {
    localStorage.setItem(SETTINGS_KEY, '{не json');
    component = create();
    expect(component.showAlts()).toBe(false);
  });
});

describe('FlashcardsComponent — пустой ответ', () => {
  let component: FlashcardsComponent;
  let ai: FakeAiService;

  /** Ждём микротаску: judgeAnswer идёт через await. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    localStorage.clear();
    component = create();
    ai = lastAi;
    component.startSession();
  });

  afterEach(() => {
    component.ngOnDestroy();
    TestBed.resetTestingModule();
  });

  it('пустой ответ засчитывается как ошибка', () => {
    component.submitTyped();

    expect(component.verdict()?.correct).toBe(false);
    expect(component.reveal()).toBe(true);
  });

  it('слово с ошибкой попадает в список mistakes', () => {
    component.submitTyped();
    expect(component.mistakes().map((w) => w.german)).toEqual([component.currentWord()?.german]);
  });

  it('пустой ответ не вызывает AI-судью', () => {
    component.submitTyped();
    // Запрос стоит денег, а случай заведомо неверный — судим локально.
    expect(ai.judgeCalls).toBe(0);
  });

  it('причину показывает игроку, а не пустую строку', () => {
    component.submitTyped();
    expect(component.verdict()?.reason).toBe('Ответ не указан');
  });

  it('пробелы-only тоже считаются пустым ответом', () => {
    component.typedAnswer.set('   ');
    component.submitTyped();

    expect(component.verdict()?.correct).toBe(false);
    expect(ai.judgeCalls).toBe(0);
  });

  it('не-пустой ответ по-прежнему уходит судье', async () => {
    ai.judgeSpokenTranslation = async () => {
      ai.judgeCalls++;
      return { correct: true, reason: 'верно' };
    };
    component.typedAnswer.set('Kaffee');
    component.submitTyped();
    await flush();

    expect(ai.judgeCalls).toBe(1);
    expect(component.verdict()?.correct).toBe(true);
  });

  it('после ответа повторная отправка игнорируется', () => {
    component.submitTyped();
    component.submitTyped();

    // Карточка уже revealed — второй клик не должен ничего портить.
    expect(component.mistakes().length).toBe(1);
  });
});
