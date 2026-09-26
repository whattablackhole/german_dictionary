// Разовая проверка качества: сверяем артикли со словами с известным родом.
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/data/duo-articles.ts', 'utf8');
const map = {};
const re = /^\s*'((?:[^'\\]|\\.)*)':\s*(null|'der'|'die'|'das'),?\s*$/gm;
let m;
while ((m = re.exec(src)) !== null) {
  map[m[1].replace(/\\'/g, "'")] = m[2] === 'null' ? null : m[2].slice(1, -1);
}
console.log('parsed entries:', Object.keys(map).length);

const CHECK = {
  Kaffee: 'der',
  Milch: 'die',
  Wasser: 'das',
  Tee: 'der',
  Zucker: 'der',
  Brot: 'das',
  Käse: 'der',
  Apfel: 'der',
  Banane: 'die',
  Buch: 'das',
  Bruder: 'der',
  Schwester: 'die',
  Sohn: 'der',
  Tochter: 'die',
  Freund: 'der',
  Freundin: 'die',
  Hund: 'der',
  Katze: 'die',
  Auto: 'das',
  Fahrrad: 'das',
  Tür: 'die',
  Stadt: 'die',
  Land: 'das',
  Haus: 'das',
  Baum: 'der',
  Blume: 'die',
  Wolke: 'die',
  Sonne: 'die',
  Mond: 'der',
  Zeitung: 'die',
  Schlüssel: 'der',
  Computer: 'der',
  Berlin: null,
  Anna: null,
  Paris: null,
  London: null,
  David: null,
};

let ok = 0;
const bad = [];
for (const [w, want] of Object.entries(CHECK)) {
  const got = map[w];
  if (got === want) ok++;
  else bad.push(`  ${w}: получили ${got}, ожидали ${want}`);
}
console.log(`spot check ${ok}/${Object.keys(CHECK).length}`);
if (bad.length) console.log('MISMATCHES:\n' + bad.join('\n'));

// Грубая проверка распределения — помогает заметить системную ошибку.
const counts = { der: 0, die: 0, das: 0, null: 0 };
for (const v of Object.values(map)) counts[v === null ? 'null' : v]++;
console.log('distribution:', counts);
