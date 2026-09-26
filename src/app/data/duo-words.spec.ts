import { DUO_UNITS, DUO_WORDS } from './duo-words';
import { DuoWordsService, altTranslations, shuffled } from '../services/duo-words.service';

describe('duo-words data (сгенерировано из duo-words.txt)', () => {
  it('содержит большой словарь', () => {
    expect(DUO_UNITS.length).toBeGreaterThan(100);
    expect(DUO_WORDS.length).toBeGreaterThan(5000);
  });

  it('юниты идут по возрастанию с 1 и без дыр', () => {
    for (let i = 0; i < DUO_UNITS.length; i++) {
      expect(DUO_UNITS[i].order).toBe(i + 1);
    }
    expect(DUO_UNITS[0].order).toBe(1);
  });

  it('у каждого юнита есть имя и тема', () => {
    for (const u of DUO_UNITS) {
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.theme.length).toBeGreaterThan(0);
      expect(u.label).toContain(u.name);
    }
  });

  it('каждое слово корректно: непустые поля, валидный юнит, переводы', () => {
    const validUnits = new Set(DUO_UNITS.map((u) => u.order));
    for (const w of DUO_WORDS) {
      expect(w.german.length).toBeGreaterThan(0);
      expect(w.translationsRaw.length).toBeGreaterThan(0);
      expect(w.russian.length).toBeGreaterThan(0);
      expect(validUnits.has(w.unit)).toBe(true);
      expect(w.translationsRaw).toContain(w.russian);
    }
  });

  it('первый юнит — CoffeeShop, слова начинаются с базовой лексики', () => {
    expect(DUO_UNITS[0].name).toBe('CoffeeShop');
    const firstUnitWords = DUO_WORDS.filter((w) => w.unit === 1);
    expect(firstUnitWords.map((w) => w.german)).toContain('Kaffee');
  });
});

describe('duo-words: артикли (сгенерировано в duo-articles.ts)', () => {
  const valid = new Set(['der', 'die', 'das']);

  it('у каждого слова article — либо корректный артикль, либо его нет', () => {
    for (const w of DUO_WORDS) {
      if (w.article !== undefined) expect(valid.has(w.article)).toBe(true);
    }
  });

  it('артикли есть у большинства существительных', () => {
    const capitalized = DUO_WORDS.filter((w) => /^\p{Lu}/u.test(w.german));
    const withArticle = capitalized.filter((w) => w.article);
    // Не 100%: у части слов род определить не удалось (имена собственные,
    // языки, месяцы, безартиклевые массовые nouns). Но меньше половины —
    // значит, словарь развалился.
    expect(withArticle.length / capitalized.length).toBeGreaterThan(0.5);
  });

  it('нижний регистр (глаголы, прилагательные) никогда не получает артикль', () => {
    for (const w of DUO_WORDS) {
      if (!/^\p{Lu}/u.test(w.german)) expect(w.article).toBeUndefined();
    }
  });

  it('одно и то же слово всегда имеет один и тот же артикль', () => {
    const seen = new Map<string, string | undefined>();
    for (const w of DUO_WORDS) {
      const key = w.german;
      if (!seen.has(key)) seen.set(key, w.article);
      else expect(w.article).toBe(seen.get(key));
    }
  });

  it('известные слова имеют ожидаемый артикль', () => {
    // Род здесь лексический: его нельзя вывести из слова, значения зафиксированы.
    const expected: Record<string, string> = {
      Kaffee: 'der',
      Milch: 'die',
      Wasser: 'das',
      Brot: 'das',
      Käse: 'der',
      Kekse: 'die',
    };
    for (const [german, article] of Object.entries(expected)) {
      const word = DUO_WORDS.find((w) => w.german === german);
      expect(word?.article, german).toBe(article);
    }
  });

  it('имена собственные остаются без артикля', () => {
    for (const name of ['Berlin', 'Anna', 'Paris']) {
      expect(DUO_WORDS.find((w) => w.german === name)?.article).toBeUndefined();
    }
  });
});

describe('DuoWordsService', () => {
  const service = new DuoWordsService();

  it('poolUpTo(1) возвращает только слова первого юнита', () => {
    const pool = service.poolUpTo(1);
    expect(pool.length).toBeGreaterThan(0);
    for (const w of pool) {
      expect(w.unit).toBe(1);
    }
  });

  it('poolUpTo дедуплицирует слова по немецкому написанию', () => {
    const pool = service.poolUpTo(service.maxUnit);
    const seen = new Set<string>();
    for (const w of pool) {
      const key = w.german.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('poolUpTo монотонен: пул большего юнита включает пул меньшего', () => {
    const small = service.poolUpTo(5);
    const big = service.poolUpTo(10);
    expect(big.length).toBeGreaterThanOrEqual(small.length);
    for (const w of small) {
      expect(big.some((x) => x.german === w.german)).toBe(true);
    }
  });

  it('buildDeck отдаёт не больше size слов и перемешивает', () => {
    const deck = service.buildDeck(3, 10, 42);
    expect(deck.length).toBe(10);
    const pool = service.poolUpTo(3);
    // С фиксированным seed — детерминированный порядок
    const deckAgain = service.buildDeck(3, 10, 42);
    expect(deck.map((w) => w.german)).toEqual(deckAgain.map((w) => w.german));
    // И это перестановка пула
    expect(deck.every((w) => pool.some((p) => p.german === w.german))).toBe(true);
  });

  it('shuffled сохраняет все элементы', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(arr, 7);
    expect(out.slice().sort((a, b) => a - b)).toEqual(arr);
  });
});

describe('altTranslations (дополнительные переводы карточки)', () => {
  const word = (russian: string, translationsRaw: string) => ({
    german: 'Test',
    russian,
    translationsRaw,
    unit: 1,
  });

  it('отдаёт всё, кроме основного перевода', () => {
    expect(altTranslations(word('кофе', 'кофе, кофейный напиток'))).toEqual(['кофейный напиток']);
  });

  it('убирает дубликаты (без учёта регистра) и пустые значения', () => {
    expect(altTranslations(word('печенье', 'печенье, Печенье, печеньями, , печеньями '))).toEqual([
      'печеньями',
    ]);
  });

  it('без дополнительных переводов возвращает пустой массив', () => {
    expect(altTranslations(word('хлеб', 'хлеб'))).toEqual([]);
  });

  it('для всех слов словаря количество альтернатив согласовано с источником', () => {
    for (const w of DUO_WORDS) {
      const alts = altTranslations(w);
      // Основной перевод не попадает в альтернативы
      expect(alts.some((a) => a.toLowerCase() === w.russian.toLowerCase())).toBe(false);
      // Каждая альтернатива присутствует в исходной строке переводов
      for (const alt of alts) {
        expect(w.translationsRaw).toContain(alt);
      }
    }
  });
});
