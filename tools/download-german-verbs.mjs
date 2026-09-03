#!/usr/bin/env node
/**
 * download-german-verbs.mjs
 *
 * One-off build tool that produces `src/app/data/german-verbs.ts` - a list of
 * ~2000 German verb infinitives (with and without prefixes).
 *
 * Sources (all public, free to reuse):
 *  - Word frequency ranking  : hermitdave/FrequencyWords `de_50k.txt`
 *                              (https://github.com/hermitdave/FrequencyWords),
 *                              content licensed CC BY-SA 4.0, code MIT.
 *  - Verb whitelist          : German Wiktionary category "Verb (Deutsch)"
 *                              (all German verb lemmas).
 *  - Separable-verb flag     : German Wiktionary category
 *                              "Verb trennbar (Deutsch)".
 *  - Curated data            : the app's existing src/app/data/separable-verbs.ts
 *                              (merged, their translations are kept).
 *
 * Strategy:
 *  1. Take every word from the frequency list.
 *  2. Keep only words that are verb lemmas in Wiktionary ("Verb (Deutsch)").
 *  3. Rank by frequency, take the top ~2000, reserving guaranteed slots for
 *     prefixed verbs so both plain and prefix verbs are well represented.
 *  4. Always append a small curated list of essential verbs plus the existing
 *     SEPARABLE_VERBS so the most important verbs can never be missing.
 *  5. For every entry, detect the prefix (only when the remaining stem is a
 *     known verb lemma) and mark trennbar/untrennbar.
 *
 * Run: `node tools/download-german-verbs.mjs`
 * (downloads are cached under tools/.cache; delete it to re-fetch).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(__dirname, '.cache');
const DATA_DIR = join(ROOT, 'src', 'app', 'data');

const LIST_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt';
const LIST_FILE = join(CACHE_DIR, 'de_50k.txt');
const WIKT_CACHE_FILE = join(CACHE_DIR, 'wiktionary-verbs.json');
const OUT_FILE = join(DATA_DIR, 'german-verbs.ts');
const SEPARABLE_FILE = join(DATA_DIR, 'separable-verbs.ts');

const WIKT_API = 'https://de.wiktionary.org/w/api.php';
const CAT_VERBS = 'Kategorie:Verb (Deutsch)';
const CAT_TRENNBAR = 'Kategorie:Verb trennbar (Deutsch)';

/** How many verbs to generate (>= this). */
const VERB_TARGET = 3914;
/** Reserved slots for prefixed verbs so they are never crowded out. */
const PREFIXED_CAP = 2500;
/** Be polite to the public MediaWiki API. */
const WIKT_THROTTLE_MS = 1200;

/**
 * German verbal prefixes (longest first so e.g. "zurück-" wins over "zu-").
 * `separable` is the mapping for the plain prefix. Ambiguous prefixes
 * (über-, unter-, um-, durch-, wider-, wieder-, hinter-) default to
 * non-separable; the Wiktionary "Verb trennbar (Deutsch)" category overrides
 * the flag per verb when it is known.
 */
const PREFIX_TABLE = [
  { prefix: 'zurück', separable: true },
  { prefix: 'zusammen', separable: true },
  { prefix: 'wieder', separable: false },
  { prefix: 'vorbei', separable: true },
  { prefix: 'weiter', separable: true },
  { prefix: 'hinter', separable: false },
  { prefix: 'wider', separable: false },
  { prefix: 'teil', separable: true },
  { prefix: 'statt', separable: true },
  { prefix: 'fest', separable: true },
  { prefix: 'durch', separable: false },
  { prefix: 'unter', separable: false },
  { prefix: 'über', separable: false },
  { prefix: 'miss', separable: false },
  { prefix: 'fehl', separable: false },
  { prefix: 'los', separable: true },
  { prefix: 'weg', separable: true },
  { prefix: 'her', separable: true },
  { prefix: 'hin', separable: true },
  { prefix: 'vor', separable: true },
  { prefix: 'auf', separable: true },
  { prefix: 'aus', separable: true },
  { prefix: 'ein', separable: true },
  { prefix: 'mit', separable: true },
  { prefix: 'nach', separable: true },
  { prefix: 'be', separable: false },
  { prefix: 'bei', separable: true },
  { prefix: 'ent', separable: false },
  { prefix: 'er', separable: false },
  { prefix: 'ge', separable: false },
  { prefix: 'ver', separable: false },
  { prefix: 'zer', separable: false },
  { prefix: 'um', separable: false },
  { prefix: 'zu', separable: true },
  { prefix: 'ab', separable: true },
  { prefix: 'an', separable: true },
];

