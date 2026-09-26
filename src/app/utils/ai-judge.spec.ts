import {
  DECISIONS_URL,
  JUDGE_INSTRUCTIONS,
  JUDGE_MODEL,
  JUDGE_MODEL_PINNED,
  buildDecisionsPayload,
  contentWords,
  editDistance,
  judgeLocally,
  mentionsAnyArticle,
  mentionsArticle,
  normalizeGerman,
  parseDecisionsResponse,
  recognitionTolerance,
  soundsLike,
} from './ai-judge';

describe('ai-judge (Decisions API)', () => {
  it('РєРѕРЅСЃС‚Р°РЅС‚С‹: decisions endpoint Рё РјРѕРґРµР»Рё Jev', () => {
    expect(DECISIONS_URL).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(JUDGE_MODEL).toBe('~typesafe/jev-latest');
    expect(JUDGE_MODEL_PINNED).toBe('typesafe/jev-1.13');
  });

  it('buildDecisionsPayload СЃРѕР±РёСЂР°РµС‚ question=choice Рё state СЃ РєРѕРЅС‚РµРєСЃС‚РѕРј', () => {
    const payload = buildDecisionsPayload({
      russian: 'РєРѕС„Рµ',
      translationsRaw: 'РєРѕС„Рµ',
      expectedGerman: 'Kaffee',
      spokenText: 'der Kaffee',
    });

    expect(payload.model).toBe(JUDGE_MODEL);
    expect(payload.questions['verdict'].type).toBe('choice');
    expect(Object.keys(payload.questions['verdict'].criteria!)).toEqual(['correct', 'incorrect']);
    expect(payload.questions['verdict'].instructions).toContain('synonyms');
    expect(payload.questions['verdict'].instructions).toContain('polysemous');
    expect(payload.state).toMatchObject({
      russian: 'РєРѕС„Рµ',
      expected_german: 'Kaffee',
      spoken: 'der Kaffee',
    });
  });

  it('РёРЅСЃС‚СЂСѓРєС†РёРё С‚РµСЂРїСЏС‚ Р°СЂС‚РµС„Р°РєС‚С‹ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ Рё РѕС‚РІРµСЂРіР°СЋС‚ С‡СѓР¶РёРµ СЃР»РѕРІР°', () => {
    const payload = buildDecisionsPayload({
      russian: 'РєРѕС„Рµ',
      translationsRaw: 'РєРѕС„Рµ',
      expectedGerman: 'Kaffee',
      spokenText: 'Kekse',
    });
    expect(payload.questions['verdict'].instructions).toContain('speech-recognition artifacts');
    expect(payload.questions['verdict'].instructions).toContain('Reject unrelated');
  });

  describe('parseDecisionsResponse', () => {
    it('choice=correct в†’ РІРµСЂРЅС‹Р№ РІРµСЂРґРёРєС‚ СЃ СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊСЋ', () => {
      const v = parseDecisionsResponse({
        answers: {
          verdict: {
            type: 'choice',
            choice: 'correct',
            confidence: 0.87,
            probabilities: { correct: 0.87, incorrect: 0.13 },
          },
        },
      });
      expect(v.correct).toBe(true);
      expect(v.reason).toContain('87%');
    });

    it('choice=incorrect в†’ РЅРµРІРµСЂРЅС‹Р№ РІРµСЂРґРёРєС‚', () => {
      const v = parseDecisionsResponse({
        answers: {
          verdict: {
            type: 'choice',
            choice: 'incorrect',
            confidence: 0.94,
            probabilities: { correct: 0.06, incorrect: 0.94 },
          },
        },
      });
      expect(v.correct).toBe(false);
      expect(v.reason).toContain('94%');
    });

    it('noul-РѕС‚РІРµС‚ (Р±СѓР»РµРІ С‚РёРї) С‚РѕР¶Рµ РїРѕРЅРёРјР°РµС‚СЃСЏ', () => {
      const yes = parseDecisionsResponse({
        answers: { verdict: { type: 'noul', noul: 0.96 } },
      });
      expect(yes.correct).toBe(true);

      const no = parseDecisionsResponse({
        answers: { verdict: { type: 'noul', noul: 0.2 } },
      });
      expect(no.correct).toBe(false);
    });

    it('Р±РµР· confidence вЂ” РІРµСЂРґРёРєС‚ Р±РµР· reason', () => {
      const v = parseDecisionsResponse({
        answers: { verdict: { type: 'choice', choice: 'correct' } },
      });
      expect(v.correct).toBe(true);
      expect(v.reason).toBe('');
    });

    it('РЅРµС‚ answers.verdict в†’ РѕС€РёР±РєР°', () => {
      expect(() => parseDecisionsResponse({ answers: {} })).toThrow();
      expect(() => parseDecisionsResponse({})).toThrow();
    });

    it('РЅРµРёР·РІРµСЃС‚РЅС‹Р№ С„РѕСЂРјР°С‚ РѕС‚РІРµС‚Р° в†’ РѕС€РёР±РєР°', () => {
      expect(() =>
        parseDecisionsResponse({
          answers: { verdict: { type: 'score', confidence: 1 } },
        }),
      ).toThrow();
    });
  });

  describe('локальная проверка (без сети)', () => {
    it('normalizeGerman убирает пунктуацию и лишние пробелы', () => {
      expect(normalizeGerman('  Kaffee,  bitte! ')).toBe('kaffee bitte');
      expect(normalizeGerman('Straße')).toBe('straße');
    });

    it('contentWords выкидывает артикли', () => {
      expect(contentWords('der Kaffee')).toEqual(['kaffee']);
      expect(contentWords('ein Brot, bitte')).toEqual(['brot', 'bitte']);
    });

    it('editDistance считает расстояние и уважает лимит', () => {
      expect(editDistance('kaffee', 'kaffee', 2)).toBe(0);
      expect(editDistance('kaffee', 'kafee', 2)).toBe(1);
      // Слово длиннее лимита отсекается сразу, без подсчёта.
      expect(editDistance('kaffee', 'apfelstrudel', 2)).toBeGreaterThan(2);
    });

    it('recognitionTolerance растёт вместе со словом', () => {
      expect(recognitionTolerance('Hut')).toBe(1);
      expect(recognitionTolerance('Kaffee')).toBe(2);
      expect(recognitionTolerance('Fahrradfahrer')).toBe(3);
    });

    it('soundsLike сглаживает типичные ошибки распознавания', () => {
      // ß и ss звучат одинаково, v и f — почти одинаково на слух.
      expect(soundsLike('Straße')).toBe(soundsLike('strasse'));
      expect(soundsLike('Vater')).toBe(soundsLike('Fater'));
      // Но разные слова не схлопываются в одно.
      expect(soundsLike('Wasser')).not.toBe(soundsLike('Vater'));
    });

    it('точное совпадение решается локально, без запроса к судье', () => {
      const verdict = judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'Kaffee' });
      expect(verdict?.correct).toBe(true);
      expect(verdict?.reason).toContain('точное');
    });

    it('артикль и лишнее окончание не мешают', () => {
      expect(judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'der Kaffee' })?.correct).toBe(
        true,
      );
      expect(judgeLocally({ expectedGerman: 'Brot', spokenText: 'Brote' })?.correct).toBe(true);
    });

    it('опечатка в одном слове прощается', () => {
      const verdict = judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'Kafee' });
      expect(verdict?.correct).toBe(true);
    });

    it('ошибка распознавания «ш» вместо «sch» прощается', () => {
      expect(judgeLocally({ expectedGerman: 'Straße', spokenText: 'Strasse' })?.correct).toBe(true);
    });

    it('чужие слова отправляются судье (возвращается null)', () => {
      expect(judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'Tee' })).toBeNull();
      expect(judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'Banane' })).toBeNull();
    });

    it('пустой или бессмысленный ответ не решается локально', () => {
      expect(judgeLocally({ expectedGerman: 'Kaffee', spokenText: '' })).toBeNull();
      expect(judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'der die das' })).toBeNull();
    });

    it('немецкий синоним из переводов тоже засчитывается', () => {
      expect(
        judgeLocally({
          expectedGerman: 'Kaffee',
          translationsRaw: 'кофе, Kaffeesorte',
          spokenText: 'Kaffeesorte',
        })?.correct,
      ).toBe(true);
    });

    it('русские переводы из списка кандидатами не становятся', () => {
      // «кофе» — русское слово, оно не должно превратиться в кандидата.
      expect(judgeLocally({ expectedGerman: 'Kaffee', spokenText: 'кофе' })).toBeNull();
    });

    // ── Требование артикля (строгий режим) ───────────────────────────────────

    it('артикль выключен: слово засчитывается без него, как раньше', () => {
      expect(
        judgeLocally({
          expectedGerman: 'Kaffee',
          expectedArticle: 'der',
          requireArticle: false,
          spokenText: 'Kaffee',
        })?.correct,
      ).toBe(true);
    });

    it('артикль выключен: requireArticle без expectedArticle не ломает проверку', () => {
      // Тумблер включён, но слово — не существительное: строгий режим не включаем.
      expect(
        judgeLocally({ expectedGerman: 'gehen', requireArticle: true, spokenText: 'gehen' })
          ?.correct,
      ).toBe(true);
    });

    it('строгий режим: слово с нужным артиклем засчитывается локально', () => {
      const verdict = judgeLocally({
        expectedGerman: 'Kaffee',
        expectedArticle: 'der',
        requireArticle: true,
        spokenText: 'der Kaffee',
      });
      expect(verdict?.correct).toBe(true);
      expect(verdict?.reason).toContain('артикль назван');
    });

    it('строгий режим: без артикля уходим к судье, а не ставим «неверно»', () => {
      // Локально решить нельзя: «der» и «die» Whisper путает регулярно,
      // и ложное «неверно» научило бы игрока неправильно.
      expect(
        judgeLocally({
          expectedGerman: 'Kaffee',
          expectedArticle: 'der',
          requireArticle: true,
          spokenText: 'Kaffee',
        }),
      ).toBeNull();
    });

    it('строгий режим: чужой артикль тоже уходит к судье', () => {
      expect(
        judgeLocally({
          expectedGerman: 'Kaffee',
          expectedArticle: 'der',
          requireArticle: true,
          spokenText: 'die Kaffee',
        }),
      ).toBeNull();
    });

    it('строгий режим: неузнанное слово уходит к судье', () => {
      expect(
        judgeLocally({
          expectedGerman: 'Kaffee',
          expectedArticle: 'der',
          requireArticle: true,
          spokenText: 'der Apfel',
        }),
      ).toBeNull();
    });

    it('строгий режим: опечатка в слове не мешает засчитать артикль', () => {
      expect(
        judgeLocally({
          expectedGerman: 'Kaffee',
          expectedArticle: 'der',
          requireArticle: true,
          spokenText: 'der Kafee',
        })?.correct,
      ).toBe(true);
    });

    it('mentionsArticle узнаёт артикль в любом регистре и с мусором вокруг', () => {
      expect(mentionsArticle('der Kaffee', 'der')).toBe(true);
      expect(mentionsArticle('Der Kaffee, bitte', 'der')).toBe(true);
      expect(mentionsArticle('die Milch', 'der')).toBe(false);
      expect(mentionsAnyArticle('die Milch')).toBe(true);
      expect(mentionsAnyArticle('Milch')).toBe(false);
    });

    it('buildDecisionsPayload в строгом режиме просит артикль и передаёт его', () => {
      const payload = buildDecisionsPayload({
        russian: 'кофе',
        translationsRaw: 'кофе',
        expectedGerman: 'Kaffee',
        spokenText: 'Kaffee',
        expectedArticle: 'der',
        requireArticle: true,
      });
      expect(payload.questions['verdict'].instructions).toContain('article');
      expect(payload.state).toMatchObject({ expected_article: 'der' });
    });

    it('buildDecisionsPayload без артикля остаётся в свободном режиме', () => {
      const payload = buildDecisionsPayload({
        russian: 'пожалуйста',
        translationsRaw: 'пожалуйста',
        expectedGerman: 'bitte',
        spokenText: 'bitte',
        requireArticle: true,
      });
      expect(payload.questions['verdict'].instructions).toBe(JUDGE_INSTRUCTIONS);
      expect(payload.state).not.toHaveProperty('expected_article');
    });
  });
});
