/**
 * @vitest-environment jsdom
 *
 * Упаковка Float32-PCM в WAV: от неё зависит и облачное распознавание, и
 * часть TTS-моделей, поэтому заголовок проверяем побайтово.
 */
import { describe, expect, it } from 'vitest';
import { blobToBase64, encodePcmToWav } from './audio';

const tag = (view: DataView, offset: number) =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

describe('encodePcmToWav', () => {
  it('собирает корректный RIFF/WAVE-заголовок для 16-битного моно', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodePcmToWav(samples, 16000);
    expect(blob.type).toBe('audio/wav');

    const view = new DataView(await blob.arrayBuffer());
    expect(tag(view, 0)).toBe('RIFF');
    expect(tag(view, 8)).toBe('WAVE');
    expect(tag(view, 12)).toBe('fmt ');
    expect(tag(view, 36)).toBe('data');
    // Формат 1 (PCM), моно, 16 кГц, 16 бит.
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    // Размер data = сэмплы × 2 байта, и он совпадает с реальной длиной файла.
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(blob.size).toBe(44 + samples.length * 2);
  });

  it('клиппит значения за пределами [-1..1] и не переполняет int16', async () => {
    const view = new DataView(await encodePcmToWav(new Float32Array([2, -2]), 16000).arrayBuffer());
    // +1.0 → 32767 и -1.0 → -32767 (не 32768, иначе int16 переполняется).
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
  });

  it('пустой буфер даёт корректный WAV без данных', async () => {
    const blob = encodePcmToWav(new Float32Array(0), 16000);
    expect(blob.size).toBe(44);
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getUint32(40, true)).toBe(0);
  });
});

describe('blobToBase64', () => {
  it('кодирует байты в чистый base64 без data:-URI префикса', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 253, 254, 255])]);
    const base64 = await blobToBase64(blob);
    expect(base64).toBe('AAEC/f7/');
    expect(base64).not.toContain('data:');
  });

  it('переживает буфер больше порога chunk в 0x8000', async () => {
    // fromCharCode(...bytes) падает на ~65k аргументов — проверяем чанкинг.
    const size = 0x8000 * 2 + 5;
    const bytes = new Uint8Array(size).map((_, i) => i % 256);
    const base64 = await blobToBase64(new Blob([bytes]));
    expect(base64.length).toBe(Math.ceil(size / 3) * 4);
    // Первые байты должны совпасть с прямой кодировкой.
    expect(base64.slice(0, 4)).toBe(btoa(String.fromCharCode(0, 1, 2)));
  });
});
