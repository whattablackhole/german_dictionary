/**
 * Облачное распознавание речи через OpenRouter.
 *
 * Формат у OpenRouter НЕ такой, как у OpenAI: это не multipart, а обычный
 * JSON, где аудио лежит в `input_audio.data` как **чистый** base64
 * (без префикса `data:audio/wav;base64,` — иначе провайдер отвергнет файл).
 *
 * Про экономию запросов и приватность:
 *  - сюда попадает ТОЛЬКО уже нарезанная VAD фраза (тишина и щелчки
 *    отсекаются в WhisperService до вызова — см. `finishUtterance`);
 *  - запрос не отправляется, если фраза короче `minSpeechMs`;
 *  - одновременно живёт только один запрос: `busy` держит следующий вызов;
 *  - `abort()` снимает полёт запроса при смене карточки или выходе из сессии;
 *  - ошибки и отмены НЕ считаются «речью» — ретрай делает вызывающий код.
 */
import { Injectable, inject } from '@angular/core';
import { AiService } from './ai.service';
import { blobToBase64, encodePcmToWav } from '../utils/audio';

/** Speech-to-Text endpoint OpenRouter. */
export const STT_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';

export interface SttRequest {
  /** id модели OpenRouter, например `openai/whisper-large-v3-turbo`. */
  model: string;
  /** Частота дискретизации сэмплов в `audio` (для корректного заголовка WAV). */
  sampleRate: number;
  /** ISO-639-1 код: `de`. Без него провайдер угадывает язык — медленнее и хуже. */
  language: string;
  /** Отменяет запрос, если карточка сменилась раньше ответа. */
  signal?: AbortSignal;
}

export interface SttResult {
  text: string;
  /** Секунды аудио по ответу провайдера — для статистики и дебага. */
  durationSeconds?: number;
  /** Стоимость запроса в USD, если провайдер её вернул. */
  costUsd?: number;
}

@Injectable({ providedIn: 'root' })
export class CloudSttService {
  private readonly ai = inject(AiService);
  private controller: AbortController | null = null;
  private busy = false;

  /** Есть ли ключ OpenRouter — без него облако недоступно. */
  isAvailable(): boolean {
    return this.ai.hasApiKey();
  }

  /** Идёт ли сейчас запрос (UI может показать «распознаём в облаке»). */
  isBusy(): boolean {
    return this.busy;
  }

  /** Отменить текущий запрос, если он ещё в полёте. */
  abort(): void {
    // Контроллер НЕ обнуляем здесь: им пользуется finally текущего запроса.
    // Обнулив сейчас, мы оставили бы busy=true без возможности отменить.
    this.controller?.abort();
  }

  async transcribe(audio: Float32Array, request: SttRequest): Promise<SttResult> {
    if (this.busy) throw new Error('Предыдущий запрос распознавания ещё выполняется.');
    if (!this.isAvailable()) throw new Error('Нет ключа OpenRouter.');
    if (audio.length === 0) throw new Error('Пустая запись.');
    if (request.signal?.aborted) throw new DOMException('Отменено', 'AbortError');

    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    request.signal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      // WAV 16 бит моно — лучший формат для распознавания, и base64 короче
      // сжатого без потери качества на коротких фразах.
      const blob = encodePcmToWav(audio, request.sampleRate);
      const data = await blobToBase64(blob);

      const response = await fetch(STT_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.ai.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          input_audio: { data, format: 'wav' },
          language: request.language,
          temperature: 0,
        }),
      });

      if (!response.ok) throw new Error(await this.describeError(response));
      const json = (await response.json()) as {
        text?: string;
        duration?: number;
        usage?: { duration?: number; cost?: number };
      };
      return {
        text: (json.text ?? '').trim(),
        durationSeconds: json.duration ?? json.usage?.duration,
        costUsd: json.usage?.cost,
      };
    } finally {
      // Сбрасываем состояние только если контроллер всё ещё наш: иначе
      // опоздавший finally отменённого запроса снял бы флаг у нового.
      if (this.controller === controller) {
        this.busy = false;
        this.controller = null;
      }
    }
  }

  /** Понятная причина вместо голого HTTP-кода. */
  private async describeError(response: Response): Promise<string> {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch {
      // Тела может не быть — останется только код.
    }
    switch (response.status) {
      case 401:
        return 'Ключ OpenRouter отклонён.';
      case 402:
        return 'На балансе OpenRouter закончились кредиты.';
      case 429:
        return 'Слишком много запросов к распознаванию. Подождите немного.';
      case 404:
        return `Модель распознавания не найдена на OpenRouter (HTTP 404).${detail ? ` ${detail}` : ''}`;
      default:
        return `Распознавание не удалось (HTTP ${response.status}).${detail ? ` ${detail}` : ''}`;
    }
  }
}
