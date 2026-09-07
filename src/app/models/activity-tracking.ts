/** Active seconds per first route segment (page) for one local date. */
export type ActivityRouteSeconds = Record<string, number>;

/**
 * Accumulated active-usage time recorded while the app is open.
 * Seconds are credited by a 1s heartbeat whenever the user showed activity
 * within the last 30s and the tab is visible.
 */
export interface ActivityTrackingData {
  /** Active seconds per local date (YYYY-MM-DD). */
  days: Record<string, number>;
  /** Active seconds per page (first URL segment) per local date. */
  pages: Record<string, ActivityRouteSeconds>;
}
