import { Injectable, computed, signal } from '@angular/core';
import { ActivityTrackingData } from '../models/activity-tracking';

const STORAGE_KEY = 'german-dictionary-activity-tracking';

/** No input for this long => the user walked away and the timer stops. */
const IDLE_TIMEOUT_MS = 30_000;
/** Heartbeat interval; every credited tick adds one second. */
const TICK_MS = 1_000;
/** Persist after this many credited ticks (~15s) or on risky moments. */
const SAVE_EVERY_TICKS = 15;
/** Keep at most one year of daily buckets. */
const MAX_DAYS = 365;

/** Document events that count as user presence (mousemove handled separately). */
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'click',
  'keydown',
  'wheel',
  'scroll',
  'pointerdown',
  'touchstart',
];

/**
 * Tracks how much time the user actively spends in the app.
 *
 * Pattern: activity events only refresh a lastActivityAt timestamp; a 1s
 * heartbeat credits one second of active time whenever the user interacted
 * within the last 30s and the tab is visible. Hidden tabs never count and
 * data is flushed on visibility loss / page hide. Day buckets use the local
 * date, so passing midnight simply starts a new bucket.
 */
@Injectable({ providedIn: 'root' })
export class ActivityTrackingService {
  /** Raw per-day data (seconds), loaded from localStorage. */
  readonly data = signal<ActivityTrackingData>(this.load());

  /** Active seconds today. */
  readonly todaySeconds = computed(
    () => this.data().days[this.dateKey(Date.now())] ?? 0
  );

  /** Active seconds across all stored days. */
  readonly totalSeconds = computed(() =>
    Object.values(this.data().days).reduce((sum, s) => sum + s, 0)
  );

  /** How many stored days had any activity. */
  readonly activeDays = computed(
    () => Object.values(this.data().days).filter((s) => s > 0).length
  );

  /** Mean active seconds per day that had any activity. */
  readonly dailyAverage = computed(() => {
    const active = this.activeDays();
    return active === 0 ? 0 : Math.round(this.totalSeconds() / active);
  });

  /** The last seven local days, oldest first (for the mini bar chart). */
  readonly last7Days = computed<{ date: string; label: string; seconds: number }[]>(
    () => {
      const days = this.data().days;
      const out: { date: string; label: string; seconds: number }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = this.dateKey(d.getTime());
        out.push({
          date: key,
          label: d.toLocaleDateString(undefined, { weekday: 'short' }),
          seconds: days[key] ?? 0,
        });
      }
      return out;
    }
  );

  /** Most-used pages across all stored days, best first (top 5). */
  readonly topPages = computed<{ route: string; seconds: number }[]>(() => {
    const totals = new Map<string, number>();
    for (const pages of Object.values(this.data().pages)) {
      for (const [route, seconds] of Object.entries(pages)) {
        totals.set(route, (totals.get(route) ?? 0) + seconds);
      }
    }
    return [...totals.entries()]
      .map(([route, seconds]) => ({ route, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
  });

  private lastActivityAt = Date.now();
  private lastMouseMoveMark = 0;
  private ticksSinceSave = 0;

  constructor() {
    if (typeof document === 'undefined') return; // non-browser safety
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    for (const type of ACTIVITY_EVENTS) {
      document.addEventListener(type, this.markActivity, opts);
    }
    document.addEventListener('mousemove', this.onMouseMove, opts);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.flush);
    window.addEventListener('beforeunload', this.flush);
    setInterval(() => this.tick(), TICK_MS);
  }

  /** Hook for other features (e.g. TTS audio playback) to count as presence. */
  noteExternalActivity(at: number = Date.now()): void {
    this.lastActivityAt = at;
  }

  /**
   * One heartbeat. Public for tests. Credits one second of active time when
   * the user is present (activity within the idle window, tab visible).
   */
  tick(now: number = Date.now()): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (now - this.lastActivityAt >= IDLE_TIMEOUT_MS) return;

    const dateKey = this.dateKey(now);
    const route = this.currentRoute();
    this.data.update((data) => {
      const dayPages = { ...(data.pages[dateKey] ?? {}) };
      dayPages[route] = (dayPages[route] ?? 0) + 1;
      return {
        days: { ...data.days, [dateKey]: (data.days[dateKey] ?? 0) + 1 },
        pages: { ...data.pages, [dateKey]: dayPages },
      };
    });

    if (++this.ticksSinceSave >= SAVE_EVERY_TICKS) {
      this.flush();
    }
  }

  /** Writes the current data through to localStorage. */
  flush = (): void => {
    this.ticksSinceSave = 0;
    this.save();
  };

  private markActivity = (): void => {
    this.lastActivityAt = Date.now();
  };

  // mousemove fires in floods; throttle marking to once per second.
  private onMouseMove = (): void => {
    const now = Date.now();
    if (now - this.lastMouseMoveMark < 1_000) return;
    this.lastMouseMoveMark = now;
    this.lastActivityAt = now;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.flush(); // persist what we have; hidden time does not count
    } else {
      this.markActivity(); // coming back to the tab is activity
    }
  };

  /** First URL segment as the page key ('/verbs' -> 'verbs', '/' -> 'home'). */
  private currentRoute(): string {
    try {
      const path = window.location.pathname.replace(/^\//, '').split(/[/?#]/)[0];
      return path || 'home';
    } catch {
      return 'home';
    }
  }

  private dateKey(now: number): string {
    const d = new Date(now);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
  }

  private load(): ActivityTrackingData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActivityTrackingData;
        if (parsed && typeof parsed === 'object' && parsed.days) {
          return { days: parsed.days, pages: parsed.pages ?? {} };
        }
      }
    } catch {
      // corrupted data - start fresh
    }
    return { days: {}, pages: {} };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prune(this.data())));
    } catch {
      // storage may be unavailable (tests / private mode) - best effort
    }
  }

  /** Drops buckets older than MAX_DAYS (YYYY-MM-DD strings sort chronologically). */
  private prune(data: ActivityTrackingData): ActivityTrackingData {
    const cutoff = this.dateKey(Date.now() - MAX_DAYS * 86_400_000);
    const days: Record<string, number> = {};
    const pages: Record<string, Record<string, number>> = {};
    for (const [key, seconds] of Object.entries(data.days)) {
      if (key < cutoff) continue;
      days[key] = seconds;
      pages[key] = data.pages[key] ?? {};
    }
    return { days, pages };
  }
}
