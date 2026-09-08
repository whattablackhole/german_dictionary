export interface DaCompoundData {
  preposition: string;
  compound: string;
  /** How the form is built, e.g. "da + an → dar + an (r перед гласной)" */
  formation: string;
  translationEn: string;
  translationRu: string;
  /** Frequency 1–5 (0 = form does not exist) */
  frequency: number;
  example: string;
  exampleRu: string;
  /** Typical verb + preposition combinations used with this compound */
  verbs: string[];
  /** Extra usage note / trap */
  note?: string;
  /** false = this da-form does NOT exist (omit for existing forms) */
  exists?: boolean;
}

export const DA_COMPOUNDS: DaCompoundData[] = [
  // ── dar- (before vowel-initial prepositions: an, auf, aus, in, über, um) ──
  { preposition: 'an', compound: 'daran', formation: 'da + an → dar + an (r перед гласной)', translationEn: 'about it, on it', translationRu: 'об этом, на этом, у этого', frequency: 5, example: 'Ich denke oft daran.', exampleRu: 'Я часто об этом думаю.', verbs: ['denken an', 'sich erinnern an', 'glauben an', 'zweifeln an', 'teilnehmen an'], note: 'Типично с глаголами мышления и памяти: denken, erinnern, glauben.' },

  { preposition: 'auf', compound: 'darauf', formation: 'da + auf → dar + auf', translationEn: 'on it, for it', translationRu: 'на это, на этом', frequency: 5, example: 'Ich freue mich schon darauf.', exampleRu: 'Я уже с нетерпением этого жду.', verbs: ['warten auf', 'sich freuen auf', 'antworten auf', 'sich verlassen auf', 'achten auf'], note: 'sich freuen AUF = ждать с нетерпением (будущее), sich freuen ÜBER = радоваться (уже случившемуся).' },
  { preposition: 'aus', compound: 'daraus', formation: 'da + aus → daraus', translationEn: 'out of it, from it', translationRu: 'из этого, оттуда', frequency: 4, example: 'Man kann vieles daraus lernen.', exampleRu: 'Из этого можно многому научиться.', verbs: ['bestehen aus', 'werden aus', 'folgen aus', 'entstehen aus'], note: 'bestehen aus = «состоять из»: Was besteht der Kuchen daraus?' },
  { preposition: 'in', compound: 'darin', formation: 'da + in → dar + in', translationEn: 'in it, inside it', translationRu: 'в этом, внутри этого', frequency: 3, example: 'Darin liegt der Unterschied.', exampleRu: 'В этом и состоит разница.', verbs: ['bestehen in', 'gut sein in'], note: '«Darin liegt...» — частое начало книжных фраз: «в этом заключается...».' },
  { preposition: 'über', compound: 'darüber', formation: 'da + über → dar + über', translationEn: 'about it, over it', translationRu: 'над этим, об этом, через это', frequency: 4, example: 'Wir sprechen gerade darüber.', exampleRu: 'Мы как раз об этом говорим.', verbs: ['sprechen über', 'sich freuen über', 'nachdenken über', 'sich ärgern über', 'sich informieren über'] },
  { preposition: 'um', compound: 'darum', formation: 'da + um → dar + um', translationEn: 'around it, about it; therefore', translationRu: 'вокруг этого, об этом, из-за этого', frequency: 3, example: 'Ich bitte nur darum.', exampleRu: 'Я только об этом прошу.', verbs: ['bitten um', 'sich kümmern um', 'sich bewerben um', 'gehen um (Es geht um...)'], note: 'darum часто = «поэтому» (как deshalb): Er war müde, darum ging er ins Bett.' },

  // ── da- (all other prepositions) ──
  { preposition: 'bei', compound: 'dabei', formation: 'da + bei → dabei', translationEn: 'with it, at it, nearby', translationRu: 'при этом, рядом с этим', frequency: 5, example: 'Er hat mir dabei geholfen.', exampleRu: 'Он помог мне при этом.', verbs: ['helfen bei', 'sein bei', 'bleiben bei'], note: 'dabei часто = «в процессе, попутно»: Kannst du mir dabei helfen?' },
  { preposition: 'durch', compound: 'dadurch', formation: 'da + durch → dadurch', translationEn: 'through it, thereby', translationRu: 'благодаря этому, тем самым', frequency: 4, example: 'Dadurch habe ich Zeit gespart.', exampleRu: 'Благодаря этому я сэкономил время.', verbs: ['dadurch, dass... (благодаря тому, что...)'], note: 'ФОРМА СУЩЕСТВУЕТ! dadurch очень частотна: «благодаря этому», и конструкция «dadurch, dass...».' },
  { preposition: 'für', compound: 'dafür', formation: 'da + für → dafür', translationEn: 'for it', translationRu: 'за это, для этого', frequency: 5, example: 'Ich interessiere mich dafür.', exampleRu: 'Я этим интересуюсь.', verbs: ['sich interessieren für', 'danken für', 'sich einsetzen für', 'sich begeistern für', 'sich eignen für'] },
  { preposition: 'gegen', compound: 'dagegen', formation: 'da + gegen → dagegen', translationEn: 'against it', translationRu: 'против этого', frequency: 4, example: 'Ich habe nichts dagegen.', exampleRu: 'Я ничего не имею против.', verbs: ['sein gegen', 'kämpfen gegen', 'sprechen gegen', 'verstoßen gegen'], note: '«Ich habe nichts dagegen» — устойчивый ответ «я не против».' },
  { preposition: 'hinter', compound: 'dahinter', formation: 'da + hinter → dahinter', translationEn: 'behind it', translationRu: 'за этим, позади этого', frequency: 2, example: 'Da steckt mehr dahinter.', exampleRu: 'За этим кроется нечто большее.', verbs: ['stehen hinter', 'stecken hinter'] },
  { preposition: 'mit', compound: 'damit', formation: 'da + mit → damit', translationEn: 'with it', translationRu: 'с этим, этим (инструмент)', frequency: 5, example: 'Was willst du damit sagen?', exampleRu: 'Что ты этим хочешь сказать?', verbs: ['anfangen mit', 'aufhören mit', 'zufrieden sein mit', 'rechnen mit', 'sich beschäftigen mit'], note: 'Не путать с союзом damit (= чтобы, уровень 21): Ich lerne, damit ich bestehe.' },
  { preposition: 'nach', compound: 'danach', formation: 'da + nach → danach', translationEn: 'after it, afterwards; according to it', translationRu: 'после этого, согласно этому', frequency: 4, example: 'Danach habe ich gefrühstückt.', exampleRu: 'После этого (затем) я позавтракал.', verbs: ['sich richten nach', 'fragen nach', 'streben nach'], note: 'danach очень часто просто = «потом, затем».' },
  { preposition: 'neben', compound: 'daneben', formation: 'da + neben → daneben', translationEn: 'next to it, beside it', translationRu: 'рядом с этим', frequency: 2, example: 'Das Buch liegt daneben.', exampleRu: 'Книга лежит рядом (с этим).', verbs: ['stehen neben', 'sitzen neben'], note: 'Разг. daneben sein/greifen = «промахнуться, ошибиться».' },
  { preposition: 'unter', compound: 'darunter', formation: 'da + unter → darunter', translationEn: 'under it, among them', translationRu: 'под этим, среди этого', frequency: 2, example: 'Der Schlüssel liegt darunter.', exampleRu: 'Ключ лежит под этим (под ним).', verbs: ['liegen unter', 'verstehen unter'], note: 'darunter = «среди них»: Viele Kinder, darunter zwei Mädchen.' },
  { preposition: 'von', compound: 'davon', formation: 'da + von → davon', translationEn: 'of it, about it, from it', translationRu: 'от этого, из этого, об этом', frequency: 4, example: 'Ich habe davon geträumt.', exampleRu: 'Я об этом мечтал (мне это снилось).', verbs: ['träumen von', 'erzählen von', 'halten von', 'abhängen von', 'wissen von'] },
  { preposition: 'vor', compound: 'davor', formation: 'da + vor → davor', translationEn: 'in front of it, before it; of it (fear)', translationRu: 'перед этим, до этого, этого (бояться)', frequency: 3, example: 'Ich habe Angst davor.', exampleRu: 'Я этого боюсь.', verbs: ['Angst haben vor', 'sich fürchten vor', 'warnen vor', 'schützen vor'] },
  { preposition: 'zu', compound: 'dazu', formation: 'da + zu → dazu', translationEn: 'to it, for it; in addition', translationRu: 'к этому, для этого, кроме того', frequency: 5, example: 'Was sagst du dazu?', exampleRu: 'Что ты на это скажешь?', verbs: ['gehören zu', 'beitragen zu', 'einladen zu', 'gratulieren zu', 'passen zu'], note: 'dazu часто = «кроме того, вдобавок»: Dazu kommt, dass...' },
  { preposition: 'zwischen', compound: 'dazwischen', formation: 'da + zwischen → dazwischen', translationEn: 'between it/them', translationRu: 'между этим, посреди этого', frequency: 1, example: 'Ein Tisch steht dazwischen.', exampleRu: 'Между ними (этим) стоит стол.', verbs: ['liegen zwischen', 'stehen zwischen'], note: 'Тоже отделяемая приставка: dazwischenreden — «влезать не в своё дело».' },

  // ── NO da-form exists ──
  { preposition: 'ohne', compound: '—', formation: 'НЕТ da-формы!', translationEn: '—', translationRu: 'без этого (формы нет)', frequency: 0, example: 'Ohne das geht es nicht.', exampleRu: 'Без этого никак.', verbs: [], exists: false, note: 'Замена: ohne das / ohne es или перефразировка.' },
  { preposition: 'seit', compound: '—', formation: 'НЕТ da-формы!', translationEn: '—', translationRu: 'с того времени (формы нет)', frequency: 0, example: 'Seitdem rauche ich nicht mehr.', exampleRu: 'С тех пор я больше не курю.', verbs: [], exists: false, note: 'Замена: seitdem (= с тех пор). Это союз/наречие, но не da-compound.' },
];

