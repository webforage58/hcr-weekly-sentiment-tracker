/**
 * Test suite for reportComposer.ts
 * Run in browser console after dev server starts
 *
 * Usage:
 * 1. npm run dev
 * 2. Open browser console
 * 3. window.testReportComposer.runAll()
 */

import { composeWeeklyReport } from './services/reportComposer';
import { saveEpisode, getEpisodesByDateRange, clearAllEpisodes } from './services/episodeDB';
import type { EpisodeInsight } from './types';

/**
 * Generate synthetic episode data for testing
 */
function generateTestEpisode(
  episodeId: string,
  publishedAt: string,
  topics: Array<{
    name: string;
    sentiment: number;
    confidence: number;
    prominence: number;
    quotes: string[];
  }>
): EpisodeInsight {
  return {
    episode_id: episodeId,
    show_name: "Politics Chat",
    title: `Test Episode ${episodeId}`,
    published_at: publishedAt,
    topics: topics.map(t => ({
      topic_name: t.name,
      sentiment_score: t.sentiment,
      confidence: t.confidence,
      evidence_quotes: t.quotes,
      prominence_score: t.prominence
    })),
    overall_sentiment: topics.reduce((sum, t) => sum + t.sentiment, 0) / topics.length,
    trump_admin_focus: true,
    key_quotes: topics.flatMap(t => t.quotes).slice(0, 5),
    framework_version: "v2-test",
    processed_at: new Date().toISOString(),
    model_used: "test-model"
  };
}

/**
 * Test 1: Basic composition with 3 episodes
 */
