/**
 * Framework Version Management
 *
 * Tracks the current framework version for episode analysis and aggregation.
 * Used for selective reprocessing when analysis logic changes.
 */

/**
 * Current framework version
 *
 * Increment this when:
 * - Episode analysis prompt changes significantly
 * - Aggregation/ranking algorithm changes
 * - Topic extraction logic changes
 * - Any change that would produce different results for same input
 */
export const FRAMEWORK_VERSION = "v2.0.0";

/**
 * Framework changelog
 *
 * Documents major changes in each framework version.
 * Helps users understand what changed and why reprocessing may be needed.
 */
export const FRAMEWORK_CHANGELOG: Record<string, string> = {
  "v2.0.0": "Episode-centric architecture with parallel processing, improved topic extraction, and evidence-based delta descriptions",
  "v1.0.0": "Legacy week-centric architecture with sequential processing",
  "v1-legacy": "Migrated data from LocalStorage week-level reports"
};

/**
 * Get the changelog entry for a specific version
 */
export function getVersionChangelog(version: string): string {
  return FRAMEWORK_CHANGELOG[version] || "Unknown version";
}

/**
 * Compare two framework versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  // Handle special case of v1-legacy
  if (v1 === "v1-legacy") v1 = "v1.0.0";
  if (v2 === "v1-legacy") v2 = "v1.0.0";

  // Remove 'v' prefix if present
  const cleanV1 = v1.replace(/^v/, '');
  const cleanV2 = v2.replace(/^v/, '');

  // Split into major.minor.patch
  const parts1 = cleanV1.split('.').map(Number);
  const parts2 = cleanV2.split('.').map(Number);

  // Compare each part
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Check if a version is outdated compared to current framework version
 */
export function isVersionOutdated(version: string): boolean {
  return compareVersions(FRAMEWORK_VERSION, version) > 0;
}

/**
 * Get all known framework versions in descending order (newest first)
 */
export function getAllVersions(): string[] {
  return Object.keys(FRAMEWORK_CHANGELOG).sort((a, b) => compareVersions(b, a));
}
