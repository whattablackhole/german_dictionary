import {
  RecognitionResult,
  SpeechRecognitionService,
  isFatalRecognitionError,
} from './speech-recognition.service';

class FakeRecognition {
  static instances: FakeRecognition[] = [];

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  started = false;
  stopped = false;
  aborted = false;

  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  abort(): void {
    this.aborted = true;
  }

  emit(parts: Array<{ transcript: string; isFinal: boolean }>): void {
    const results = parts.map((p) => {
      const alt = [{ transcript: p.transcript, confidence: 1 }];
      return Object.assign(alt, { isFinal: p.isFinal });
    });
    this.onresult?.({ resultIndex: 0, results });
  }

  emitError(error: string): void {
    this.onerror?.({ error });
  }

  emitEnd(): void {
    this.onend?.();
  }

  emitSpeechEnd(): void {
    this.onspeechend?.();
  }
}

interface Hooks {
  interim: string[];
  final: RecognitionResult[];
  errors: Array<{ message: string; code?: string }>;
}

function hooks(): Hooks {
  return { interim: [], final: [], errors: [] };
}

describe('SpeechRecognitionService', () => {
  let service: SpeechRecognitionService;
  let h: Hooks;

  beforeEach(() => {
    FakeRecognition.instances = [];
    (window as unknown as Record<string, unknown>)['SpeechRecognition'] =
      FakeRecognition;
    service = new SpeechRecognitionService();
    h = hooks();
    service.clearDebugLog();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
  });

  function listen(): FakeRecognition {
    service.start(
      (result) => h.final.push(result),
      (text) => h.interim.push(text),
      (message, code) => h.errors.push({ message, code })
    );
    return FakeRecognition.instances[FakeRecognition.instances.length - 1];
  }

  it('настраивает распознавание на немецкий язык', () => {
    const rec = listen();
    expect(rec.started).toBe(true);
    expect(rec.lang).toBe('de-DE');
    expect(service.isListening()).toBe(true);
  });

  it('сообщает об отсутствии поддержки браузера', () => {
    delete (window as unknown as Record<string, unknown>)['SpeechRecognition'];
    service.start(
      () => undefined,
      () => undefined,
      (message, code) => h.errors.push({ message, code })
    );
    expect(h.errors).toHaveLength(1);
    expect(h.errors[0].code).toBe('unsupported');
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it('отдаёт финальный результат при isFinal', () => {
    const rec = listen();
    rec.emit([{ transcript: 'der Kaffee', isFinal: true }]);
    expect(h.final).toEqual([
      { transcript: 'der Kaffee', confidence: 1 },
    ]);
  });

  it('отдаёт промежуточный текст через onInterim', () => {
    const rec = listen();
    rec.emit([{ transcript: 'der Kaf', isFinal: false }]);
    expect(h.interim).toContain('der Kaf');
  });

  it('stop() финализирует распознанный текст', () => {
    const rec = listen();
    rec.emit([{ transcript: 'Schuhe', isFinal: true }]);
    service.stop();
    expect(rec.stopped).toBe(true);
  });

  it('abort() не отдаёт результатов', () => {
    const rec = listen();
    service.abort();
    rec.emitEnd();
    expect(h.final).toEqual([]);
    expect(service.isListening()).toBe(false);
  });

  it('isListening() возвращает false до запуска', () => {
    expect(service.isListening()).toBe(false);
  });

  it('getInterim() возвращает текущий промежуточный текст', () => {
    const rec = listen();
    rec.emit([{ transcript: 'test', isFinal: false }]);
    expect(service.getInterim()).toBe('test');
  });

  it('обрабатывает ошибку not-allowed', () => {
    const rec = listen();
    rec.emitError('not-allowed');
    expect(h.errors[0].code).toBe('not-allowed');
  });

  it('isFatalRecognitionError() определяет критичные ошибки', () => {
    for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'unsupported', 'start-failed']) {
      expect(isFatalRecognitionError(code)).toBe(true);
    }
    for (const code of ['no-speech', 'network', 'aborted', undefined]) {
      expect(isFatalRecognitionError(code)).toBe(false);
    }
  });

  describe('debug logging', () => {
    it('getDebugLog() возвращает записи после событий', () => {
      const rec = listen();
      rec.emit([{ transcript: 'Hallo', isFinal: true }]);
      const log = service.getDebugLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].category).toBe('event');
      expect(log[0].message).toContain('onresult');
    });

    it('getDebugLogSize() отражает количество записей', () => {
      expect(service.getDebugLogSize()).toBe(0);
      listen();
      expect(service.getDebugLogSize()).toBeGreaterThan(0);
    });

    it('clearDebugLog() очищает журнал', () => {
      listen();
      expect(service.getDebugLogSize()).toBeGreaterThan(0);
      service.clearDebugLog();
      expect(service.getDebugLogSize()).toBe(0);
      expect(service.getDebugLog()).toEqual([]);
    });

    it('записи содержат timestamp и time', () => {
      listen();
      const log = service.getDebugLog();
      expect(typeof log[0].timestamp).toBe('number');
      expect(typeof log[0].time).toBe('string');
    });

    it('записи содержат category и message', () => {
      const rec = listen();
      rec.emitError('no-speech');
      const log = service.getDebugLog();
      const errorEntry = log.find((e) => e.category === 'error');
      expect(errorEntry).toBeDefined();
    });

    it('лог не переполняется (макс. 500 записей)', () => {
      for (let i = 0; i < 600; i++) {
        service.start(() => undefined, () => undefined, () => undefined);
      }
      expect(service.getDebugLogSize()).toBeLessThanOrEqual(500);
    });
  });
});