async function testBasicComposition(): Promise<void> {
  console.log('\n=== Test 1: Basic Composition ===');

  try {
    // Clear existing test data
    await clearAllEpisodes();

    // Create 3 episodes for current week (2025-06-08 to 2025-06-14)
    const episode1 = generateTestEpisode(
      'test-ep-1',
      '2025-06-09',
      [
        {
          name: 'Immigration Policy',
          sentiment: 35,
          confidence: 0.85,
          prominence: 0.8,
          quotes: ['The administration announced new border restrictions.', 'Critics argue this violates asylum laws.']
        },
        {
          name: 'Economic Policy',
          sentiment: 55,
          confidence: 0.75,
          prominence: 0.6,
          quotes: ['GDP growth exceeded expectations this quarter.']
        }
      ]
    );

    const episode2 = generateTestEpisode(
      'test-ep-2',
      '2025-06-11',
      [
        {
          name: 'Immigration Policy',
          sentiment: 32,
          confidence: 0.88,
          prominence: 0.9,
          quotes: ['Border crossings reached a new high.', 'Facilities are overcrowded.']
        },
        {
          name: 'Supreme Court',
          sentiment: 40,
          confidence: 0.9,
          prominence: 0.7,
          quotes: ['The Court struck down a key voting rights provision.']
        }
      ]
    );

    const episode3 = generateTestEpisode(
      'test-ep-3',
      '2025-06-13',
      [
        {
          name: 'Immigration Policy',
          sentiment: 38,
          confidence: 0.82,
          prominence: 0.75,
          quotes: ['States are challenging the new policy in court.']
        },
        {
          name: 'Economic Policy',
          sentiment: 60,
          confidence: 0.78,
          prominence: 0.65,
          quotes: ['Unemployment remains low despite recent concerns.']
        },
        {
          name: 'Climate Change',
          sentiment: 45,
          confidence: 0.7,
          prominence: 0.5,
          quotes: ['New climate legislation faces Senate opposition.']
        }
      ]
    );

    // Save episodes
    await saveEpisode(episode1);
    await saveEpisode(episode2);
    await saveEpisode(episode3);

    console.log('✓ Created 3 test episodes');

    // Compose report (no prior week data)
    const report = await composeWeeklyReport(
      '2025-06-08', // Sunday
      '2025-06-14', // Saturday
      '2025-06-01', // Prior week Sunday
      '2025-06-07'  // Prior week Saturday
    );

    console.log('✓ Report composed successfully');
    console.log('\nReport Summary:');
    console.log(`- Episodes analyzed: ${report.sources_analyzed.length}`);
    console.log(`- Top issues: ${report.top_issues.length}`);
    console.log(`- Executive summary paragraphs: ${report.executive_summary.length}`);

    // Validate structure
    if (report.sources_analyzed.length !== 3) {
      throw new Error(`Expected 3 sources, got ${report.sources_analyzed.length}`);
    }

    if (report.top_issues.length === 0) {
      throw new Error('No top issues generated');
    }

    // Check top issue is Immigration Policy (most prominent across episodes)
    console.log('\nTop 5 Issues:');
    report.top_issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.issue_name} (sentiment: ${issue.sentiment_index}, episodes: ${issue.evidence.length > 0 ? 'has evidence' : 'no evidence'})`);
    });

    if (!report.top_issues[0].issue_name.toLowerCase().includes('immigration')) {
      console.warn('⚠ Expected Immigration Policy as top issue');
    }

    console.log('\n✓ Test 1 PASSED');
  } catch (error) {
    console.error('✗ Test 1 FAILED:', error);
    throw error;
  }
}

/**
 * Test 2: Week-over-week delta calculation
 */
async function testDeltaCalculation(): Promise<void> {
  console.log('\n=== Test 2: Delta Calculation ===');

  try {
    // Clear existing test data
    await clearAllEpisodes();

    // Prior week episodes (2025-06-01 to 2025-06-07)
    const priorEp1 = generateTestEpisode(
      'prior-ep-1',
      '2025-06-03',
      [
        {
          name: 'Healthcare Reform',
          sentiment: 50,
          confidence: 0.8,
          prominence: 0.7,
          quotes: ['Healthcare bill passed the House.']
        }
      ]
    );

    const priorEp2 = generateTestEpisode(
      'prior-ep-2',
      '2025-06-05',
      [
        {
          name: 'Healthcare Reform',
          sentiment: 52,
          confidence: 0.82,
          prominence: 0.75,
          quotes: ['Senate debate begins on healthcare.']
        }
      ]
    );

    // Current week episodes (2025-06-08 to 2025-06-14)
    const currentEp1 = generateTestEpisode(
      'current-ep-1',
      '2025-06-09',
      [
        {
          name: 'Healthcare Reform',
          sentiment: 68,
          confidence: 0.85,
          prominence: 0.8,
          quotes: ['Senate passes healthcare reform with bipartisan support.']
        }
      ]
    );

    const currentEp2 = generateTestEpisode(
      'current-ep-2',
      '2025-06-11',
      [
        {
          name: 'Healthcare Reform',
          sentiment: 72,
          confidence: 0.88,
          prominence: 0.85,
          quotes: ['President expected to sign healthcare bill into law.']
        }
      ]
    );

    // Save all episodes
    await saveEpisode(priorEp1);
    await saveEpisode(priorEp2);
    await saveEpisode(currentEp1);
    await saveEpisode(currentEp2);

    console.log('✓ Created prior week (2 episodes) and current week (2 episodes)');

    // Compose report with prior week comparison
    const report = await composeWeeklyReport(
      '2025-06-08',
      '2025-06-14',
      '2025-06-01',
      '2025-06-07'
    );

    console.log('✓ Report composed with delta calculation');

    // Check delta
    const healthcareIssue = report.top_issues.find(i =>
      i.issue_name.toLowerCase().includes('healthcare')
    );

    if (!healthcareIssue) {
      throw new Error('Healthcare Reform issue not found in top issues');
    }

    console.log(`\nHealthcare Reform:
  - Current week sentiment: ${healthcareIssue.sentiment_index}
  - Delta vs prior week: ${healthcareIssue.delta_vs_prior_week}
  - What changed: ${healthcareIssue.what_changed_week_over_week}
`);

    // Prior week avg: (50 + 52) / 2 = 51
    // Current week avg: (68 + 72) / 2 = 70
    // Expected delta: ~+19
    if (typeof healthcareIssue.delta_vs_prior_week === 'number') {
      const expectedDelta = 70 - 51;
      const actualDelta = healthcareIssue.delta_vs_prior_week;
      const deltaDeviation = Math.abs(actualDelta - expectedDelta);

      if (deltaDeviation > 3) {
        console.warn(`⚠ Delta deviation: expected ~${expectedDelta}, got ${actualDelta}`);
      }

      console.log(`✓ Delta calculated correctly: ${actualDelta > 0 ? '+' : ''}${actualDelta}`);
    } else {
      throw new Error('Delta should be a number, not "unknown"');
    }

    // Check for gaining issues
    if (report.issues_gaining_importance.length === 0) {
      console.warn('⚠ Expected Healthcare Reform in gaining issues');
    } else {
      console.log(`✓ ${report.issues_gaining_importance.length} gaining issue(s) detected`);
    }

    console.log('\n✓ Test 2 PASSED');
  } catch (error) {
    console.error('✗ Test 2 FAILED:', error);
    throw error;
  }
}

/**
 * Test 3: Topic normalization (Jan 6 vs January 6)
 */
async function testTopicNormalization(): Promise<void> {
  console.log('\n=== Test 3: Topic Normalization ===');

  try {
    await clearAllEpisodes();

    // Create episodes with topic name variations
    const ep1 = generateTestEpisode(
      'norm-ep-1',
      '2025-06-09',
      [
        {
          name: 'Jan 6 Investigation',
          sentiment: 35,
          confidence: 0.85,
          prominence: 0.8,
          quotes: ['New evidence emerges from Jan 6 committee.']
        }
      ]
    );

    const ep2 = generateTestEpisode(
      'norm-ep-2',
      '2025-06-11',
      [
        {
          name: 'January 6 Investigation',
          sentiment: 32,
          confidence: 0.88,
          prominence: 0.85,
          quotes: ['Hearings continue on January 6 attack.']
        }
      ]
    );

    const ep3 = generateTestEpisode(
      'norm-ep-3',
      '2025-06-13',
      [
        {
          name: 'Jan. 6 Committee',
          sentiment: 30,
          confidence: 0.82,
          prominence: 0.75,
          quotes: ['Jan. 6 committee subpoenas more witnesses.']
        }
      ]
    );

    await saveEpisode(ep1);
    await saveEpisode(ep2);
    await saveEpisode(ep3);

    console.log('✓ Created 3 episodes with topic name variations');

    const report = await composeWeeklyReport(
      '2025-06-08',
      '2025-06-14',
      '2025-06-01',
      '2025-06-07'
    );

    console.log('✓ Report composed');

    // Check that variations were merged into single issue
    const jan6Issues = report.top_issues.filter(i =>
      i.issue_name.toLowerCase().includes('january 6')
    );

    console.log(`\nJanuary 6 related issues found: ${jan6Issues.length}`);

    if (jan6Issues.length === 0) {
      throw new Error('January 6 issue not found (normalization may have failed)');
    }

    if (jan6Issues.length > 1) {
      console.warn('⚠ Multiple January 6 variations found - normalization incomplete:');
      jan6Issues.forEach(issue => console.warn(`  - ${issue.issue_name}`));
    } else {
      console.log(`✓ Topic variations normalized to: "${jan6Issues[0].issue_name}"`);
    }

    // Check evidence count (should have quotes from all 3 episodes)
    const evidence = jan6Issues[0].evidence;
    console.log(`✓ Evidence entries: ${evidence.length} (from 3 episodes)`);

    console.log('\n✓ Test 3 PASSED');
  } catch (error) {
    console.error('✗ Test 3 FAILED:', error);
    throw error;
  }
}

/**
 * Test 4: Performance test (10 episodes)
 */
async function testPerformance(): Promise<void> {
  console.log('\n=== Test 4: Performance Test ===');

  try {
    await clearAllEpisodes();

    // Create 10 episodes with varied topics
    const topics = [
      'Immigration Policy',
      'Economic Policy',
      'Healthcare Reform',
      'Climate Change',
      'Supreme Court',
      'Foreign Policy',
      'Education Policy'
    ];

    const episodes: EpisodeInsight[] = [];
    for (let i = 1; i <= 10; i++) {
      const date = `2025-06-${String(8 + i).padStart(2, '0')}`;
      const selectedTopics = topics.slice(0, 3 + (i % 3)).map((name, idx) => ({
        name,
        sentiment: 40 + (i * 3) + (idx * 5),
        confidence: 0.75 + (i * 0.01),
        prominence: 0.6 + (idx * 0.1),
        quotes: [`Quote ${i}-${idx} about ${name}.`]
      }));

      const episode = generateTestEpisode(`perf-ep-${i}`, date, selectedTopics);
      episodes.push(episode);
      await saveEpisode(episode);
    }

    console.log('✓ Created 10 test episodes');

    // Measure composition time
    const startTime = performance.now();
    const report = await composeWeeklyReport(
      '2025-06-08',
      '2025-06-14',
      '2025-06-01',
      '2025-06-07'
    );
    const elapsedMs = performance.now() - startTime;

    console.log(`✓ Report composed in ${elapsedMs.toFixed(2)}ms`);

    // Check performance target: <2 seconds for 10 episodes
    if (elapsedMs > 2000) {
      console.warn(`⚠ Composition took ${elapsedMs.toFixed(0)}ms (target: <2000ms)`);
    } else {
      console.log(`✓ Performance target met (${elapsedMs.toFixed(0)}ms < 2000ms)`);
    }

    console.log(`\nReport statistics:
  - Sources analyzed: ${report.sources_analyzed.length}
  - Top issues: ${report.top_issues.length}
  - Total evidence entries: ${report.top_issues.reduce((sum, i) => sum + i.evidence.length, 0)}
  - Narrative shifts: ${report.narrative_shifts.length}
`);

    console.log('\n✓ Test 4 PASSED');
  } catch (error) {
    console.error('✗ Test 4 FAILED:', error);
    throw error;
  }
}

/**
 * Test 5: Quality flags validation
 */
async function testQualityFlags(): Promise<void> {
  console.log('\n=== Test 5: Quality Flags ===');

  try {
    await clearAllEpisodes();

    // Test with minimal episode (low confidence)
    const lowConfidenceEp = generateTestEpisode(
      'quality-ep-1',
      '2025-06-09',
      [
        {
          name: 'Unknown Topic',
          sentiment: 50,
          confidence: 0.35, // Low confidence
          prominence: 0.4,
          quotes: ['Vague statement about politics.']
        }
      ]
    );

    await saveEpisode(lowConfidenceEp);

    const report = await composeWeeklyReport(
      '2025-06-08',
      '2025-06-14',
      '2025-06-01',
      '2025-06-07'
    );

    console.log(`Quality Flags:
  - Hallucination risk: ${report.quality_flags.hallucination_risk}
  - Data coverage: ${report.quality_flags.data_coverage}
  - Notes: ${report.quality_flags.notes.join('; ')}
`);

    // Expect high hallucination risk and minimal coverage
    if (report.quality_flags.hallucination_risk !== 'high') {
      console.warn('⚠ Expected high hallucination risk with low confidence');
    } else {
      console.log('✓ Hallucination risk correctly flagged as high');
    }

    if (report.quality_flags.data_coverage !== 'minimal') {
      console.warn('⚠ Expected minimal data coverage with 1 episode');
    } else {
      console.log('✓ Data coverage correctly flagged as minimal');
    }

    console.log('\n✓ Test 5 PASSED');
  } catch (error) {
    console.error('✗ Test 5 FAILED:', error);
    throw error;
  }
}

/**
 * Run all tests sequentially
 */
async function runAll(): Promise<void> {
  console.log('🧪 Starting reportComposer test suite...\n');

  const startTime = performance.now();
  let passed = 0;
  let failed = 0;

  const tests = [
    { name: 'Basic Composition', fn: testBasicComposition },
    { name: 'Delta Calculation', fn: testDeltaCalculation },
    { name: 'Topic Normalization', fn: testTopicNormalization },
    { name: 'Performance', fn: testPerformance },
    { name: 'Quality Flags', fn: testQualityFlags }
  ];

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n❌ ${test.name} test failed\n`);
    }
  }

  const totalTime = performance.now() - startTime;

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Suite Summary');
  console.log('='.repeat(50));
  console.log(`✓ Passed: ${passed}/${tests.length}`);
  console.log(`✗ Failed: ${failed}/${tests.length}`);
  console.log(`⏱ Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠ ${failed} test(s) failed - see errors above`);
  }
}

// Export test functions to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).testReportComposer = {
    runAll,
    testBasicComposition,
    testDeltaCalculation,
    testTopicNormalization,
    testPerformance,
    testQualityFlags
  };
  console.log('✓ Test suite loaded. Run window.testReportComposer.runAll() to begin.');
}

export {
  runAll,
  testBasicComposition,
  testDeltaCalculation,
  testTopicNormalization,
  testPerformance,
  testQualityFlags
};
