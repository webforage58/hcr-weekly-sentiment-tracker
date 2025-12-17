/**
 * Test file for the new analyzeEpisode() function
 *
 * This demonstrates the new episode-centric analysis capability introduced in Phase 2.
 *
 * USAGE (in browser console):
 * 1. Start dev server: npm run dev
 * 2. Open http://localhost:3000 in browser
 * 3. Open browser DevTools console
 * 4. Run: await window.testAnalyzeEpisode.testSingleEpisode()
 */

import { analyzeEpisode } from './services/gemini';
import { saveEpisode, getEpisode } from './services/episodeDB';
import type { EpisodeMetadata, EpisodeInsight } from './types';

/**
 * Test 1: Analyze a single episode
 */
async function testSingleEpisode() {
  console.log('=== Test 1: Analyze Single Episode ===');

  const metadata: EpisodeMetadata = {
    episode_id: 'test-episode-2025-01-15',
    show_name: 'Politics Chat',
    title: 'January 15, 2025 Politics Discussion',
    published_at: '2025-01-15',
    transcript_url: undefined
  };

  try {
    console.log('Analyzing episode:', metadata);
    const start = Date.now();

    const insight = await analyzeEpisode(
      metadata.episode_id,
      metadata,
      'v2'
    );

    const elapsed = Date.now() - start;
    console.log(`✓ Analysis completed in ${(elapsed / 1000).toFixed(1)}s`);
    console.log('Episode Insight:', insight);
    console.log('Topics found:', insight.topics.length);
    console.log('Overall sentiment:', insight.overall_sentiment);
    console.log('Trump admin focus:', insight.trump_admin_focus);
    console.log('Key quotes:', insight.key_quotes.length);

    // Save to IndexedDB
    await saveEpisode(insight);
    console.log('✓ Saved to IndexedDB');

    return insight;
  } catch (error) {
    console.error('✗ Test failed:', error);
    throw error;
  }
}

/**
 * Test 2: Analyze and cache multiple episodes
 */
