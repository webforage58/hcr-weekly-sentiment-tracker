import { HCRReport } from "../types";

const STORAGE_KEY = "hcr_sentiment_weeks";

export const storageService = {
  /**
   * Load all cached weeks from LocalStorage
   */
  getAllWeeks(): Record<string, HCRReport> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error("Failed to load state", e);
      return {};
    }
  },

  /**
   * Get a specific week by its start date (YYYY-MM-DD)
   */
  getWeek(startDate: string): HCRReport | null {
    const all = this.getAllWeeks();
    return all[startDate] || null;
  },

  /**
   * Save a report for a specific week
   */
  saveWeek(startDate: string, report: HCRReport): void {
    const all = this.getAllWeeks();
    all[startDate] = report;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.error("Failed to save week - likely exceeded LocalStorage quota", e);
    }
  },

  /**
   * Check if we have analysis for a specific week start date
   */
  hasWeek(startDate: string): boolean {
    const all = this.getAllWeeks();
    return !!all[startDate];
  },

  /**
   * Clear all cached data
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
};