/**
 * A hand-picked set of the most essential everyday German verbs. These are
 * forced in so a beginner always has the core vocabulary, even if the
 * frequency list only contains their conjugated forms.
 */
const ESSENTIAL_VERBS = [
  'sein', 'haben', 'werden', 'können', 'müssen', 'wollen', 'dürfen', 'sollen', 'mögen',
  'lassen', 'machen', 'tun', 'gehen', 'kommen', 'sehen', 'wissen', 'sagen', 'sprechen',
  'reden', 'erzählen', 'fragen', 'antworten', 'hören', 'zuhören', 'lesen', 'schreiben',
  'lernen', 'verstehen', 'studieren', 'arbeiten', 'wohnen', 'leben', 'spielen', 'essen',
  'trinken', 'schlafen', 'aufstehen', 'laufen', 'springen', 'schwimmen', 'fahren',
  'fliegen', 'reisen', 'ankommen', 'abfahren', 'nehmen', 'bringen', 'holen', 'geben',
  'bekommen', 'erhalten', 'kaufen', 'verkaufen', 'bezahlen', 'zahlen', 'kosten',
  'verdienen', 'gewinnen', 'verlieren', 'finden', 'suchen', 'treffen', 'besuchen',
  'einladen', 'lieben', 'hassen', 'wünschen', 'hoffen', 'glauben', 'denken', 'kennen',
  'erkennen', 'erinnern', 'vergessen', 'zeigen', 'erklären', 'beschreiben', 'meinen',
  'bedeuten', 'brauchen', 'benutzen', 'nutzen', 'verwenden', 'öffnen', 'schließen',
  'beginnen', 'starten', 'enden', 'beenden', 'aufhören', 'warten', 'bleiben', 'stehen',
  'sitzen', 'liegen', 'legen', 'stellen', 'setzen', 'fangen', 'anfangen', 'entscheiden',
  'wählen', 'auswählen', 'vergleichen', 'prüfen', 'testen', 'versuchen', 'schaffen',
  'erreichen', 'führen', 'leiten', 'folgen', 'helfen', 'retten', 'schützen', 'kämpfen',
  'ziehen', 'bewegen', 'schicken', 'senden', 'empfangen', 'tragen', 'wachsen',
  'blühen', 'scheinen', 'regnen', 'schneien', 'gefallen', 'schmecken', 'fühlen',
  'merken', 'bemerken', 'planen', 'bauen', 'reparieren', 'kochen', 'backen',
  'waschen', 'putzen', 'räumen', 'aufräumen', 'sparen', 'leihen', 'schenken',
  'danken', 'grüßen', 'lachen', 'lächeln', 'weinen', 'schreien', 'flüstern',
  'vorstellen', 'mitbringen', 'mitnehmen', 'zurückkehren', 'zusammenarbeiten',
];

/** Sort a copy of the prefix table with the longest prefixes first. */
function sortedPrefixTable() {
  return [...PREFIX_TABLE].sort((a, b) => b.prefix.length - a.prefix.length);
}

const PREFIXES_LONGEST_FIRST = sortedPrefixTable();

/**
 * Function-word homographs that are not meaningful verbs for learners. These
 * pass the Wiktionary "Verb (Deutsch)" whitelist (e.g. the archaic verb
 * "einen" = "to unite") but their frequency ranking actually comes from a
 * common closed-class word ("einen" is the accusative article), which makes
 * them confusing catalog entries.
 */
