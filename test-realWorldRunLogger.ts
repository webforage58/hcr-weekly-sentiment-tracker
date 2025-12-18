/**
 * Real-World 52-Week Run Logger (Task 5.2 helper)
 *
 * Usage:
 * 1. Start dev server: `npm run dev`
 * 2. Open browser console
 * 3. Run:
 *    - window.realWorldRunLogger.armCold()
 *    - (set date range to ~52 weeks in the UI and click Generate)
 *    - After completion, a state.md checklist block is printed to the console
 * 4. Then run a warm-cache rerun:
 *    - window.realWorldRunLogger.armWarm()
 *    - Click Generate again with the same date range
 */

import {
  createRealWorld52WeekTestLogger,
  setActiveRealWorld52WeekTestLogger
} from './utils/realWorldRunLogger';

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function suggest52WeekRange(endDate?: string): { startDate: string; endDate: string } {
  const end = endDate ?? new Date().toISOString().slice(0, 10);
  // 52 weeks ≈ 364 days
  const start = addDaysYmd(end, -364);
  return { startDate: start, endDate: end };
}

if (typeof window !== 'undefined') {
  const logger = createRealWorld52WeekTestLogger({ memorySampleIntervalMs: 500 });
  setActiveRealWorld52WeekTestLogger(logger);

  (window as any).realWorldRunLogger = {
    armCold: () => {
      logger.reset();
      logger.arm('cold');
      console.log('[RealWorldRunLogger] Armed for cold-cache run.');
      console.log('[RealWorldRunLogger] Suggested 52-week range:', suggest52WeekRange());
    },
    armWarm: () => {
      logger.arm('warm');
      console.log('[RealWorldRunLogger] Armed for warm-cache run.');
    },
    reset: () => {
      logger.reset();
      console.log('[RealWorldRunLogger] Reset.');
    },
    print: () => logger.printStateMdChecklistBlock(),
    getBlock: () => logger.getStateMdChecklistBlock(),
    suggest52WeekRange
  };

  console.log('Real-world run logger loaded!');
  console.log('Commands:');
  console.log('  - window.realWorldRunLogger.armCold()');
  console.log('  - window.realWorldRunLogger.armWarm()');
  console.log('  - window.realWorldRunLogger.print()');
  console.log('  - window.realWorldRunLogger.suggest52WeekRange()');
}

export {};

