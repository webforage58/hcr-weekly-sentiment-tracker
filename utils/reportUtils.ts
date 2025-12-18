import type { HCRReport, IssueEntry, PeriodComparison, PeriodIssueTrend, PeriodWeekSummary } from "../types";

export interface DateWindow {
  start: string;
  end: string;
  priorStart: string;
  priorEnd: string;
}

/**
 * Generates Sunday-to-Saturday windows that cover the provided date range.
 * Accepting strings (YYYY-MM-DD) avoids timezone shifts that occur when parsing 
 * simplified ISO strings with `new Date()`.
 */
export function getWeekWindows(startDateStr: string, endDateStr: string): DateWindow[] {
  // Parse YYYY-MM-DD as local date parts to prevent UTC shifting
  const parseLocal = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const windows: DateWindow[] = [];
  
  // Align start to the preceding (or current) Sunday
  const start = parseLocal(startDateStr);
  const startDay = start.getDay(); // 0 is Sunday
  start.setDate(start.getDate() - startDay); 

  // Align end to the next (or current) Saturday
  const end = parseLocal(endDateStr);
  end.setHours(23, 59, 59, 999);
  const endDay = end.getDay(); // 6 is Saturday
  end.setDate(end.getDate() + (6 - endDay));

  let current = new Date(start);
  
  // Iterate in 7-day chunks until we pass the end date
  while (current <= end) {
    const wStart = new Date(current);
    const wEnd = new Date(current);
    wEnd.setDate(wEnd.getDate() + 6); // Add 6 days to get to Saturday

    // Prior window is simply the 7 days before wStart
    const pStart = new Date(wStart);
    pStart.setDate(pStart.getDate() - 7);
    const pEnd = new Date(pStart);
    pEnd.setDate(pEnd.getDate() + 6);

    const fmt = (d: Date) => {
        // Ensure we format as YYYY-MM-DD based on local time values
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    windows.push({
      start: fmt(wStart),
      end: fmt(wEnd),
      priorStart: fmt(pStart),
      priorEnd: fmt(pEnd),
    });

    // Move to next Sunday
    current.setDate(current.getDate() + 7);
  }
  return windows;
}

export function aggregateReports(reports: HCRReport[]): HCRReport {
  if (reports.length === 0) throw new Error("No reports to aggregate");
  if (reports.length === 1) return reports[0];

  const sortedAsc = [...reports].sort((a, b) =>
    a.run_window.window_start.localeCompare(b.run_window.window_start)
  );

  const latest = sortedAsc[sortedAsc.length - 1];
  const earliest = sortedAsc[0];

  const normalizeIssueKey = (name: string): string =>
    name
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const numericSentiments = (issues: IssueEntry[]): number[] =>
    issues
      .map(i => (typeof i.sentiment_index === 'number' ? i.sentiment_index : null))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const mean = (values: number[]): number | null => {
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  const stdDev = (values: number[]): number | null => {
    const m = mean(values);
    if (m === null) return null;
    if (values.length < 2) return 0;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const computeOverallSentimentIndex = (report: HCRReport): number | 'unknown' => {
    const values = numericSentiments(report.top_issues);
    const avg = mean(values);
    return avg === null ? 'unknown' : Math.round(avg);
  };

  const periodSeries: PeriodWeekSummary[] = sortedAsc.map(report => ({
    week_start: report.run_window.window_start,
    week_end: report.run_window.window_end,
    overall_sentiment_index: computeOverallSentimentIndex(report),
    episode_count: report.sources_analyzed.length,
    top_issues: report.top_issues.map(issue => ({
      issue_name: issue.issue_name,
      sentiment_index: issue.sentiment_index,
      confidence: issue.confidence
    })),
    narrative_shifts: report.narrative_shifts.map(shift => shift.shift)
  }));

  type IssueObservation = { weekStart: string; sentiment: number };
  const issueObservations = new Map<string, { issueName: string; observations: IssueObservation[] }>();

  for (const report of sortedAsc) {
    for (const issue of report.top_issues) {
      if (typeof issue.sentiment_index !== 'number' || !Number.isFinite(issue.sentiment_index)) continue;
      const normalized = normalizeIssueKey(issue.issue_name);
      const entry = issueObservations.get(normalized) ?? { issueName: issue.issue_name, observations: [] };
      // Keep the most recent display name we saw for this normalized key.
      entry.issueName = issue.issue_name;
      entry.observations.push({ weekStart: report.run_window.window_start, sentiment: issue.sentiment_index });
      issueObservations.set(normalized, entry);
    }
  }

  const issueTrends: PeriodIssueTrend[] = Array.from(issueObservations.entries())
    .map(([normalizedName, entry]): PeriodIssueTrend => {
      const observations = [...entry.observations].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      const sentiments = observations.map(o => o.sentiment);
      const first = observations[0];
      const last = observations[observations.length - 1];

      const firstSentiment = first ? first.sentiment : 'unknown';
      const lastSentiment = last ? last.sentiment : 'unknown';
      const delta =
        typeof firstSentiment === 'number' && typeof lastSentiment === 'number' && observations.length >= 2
          ? Math.round(lastSentiment - firstSentiment)
          : 'unknown';

      const avg = mean(sentiments);
      const vol = stdDev(sentiments);

      return {
        issue_name: entry.issueName,
        normalized_name: normalizedName,
        weeks_present: observations.length,
        first_week_start: first?.weekStart ?? earliest.run_window.window_start,
        last_week_start: last?.weekStart ?? latest.run_window.window_start,
        first_sentiment: firstSentiment,
        last_sentiment: lastSentiment,
        delta,
        avg_sentiment: avg === null ? 'unknown' : Math.round(avg),
        volatility: vol === null ? 'unknown' : Number(vol.toFixed(1))
      };
    })
    .sort((a, b) => a.issue_name.localeCompare(b.issue_name));

  const trendsWithDelta = issueTrends.filter(t => typeof t.delta === 'number');
  const topGainers = [...trendsWithDelta].sort((a, b) => (b.delta as number) - (a.delta as number)).slice(0, 5);
  const topLosers = [...trendsWithDelta].sort((a, b) => (a.delta as number) - (b.delta as number)).slice(0, 5);

  const overallStart = periodSeries.length > 0 ? periodSeries[0].overall_sentiment_index : 'unknown';
  const overallEnd = periodSeries.length > 0 ? periodSeries[periodSeries.length - 1].overall_sentiment_index : 'unknown';
  const overallDelta =
    typeof overallStart === 'number' && typeof overallEnd === 'number'
      ? Math.round(overallEnd - overallStart)
      : 'unknown';

  const notes: string[] = [];
  if (typeof overallStart === 'number' && typeof overallEnd === 'number' && typeof overallDelta === 'number') {
    const dir = overallDelta === 0 ? 'flat' : overallDelta > 0 ? 'up' : 'down';
    notes.push(
      `Overall sentiment moved from ${overallStart} to ${overallEnd} (Δ ${overallDelta > 0 ? '+' : ''}${overallDelta}) across ${periodSeries.length} week(s) (${dir}).`
    );
  }

  // Largest week-to-week swing in overall sentiment (when available).
  let maxSwing: { delta: number; from: string; to: string } | null = null;
  for (let i = 1; i < periodSeries.length; i++) {
    const prev = periodSeries[i - 1].overall_sentiment_index;
    const cur = periodSeries[i].overall_sentiment_index;
    if (typeof prev !== 'number' || typeof cur !== 'number') continue;
    const d = cur - prev;
    if (!maxSwing || Math.abs(d) > Math.abs(maxSwing.delta)) {
      maxSwing = { delta: Math.round(d), from: periodSeries[i - 1].week_start, to: periodSeries[i].week_start };
    }
  }
  if (maxSwing) {
    notes.push(
      `Largest week-to-week swing: ${maxSwing.delta > 0 ? '+' : ''}${maxSwing.delta} points from week starting ${maxSwing.from} to ${maxSwing.to}.`
    );
  }

  const periodComparison: PeriodComparison = {
    week_count: periodSeries.length,
    overall_sentiment_start: overallStart,
    overall_sentiment_end: overallEnd,
    overall_sentiment_delta: overallDelta,
    top_gainers: topGainers,
    top_losers: topLosers,
    notes
  };

  const aggregatedExecutiveSummary: string[] = (() => {
    const bullets: string[] = [];
    if (periodComparison.notes.length > 0) {
      bullets.push(`Period overview: ${periodComparison.notes[0]}`);
    }
    const topUp = periodComparison.top_gainers[0];
    const topDown = periodComparison.top_losers[0];
    if (topUp && typeof topUp.delta === 'number') {
      bullets.push(`Top improver: ${topUp.issue_name} (+${topUp.delta} points from first to last observation).`);
    }
    if (topDown && typeof topDown.delta === 'number') {
      bullets.push(`Top decliner: ${topDown.issue_name} (${topDown.delta} points from first to last observation).`);
    }
    return [...bullets, ...latest.executive_summary];
  })();

  const trendLookup = new Map<string, PeriodIssueTrend>();
  issueTrends.forEach(t => trendLookup.set(t.normalized_name, t));

  const aggregatedTopIssues: IssueEntry[] = latest.top_issues.map(issue => {
    const normalized = normalizeIssueKey(issue.issue_name);
    const trend = trendLookup.get(normalized);
    if (!trend || typeof trend.delta !== 'number') {
      return {
        ...issue,
        delta_vs_period_start: 'unknown',
        what_changed_over_period: 'No multi-week baseline available for this issue in the selected range.'
      };
    }

    const change = trend.delta;
    const direction = change === 0 ? 'held steady' : change > 0 ? 'improved' : 'declined';
    return {
      ...issue,
      delta_vs_period_start: change,
      what_changed_over_period: `Since week starting ${trend.first_week_start}, sentiment ${direction} by ${change > 0 ? '+' : ''}${change} points (from ${trend.first_sentiment} → ${trend.last_sentiment}).`
    };
  });

  // Composite report: keep latest-week detail but attach period-level trend data.
  return {
    ...latest,
    run_window: {
      ...latest.run_window,
      window_start: earliest.run_window.window_start,
      window_end: latest.run_window.window_end
    },
    executive_summary: aggregatedExecutiveSummary,
    top_issues: aggregatedTopIssues,
    isAggregated: true,
    period_series: periodSeries,
    period_comparison: periodComparison
  };
}
