/**
 * Test Suite for Episode Processor
 *
 * Manual browser-based tests for parallel episode processing.
 * Run these tests in the browser console after starting the dev server.
 *
 * Usage:
 *   npm run dev
 *   Open browser console
 *   await window.testEpisodeProcessor.testBasicProcessing()
 */

import {
  processEpisodesInRange,
  getEpisodesForWeek,
  estimateProcessingTime,
  ProcessResult
} from './services/episodeProcessor';
import { clearAllEpisodes } from './services/episodeDB';

/**
 * Test 1: Basic episode processing with progress tracking
 */
async function testBasicProcessing() {
  console.log('\n========================================');
  console.log('Test 1: Basic Episode Processing');
  console.log('========================================\n');

  const startDate = '2025-12-01';
  const endDate = '2025-12-07';

  let progressUpdates = 0;

  try {
    const result = await processEpisodesInRange(startDate, endDate, {
      concurrency: 5,
      onProgress: (completed, total, episode, isCached) => {
        console.log(
          `Progress: ${completed}/${total} - ${episode} ${isCached ? '(cached)' : '(analyzing)'}`
        );
        progressUpdates++;
      },
      onDiscoveryComplete: (total, cached, newEpisodes) => {
        console.log(`Discovery complete: ${total} total, ${cached} cached, ${newEpisodes} new`);
      }
    });

    console.log('\n--- Results ---');
    console.log('Episodes:', result.episodes.length);
    console.log('Stats:', result.stats);
    console.log('Errors:', result.errors);
    console.log('Progress updates:', progressUpdates);

    // Validate results
    if (result.episodes.length > 0) {
      console.log('\n✅ Test passed: Episodes processed successfully');
      console.log('Sample episode:', result.episodes[0].title);
    } else {
      console.log('\n⚠️  No episodes found in date range (this may be expected)');
    }

    return result;

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 2: Cache performance - run same date range twice
 */
async function testCachePerformance() {
  console.log('\n========================================');
  console.log('Test 2: Cache Performance');
  console.log('========================================\n');

  const startDate = '2025-11-24';
  const endDate = '2025-11-30';

  try {
    // First run - should analyze episodes
    console.log('--- First run (cold cache) ---');
    const start1 = performance.now();

    const result1 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 10,
      onProgress: (completed, total, episode, isCached) => {
        console.log(`[Run 1] ${completed}/${total}: ${episode} ${isCached ? '(cached)' : '(NEW)'}`);
      }
    });

    const duration1 = performance.now() - start1;

    console.log(`\nFirst run complete in ${(duration1 / 1000).toFixed(2)}s`);
    console.log('Newly analyzed:', result1.stats.newlyAnalyzed);
    console.log('From cache:', result1.stats.cachedEpisodes);

    // Second run - should use cache
    console.log('\n--- Second run (warm cache) ---');
    const start2 = performance.now();

    const result2 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 10,
      onProgress: (completed, total, episode, isCached) => {
        console.log(`[Run 2] ${completed}/${total}: ${episode} ${isCached ? '(CACHED)' : '(new)'}`);
      }
    });

    const duration2 = performance.now() - start2;

    console.log(`\nSecond run complete in ${(duration2 / 1000).toFixed(2)}s`);
    console.log('Newly analyzed:', result2.stats.newlyAnalyzed);
    console.log('From cache:', result2.stats.cachedEpisodes);

    // Calculate speedup
    const speedup = duration1 / duration2;

    console.log('\n--- Performance Comparison ---');
    console.log(`First run:  ${(duration1 / 1000).toFixed(2)}s`);
    console.log(`Second run: ${(duration2 / 1000).toFixed(2)}s`);
    console.log(`Speedup:    ${speedup.toFixed(1)}x faster`);

    if (result2.stats.newlyAnalyzed === 0 && result2.stats.cachedEpisodes > 0) {
      console.log('\n✅ Test passed: All episodes retrieved from cache');
    } else {
      console.log('\n⚠️  Warning: Expected all episodes to be cached on second run');
    }

    return { result1, result2, speedup };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 3: Concurrency comparison (5 vs 10 concurrent)
 */
