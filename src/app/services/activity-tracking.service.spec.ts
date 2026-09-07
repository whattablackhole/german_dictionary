import { ActivityTrackingService } from './activity-tracking.service';

/** Overrides the (read-only) document.hidden flag for a test. */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
}

describe('ActivityTrackingService', () => {
  let base: number;

  beforeEach(() => {
    localStorage.clear();
    base = Date.now();
  });

  afterEach(() => {
    setHidden(false);
  });

  it('starts with empty stats', () => {
    const service = new ActivityTrackingService();
    expect(service.todaySeconds()).toBe(0);
    expect(service.totalSeconds()).toBe(0);
    expect(service.activeDays()).toBe(0);
    expect(service.topPages()).toEqual([]);
  });

  it('credits one second per tick while the user is active', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    service.tick(base + 1_000);
    service.tick(base + 2_000);
    service.tick(base + 3_000);
    expect(service.todaySeconds()).toBe(3);
    expect(service.totalSeconds()).toBe(3);
  });

  it('stops counting after 30s without activity', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    service.tick(base + 1_000); // active
    service.tick(base + 31_000); // 31s since the last event -> idle
    service.tick(base + 32_000); // still idle
    expect(service.todaySeconds()).toBe(1);
  });

  it('resumes counting after new activity', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    service.tick(base + 1_000);
    service.noteExternalActivity(base + 120_000); // user returns
    service.tick(base + 121_000);
    expect(service.todaySeconds()).toBe(2);
  });

  it('does not count seconds while the tab is hidden', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    setHidden(true);
    try {
      service.tick(base + 1_000);
      service.tick(base + 2_000);
    } finally {
      setHidden(false);
    }
    expect(service.todaySeconds()).toBe(0);
  });

  it('splits time across midnight into separate day buckets', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    service.tick(base + 1_000);
    service.noteExternalActivity(base + 86_400_000); // next day
    service.tick(base + 86_400_000 + 1_000);
    expect(Object.keys(service.data().days).length).toBe(2);
    expect(service.totalSeconds()).toBe(2);
    expect(service.activeDays()).toBe(2);
  });

  it('tracks time per page', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    service.tick(base + 1_000);
    const top = service.topPages();
    expect(top.length).toBe(1);
    expect(top[0].route).toBe('home'); // jsdom location.pathname is '/'
    expect(top[0].seconds).toBe(1);
  });

  it('persists across service instances', () => {
    const service = new ActivityTrackingService();
    service.noteExternalActivity(base);
    service.tick(base + 1_000);
    service.flush();

    const reloaded = new ActivityTrackingService();
    expect(reloaded.todaySeconds()).toBe(1);
  });

  it('provides the last 7 days for the chart', () => {
    const service = new ActivityTrackingService();
    expect(service.last7Days().length).toBe(7);
  });

  it('strips the GitHub Pages deploy base from routes', () => {
    const service = new ActivityTrackingService();
    expect(
      service.routeFromPath('/german_dictionary/settings', '/german_dictionary/')
    ).toBe('settings');
    expect(
      service.routeFromPath('/german_dictionary/stories/abc', '/german_dictionary/')
    ).toBe('stories');
    expect(
      service.routeFromPath('/german_dictionary/', '/german_dictionary/')
    ).toBe('home');
    expect(service.routeFromPath('/german_dictionary', '/german_dictionary/')).toBe('home');
    expect(service.routeFromPath('/settings', '/')).toBe('settings');
    expect(service.routeFromPath('/', '/')).toBe('home');
  });

  it('drops legacy page keys that recorded the deploy base', () => {
    localStorage.setItem(
      'german-dictionary-activity-tracking',
      JSON.stringify({
        days: { '2026-09-07': 10 },
        pages: { '2026-09-07': { german_dictionary: 10, settings: 5 } },
      })
    );
    Object.defineProperty(document, 'baseURI', {
      configurable: true,
      value: 'https://user.github.io/german_dictionary/',
    });
    try {
      const service = new ActivityTrackingService();
      expect(service.data().days['2026-09-07']).toBe(10);
      expect(service.data().pages['2026-09-07']).toEqual({ settings: 5 });
    } finally {
      delete (document as unknown as { baseURI?: string }).baseURI;
    }
  });
});
