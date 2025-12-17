/**
 * Test file for migration utility
 *
 * This file demonstrates how to use the migration utility to convert
 * LocalStorage week-level data to IndexedDB episode-level data.
 *
 * Run in browser console:
 * 1. Open the app in a browser
 * 2. Copy this file's test functions to console
 * 3. Run testMigration()
 */

import { migrateWeeklyReportsToEpisodes, isMigrationNeeded, getMigrationStats } from './utils/migration';
import { getEpisodeCount, getAllEpisodes, getAllWeeklyAggregations } from './services/episodeDB';

/**
 * Test 1: Check if migration is needed
 */
export async function testMigrationCheck() {
  console.log('=== Test 1: Check Migration Status ===');

  const needed = isMigrationNeeded();
  console.log('Migration needed:', needed);

  if (needed) {
    const stats = getMigrationStats();
    console.log('Migration stats:', stats);
    console.log(`  - Weeks in LocalStorage: ${stats.weeksInLocalStorage}`);
    console.log(`  - Total episodes to migrate: ${stats.totalEpisodes}`);
  }
}

/**
 * Test 2: Run migration in dry-run mode
 */
export async function testMigrationDryRun() {
  console.log('\n=== Test 2: Dry Run Migration ===');

  const result = await migrateWeeklyReportsToEpisodes({ dryRun: true });

  console.log('Dry run result:', result);
  console.log(`  - Success: ${result.success}`);
  console.log(`  - Weeks processed: ${result.weeksProcessed}`);
  console.log(`  - Episodes created: ${result.episodesCreated}`);
  console.log(`  - Episodes updated: ${result.episodesUpdated}`);
  console.log(`  - Aggregations saved: ${result.aggregationsSaved}`);
  console.log(`  - Errors: ${result.errors.length}`);
  console.log(`  - Warnings: ${result.warnings.length}`);

  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }
}

/**
 * Test 3: Run actual migration
 */
export async function testMigrationReal() {
  console.log('\n=== Test 3: Real Migration ===');

  const result = await migrateWeeklyReportsToEpisodes({ dryRun: false, force: false });

  console.log('Migration result:', result);
  console.log(`  - Success: ${result.success}`);
  console.log(`  - Weeks processed: ${result.weeksProcessed}`);
  console.log(`  - Episodes created: ${result.episodesCreated}`);
  console.log(`  - Episodes updated: ${result.episodesUpdated}`);
  console.log(`  - Aggregations saved: ${result.aggregationsSaved}`);
  console.log(`  - Errors: ${result.errors.length}`);
  console.log(`  - Warnings: ${result.warnings.length}`);

  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn('Warnings:', result.warnings);
  }
}

/**
 * Test 4: Verify migrated data in IndexedDB
 */
export async function testVerifyMigration() {
  console.log('\n=== Test 4: Verify Migrated Data ===');

  const episodeCount = await getEpisodeCount();
  console.log(`Total episodes in IndexedDB: ${episodeCount}`);

  const episodes = await getAllEpisodes();
  console.log(`Retrieved ${episodes.length} episodes`);

  if (episodes.length > 0) {
    console.log('\nSample episode:');
    const sample = episodes[0];
    console.log(`  - Episode ID: ${sample.episode_id}`);
    console.log(`  - Show: ${sample.show_name}`);
    console.log(`  - Title: ${sample.title}`);
    console.log(`  - Published: ${sample.published_at}`);
    console.log(`  - Topics: ${sample.topics.length}`);
    console.log(`  - Overall sentiment: ${sample.overall_sentiment}`);
    console.log(`  - Framework version: ${sample.framework_version}`);
  }

  const aggregations = await getAllWeeklyAggregations();
  console.log(`\nTotal weekly aggregations: ${aggregations.length}`);

  if (aggregations.length > 0) {
    console.log('\nSample aggregation:');
    const sample = aggregations[0];
    console.log(`  - Week start: ${sample.week_start}`);
    console.log(`  - Week end: ${sample.week_end}`);
    console.log(`  - Episode count: ${sample.episode_ids.length}`);
    console.log(`  - Top issues: ${sample.top_issues.length}`);
    console.log(`  - Framework version: ${sample.framework_version}`);
  }
}

/**
 * Run all tests in sequence
 */
export async function testMigration() {
  console.log('🧪 Starting Migration Tests...\n');

  try {
    await testMigrationCheck();
    await testMigrationDryRun();

    // Prompt user before running real migration
    console.log('\n⚠️ Ready to run REAL migration. This will write to IndexedDB.');
    console.log('To proceed, run: testMigrationReal()');
    console.log('To verify results after migration, run: testVerifyMigration()');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Instructions
console.log(`
Migration Test Suite
====================

Available test functions:
1. testMigrationCheck() - Check if migration is needed and get stats
2. testMigrationDryRun() - Simulate migration without writing to database
3. testMigrationReal() - Run actual migration (writes to IndexedDB)
4. testVerifyMigration() - Verify migrated data in IndexedDB

Quick start:
- Run testMigration() to run tests 1 and 2
- If successful, run testMigrationReal() to perform actual migration
- Finally, run testVerifyMigration() to confirm data was migrated correctly
`);
