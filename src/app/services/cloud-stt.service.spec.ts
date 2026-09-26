/**
 * @vitest-environment jsdom
 *
 * Облачное распознавание речи: проверяем контракт с OpenRouter и гигиену
 * запросов (не отправляем мусор, не шлём запросы гонкой, отменяем при abort).
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSttService, STT_URL } from './cloud-stt.service';
import { AiService } from './ai.service';

class FakeAiService {
  hasApiKey = vi.fn(() => true);
  getApiKey = vi.fn(() => 'sk-test');
}

describe('CloudSttService', () => {
  let service: CloudSttService;
  let ai: FakeAiService;
  let fetchMock: ReturnType<typeof vi.fn>;

  /** 0.5 с тишины на 16 кГц. */
  const audio = (): Float32Array => new Float32Array(8000);
  const request = { model: 'openai/whisper-large-v3-turbo', sampleRate: 16000, language: 'de' };

  beforeEach(() => {
    ai = new FakeAiService();
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: ' Kaffee ', usage: { duration: 0.5, cost: 0.00003 } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [CloudSttService, { provide: AiService, useValue: ai }],
    });
    service = TestBed.inject(CloudSttService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('шлёт JSON с чистым base64 в input_audio, а не multipart', async () => {
    await service.transcribe(audio(), request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(STT_URL);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    // Ключевой момент: у OpenRouter это JSON, а не multipart/form-data.
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBeTypeOf('string');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('openai/whisper-large-v3-turbo');
    expect(body.language).toBe('de');
    expect(body.input_audio.format).toBe('wav');
    // Чистый base64: без data:-URI префикса, иначе провайдер отвергнет файл.
    expect(body.input_audio.data).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    // Заголовок WAV (RIFF) тоже должен декодироваться — base64 не обрезан.
    expect(atob(body.input_audio.data).slice(0, 4)).toBe('RIFF');
  });

  it('возвращает текст, длительность и стоимость', async () => {
    const result = await service.transcribe(audio(), request);
    expect(result.text).toBe('Kaffee');
    expect(result.durationSeconds).toBe(0.5);
    expect(result.costUsd).toBe(0.00003);
  });

  it('не отправляет запрос, когда нет ключа OpenRouter', async () => {
    ai.hasApiKey.mockReturnValue(false);
    await expect(service.transcribe(audio(), request)).rejects.toThrow('Нет ключа');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не отправляет запрос, когда запись пустая', async () => {
    await expect(service.transcribe(new Float32Array(0), request)).rejects.toThrow('Пустая запись');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('не даёт двум запросам идти одновременно', async () => {
    let release!: (value: unknown) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.transcribe(audio(), request);
    await expect(service.transcribe(audio(), request)).rejects.toThrow('ещё выполняется');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release({ ok: true, status: 200, json: async () => ({ text: 'ok' }) });
    await first;
    // После завершения лимит снят — сервис снова принимает запросы.
    expect(service.isBusy()).toBe(false);
  });

  it('abort() обрывает запрос в полёте', async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      capturedSignal = init.signal;
      // Слушатель вешаем сразу, но abort() мог прийти до fetch — проверяем флаг.
      return new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init.signal.aborted) fail();
        else init.signal.addEventListener('abort', fail, { once: true });
      });
    });

    const pending = service.transcribe(audio(), request);
    // Ждём, пока transcribe дойдёт до fetch (кодирование base64 асинхронно).
    while (!capturedSignal) await Promise.resolve();
    service.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(capturedSignal?.aborted).toBe(true);
    // Состояние сброшено, следующий запрос пройдёт.
    expect(service.isBusy()).toBe(false);
  });

  it('внешний signal отменяет запрос, не начиная его', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.transcribe(audio(), { ...request, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'Ключ OpenRouter отклонён'],
    [402, 'кредиты'],
    [429, 'Слишком много запросов'],
    [404, 'не найдена'],
  ])('HTTP %i превращается в понятное сообщение', async (status, expected) => {
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status,
      json: async () => ({ error: { message: 'upstream said no' } }),
    }));
    await expect(service.transcribe(audio(), request)).rejects.toThrow(expected);
  });

  it('сервис освобождается после ошибки', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    await expect(service.transcribe(audio(), request)).rejects.toThrow();
    expect(service.isBusy()).toBe(false);
  });
});
