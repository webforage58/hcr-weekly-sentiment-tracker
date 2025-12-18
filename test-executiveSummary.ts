/**
 * Test suite for Executive Summary Synthesis (Task 4.3)
 *
 * These tests verify that the AI-generated executive summaries work correctly
 * and integrate properly with the report composition pipeline.
 *
 * Run tests in browser console: window.testExecutiveSummary.runAll()
 */

import { synthesizeExecutiveSummary } from './services/gemini';
import { getEpisodesByDateRange } from './services/episodeDB';
import { rankIssues } from './utils/aggregation';
import { getConfig, updateConfig, resetConfig } from './constants/config';
import { composeWeeklyReport } from './services/reportComposer';
import { getWeekWindows } from './utils/reportUtils';

/**
 * Test 1: Direct synthesis call with sample data
 */
async function testDirectSynthesis() {
  console.log('\n=== Test 1: Direct Executive Summary Synthesis ===');

  const sampleIssues = [
    {
      issue_name: 'Federal Government Shutdown',
      avg_sentiment: 25,
      avg_prominence: 0.8,
      episode_count: 3,
      delta_vs_prior_week: -10,
      movement: 'losing'
    },
    {
      issue_name: 'Immigration Policy',
      avg_sentiment: 30,
      avg_prominence: 0.6,
      episode_count: 2,
      delta_vs_prior_week: 5,
      movement: 'gaining'
    },
    {
      issue_name: 'January 6 Investigation',
      avg_sentiment: 35,
      avg_prominence: 0.5,
      episode_count: 2,
      delta_vs_prior_week: 0,
      movement: 'unchanged'
    }
  ];

  const sampleEpisodes = await getEpisodesByDateRange('2025-01-01', '2025-01-07');

  if (sampleEpisodes.length === 0) {
    console.log('⚠ No episodes found for test date range. Skipping test.');
    return;
  }

  const narrativeShifts = [
    'Government shutdown rhetoric intensified this week',
    'Immigration focus shifted from border security to deportation policy'
  ];

  try {
    const startTime = Date.now();
    const summary = await synthesizeExecutiveSummary(
      '2025-01-01',
      '2025-01-07',
      sampleIssues,
      sampleEpisodes.slice(0, 3), // Use up to 3 episodes
      narrativeShifts
    );
    const elapsed = Date.now() - startTime;

    console.log(`✓ Summary generated in ${elapsed}ms`);
    console.log(`✓ Paragraph count: ${summary.length}`);
    console.log('\nGenerated summary:');
    summary.forEach((para, idx) => {
      console.log(`\nParagraph ${idx + 1} (${para.split(' ').length} words):`);
      console.log(para);
    });

    // Validation
    if (summary.length < 3 || summary.length > 5) {
      console.warn(`⚠ Expected 3-5 paragraphs, got ${summary.length}`);
    }

    const avgWordCount = summary.reduce((sum, p) => sum + p.split(' ').length, 0) / summary.length;
    console.log(`\nAverage words per paragraph: ${Math.round(avgWordCount)}`);

    if (avgWordCount < 30 || avgWordCount > 100) {
      console.warn(`⚠ Expected 50-80 words per paragraph, got average of ${Math.round(avgWordCount)}`);
    }

    console.log('✓ Test 1 completed successfully');
  } catch (error) {
    console.error('✗ Test 1 failed:', error);
  }
}

/**
 * Test 2: Integration with report composer (AI enabled)
 */
async function testReportComposerWithAI() {
  console.log('\n=== Test 2: Report Composer with AI Summary ===');

  // Enable AI summary in config
  const originalConfig = getConfig();
  updateConfig('features', 'enableAIExecutiveSummary', true);

  try {
    // Use a recent week that likely has data
    const windows = getWeekWindows('2025-01-01', '2025-01-07');
    if (windows.length === 0) {
      console.log('⚠ No week windows generated. Skipping test.');
      return;
    }

    const window = windows[0];
    console.log(`Testing week: ${window.start} to ${window.end}`);

    const startTime = Date.now();
    const report = await composeWeeklyReport(
      window.start,
      window.end,
      window.priorStart,
      window.priorEnd
    );
    const elapsed = Date.now() - startTime;

    console.log(`✓ Report composed in ${elapsed}ms`);
    console.log(`✓ Executive summary paragraphs: ${report.executive_summary.length}`);
    console.log('\nFirst paragraph:');
    console.log(report.executive_summary[0]);

    // Check if it's AI-generated (not placeholder)
    const isPlaceholder = report.executive_summary[0].includes('This week\'s political discourse focused primarily on');
    if (isPlaceholder) {
      console.warn('⚠ Summary appears to be placeholder, not AI-generated');
    } else {
      console.log('✓ Summary appears to be AI-generated (not placeholder)');
    }

    console.log('✓ Test 2 completed successfully');
  } catch (error) {
    console.error('✗ Test 2 failed:', error);
  } finally {
    // Restore original config
    updateConfig('features', 'enableAIExecutiveSummary', originalConfig.features.enableAIExecutiveSummary);
  }
}

/**
 * Test 3: Integration with report composer (AI disabled)
 */