async function testMultipleEpisodes() {
  console.log('=== Test 2: Analyze Multiple Episodes ===');

  const episodes: EpisodeMetadata[] = [
    {
      episode_id: 'test-ep-1',
      show_name: 'Politics Chat',
      title: 'Episode 1',
      published_at: '2025-01-10'
    },
    {
      episode_id: 'test-ep-2',
      show_name: 'Politics Chat',
      title: 'Episode 2',
      published_at: '2025-01-12'
    },
    {
      episode_id: 'test-ep-3',
      show_name: 'Politics Chat',
      title: 'Episode 3',
      published_at: '2025-01-14'
    }
  ];

  try {
    console.log(`Analyzing ${episodes.length} episodes sequentially...`);
    const start = Date.now();

    const insights: EpisodeInsight[] = [];
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      console.log(`\n[${i + 1}/${episodes.length}] Analyzing: ${ep.title}`);

      const insight = await analyzeEpisode(ep.episode_id, ep, 'v2');
      insights.push(insight);

      // Save to cache
      await saveEpisode(insight);
      console.log(`✓ Cached episode ${i + 1}`);
    }

    const elapsed = Date.now() - start;
    console.log(`\n✓ All episodes analyzed in ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`Average: ${(elapsed / episodes.length / 1000).toFixed(1)}s per episode`);

    return insights;
  } catch (error) {
    console.error('✗ Test failed:', error);
    throw error;
  }
}

/**
 * Test 3: Retrieve cached episode (no API call)
 */
async function testCachedRetrieval() {
  console.log('=== Test 3: Cached Episode Retrieval ===');

  const episodeId = 'test-episode-2025-01-15';

  try {
    console.log('Retrieving from cache:', episodeId);
    const start = Date.now();

    const cached = await getEpisode(episodeId);

    const elapsed = Date.now() - start;

    if (cached) {
      console.log(`✓ Retrieved from cache in ${elapsed}ms`);
      console.log('Episode:', cached.title);
      console.log('Framework version:', cached.framework_version);
      console.log('Topics:', cached.topics.length);
      return cached;
    } else {
      console.log('✗ Episode not found in cache');
      console.log('Tip: Run testSingleEpisode() first to populate cache');
      return null;
    }
  } catch (error) {
    console.error('✗ Test failed:', error);
    throw error;
  }
}

/**
 * Test 4: Compare analysis time vs cache retrieval
 */
async function testCachePerformance() {
  console.log('=== Test 4: Cache Performance Comparison ===');

  const metadata: EpisodeMetadata = {
    episode_id: 'perf-test-episode',
    show_name: 'Politics Chat',
    title: 'Performance Test Episode',
    published_at: '2025-01-15'
  };

  try {
    // First run: Full analysis
    console.log('First run: Full analysis with API call...');
    const start1 = Date.now();
    const insight = await analyzeEpisode(metadata.episode_id, metadata, 'v2');
    await saveEpisode(insight);
    const elapsed1 = Date.now() - start1;
    console.log(`✓ Analysis + cache save: ${(elapsed1 / 1000).toFixed(1)}s`);

    // Second run: Cache retrieval
    console.log('\nSecond run: Cache retrieval (no API call)...');
    const start2 = Date.now();
    const cached = await getEpisode(metadata.episode_id);
    const elapsed2 = Date.now() - start2;
    console.log(`✓ Cache retrieval: ${elapsed2}ms`);

    // Performance comparison
    const speedup = elapsed1 / elapsed2;
    console.log(`\n=== Performance Comparison ===`);
    console.log(`First run:  ${(elapsed1 / 1000).toFixed(1)}s`);
    console.log(`Second run: ${elapsed2}ms`);
    console.log(`Speedup:    ${speedup.toFixed(0)}x faster`);

    return { insight, cached, speedup };
  } catch (error) {
    console.error('✗ Test failed:', error);
    throw error;
  }
}

/**
 * Test 5: Validate episode insight structure
 */
async function testInsightValidation() {
  console.log('=== Test 5: Episode Insight Validation ===');

  const metadata: EpisodeMetadata = {
    episode_id: 'validation-test',
    show_name: 'Politics Chat',
    title: 'Validation Test',
    published_at: '2025-01-15'
  };

  try {
    const insight = await analyzeEpisode(metadata.episode_id, metadata, 'v2');

    // Validate structure
    const checks = {
      'Has episode_id': !!insight.episode_id,
      'Has show_name': !!insight.show_name,
      'Has title': !!insight.title,
      'Has published_at': !!insight.published_at,
      'Has topics array': Array.isArray(insight.topics),
      'Has at least 1 topic': insight.topics.length > 0,
      'Has overall_sentiment': typeof insight.overall_sentiment === 'number',
      'Sentiment in range 0-100': insight.overall_sentiment >= 0 && insight.overall_sentiment <= 100,
      'Has trump_admin_focus': typeof insight.trump_admin_focus === 'boolean',
      'Has key_quotes': Array.isArray(insight.key_quotes),
      'Has framework_version': !!insight.framework_version,
      'Has processed_at': !!insight.processed_at,
      'Has model_used': !!insight.model_used
    };

    console.log('Validation Results:');
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`${passed ? '✓' : '✗'} ${check}`);
    }

    // Validate topic structure
    if (insight.topics.length > 0) {
      const topic = insight.topics[0];
      console.log('\nTopic Structure Validation:');
      console.log(`✓ Topic name: "${topic.topic_name}"`);
      console.log(`✓ Sentiment score: ${topic.sentiment_score} (0-100)`);
      console.log(`✓ Confidence: ${topic.confidence} (0-1)`);
      console.log(`✓ Evidence quotes: ${topic.evidence_quotes.length}`);
      console.log(`✓ Prominence: ${topic.prominence_score} (0-1)`);
    }

    const allPassed = Object.values(checks).every(v => v);
    console.log(`\n${allPassed ? '✓' : '✗'} Overall validation: ${allPassed ? 'PASSED' : 'FAILED'}`);

    return { insight, checks, allPassed };
  } catch (error) {
    console.error('✗ Test failed:', error);
    throw error;
  }
}

// Export all test functions for browser console access
const tests = {
  testSingleEpisode,
  testMultipleEpisodes,
  testCachedRetrieval,
  testCachePerformance,
  testInsightValidation,

  // Helper: Run all tests
  async runAll() {
    console.log('=== Running All Tests ===\n');

    try {
      await testSingleEpisode();
      console.log('\n---\n');

      await testCachedRetrieval();
      console.log('\n---\n');

      await testInsightValidation();
      console.log('\n---\n');

      await testCachePerformance();
      console.log('\n---\n');

      console.log('✓ All tests completed successfully!');
    } catch (error) {
      console.error('✗ Test suite failed:', error);
    }
  }
};

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).testAnalyzeEpisode = tests;
  console.log('Test functions available at: window.testAnalyzeEpisode');
  console.log('Available tests:', Object.keys(tests));
  console.log('Run all tests: await window.testAnalyzeEpisode.runAll()');
}

export default tests;
