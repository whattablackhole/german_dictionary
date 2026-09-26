// @vitest-environment jsdom
// Микрофон и AudioWorklet — браузерные API, поэтому тесту нужен DOM.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  WHISPER_MODELS,
  WHISPER_SAMPLE_RATE,
  WhisperService,
  cleanTranscript,
  concatFrames,
  frameRms,
  levelFromRms,
  modelDtype,
  resampleTo16k,
} from './whisper.service';
import { CloudSttService } from './cloud-stt.service';

/** id большой модели — тот же, что и в списке (репозиторий с ONNX-весами). */
const LARGE_MODEL = 'onnx-community/whisper-large-v3-turbo-german-ONNX';
/** id облачной модели — обычный id OpenRouter, без локальных весов. */
const CLOUD_MODEL = 'openai/whisper-large-v3-turbo';
/** Полная (не turbo) облачная модель — медленнее и дороже, но точнее. */
const CLOUD_MODEL_FULL = 'openai/whisper-large-v3';

/**
 * Заглушка облачного распознавания: считаем вызовы, сеть не трогаем.
 * Подставляется через TestBed — `vi.mock` на относительный импорт
 * Angular-раннер не поддерживает.
 */
const cloudStt = vi.hoisted(() => ({
  // Параметры типизируем: тесты читают модель и язык из аргументов вызова.
  transcribe: vi.fn(
    async (_audio: Float32Array, _request: { model: string; language: string }) => ({
      text: 'Kaffee',
      costUsd: 0.0001,
    }),
  ),
  isAvailable: vi.fn(() => true),
  isBusy: vi.fn(() => false),
  abort: vi.fn(),
  reset() {
    this.transcribe.mockClear();
    this.isAvailable.mockReturnValue(true);
    this.abort.mockClear();
  },
}));

// ── Мок библиотеки распознавания (реальная тянет ONNX/WASM) ───────────────────

const mocks = vi.hoisted(() => {
  const transcribe = vi.fn();
  // Аргументы намеренно «широкие»: тесты читают (task, modelId, options).
  const pipeline = vi.fn(async (..._args: unknown[]) => transcribe);
  return { transcribe, pipeline };
});

vi.mock('@huggingface/transformers', () => ({
  env: { allowLocalModels: true, useBrowserCache: false, logLevel: 99 },
  LogLevel: { ERROR: 40 },
  pipeline: mocks.pipeline,
}));

// ── Мок браузерного звукового API ─────────────────────────────────────────────

class FakeNode {
  connections: unknown[] = [];
  connect(node: unknown): void {
    this.connections.push(node);
  }
  disconnect(): void {
    this.connections = [];
  }
}

class FakeTrack {
  stopped = false;
  stop(): void {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(public tracks: FakeTrack[]) {}
  getTracks(): FakeTrack[] {
    return this.tracks;
  }
}

class FakeWorkletNode extends FakeNode {
  static instances: FakeWorkletNode[] = [];
  port = {
    onmessage: null as ((event: { data: Float32Array }) => void) | null,
    postMessage: vi.fn(),
  };
  constructor() {
    super();
    FakeWorkletNode.instances.push(this);
  }
}

class FakeGainNode extends FakeNode {
  gain = { value: 1 };
}

class FakeContext {
  /** Какую частоту возвращает контекст, если браузер не дал запрошенную. */
  static fallbackSampleRate = WHISPER_SAMPLE_RATE;
  /** Имитация браузера, игнорирующего `sampleRate` в конструкторе. */
  static ignoreSampleRateOption = false;
  static instances: FakeContext[] = [];
  static lastGain: FakeGainNode | null = null;
  state = 'running';
  sampleRate: number;
  destination = new FakeNode();
  audioWorklet = { addModule: vi.fn(async () => undefined) };

  constructor(public options?: AudioContextOptions) {
    const requested = FakeContext.ignoreSampleRateOption ? undefined : options?.sampleRate;
    this.sampleRate = requested ?? FakeContext.fallbackSampleRate;
    FakeContext.instances.push(this);
  }

  createMediaStreamSource(): FakeNode {
    return new FakeNode();
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    FakeContext.lastGain = gain;
    return gain;
  }

