/**
 * Test Suite for Episode Search API
 *
 * This file contains manual test functions for the episode search functionality.
 * Run these tests in the browser console after starting the dev server.
 *
 * Usage:
 * 1. Start dev server: npm run dev
 * 2. Open browser console
 * 3. Import this module and run test functions
 */

import { searchEpisodesInRange, searchEpisodesWithValidation, validateDateFormat } from './services/episodeSearch';
import { getSearchCache, clearAllSearchCache, clearExpiredSearchCache } from './services/episodeDB';

/**
 * Test 1: Basic Episode Search
 * Tests searching for episodes in a 7-day range
 */
export async function testBasicSearch() {
  console.log('\n=== Test 1: Basic Episode Search ===');

  try {
    const startDate = '2025-01-15';
    const endDate = '2025-01-21';

    console.log(`Searching for episodes from ${startDate} to ${endDate}...`);
    const episodes = await searchEpisodesInRange(startDate, endDate);

    console.log(`✅ Found ${episodes.length} episodes`);
    console.table(episodes.map(ep => ({
      ID: ep.episode_id,
      Show: ep.show_name,
      Title: ep.title.substring(0, 50),
      Date: ep.published_at
    })));

    return episodes;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 2: Cache Hit
 * Tests that repeated searches use cached results
 */
export async function testCacheHit() {
  console.log('\n=== Test 2: Cache Hit Test ===');

  try {
    const startDate = '2025-01-15';
    const endDate = '2025-01-21';

    console.log('First search (should call API)...');
    const start1 = performance.now();
    const episodes1 = await searchEpisodesInRange(startDate, endDate);
    const time1 = performance.now() - start1;

    console.log(`First search: ${episodes1.length} episodes in ${time1.toFixed(0)}ms`);

    console.log('\nSecond search (should use cache)...');
    const start2 = performance.now();
    const episodes2 = await searchEpisodesInRange(startDate, endDate);
    const time2 = performance.now() - start2;

    console.log(`Second search: ${episodes2.length} episodes in ${time2.toFixed(0)}ms`);

    if (time2 < time1 / 10) {
      console.log('✅ Cache working! Second search was significantly faster');
    } else {
      console.warn('⚠️  Cache might not be working properly');
    }

    return { episodes1, episodes2, time1, time2 };
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 3: No Episodes Found
 * Tests handling of date ranges with no episodes
 */
export async function testNoEpisodesFound() {
  console.log('\n=== Test 3: No Episodes Found ===');

  try {
    // Use a date range far in the future
    const startDate = '2030-01-01';
    const endDate = '2030-01-07';

    console.log(`Searching for episodes from ${startDate} to ${endDate}...`);
    const episodes = await searchEpisodesInRange(startDate, endDate);

    console.log(`✅ Returned ${episodes.length} episodes (expected 0)`);

    if (episodes.length === 0) {
      console.log('✅ Correctly handled empty result');
    } else {
      console.warn('⚠️  Expected empty array but got episodes');
    }

    return episodes;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 4: Date Validation
 * Tests input validation for date formats
 */
export async function testDateValidation() {
  console.log('\n=== Test 4: Date Validation ===');

  const validDates = ['2025-01-15', '2024-12-31', '2023-06-01'];
  const invalidDates = ['2025-1-15', '01-15-2025', '2025/01/15', 'invalid', ''];

  console.log('Testing valid dates:');
  for (const date of validDates) {
    const isValid = validateDateFormat(date);
    console.log(`  ${date}: ${isValid ? '✅' : '❌'}`);
  }

  console.log('\nTesting invalid dates:');
  for (const date of invalidDates) {
    const isValid = validateDateFormat(date);
    console.log(`  "${date}": ${isValid ? '❌ Should be invalid' : '✅ Correctly rejected'}`);
  }

  console.log('\n✅ Date validation test complete');
}

/**
 * Test 5: Validation Wrapper
 * Tests the searchEpisodesWithValidation wrapper function
 */
export async function testValidationWrapper() {
  console.log('\n=== Test 5: Validation Wrapper ===');

  // Test valid input
  console.log('Testing valid input...');
  const result1 = await searchEpisodesWithValidation('2025-01-15', '2025-01-21');
  console.log(`Result: ${result1.success ? '✅ Success' : '❌ Failed'}`);
  if (result1.episodes) {
    console.log(`  Found ${result1.episodes.length} episodes`);
  }

  // Test invalid start date
  console.log('\nTesting invalid start date...');
  const result2 = await searchEpisodesWithValidation('2025-1-15', '2025-01-21');
  console.log(`Result: ${result2.success ? '❌ Should fail' : '✅ Correctly rejected'}`);
  console.log(`  Error: ${result2.error}`);

  // Test invalid date range (start > end)
  console.log('\nTesting invalid date range (start > end)...');
  const result3 = await searchEpisodesWithValidation('2025-01-21', '2025-01-15');
  console.log(`Result: ${result3.success ? '❌ Should fail' : '✅ Correctly rejected'}`);
  console.log(`  Error: ${result3.error}`);

  console.log('\n✅ Validation wrapper test complete');
}

/**
 * Test 6: Cache Management
 * Tests cache inspection and cleanup functions
 */
export async function testCacheManagement() {
  console.log('\n=== Test 6: Cache Management ===');

  try {
    // First, do a search to create cache entry
    console.log('Creating cache entry...');
    await searchEpisodesInRange('2025-01-15', '2025-01-21');

    // Check cache exists
    console.log('\nChecking cache...');
    const cacheKey = 'search_2025-01-15_2025-01-21';
    const cached = await getSearchCache(cacheKey);

    if (cached) {
      console.log('✅ Cache entry found');
      console.log(`  Episodes: ${cached.episodes.length}`);
      console.log(`  Cached at: ${cached.cached_at}`);
      console.log(`  Expires at: ${cached.expires_at}`);
    } else {
      console.warn('⚠️  Cache entry not found');
    }

    // Test cleanup of expired entries
    console.log('\nClearing expired cache entries...');
    const clearedCount = await clearExpiredSearchCache();
    console.log(`✅ Cleared ${clearedCount} expired entries`);

    console.log('\n✅ Cache management test complete');

    return cached;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 7: Multi-Week Search
 * Tests searching for episodes across multiple weeks
 */
export async function testMultiWeekSearch() {
  console.log('\n=== Test 7: Multi-Week Search ===');

  try {
    const startDate = '2025-01-01';
    const endDate = '2025-01-31'; // Full month

    console.log(`Searching for episodes across full month: ${startDate} to ${endDate}...`);
    const episodes = await searchEpisodesInRange(startDate, endDate);

    console.log(`✅ Found ${episodes.length} episodes`);

    // Group by week
    const byWeek = new Map<string, number>();
    episodes.forEach(ep => {
      const date = new Date(ep.published_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Get Sunday
      const weekKey = weekStart.toISOString().split('T')[0];
      byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + 1);
    });

    console.log('\nEpisodes by week:');
    Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([week, count]) => {
        console.log(`  ${week}: ${count} episodes`);
      });

    return episodes;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Run all tests sequentially
 */
export async function runAllTests() {
  console.log('\n'.repeat(2));
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║     Episode Search API Test Suite                ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  const tests = [
    { name: 'Date Validation', fn: testDateValidation },
    { name: 'Validation Wrapper', fn: testValidationWrapper },
    { name: 'Basic Search', fn: testBasicSearch },
    { name: 'Cache Hit', fn: testCacheHit },
    { name: 'No Episodes Found', fn: testNoEpisodesFound },
    { name: 'Cache Management', fn: testCacheManagement },
    { name: 'Multi-Week Search', fn: testMultiWeekSearch },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`Test "${test.name}" failed:`, error);
    }
  }

  console.log('\n'.repeat(2));
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║     Test Summary                                  ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`Total tests: ${tests.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log('\n');
}

/**
 * Clear all search cache for testing purposes
 */
export async function clearCache() {
  console.log('Clearing all search cache...');
  await clearAllSearchCache();
  console.log('✅ Cache cleared');
}

// Make functions available globally in browser console for manual testing
if (typeof window !== 'undefined') {
  (window as any).episodeSearchTests = {
    testBasicSearch,
    testCacheHit,
    testNoEpisodesFound,
    testDateValidation,
    testValidationWrapper,
    testCacheManagement,
    testMultiWeekSearch,
    runAllTests,
    clearCache
  };

  console.log('Episode Search Tests loaded. Available functions:');
  console.log('  window.episodeSearchTests.runAllTests()');
  console.log('  window.episodeSearchTests.testBasicSearch()');
  console.log('  window.episodeSearchTests.testCacheHit()');
  console.log('  window.episodeSearchTests.clearCache()');
}