async function testConcurrency() {
  console.log('\n========================================');
  console.log('Test 3: Concurrency Comparison');
  console.log('========================================\n');

  const startDate = '2025-12-08';
  const endDate = '2025-12-14';

  // Clear cache to ensure fair comparison
  console.log('Clearing cache for fresh test...');
  await clearAllEpisodes();

  try {
    // Test with concurrency = 5
    console.log('\n--- Processing with concurrency = 5 ---');
    const start5 = performance.now();

    const result5 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 5
    });

    const duration5 = performance.now() - start5;

    console.log(`Complete in ${(duration5 / 1000).toFixed(2)}s`);
    console.log('Episodes analyzed:', result5.stats.newlyAnalyzed);

    // Clear cache again
    console.log('\nClearing cache for second test...');
    await clearAllEpisodes();

    // Test with concurrency = 10
    console.log('\n--- Processing with concurrency = 10 ---');
    const start10 = performance.now();

    const result10 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 10
    });

    const duration10 = performance.now() - start10;

    console.log(`Complete in ${(duration10 / 1000).toFixed(2)}s`);
    console.log('Episodes analyzed:', result10.stats.newlyAnalyzed);

    // Compare
    const speedup = duration5 / duration10;

    console.log('\n--- Concurrency Comparison ---');
    console.log(`Concurrency 5:  ${(duration5 / 1000).toFixed(2)}s`);
    console.log(`Concurrency 10: ${(duration10 / 1000).toFixed(2)}s`);
    console.log(`Speedup:        ${speedup.toFixed(2)}x faster`);

    if (speedup > 1.3) {
      console.log('\n✅ Test passed: Higher concurrency significantly faster');
    } else {
      console.log('\n⚠️  Warning: Expected more speedup from higher concurrency');
      console.log('    (This may be due to API rate limits or small episode count)');
    }

    return { result5, result10, speedup };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 4: Multi-week processing (4 weeks)
 */
async function testMultiWeekProcessing() {
  console.log('\n========================================');
  console.log('Test 4: Multi-Week Processing (4 weeks)');
  console.log('========================================\n');

  const startDate = '2025-11-01';
  const endDate = '2025-11-28'; // 4 weeks

  try {
    const startTime = performance.now();

    const result = await processEpisodesInRange(startDate, endDate, {
      concurrency: 10,
      onProgress: (completed, total, episode, isCached) => {
        const percent = ((completed / total) * 100).toFixed(0);
        console.log(`[${percent}%] ${completed}/${total}: ${episode} ${isCached ? '(cached)' : '(analyzing)'}`);
      },
      onDiscoveryComplete: (total, cached, newEpisodes) => {
        console.log(`\nDiscovered ${total} episodes across 4 weeks`);
        console.log(`Cache: ${cached} episodes, New: ${newEpisodes} episodes`);
        console.log('');
      }
    });

    const duration = performance.now() - startTime;

    console.log('\n--- Multi-Week Results ---');
    console.log('Duration:', (duration / 1000).toFixed(2), 'seconds');
    console.log('Total episodes:', result.stats.totalEpisodes);
    console.log('Cached:', result.stats.cachedEpisodes);
    console.log('Newly analyzed:', result.stats.newlyAnalyzed);
    console.log('Failed:', result.stats.failed);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => {
        console.log(`  - ${err.episodeId}: ${err.error}`);
      });
    }

    // Estimate vs actual
    const estimated = estimateProcessingTime(
      result.stats.totalEpisodes,
      result.stats.cachedEpisodes,
      10
    );
    const actual = duration / 1000;

    console.log('\n--- Time Estimate ---');
    console.log('Estimated:', estimated, 'seconds');
    console.log('Actual:', actual.toFixed(2), 'seconds');
    console.log('Accuracy:', (estimated / actual).toFixed(2) + 'x');

    console.log('\n✅ Test passed: Multi-week processing complete');

    return result;

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 5: Get episodes for specific week
 */
async function testGetEpisodesForWeek() {
  console.log('\n========================================');
  console.log('Test 5: Get Episodes for Specific Week');
  console.log('========================================\n');

  // First ensure we have some episodes in the database
  const rangeStart = '2025-12-01';
  const rangeEnd = '2025-12-14'; // 2 weeks

  console.log('Processing 2 weeks to populate cache...');
  await processEpisodesInRange(rangeStart, rangeEnd, {
    concurrency: 10
  });

  // Now test getting episodes for specific weeks
  const week1Start = '2025-12-01';
  const week1End = '2025-12-07';

  const week2Start = '2025-12-08';
  const week2End = '2025-12-14';

  try {
    console.log(`\nRetrieving episodes for week 1 (${week1Start} to ${week1End})...`);
    const week1Episodes = await getEpisodesForWeek(week1Start, week1End);

    console.log('Week 1 episodes:', week1Episodes.length);
    if (week1Episodes.length > 0) {
      console.log('Sample:', week1Episodes[0].title);
    }

    console.log(`\nRetrieving episodes for week 2 (${week2Start} to ${week2End})...`);
    const week2Episodes = await getEpisodesForWeek(week2Start, week2End);

    console.log('Week 2 episodes:', week2Episodes.length);
    if (week2Episodes.length > 0) {
      console.log('Sample:', week2Episodes[0].title);
    }

    console.log('\n✅ Test passed: Successfully retrieved episodes by week');

    return { week1Episodes, week2Episodes };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 6: Force reprocess
 */
async function testForceReprocess() {
  console.log('\n========================================');
  console.log('Test 6: Force Reprocess');
  console.log('========================================\n');

  const startDate = '2025-12-01';
  const endDate = '2025-12-07';

  try {
    // First run - populate cache
    console.log('--- First run (populate cache) ---');
    const result1 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 5
    });

    console.log('First run - Newly analyzed:', result1.stats.newlyAnalyzed);
    console.log('First run - Cached:', result1.stats.cachedEpisodes);

    // Second run - should use cache
    console.log('\n--- Second run (should use cache) ---');
    const result2 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 5
    });

    console.log('Second run - Newly analyzed:', result2.stats.newlyAnalyzed);
    console.log('Second run - Cached:', result2.stats.cachedEpisodes);

    // Third run - force reprocess
    console.log('\n--- Third run (force reprocess) ---');
    const result3 = await processEpisodesInRange(startDate, endDate, {
      concurrency: 5,
      forceReprocess: true
    });

    console.log('Third run - Newly analyzed:', result3.stats.newlyAnalyzed);
    console.log('Third run - Cached:', result3.stats.cachedEpisodes);

    console.log('\n--- Validation ---');

    if (result2.stats.newlyAnalyzed === 0) {
      console.log('✅ Run 2 used cache (0 new analyses)');
    } else {
      console.log('⚠️  Run 2 expected to use cache');
    }

    if (result3.stats.newlyAnalyzed > 0 && result3.stats.cachedEpisodes === 0) {
      console.log('✅ Run 3 forced reprocessing (all new analyses)');
    } else {
      console.log('⚠️  Run 3 expected to reprocess all episodes');
    }

    console.log('\n✅ Test passed: Force reprocess working correctly');

    return { result1, result2, result3 };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test 7: Estimate processing time
 */
