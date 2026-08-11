import { Injectable, signal } from '@angular/core';
import { DifficultyLevel } from '../models/word';
import { Sentence } from '../models/sentence';

const STORAGE_KEY = 'german-dictionary-sentences';

const SEED_SENTENCES: Sentence[] = [
  // A1
  { id: 's1', german: 'Der Hund ist im Haus.', translationEn: 'The dog is in the house.', translationRu: 'Собака в доме.', level: 'A1', domain: 'Home', grammarTopics: ['Definite articles (der, die, das)', 'Local prepositions (in, auf, unter, neben)', 'Present tense (Präsens)'], createdAt: '2026-08-01T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's2', german: 'Die Katze trinkt Milch.', translationEn: 'The cat drinks milk.', translationRu: 'Кошка пьёт молоко.', level: 'A1', domain: 'Food', grammarTopics: ['Definite articles (der, die, das)', 'Present tense (Präsens)', 'Verbs with accusative object'], createdAt: '2026-08-01T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's3', german: 'Das Kind hat einen Apfel.', translationEn: 'The child has an apple.', translationRu: 'У ребёнка есть яблоко.', level: 'A1', domain: 'Food', grammarTopics: ['Definite articles (der, die, das)', 'Indefinite articles (ein, eine)', 'Accusative case (Akkusativ)'], createdAt: '2026-08-01T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  // A2
  { id: 's4', german: 'Der Mann liest ein Buch unter dem Baum.', translationEn: 'The man is reading a book under the tree.', translationRu: 'Мужчина читает книгу под деревом.', level: 'A2', domain: 'Nature', grammarTopics: ['Definite articles (der, die, das)', 'Indefinite articles (ein, eine)', 'Two-way prepositions (Wechselpräpositionen)', 'Dative case (Dativ)'], createdAt: '2026-08-02T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's5', german: 'Die Frau kauft eine Lampe für das Haus.', translationEn: 'The woman buys a lamp for the house.', translationRu: 'Женщина покупает лампу для дома.', level: 'A2', domain: 'Shopping', grammarTopics: ['Definite articles (der, die, das)', 'Indefinite articles (ein, eine)', 'Accusative case (Akkusativ)', 'Prepositions with accusative'], createdAt: '2026-08-02T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's6', german: 'Auf dem Tisch steht eine Blume.', translationEn: 'There is a flower on the table.', translationRu: 'На столе стоит цветок.', level: 'A2', domain: 'Home', grammarTopics: ['Two-way prepositions (Wechselpräpositionen)', 'Dative case (Dativ)', 'Inverted word order (verb second)'], createdAt: '2026-08-02T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  // B1
  { id: 's7', german: 'Obwohl es regnete, gingen wir spazieren.', translationEn: 'Although it was raining, we went for a walk.', translationRu: 'Хотя шёл дождь, мы пошли гулять.', level: 'B1', domain: 'Weather', grammarTopics: ['Subordinating conjunctions (weil, dass, obwohl)', 'Simple past (Präteritum / Imperfekt)', 'Separable prefix verbs'], createdAt: '2026-08-03T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's8', german: 'Kannst du mir bitte das Wasser geben?', translationEn: 'Can you please pass me the water?', translationRu: 'Не мог бы ты передать мне воду?', level: 'B1', domain: 'Food', grammarTopics: ['Modal verbs (können, müssen, dürfen...)', 'Personal pronouns (ich, du, er...)', 'Verbs with dative object', 'Modal particles (doch, ja, mal, eben)'], createdAt: '2026-08-03T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's9', german: 'Ich habe gehört, dass das Auto sehr teuer ist.', translationEn: 'I heard that the car is very expensive.', translationRu: 'Я слышал, что эта машина очень дорогая.', level: 'B1', domain: 'Transport', grammarTopics: ['Present perfect (Perfekt)', 'Subordinating conjunctions (weil, dass, obwohl)', 'Verb at the end (Nebensatz)'], createdAt: '2026-08-03T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  // B2
  { id: 's10', german: 'Die Behörde hat die Genehmigung für den Bau des neuen Hauses erteilt.', translationEn: 'The authority has granted permission for the construction of the new house.', translationRu: 'Власти выдали разрешение на строительство нового дома.', level: 'B2', domain: 'Administration', grammarTopics: ['Present perfect (Perfekt)', 'Genitive case (Genitiv)', 'Adjective declension (weak)', 'Prepositions with genitive'], createdAt: '2026-08-04T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's11', german: 'Es wäre wünschenswert, wenn wir die Umwelt besser schützen würden.', translationEn: 'It would be desirable if we protected the environment better.', translationRu: 'Было бы желательно, если бы мы лучше защищали окружающую среду.', level: 'B2', domain: 'Environment', grammarTopics: ['Subjunctive II (Konjunktiv II - would/could)', 'Conditional clauses (wenn, falls)', 'Comparative adjectives', 'Infinitive with "zu"'], createdAt: '2026-08-04T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's12', german: 'Trotz der Schwierigkeiten hat sie ihr Studium erfolgreich abgeschlossen.', translationEn: 'Despite the difficulties, she successfully completed her studies.', translationRu: 'Несмотря на трудности, она успешно завершила учёбу.', level: 'B2', domain: 'Education', grammarTopics: ['Present perfect (Perfekt)', 'Possessive articles (mein, dein, sein...)', 'Adverbs of manner', 'Separable prefix verbs'], createdAt: '2026-08-04T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  // C1
  { id: 's13', german: 'In Anbetracht der wirtschaftlichen Lage müssen wir unsere Strategie überdenken.', translationEn: 'In view of the economic situation, we need to reconsider our strategy.', translationRu: 'Учитывая экономическую ситуацию, мы должны пересмотреть нашу стратегию.', level: 'C1', domain: 'Business', grammarTopics: ['Prepositions with genitive', 'Modal verbs (können, müssen, dürfen...)', 'Possessive articles (mein, dein, sein...)', 'Inseparable prefix verbs'], createdAt: '2026-08-05T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's14', german: 'Die zunehmende Globalisierung führt zu einer tiefgreifenden Veränderung der Arbeitsmärkte.', translationEn: 'Increasing globalization is leading to a profound change in labor markets.', translationRu: 'Растущая глобализация приводит к глубоким изменениям на рынках труда.', level: 'C1', domain: 'Economy', grammarTopics: ['Present participle (Partizip I)', 'Adjective declension (strong)', 'Verbs with fixed prepositions', 'Compound nouns'], createdAt: '2026-08-05T10:00:00.000Z', passedAt: null, timesPassed: 0 },
  { id: 's15', german: 'Es ist unabdingbar, dass wir uns mit den ethischen Implikationen dieser Technologie auseinandersetzen.', translationEn: 'It is essential that we address the ethical implications of this technology.', translationRu: 'Необходимо, чтобы мы занялись этическими последствиями этой технологии.', level: 'C1', domain: 'Technology', grammarTopics: ['Subordinating conjunctions (weil, dass, obwohl)', 'Verb at the end (Nebensatz)', 'Reflexive verbs', 'Verbs with fixed prepositions', 'Separable prefix verbs'], createdAt: '2026-08-05T10:00:00.000Z', passedAt: null, timesPassed: 0 },
];

@Injectable({ providedIn: 'root' })
export class SentenceService {
  readonly sentences = signal<Sentence[]>(this.loadSentences());

  getSentences(): Sentence[] {
    return this.sentences();
  }

  getSentencesByLevels(levels: DifficultyLevel[]): Sentence[] {
    if (levels.length === 0) {
      return this.sentences();
    }
    return this.sentences().filter((s) => levels.includes(s.level));
  }

  getSentencesByDomain(domain: string): Sentence[] {
    if (!domain) {
      return this.sentences();
    }
    return this.sentences().filter(
      (s) => s.domain.toLowerCase() === domain.toLowerCase()
    );
  }

  getSentencesByGrammarTopics(topics: string[]): Sentence[] {
    if (topics.length === 0) {
      return this.sentences();
    }
    return this.sentences().filter((s) =>
      topics.some((t) =>
        s.grammarTopics.some(
          (st) => st.toLowerCase() === t.toLowerCase()
        )
      )
    );
  }

  getNewSentences(
    levels: DifficultyLevel[],
    domain?: string,
    grammarTopics?: string[]
  ): Sentence[] {
    let result = this.getSentencesByLevels(levels);
    if (domain) {
      result = result.filter(
        (s) => s.domain.toLowerCase() === domain.toLowerCase()
      );
    }
    if (grammarTopics && grammarTopics.length > 0) {
      result = result.filter((s) =>
        grammarTopics.some((t) =>
          s.grammarTopics.some(
            (st) => st.toLowerCase() === t.toLowerCase()
          )
        )
      );
    }
    return result.filter((s) => s.passedAt === null);
  }

  getPassedSentences(
    levels: DifficultyLevel[],
    domain?: string,
    grammarTopics?: string[]
  ): Sentence[] {
    let result = this.getSentencesByLevels(levels);
    if (domain) {
      result = result.filter(
        (s) => s.domain.toLowerCase() === domain.toLowerCase()
      );
    }
    if (grammarTopics && grammarTopics.length > 0) {
      result = result.filter((s) =>
        grammarTopics.some((t) =>
          s.grammarTopics.some(
            (st) => st.toLowerCase() === t.toLowerCase()
          )
        )
      );
    }
    return result.filter((s) => s.passedAt !== null);
  }

  addSentence(sentence: Omit<Sentence, 'id' | 'createdAt'>): void {
    const newSentence: Sentence = {
      ...sentence,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.sentences.update((sentences) => [...sentences, newSentence]);
    this.save();
  }

  addSentences(sentences: Omit<Sentence, 'id' | 'createdAt'>[]): void {
    const now = new Date().toISOString();
    const newSentences: Sentence[] = sentences.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      createdAt: now,
    }));
    this.sentences.update((existing) => [...existing, ...newSentences]);
    this.save();
  }

  markAsPassed(id: string): void {
    this.sentences.update((sentences) =>
      sentences.map((s) =>
        s.id === id
          ? { ...s, passedAt: new Date().toISOString(), timesPassed: s.timesPassed + 1 }
          : s
      )
    );
    this.save();
  }

  private loadSentences(): Sentence[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Sentence[];
        // Backward compatibility: add grammarTopics if missing
        return parsed.map((s) => ({
          ...s,
          grammarTopics: s.grammarTopics ?? [],
        }));
      } catch {
        // fall through to seed data
      }
    }
    return [...SEED_SENTENCES];
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sentences()));
  }
}