const FUNCTION_WORD_HOMOGRAPHS = new Set([
  'einen',
  'einer',
  'einem',
  'eines',
  'eine',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url, dest) {
  if (existsSync(dest)) {
    console.log(`Using cached ${dest}`);
    return;
  }
  console.log(`Downloading ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'german-dictionary-data-tool/1.0 (learning app)' },
  });
  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status}): ${url}`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, await res.text(), 'utf8');
  console.log(`Saved ${dest}`);
}

/**
 * Fetches every page title of a Wiktionary category (paginated, polite).
 * Retries rate-limited or server-error pages with an increasing backoff.
 */
async function fetchCategoryMembers(title) {
  const members = [];
  let gcmcontinue = null;
  let pageNo = 0;
  const maxRetries = 6;
  do {
    pageNo += 1;
    const params = new URLSearchParams({
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: title,
      gcmlimit: '500',
      gcmtype: 'page',
      prop: 'info',
      format: 'json',
      formatversion: '2',
    });
    if (gcmcontinue) params.set('gcmcontinue', gcmcontinue);
    const url = `${WIKT_API}?${params.toString()}`;

    let res;
    let attempt = 0;
    for (;;) {
      res = await fetch(url, {
        headers: { 'User-Agent': 'german-dictionary-data-tool/1.0 (learning app)' },
      });
      if (res.ok) break;
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          attempt += 1;
          const waitMs = 20000 + attempt * 20000;
          console.log(
            `  rate limited (HTTP ${res.status}), retry ${attempt}/${maxRetries} in ${waitMs}ms...`
          );
          await sleep(waitMs);
          continue;
        }
      }
      throw new Error(`Wiktionary request failed (HTTP ${res.status})`);
    }

    const data = await res.json();
    for (const page of data?.query?.pages ?? []) {
      if (page && typeof page.title === 'string') members.push(page.title);
    }
    gcmcontinue = data?.continue?.gcmcontinue ?? null;
    console.log(`  ${title}: page ${pageNo}, ${members.length} members so far`);
    if (gcmcontinue) await sleep(WIKT_THROTTLE_MS);
  } while (gcmcontinue);
  return members;
}

/** Parse the manual SEPARABLE_VERBS file into verb/prefix/translation entries. */
function parseSeparableVerbs(source) {
  const entries = [];
  const re =
    /infinitive:\s*'([^']+)',\s*prefix:\s*'([^']+)',\s*translationEn:\s*'([^']*)',\s*translationRu:\s*'([^']*)'/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    entries.push({
      infinitive: match[1],
      prefix: match[2],
      translationEn: match[3],
      translationRu: match[4],
    });
  }
  return entries;
}

function isInfinitiveShape(word) {
  if (!/^[a-zäöüß]{3,}$/.test(word)) return false;
  if (/(en|eln|ern)$/.test(word)) return true;
  // Non-standard infinitives that still count as verbs (sein, tun).
  return word === 'sein' || word === 'tun';
}

/** Global set of verb lemmas from Wiktionary; filled by main(). */
let VERB_WIKT_SET = new Set();

function verbWiktHas(stem) {
  return VERB_WIKT_SET.has(stem);
}

/**
 * Detects a prefix for an infinitive. A prefix only counts when the remaining
 * stem is itself a known Wiktionary verb lemma ("verstehen" -> "stehen"),
 * which keeps false positives like "gehen" from matching "ge-".
 */
function analyzePrefix(infinitive, trennbarSet) {
  for (const { prefix, separable } of PREFIXES_LONGEST_FIRST) {
    if (!infinitive.startsWith(prefix)) continue;
    const stem = infinitive.slice(prefix.length);
    if (stem.length < 3) continue;
    if (!verbWiktHas(stem)) continue;
    return { prefix, separable: trennbarSet.has(infinitive) ? true : separable };
  }
  return { prefix: undefined, separable: undefined };
}

const Q = String.fromCharCode(39); // '
const BS = String.fromCharCode(92); // backslash

function tsString(value) {
  return `${Q}${value.replace(/['\\]/g, (ch) => (ch === Q ? BS + Q : BS + BS))}${Q}`;
}

