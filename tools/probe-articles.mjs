#!/usr/bin/env node
/**
 * Разовая проверка: попросить модель расставить артикли на словах с
 * заранее известным родом и сверить. Ничего не пишет — только отчёт.
 *
 * Запуск:  OR_KEY=<ключ> node tools/probe-articles.mjs
 */
const KEY = process.env.OR_KEY;
const MODEL = 'google/gemini-2.5-flash-lite';

/** Эталон: der / die / das / null (не существительное). */
const GOLD = {
  Kaffee: 'der',
  Milch: 'die',
  Wasser: 'das',
  Zucker: 'der',
  Kekse: 'die',
  Tee: 'der',
  Brot: 'das',
  Käse: 'der',
  Bruder: 'der',
  Schwester: 'die',
  Sohn: 'der',
  Tochter: 'die',
  Berlin: null,
  Anna: null,
  gehen: null,
  schön: null,
  bitte: null,
  Herr: 'der',
  Apfel: 'der',
  Banane: 'die',
  Buch: 'das',
};

const words = Object.keys(GOLD);
const prompt =
  'For each German word below, give its definite article.\n' +
  'Rules:\n' +
  '- If the word is a common noun (also plural, also a nominalised word), answer der/die/das.\n' +
  '- If it is a proper name (person, city, country), a verb, an adjective, an adverb, ' +
  'a pronoun, a preposition or a phrase, answer null.\n' +
  '- Use the nominative singular article. German gender is lexical: never guess from ' +
  'meaning or from the ending alone, recall the established gender.\n' +
  'Reply with ONLY a JSON object mapping each input word to der/die/das/null.\n\n' +
  words.map((w) => `- ${w}`).join('\n');

const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  }),
});
if (!res.ok) {
  console.error('HTTP', res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
const content = data.choices?.[0]?.message?.content ?? '';
console.log('cost USD:', data.usage?.cost);

const match = content.match(/\{[\s\S]*\}/);
if (!match) {
  console.error('Нет JSON в ответе:', content.slice(0, 400));
  process.exit(1);
}
const got = JSON.parse(match[0]);

let ok = 0;
for (const w of words) {
  const expect = GOLD[w];
  // Внимание: `??` здесь не годится — легальный null от модели он бы
  // превратил в «нет ответа». Строка "null" — тоже не то же самое, что null.
  const raw = Object.prototype.hasOwnProperty.call(got, w) ? got[w] : '(нет)';
  const pass = raw === expect;
  if (pass) ok++;
  console.log(
    `${pass ? 'ok  ' : 'FAIL'} ${w.padEnd(10)} ожидали ${JSON.stringify(expect).padEnd(6)} получили ${JSON.stringify(raw)} (${typeof raw})`,
  );
}
console.log(`\n${ok}/${words.length} верно`);
