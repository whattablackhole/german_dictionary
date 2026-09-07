import { VerbTrainerService } from './verb-trainer.service';
import { VerbTrainerAttempt } from '../models/verb-trainer';

/** Builds a fully populated attempt with sensible defaults. */
function attempt(overrides: Partial<VerbTrainerAttempt> = {}): VerbTrainerAttempt {
  return {
    verb: 'machen',
    person: 'ich',
    tense: 'präsens',
    mode: 'sentence',
    answer: 'mache',
    correct: true,
    expected: 'mache',
    score: 100,
    explanation: '',
    ts: new Date().toISOString(),
    ...overrides,
  };
}

describe('VerbTrainerService stats', () => {
  let service: VerbTrainerService;

  beforeEach(() => {
    localStorage.clear();
    service = new VerbTrainerService();
  });

  it('reports empty stats when nothing was trained', () => {
    expect(service.getOverallStats()).toEqual({
      verbsTrained: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      accuracy: 0,
    });
    expect(service.getStatsPerVerb()).toEqual([]);
  });

  it('aggregates overall stats across all verbs', () => {
    service.record(attempt({ verb: 'machen', correct: true }));
    service.record(attempt({ verb: 'machen', correct: false }));
    service.record(attempt({ verb: 'sein', correct: true }));

    expect(service.getOverallStats()).toEqual({
      verbsTrained: 2,
      totalAttempts: 3,
      totalCorrect: 2,
      accuracy: 67,
    });
  });

  it('groups per-verb stats case-insensitively and computes accuracy', () => {
    service.record(attempt({ verb: 'machen', correct: true }));
    service.record(attempt({ verb: 'Machen', correct: true }));
    service.record(attempt({ verb: 'MACHEN', correct: false }));

    const rows = service.getStatsPerVerb();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ verb: 'machen', total: 3, correct: 2, accuracy: 67 });
  });

  it('sorts rows by attempts, then weakest accuracy, then name', () => {
    service.record(attempt({ verb: 'sein', correct: true })); // 1 attempt, 100%
    service.record(attempt({ verb: 'gehen', correct: false })); // 1 attempt, 0%
    service.record(attempt({ verb: 'machen', correct: false }));
    service.record(attempt({ verb: 'machen', correct: false }));
    service.record(attempt({ verb: 'machen', correct: true }));

    const rows = service.getStatsPerVerb();
    expect(rows.map((r) => r.verb)).toEqual(['machen', 'gehen', 'sein']);
    expect(rows[0].accuracy).toBe(33);
  });

  it('round-trips through localStorage', () => {
    service.record(attempt({ verb: 'verstehen', correct: false }));

    const reloaded = new VerbTrainerService();
    expect(reloaded.getOverallStats().verbsTrained).toBe(1);
    expect(reloaded.getStatsPerVerb()[0]).toEqual({
      verb: 'verstehen',
      total: 1,
      correct: 0,
      accuracy: 0,
    });
  });

  it('clears stats together with the history', () => {
    service.record(attempt());
    service.clearHistory();
    expect(service.getOverallStats().totalAttempts).toBe(0);
    expect(service.getStatsPerVerb()).toEqual([]);
  });
});