function emitEntry(entry, curatedTranslations) {
  const fields = [
    `infinitive: ${tsString(entry.infinitive)}`,
    `frequencyRank: ${entry.frequencyRank}`,
  ];
  if (entry.prefix) fields.push(`prefix: ${tsString(entry.prefix)}`);
  if (entry.separable === true) fields.push('separable: true');
  if (entry.separable === false && entry.prefix) fields.push('separable: false');
  const curated = curatedTranslations.get(entry.infinitive);
  if (curated) {
    if (curated.translationRu) fields.push(`translationRu: ${tsString(curated.translationRu)}`);
    if (curated.translationEn) fields.push(`translationEn: ${tsString(curated.translationEn)}`);
  }
  return `  { ${fields.join(', ')} },`;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  // 1. Frequency list (cached).
  await download(LIST_URL, LIST_FILE);
  const listText = await readFile(LIST_FILE, 'utf8');
  const rankOf = new Map();
  for (const line of listText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [word] = trimmed.split(/\s+/);
    if (!word || rankOf.has(word)) continue;
    rankOf.set(word, rankOf.size + 1);
  }
  console.log(`Frequency list: ${rankOf.size} unique tokens`);

  // 2. Wiktionary verb whitelists (cached).
  let wiktCache = null;
  if (existsSync(WIKT_CACHE_FILE)) {
    try {
      wiktCache = JSON.parse(await readFile(WIKT_CACHE_FILE, 'utf8'));
      console.log('Using cached Wiktionary verb lists');
    } catch {
      wiktCache = null;
    }
  }
  if (!wiktCache) {
    const verbs = await fetchCategoryMembers(CAT_VERBS);
    const trennbar = await fetchCategoryMembers(CAT_TRENNBAR);
    wiktCache = { verbs, trennbar, fetchedAt: new Date().toISOString() };
    await writeFile(WIKT_CACHE_FILE, JSON.stringify(wiktCache, null, 2), 'utf8');
  }
  const verbWikt = wiktCache.verbs;
  const trennbarWikt = wiktCache.trennbar;
  VERB_WIKT_SET = new Set(verbWikt.filter(isInfinitiveShape));
  const trennbarSet = new Set(trennbarWikt);
  console.log(`Wiktionary verb lemmas: ${verbWikt.length}; trennbar: ${trennbarWikt.length}`);

  // 3. Curated separable verbs from the app.
  const sepSource = await readFile(SEPARABLE_FILE, 'utf8');
  const curatedSeparable = parseSeparableVerbs(sepSource);
  console.log(`Curated separable verbs from app: ${curatedSeparable.length}`);

  // 4. Build the candidate list from the frequency list, filtered by Wiktionary.
  const candidates = [];
  for (const [word, rank] of rankOf) {
    if (!VERB_WIKT_SET.has(word)) continue;
    if (FUNCTION_WORD_HOMOGRAPHS.has(word)) continue;
    const { prefix, separable } = analyzePrefix(word, trennbarSet);
    candidates.push({ infinitive: word, frequencyRank: rank, prefix, separable });
  }
  candidates.sort((a, b) => a.frequencyRank - b.frequencyRank);
  console.log(`Verb candidates from frequency list: ${candidates.length}`);

  // 5. Select top verbs, reserving slots for prefixed ones.
  const plainSelected = [];
  const prefixedSelected = [];
  const plainCap = VERB_TARGET - PREFIXED_CAP;
  for (const c of candidates) {
    if (c.prefix) {
      if (prefixedSelected.length < PREFIXED_CAP) prefixedSelected.push(c);
    } else if (plainSelected.length < plainCap) {
      plainSelected.push(c);
    }
  }
  // If prefixed verbs were scarce, use the freed slots for plain verbs.
  const missingPrefixed = PREFIXED_CAP - prefixedSelected.length;
  if (missingPrefixed > 0) {
    let added = 0;
    for (const c of candidates) {
      if (c.prefix || plainSelected.includes(c)) continue;
      plainSelected.push(c);
      added += 1;
      if (added >= missingPrefixed) break;
    }
  }
  const selected = [];
  const seen = new Set();
  for (const c of [...plainSelected, ...prefixedSelected]) {
    if (seen.has(c.infinitive)) continue;
    seen.add(c.infinitive);
    selected.push(c);
  }
  console.log(`Selected by frequency: ${selected.length} (${prefixedSelected.length} prefixed)`);

  // 6. Force-include essential verbs and curated separable verbs.
  const curatedTranslationMap = new Map();
  for (const c of curatedSeparable) {
    curatedTranslationMap.set(c.infinitive, {
      translationRu: c.translationRu,
      translationEn: c.translationEn,
    });
  }
  const forceIn = (infinitive, extras = {}) => {
    if (seen.has(infinitive)) return;
    if (FUNCTION_WORD_HOMOGRAPHS.has(infinitive)) return;
    if (!verbWikt.includes(infinitive)) return; // must be a real Wiktionary lemma
    seen.add(infinitive);
    const analysis = analyzePrefix(infinitive, trennbarSet);
    const rank = rankOf.get(infinitive) ?? 2000000 + seen.size;
    selected.push({
      infinitive,
      frequencyRank: rank,
      prefix: analysis.prefix ?? extras.prefix,
      separable:
        extras.separable ?? (trennbarSet.has(infinitive) ? true : analysis.separable),
    });
  };
  for (const v of ESSENTIAL_VERBS) forceIn(v);
  for (const c of curatedSeparable) forceIn(c.infinitive, { prefix: c.prefix });

  // Deduplicate and sort: by frequency rank, then alphabetically.
  const byInfinitive = new Map();
  for (const c of selected) {
    const prev = byInfinitive.get(c.infinitive);
    if (!prev || c.frequencyRank < prev.frequencyRank) byInfinitive.set(c.infinitive, c);
  }
  const finalList = [...byInfinitive.values()].sort(
    (a, b) => a.frequencyRank - b.frequencyRank || a.infinitive.localeCompare(b.infinitive, 'de')
  );

  const stats = {
    total: finalList.length,
    prefixed: finalList.filter((c) => c.prefix).length,
    separable: finalList.filter((c) => c.separable === true).length,
  };
  console.log('Stats:', stats);

  // 7. Emit the TS data module.
  const parts = [];
  parts.push(`// GENERATED FILE - run \`node tools/download-german-verbs.mjs\` to regenerate.
//
// ${stats.total} German verb infinitives (with and without prefixes) ranked by
// frequency. Sources:
//  - hermitdave/FrequencyWords "de_50k.txt" (OpenSubtitles 2018 corpus token
//    frequency; content CC BY-SA 4.0, repository MIT)
//  - de.wiktionary.org categories "Verb (Deutsch)" / "Verb trennbar (Deutsch)"
//    (CC BY-SA 4.0)
//  - the app's own curated src/app/data/separable-verbs.ts (translations kept)
//
// "frequencyRank" = position in the German frequency list (1 = most frequent).
// "prefix"        = detected verbal prefix (trennbar/untrennbar) when the
//                    remaining stem is itself a known verb lemma.
// "separable"     = true when trennbar, false when untrennbar (only for
//                    prefixed verbs).`);
  parts.push(`

export interface GermanVerbEntry {
  /** The German infinitive (lemma), e.g. "anrufen". */
  infinitive: string;
  /** Rank in the German frequency list (1 = most common). */
  frequencyRank: number;
  /** Detected verbal prefix, e.g. "an" or "ver", when applicable. */
  prefix?: string;
  /** true = trennbar, false = untrennbar (only set when a prefix exists). */
  separable?: boolean;
  /** Russian translation - present only for curated separable verbs. */
  translationRu?: string;
  /** English translation - present only for curated separable verbs. */
  translationEn?: string;
}

/**
 * All known verbal prefixes with an approximate trennbar/untrennbar default.
 * Ambiguous prefixes (über-, unter-, um-, durch-, wider-, wieder-, hinter-)
 * default to non-separable; the per-verb "separable" flag is authoritative
 * when present.
 */
export const GERMAN_PREFIX_GROUPS: { prefix: string; separable: boolean }[] = [`);
  for (const { prefix, separable } of PREFIX_TABLE) {
    parts.push(`  { prefix: ${tsString(prefix)}, separable: ${separable} },`);
  }
  parts.push(`];

/**
 * The verb list, sorted by frequencyRank ascending (most frequent first).
 */
export const GERMAN_VERBS: GermanVerbEntry[] = [
`);
  for (const entry of finalList) {
    parts.push(emitEntry(entry, curatedTranslationMap));
  }
  parts.push(`];

/**
 * Returns the first matching verbal prefix for an infinitive (longest match
 * wins, e.g. "zurück-" over "zu-"). Returns undefined when the word does not
 * start with a known prefix.
 */
export function extractPrefix(infinitive: string): string | undefined {
  const lower = infinitive.toLowerCase();
  for (const { prefix } of GERMAN_PREFIX_GROUPS) {
    if (!lower.startsWith(prefix)) continue;
    const stem = lower.slice(prefix.length);
    if (stem.length < 4) continue;
    if (!/(en|eln|ern)$/.test(stem)) continue;
    return prefix;
  }
  return undefined;
}

/**
 * Whether a prefix is (typically) separable/trennbar.
 */
export function isSeparablePrefix(prefix: string): boolean {
  return GERMAN_PREFIX_GROUPS.some((g) => g.prefix === prefix && g.separable);
}
`);

  await writeFile(OUT_FILE, parts.join('\n'), 'utf8');
  console.log(`Wrote ${OUT_FILE} (${stats.total} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

