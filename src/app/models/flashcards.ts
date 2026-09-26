/**
 * Модель режима карточек «RU → DE голосом»:
 * статический словарь Duolingo (data/duo-words.ts) и AI-судья (OpenRouter Jev).
 */

/** Один юнит курса Duolingo. */
export interface DuoUnit {
  /** Порядковый номер юнита (1, 2, 3…). */
  order: number;
  /** Короткое имя навыка, например «CoffeeShop». */
  name: string;
  /** Тема юнита, например «Заказывайте в кафе». */
  theme: string;
  /** «1 CoffeeShop — Заказывайте в кафе» — лейбл для селектора. */
  label: string;
}

/** Одно слово из словаря. */
export interface DuoWord {
  /** Немецкое слово, например «Kaffee». */
  german: string;
  /** Основной русский перевод (первый из перечисленных), например «кофе». */
  russian: string;
  /** Все переводы как в источнике, например «печенье, печеньями, …». */
  translationsRaw: string;
  /** Номер юнита, в котором слово встречается впервые. */
  unit: number;
  /** Ссылка на родное Duolingo TTS-произношение (опционально, на будущее). */
  ttsUrl?: string;
}

/** Результат AI-судьи: засчитан ли устный ответ. */
export interface JudgeVerdict {
  correct: boolean;
  /** Короткое пояснение судьи (почему зачтено/не зачтено). */
  reason: string;
}

/** Итог сессии. */
export interface FlashcardsSessionResult {
  total: number;
  correct: number;
  wrong: number;
  /** Слова, отвеченные неверно (для повтора). */
  mistakes: DuoWord[];
}