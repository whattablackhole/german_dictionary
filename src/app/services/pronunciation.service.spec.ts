// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { PronunciationService, VOICE_SOURCE_OPTIONS } from './pronunciation.service';
import { AiService } from './ai.service';
import { SettingsService } from './settings.service';
import { SpeechService } from './speech.service';
import { TtsCacheService } from './tts-cache.service';

const DATA_URL = 'data:audio/mpeg;base64,SUQz';

class FakeAiService {
  hasApiKey = vi.fn(() => true);
  generateSpeech = vi.fn(async () => DATA_URL);
}

class FakeTtsCacheService {
  store = new Map<string, string>();
  getAudio = vi.fn(async (text: string) => this.store.get(text) ?? null);
  setAudio = vi.fn(async (text: string, dataUrl: string) => {
    this.store.set(text, dataUrl);
  });
}

class FakeSpeechService {
  onEnd = { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) } as never;
  speak = vi.fn();
  stop = vi.fn();
}

describe('PronunciationService', () => {
  let service: PronunciationService;
  let ai: FakeAiService;
  let cache: FakeTtsCacheService;
  let speech: FakeSpeechService;
  let played: string[];
  let ended: (() => void) | null;

  beforeEach(() => {
    ai = new FakeAiService();
    cache = new FakeTtsCacheService();
    speech = new FakeSpeechService();

    TestBed.configureTestingModule({
      providers: [
        PronunciationService,
        { provide: AiService, useValue: ai },
        { provide: TtsCacheService, useValue: cache },
        { provide: SpeechService, useValue: speech },
        {
          provide: SettingsService,
          useValue: { ttsModel: () => 'model-x', ttsVoice: () => 'voice-x' },
        },
      ],
    });

    played = [];
    ended = null;
    // Подменяем конструктор Audio: в jsdom он не умеет играть data-URL.
    (window as unknown as { Audio: unknown }).Audio = class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      currentTime = 0;
      constructor(public src: string) {
        played.push(src);
        ended = () => this.onended?.();
      }
      play() {
        return Promise.resolve();
      }
      pause() {
        return undefined;
      }
    };

    service = TestBed.inject(PronunciationService);
  });

  afterEach(() => {
    service.stop();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('озвучивает через API и включает флаг speaking', async () => {
    const starts: number[] = [];
    service.onStart.subscribe(() => starts.push(1));
    service.speak('Kaffee');
    // onStart синхронный: микрофон успевает освободиться до ответа сети.
    expect(starts).toHaveLength(1);
    expect(service.speaking()).toBe(true);
    await flush();
    expect(played).toEqual([DATA_URL]);
  });

  it('берёт звук из кэша и не ходит в сеть', async () => {
    cache.store.set('Kaffee', DATA_URL);
    service.speak('Kaffee');
    await flush();
    expect(ai.generateSpeech).not.toHaveBeenCalled();
    expect(played).toEqual([DATA_URL]);
  });

  it('второе произнесение того же слова не генерирует заново', async () => {
    service.speak('Kaffee');
    await flush();
    service.speak('Kaffee');
    await flush();
    expect(ai.generateSpeech).toHaveBeenCalledTimes(1);
  });

  it('prefetch заранее кладёт звук в кэш — повтор потом мгновенный', async () => {
    service.prefetch('Kaffee');
    await flush();
    expect(ai.generateSpeech).toHaveBeenCalledTimes(1);
    expect(cache.setAudio).toHaveBeenCalledWith('Kaffee', DATA_URL, expect.anything());

    played.length = 0;
    service.speak('Kaffee');
    await flush();
    expect(ai.generateSpeech).toHaveBeenCalledTimes(1);
    expect(played).toEqual([DATA_URL]);
  });

  it('при ошибке API откатывается на голос браузера', async () => {
    ai.generateSpeech.mockRejectedValueOnce(new Error('no network'));
    service.speak('Kaffee');
    await flush();
    expect(speech.speak).toHaveBeenCalledWith('Kaffee');
    expect(played).toEqual([]);
  });

  it('без ключа OpenRouter сразу используется голос браузера', async () => {
    ai.hasApiKey.mockReturnValue(false);
    service.speak('Kaffee');
    await flush();
    expect(speech.speak).toHaveBeenCalledWith('Kaffee');
    expect(ai.generateSpeech).not.toHaveBeenCalled();
  });

  it('источник browser вообще не дергает API', async () => {
    service.setVoiceSource('browser');
    expect(service.voiceSource()).toBe('browser');
    service.speak('Kaffee');
    await flush();
    expect(ai.generateSpeech).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalled();
  });

  it('выбор источника сохраняется в localStorage', () => {
    service.setVoiceSource('api-settings');
    expect(localStorage.getItem('german-dictionary-voice-source')).toBe('api-settings');
    expect(VOICE_SOURCE_OPTIONS.map((option) => option.id)).toEqual([
      'api-free',
      'api-settings',
      'browser',
    ]);
  });

  it('onEnd приходит ровно один раз, когда звук доиграл', async () => {
    let ends = 0;
    service.onEnd.subscribe(() => ends++);
    service.speak('Kaffee');
    await flush();
    expect(ends).toBe(0);
    ended?.();
    expect(ends).toBe(1);
    expect(service.speaking()).toBe(false);
  });

  it('пустой текст не запускает озвучку', () => {
    let starts = 0;
    service.onStart.subscribe(() => starts++);
    service.speak('   ');
    expect(starts).toBe(0);
    expect(service.speaking()).toBe(false);
  });

  it('stop прерывает озвучку и снимает флаг', async () => {
    service.speak('Kaffee');
    await flush();
    let ends = 0;
    service.onEnd.subscribe(() => ends++);
    service.stop();
    expect(service.speaking()).toBe(false);
    expect(ends).toBe(1);
  });

  it('поздний ответ API не включает звук после stop()', async () => {
    let resolveSpeech: (value: string) => void = () => undefined;
    ai.generateSpeech.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveSpeech = resolve;
      }),
    );
    service.speak('Kaffee');
    service.stop();
    resolveSpeech(DATA_URL);
    await flush();
    // Гонка: ответ пришёл уже после остановки — играть нечего.
    expect(played).toEqual([]);
  });
});