async function testReportComposerWithoutAI() {
  console.log('\n=== Test 3: Report Composer with Placeholder Summary ===');

  // Disable AI summary in config
  const originalConfig = getConfig();
  updateConfig('features', 'enableAIExecutiveSummary', false);

  try {
    const windows = getWeekWindows('2025-01-01', '2025-01-07');
    if (windows.length === 0) {
      console.log('⚠ No week windows generated. Skipping test.');
      return;
    }

    const window = windows[0];
    console.log(`Testing week: ${window.start} to ${window.end}`);

    const startTime = Date.now();
    const report = await composeWeeklyReport(
      window.start,
      window.end,
      window.priorStart,
      window.priorEnd
    );
    const elapsed = Date.now() - startTime;

    console.log(`✓ Report composed in ${elapsed}ms`);
    console.log(`✓ Executive summary paragraphs: ${report.executive_summary.length}`);
    console.log('\nFirst paragraph:');
    console.log(report.executive_summary[0]);

    // Check if it's placeholder
    const isPlaceholder = report.executive_summary[0].includes('This week\'s political discourse focused primarily on') ||
                          report.executive_summary[0].includes('No significant political topics');
    if (!isPlaceholder) {
      console.warn('⚠ Expected placeholder summary, but got different format');
    } else {
      console.log('✓ Confirmed placeholder summary (AI synthesis disabled)');
    }

    console.log('✓ Test 3 completed successfully');
  } catch (error) {
    console.error('✗ Test 3 failed:', error);
  } finally {
    // Restore original config
    updateConfig('features', 'enableAIExecutiveSummary', originalConfig.features.enableAIExecutiveSummary);
  }
}

/**
 * Test 4: Performance comparison (AI vs Placeholder)
 */
async function testPerformanceComparison() {
  console.log('\n=== Test 4: Performance Comparison (AI vs Placeholder) ===');

  const windows = getWeekWindows('2025-01-01', '2025-01-07');
  if (windows.length === 0) {
    console.log('⚠ No week windows generated. Skipping test.');
    return;
  }

  const window = windows[0];

  try {
    // Test with placeholder
    updateConfig('features', 'enableAIExecutiveSummary', false);
    const placeholderStart = Date.now();
    await composeWeeklyReport(window.start, window.end, window.priorStart, window.priorEnd);
    const placeholderTime = Date.now() - placeholderStart;

    // Test with AI
    updateConfig('features', 'enableAIExecutiveSummary', true);
    const aiStart = Date.now();
    await composeWeeklyReport(window.start, window.end, window.priorStart, window.priorEnd);
    const aiTime = Date.now() - aiStart;

    console.log(`Placeholder summary time: ${placeholderTime}ms`);
    console.log(`AI summary time: ${aiTime}ms`);
    console.log(`AI overhead: +${aiTime - placeholderTime}ms (${((aiTime / placeholderTime - 1) * 100).toFixed(1)}% slower)`);

    if (aiTime > placeholderTime + 5000) {
      console.warn(`⚠ AI synthesis adds significant overhead (>${(aiTime - placeholderTime) / 1000}s)`);
    } else {
      console.log('✓ AI synthesis overhead is acceptable (<5s)');
    }

    console.log('✓ Test 4 completed successfully');
  } catch (error) {
    console.error('✗ Test 4 failed:', error);
  } finally {
    // Reset config
    resetConfig();
  }
}

/**
 * Test 5: Config persistence
 */
async function testConfigPersistence() {
  console.log('\n=== Test 5: Configuration Persistence ===');

  try {
    // Save original state
    const originalConfig = getConfig();

    // Update AI summary setting
    updateConfig('features', 'enableAIExecutiveSummary', true);
    console.log('✓ Set enableAIExecutiveSummary to true');

    // Reload config from LocalStorage
    const reloadedConfig = getConfig();
    if (reloadedConfig.features.enableAIExecutiveSummary === true) {
      console.log('✓ Config persisted to LocalStorage correctly');
    } else {
      console.error('✗ Config persistence failed');
    }

    // Test reset
    resetConfig();
    const resetConfigState = getConfig();
    if (resetConfigState.features.enableAIExecutiveSummary === false) {
      console.log('✓ Config reset to defaults correctly');
    } else {
      console.error('✗ Config reset failed');
    }

    // Restore original
    updateConfig('features', 'enableAIExecutiveSummary', originalConfig.features.enableAIExecutiveSummary);
    console.log('✓ Restored original config');

    console.log('✓ Test 5 completed successfully');
  } catch (error) {
    console.error('✗ Test 5 failed:', error);
  }
}

/**
 * Run all tests sequentially
 */
async function runAll() {
  console.log('===================================');
  console.log('Executive Summary Synthesis Tests');
  console.log('===================================');

  await testDirectSynthesis();
  await testReportComposerWithAI();
  await testReportComposerWithoutAI();
  await testPerformanceComparison();
  await testConfigPersistence();

  console.log('\n===================================');
  console.log('All tests completed');
  console.log('===================================');
}

// Export test functions to window for browser console access
export const testExecutiveSummary = {
  testDirectSynthesis,
  testReportComposerWithAI,
  testReportComposerWithoutAI,
  testPerformanceComparison,
  testConfigPersistence,
  runAll
};

// Attach to window
if (typeof window !== 'undefined') {
  (window as any).testExecutiveSummary = testExecutiveSummary;
  console.log('✓ Executive summary tests available: window.testExecutiveSummary');
}