  async resume(): Promise<void> {
    /* ничего */
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }
}

const streams: FakeStream[] = [];
let getUserMedia: ReturnType<typeof vi.fn>;

function installBrowserMocks(): void {
  FakeWorkletNode.instances = [];
  FakeContext.instances = [];
  FakeContext.lastGain = null;
  FakeContext.fallbackSampleRate = WHISPER_SAMPLE_RATE;
  FakeContext.ignoreSampleRateOption = false;
  streams.length = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:flashcards-worklet'),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);

  getUserMedia = vi.fn(async () => {
    const stream = new FakeStream([new FakeTrack()]);
    streams.push(stream);
    return stream;
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
    writable: true,
  });
}

// ── Тестовые кадры ────────────────────────────────────────────────────────────

const FRAME = 1024;

function silenceFrame(size = FRAME): Float32Array {
  return new Float32Array(size);
}

function speechFrame(size = FRAME, amplitude = 0.25): Float32Array {
  const frame = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    frame[i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / WHISPER_SAMPLE_RATE);
  }
  return frame;
}

function tick(times = 4): Promise<void> {
  let promise = Promise.resolve();
  for (let i = 0; i < times; i++) {
    promise = promise.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return promise;
}

// ── Чистые функции ────────────────────────────────────────────────────────────

describe('WhisperService — чистые помощники', () => {
  it('frameRms считает RMS и не падает на пустом кадре', () => {
    expect(frameRms(new Float32Array(0))).toBe(0);
    expect(frameRms(silenceFrame())).toBe(0);
    expect(frameRms(speechFrame(FRAME, 0.5))).toBeGreaterThan(0.3);
  });

  it('levelFromRms нормирует уровень в диапазон 0..1', () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(-1)).toBe(0);
    expect(levelFromRms(0.05)).toBeCloseTo(0.3, 5);
    expect(levelFromRms(10)).toBe(1);
  });

  it('concatFrames склеивает кадры в один буфер', () => {
    expect(concatFrames([silenceFrame(2), silenceFrame(3)]).length).toBe(5);
    expect(concatFrames([]).length).toBe(0);
  });

  it('resampleTo16k понижает 48 кГц до 16 кГц, сохраняя уровень', () => {
    const input = new Float32Array(48000 * 2).fill(0.5);
    const out = resampleTo16k(input, 48000);
    expect(out.length).toBe(WHISPER_SAMPLE_RATE * 2);
    expect(frameRms(out)).toBeCloseTo(0.5, 3);
  });

  it('resampleTo16k не пересчитывает уже 16 кГц', () => {
    const input = speechFrame(64);
    expect(resampleTo16k(input, WHISPER_SAMPLE_RATE)).toBe(input);
  });

  it('cleanTranscript убирает пустоту и галлюцинации, сохраняя речь', () => {
    expect(cleanTranscript('   ')).toBe('');
    expect(cleanTranscript('Продолжение следует...')).toBe('');
    expect(cleanTranscript('[MUSIK]')).toBe('');
    expect(cleanTranscript('  Kaffee  ')).toBe('Kaffee');
  });
});

// ── Сервис ────────────────────────────────────────────────────────────────────

