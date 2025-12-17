import { HCRReport, IssueEntry } from "../types";

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

  // Sort by date descending (newest first)
  const sorted = [...reports].sort((a, b) => 
    new Date(b.run_window.window_end).getTime() - new Date(a.run_window.window_end).getTime()
  );

  const latest = sorted[0];
  const earliest = sorted[sorted.length - 1];

  // Create a composite report based on the latest data
  // For a dashboard, we primarily want the current state, but we expand the window to show coverage
  return {
    ...latest,
    run_window: {
      ...latest.run_window,
      window_start: earliest.run_window.window_start,
      window_end: latest.run_window.window_end
    },
    isAggregated: true
  };
}
