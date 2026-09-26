/**
 * Звуковые утилиты для браузера.
 *
 * Вынесены отдельно от сервисов, чтобы их можно было покрыть тестами:
 * конвертация PCM → WAV нужна и облачному распознаванию речи, и TTS-моделям,
 * которые отдают «сырой» PCM без заголовка.
 */

/** Заголовок WAV для несжатого PCM. */
const WAV_HEADER_BYTES = 44;

/** Ограничение Float32 [-1..1] перед преобразованием в 16 бит. */
function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    // 32767 (не 32768) — иначе значение +1.0 переполняет знаковый int16.
    out[i] = Math.round(value * 32767);
  }
  return out;
}

/**
 * Заворачивает Float32-PCM в WAV-контейнер (16 бит, моно).
 *
 * Почему WAV, а не MP3: несжатый — самый качественный вариант для
 * распознавания, а кодировать MP3 в браузере всё равно нечем.
 */
export function encodePcmToWav(samples: Float32Array, sampleRate: number, channels = 1): Blob {
  const pcm = toInt16(samples);
  const dataBytes = pcm.byteLength;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // размер fmt-чанка
  view.setUint16(20, 1, true); // формат PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);

  new Int16Array(buffer, WAV_HEADER_BYTES).set(pcm);
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Байты Blob в base64 — без переполнения стека на больших массивах. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Порциями по 0x8000: fromCharCode(...big) падает на ~65k аргументов.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