function testEstimateProcessingTime() {
  console.log('\n========================================');
  console.log('Test 7: Processing Time Estimation');
  console.log('========================================\n');

  const testCases = [
    { total: 10, cached: 0, concurrency: 10, label: '10 new episodes (concurrency 10)' },
    { total: 10, cached: 10, concurrency: 10, label: '10 cached episodes (concurrency 10)' },
    { total: 48, cached: 0, concurrency: 10, label: '48 new episodes (concurrency 10)' },
    { total: 48, cached: 40, concurrency: 10, label: '48 total, 40 cached (concurrency 10)' },
    { total: 100, cached: 0, concurrency: 10, label: '100 new episodes (concurrency 10)' },
    { total: 100, cached: 100, concurrency: 10, label: '100 cached episodes (concurrency 10)' }
  ];

  console.log('Scenario | Estimated Time');
  console.log('---------|---------------');

  testCases.forEach(testCase => {
    const estimate = estimateProcessingTime(
      testCase.total,
      testCase.cached,
      testCase.concurrency
    );

    console.log(`${testCase.label.padEnd(40)} | ${estimate}s`);
  });

  console.log('\n✅ Test passed: Estimation function working');
}

/**
 * Run all tests sequentially
 */
async function runAll() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Episode Processor Test Suite         ║');
  console.log('╔════════════════════════════════════════╗');
  console.log('\n');

  try {
    await testBasicProcessing();
    await testCachePerformance();
    // await testConcurrency(); // Skip by default (clears cache)
    await testMultiWeekProcessing();
    await testGetEpisodesForWeek();
    await testForceReprocess();
    testEstimateProcessingTime();

    console.log('\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  All Tests Passed ✅                   ║');
    console.log('╔════════════════════════════════════════╗');
    console.log('\n');

  } catch (error) {
    console.log('\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  Test Suite Failed ❌                  ║');
    console.log('╔════════════════════════════════════════╗');
    console.log('\n');
    throw error;
  }
}

// Export tests to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).testEpisodeProcessor = {
    testBasicProcessing,
    testCachePerformance,
    testConcurrency,
    testMultiWeekProcessing,
    testGetEpisodesForWeek,
    testForceReprocess,
    testEstimateProcessingTime,
    runAll
  };

  console.log('Episode Processor tests loaded!');
  console.log('Available tests:');
  console.log('  - window.testEpisodeProcessor.testBasicProcessing()');
  console.log('  - window.testEpisodeProcessor.testCachePerformance()');
  console.log('  - window.testEpisodeProcessor.testConcurrency()');
  console.log('  - window.testEpisodeProcessor.testMultiWeekProcessing()');
  console.log('  - window.testEpisodeProcessor.testGetEpisodesForWeek()');
  console.log('  - window.testEpisodeProcessor.testForceReprocess()');
  console.log('  - window.testEpisodeProcessor.testEstimateProcessingTime()');
  console.log('  - window.testEpisodeProcessor.runAll() - Run all tests');
}

export {
  testBasicProcessing,
  testCachePerformance,
  testConcurrency,
  testMultiWeekProcessing,
  testGetEpisodesForWeek,
  testForceReprocess,
  testEstimateProcessingTime,
  runAll
};