describe('WhisperService — захват микрофона и распознавание', () => {
  let service: WhisperService;

  beforeEach(() => {
    installBrowserMocks();
    mocks.pipeline.mockClear();
    mocks.transcribe.mockReset();
    mocks.transcribe.mockResolvedValue({ text: ' Kaffee ' });
    cloudStt.reset();
    // WhisperService теперь просит CloudSttService через inject(), поэтому
    // собираем сервис через TestBed, а не new.
    TestBed.configureTestingModule({
      providers: [WhisperService, { provide: CloudSttService, useValue: cloudStt }],
    });
    service = TestBed.inject(WhisperService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  /** Кадр приходит из AudioWorklet — в тесте подсовываем его руками. */
  function push(frame: Float32Array): void {
    FakeWorkletNode.instances[0].port.onmessage?.({ data: frame });
  }

  async function startWith() {
    const onFinal = vi.fn();
    const onError = vi.fn();
    const onInterim = vi.fn();
    const ok = await service.start({ onFinal, onInterim, onError });
    return { ok, onFinal, onError, onInterim };
  }

  it('создаётся в спокойном состоянии', () => {
    expect(service).toBeTruthy();
    expect(service.isListening()).toBe(false);
    expect(service.state()).toBe('idle');
    expect(service.level()).toBe(0);
    expect(service.supported()).toBe(true);
  });

  it('stop() не падает, когда микрофон не включён', () => {
    expect(() => service.stop()).not.toThrow();
    expect(service.state()).toBe('idle');
  });

  it('взводит микрофон через AudioWorklet и не выводит звук в колонки', async () => {
    const { ok } = await startWith();

    expect(ok).toBe(true);
    expect(service.state()).toBe('listening');
    expect(FakeWorkletNode.instances.length).toBe(1);
    expect(FakeContext.instances[0].audioWorklet.addModule).toHaveBeenCalledTimes(1);
    // Усиление выхода worklet'а равно нулю — микрофон не «самопрослушивается».
    expect(FakeContext.lastGain?.gain.value).toBe(0);
    expect(mocks.pipeline.mock.calls[0][1]).toBe('Xenova/whisper-base');
  });

  it('распознаёт фразу после паузы, отпускает микрофон и ждёт нового запуска', async () => {
    service.configure({ silenceMs: 100, minSpeechMs: 20, prerollMs: 32 });
    const { onFinal, onError } = await startWith();

    push(speechFrame());
    push(speechFrame());
    expect(service.speaking()).toBe(true);
    push(silenceFrame());
    push(silenceFrame());
    await tick();

    expect(onError).not.toHaveBeenCalled();
    expect(onFinal).toHaveBeenCalledWith('Kaffee');
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    expect(service.state()).toBe('idle');
    expect(service.speaking()).toBe(false);
    // Микрофон действительно выключен: дорожка остановлена.
    expect(streams[0].tracks[0].stopped).toBe(true);
  });

  it('короткий щелчок не отправляется в распознавание', async () => {
    service.configure({ silenceMs: 64, minSpeechMs: 500, prerollMs: 0 });
    const { onFinal } = await startWith();

    push(speechFrame(FRAME, 0.02));
    push(silenceFrame());
    await tick();

    expect(mocks.transcribe).not.toHaveBeenCalled();
    expect(onFinal).not.toHaveBeenCalled();
    expect(service.state()).toBe('listening');
  });

  it('галлюцинацию на тишине не считает ответом', async () => {
    mocks.transcribe.mockResolvedValue({ text: ' Продолжение следует...' });
    service.configure({ silenceMs: 64, minSpeechMs: 10, prerollMs: 0 });
    const { onFinal, onError, onInterim } = await startWith();

    push(speechFrame());
    push(speechFrame());
    push(silenceFrame());
    push(silenceFrame());
    await tick();

    expect(onFinal).not.toHaveBeenCalled();
    expect(onInterim).toHaveBeenCalledWith('Продолжение следует...');
    expect(onError.mock.calls[0][0].code).toBe('no-speech');
  });

  it('не применяет результат, пришедший после stop()', async () => {
    mocks.transcribe.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { text: 'Kaffee' };
    });
    service.configure({ silenceMs: 64, minSpeechMs: 10, prerollMs: 0 });
    const { onFinal } = await startWith();

    push(speechFrame());
    push(speechFrame());
    push(silenceFrame());
    push(silenceFrame());
    service.stop();
    await tick(6);

    expect(onFinal).not.toHaveBeenCalled();
  });

  it('сообщает о запрете доступа к микрофону', async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    const { ok, onError } = await startWith();

    expect(ok).toBe(false);
    expect(onError.mock.calls[0][0].code).toBe('mic-denied');
    expect(service.state()).toBe('idle');
  });

  it('не включается там, где нет записи звука', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const noSound = TestBed.runInInjectionContext(() => new WhisperService());
    const onError = vi.fn();

    expect(noSound.supported()).toBe(false);
    expect(await noSound.start({ onFinal: vi.fn(), onError })).toBe(false);
    expect(onError.mock.calls[0][0].code).toBe('unsupported');
    noSound.ngOnDestroy();
  });

  it('приводит звук к 16 кГц, если браузер не дал нужную частоту', async () => {
    FakeContext.ignoreSampleRateOption = true;
    FakeContext.fallbackSampleRate = 48000;
    const debug = vi.fn();
    service.onDebug = debug;
    service.configure({ silenceMs: 64, minSpeechMs: 10, prerollMs: 0 });
    const { onFinal } = await startWith();

    push(speechFrame());
    push(speechFrame());
    push(silenceFrame());
    push(silenceFrame());
    push(silenceFrame());
    push(silenceFrame());
    await tick();

    expect(debug.mock.calls.some(([event]) => event.event === 'sample-rate')).toBe(true);
    // 5 кадров по 1024 сэмпла на 48 кГц → 1706 сэмплов на 16 кГц.
    const audio = mocks.transcribe.mock.calls[0][0] as Float32Array;
    expect(audio.length).toBe(1706);
    expect(onFinal).toHaveBeenCalledWith('Kaffee');
  });

  it('preload() загружает модель и отдаёт прогресс', async () => {
    expect(await service.preload()).toBe(true);
    expect(service.modelStatus()).toBe('ready');

    const options = mocks.pipeline.mock.calls[0][2] as {
      progress_callback: (info: unknown) => void;
    };
    options.progress_callback({
      status: 'progress_total',
      name: 'Xenova/whisper-base',
      progress: 42,
      loaded: 42,
      total: 100,
      files: {},
    });
    expect(service.modelProgress()).toBeCloseTo(0.42, 2);
  });

  it('setModel() переключает модель распознавания и её квантизацию', async () => {
    await service.preload();
    expect((mocks.pipeline.mock.calls[0][2] as { dtype: string }).dtype).toBe('q8');

    service.setModel(LARGE_MODEL);
    expect(service.modelStatus()).toBe('idle');

    await service.preload();
    expect(mocks.pipeline.mock.calls[1][1]).toBe(LARGE_MODEL);
    // Большая модель грузится в q4: q8 весил бы около гигабайта.
    expect((mocks.pipeline.mock.calls[1][2] as { dtype: string }).dtype).toBe('q4');
  });

  it('модели в списке — с ONNX-весами локально и облачные для OpenRouter', () => {
    expect(WHISPER_MODELS.map((model) => model.id)).toEqual([
      'Xenova/whisper-base',
      // Не primeline/…: там только PyTorch safetensors, в браузере не грузится.
      'onnx-community/whisper-large-v3-turbo-german-ONNX',
      CLOUD_MODEL,
      CLOUD_MODEL_FULL,
    ]);
    // Локальные модели обязаны объявлять квантизацию, облачным она не нужна.
    expect(WHISPER_MODELS.filter((m) => m.backend === 'local').map((m) => m.dtype)).toEqual([
      'q8',
      'q4',
    ]);
    expect(WHISPER_MODELS.filter((m) => m.backend === 'cloud').map((m) => m.dtype)).toEqual([
      undefined,
      undefined,
    ]);
    // Для неизвестной модели не падаем, а берём безопасное значение.
    expect(modelDtype('что-то-неизвестное')).toBe('q8');
    expect(modelDtype('Xenova/whisper-base')).toBe('q8');
  });

  // ── Облачный движок ──────────────────────────────────────────────────────────

  it('облачная модель не качает ONNX-веса, а шлёт фразу на OpenRouter', async () => {
    service.configure({ silenceMs: 64, minSpeechMs: 10, prerollMs: 0 });
    service.setModel(CLOUD_MODEL);

    const { ok, onFinal } = await startWith();
    expect(ok).toBe(true);
    // Никакой загрузки локальной модели — она бы весила сотни мегабайт.
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(service.modelStatus()).toBe('ready');

    push(speechFrame());
    push(speechFrame());
    push(silenceFrame());
    push(silenceFrame());
    await tick();

    expect(cloudStt.transcribe).toHaveBeenCalledTimes(1);
    const request = cloudStt.transcribe.mock.calls[0][1];
    expect(request.language).toBe('de');
    expect(request.model).toBe(CLOUD_MODEL);
    expect(onFinal).toHaveBeenCalledWith('Kaffee');
  });

  it('облачная модель требует ключ OpenRouter', async () => {
    cloudStt.isAvailable.mockReturnValue(false);
    service.setModel(CLOUD_MODEL);

    const { ok, onError } = await startWith();
    expect(ok).toBe(false);
    expect(onError.mock.calls[0][0].code).toBe('model');
    // Ключа нет — сеть не трогаем.
    expect(cloudStt.transcribe).not.toHaveBeenCalled();
  });

  it('не отправляет облачную фразу, короче минимальной речи', async () => {
    service.configure({ silenceMs: 64, minSpeechMs: 500, prerollMs: 0 });
    service.setModel(CLOUD_MODEL);
    const { ok } = await startWith();
    expect(ok).toBe(true);

    // Только щелчок: VAD не признаёт его речью, и облако звать нельзя.
    push(speechFrame(FRAME, 0.02));
    push(silenceFrame());
    await tick();

    expect(cloudStt.transcribe).not.toHaveBeenCalled();
  });

  it('stop() снимает облачный запрос в полёте', async () => {
    service.configure({ silenceMs: 64, minSpeechMs: 10, prerollMs: 0 });
    service.setModel(CLOUD_MODEL);
    await startWith();

    push(speechFrame());
    push(speechFrame());
    push(silenceFrame());
    push(silenceFrame());
    await tick();
    service.stop();

    expect(cloudStt.abort).toHaveBeenCalled();
  });
});
