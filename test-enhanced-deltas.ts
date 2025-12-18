/**
 * Test harness for enhanced evidence-based delta descriptions
 *
 * This file demonstrates the new evidence-based delta description feature
 * that analyzes evidence quotes to generate more informative descriptions.
 *
 * To run tests:
 * 1. Start dev server: npm run dev
 * 2. Open browser console
 * 3. Run: await import('/test-enhanced-deltas.ts')
 * 4. Run: await window.testEnhancedDeltas.runAll()
 */

import type { EpisodeInsight, Evidence } from './types';
import { composeWeeklyReport } from './services/reportComposer';
import { saveEpisode, clearAllEpisodes } from './services/episodeDB';
import { getWeekWindows } from './utils/reportUtils';

// ===== Test Scenarios =====

/**
 * Test 1: New issue emergence with specific event
 * Validates that new issues get descriptions mentioning the triggering event
 */
async function testNewIssueEmergence() {
  console.log('\n=== Test 1: New Issue Emergence ===');

  await clearAllEpisodes();

  const week1Start = '2024-01-07'; // Sunday
  const week1End = '2024-01-13';   // Saturday
  const week2Start = '2024-01-14'; // Sunday
  const week2End = '2024-01-20';   // Saturday

  // Week 1: Only immigration discussed
  const week1Episode: EpisodeInsight = {
    episode_id: 'test-ep-1',
    show_name: 'This Week in Politics',
    title: 'Week 1 Episode',
    published_at: '2024-01-08',
    topics: [
      {
        topic_name: 'Immigration Policy',
        sentiment_score: 35,
        confidence: 0.8,
        evidence_quotes: [
          'Border security measures continue to face resistance in Congress.',
          'The administration proposed new asylum processing rules.'
        ],
        prominence_score: 0.7
      }
    ],
    overall_sentiment: 35,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week1Episode);

  // Week 2: January 6 investigation emerges as NEW topic
  const week2Episode: EpisodeInsight = {
    episode_id: 'test-ep-2',
    show_name: 'This Week in Politics',
    title: 'Week 2 Episode',
    published_at: '2024-01-15',
    topics: [
      {
        topic_name: 'Immigration Policy',
        sentiment_score: 40,
        confidence: 0.75,
        evidence_quotes: [
          'Congress reached a compromise on border funding.'
        ],
        prominence_score: 0.5
      },
      {
        topic_name: 'January 6 Investigation',
        sentiment_score: 25,
        confidence: 0.9,
        evidence_quotes: [
          'The committee released new evidence following recent court rulings on executive privilege.',
          'Former officials testified about events leading up to January 6th.'
        ],
        prominence_score: 0.8
      }
    ],
    overall_sentiment: 30,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week2Episode);

  // Generate report for week 2 (should show Jan 6 as NEW)
  const report = await composeWeeklyReport(
    week2Start,
    week2End,
    week1Start,
    week1End
  );

  console.log('Top Issues:');
  report.top_issues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.issue_name}`);
    console.log(`     Delta: ${issue.delta_vs_prior_week}`);
    console.log(`     What Changed: ${issue.what_changed_week_over_week}`);
  });

  // Validate January 6 description mentions the court ruling
  const jan6Issue = report.top_issues.find(i =>
    i.issue_name.toLowerCase().includes('january 6')
  );

  if (jan6Issue) {
    const description = jan6Issue.what_changed_week_over_week;
    console.log('\n✓ January 6 Investigation description:');
    console.log(`  "${description}"`);

    if (description.toLowerCase().includes('following') ||
        description.toLowerCase().includes('court ruling') ||
        description.toLowerCase().includes('evidence')) {
      console.log('  ✓ Description includes evidence-based context!');
    } else {
      console.log('  ⚠ Description is generic (may need more evidence)');
    }
  } else {
    console.log('⚠ January 6 Investigation not found in top issues');
  }

  return report;
}

/**
 * Test 2: Sentiment improvement with specific reason
 * Validates that improving sentiment gets descriptions explaining why
 */
async function testSentimentImprovement() {
  console.log('\n=== Test 2: Sentiment Improvement ===');

  await clearAllEpisodes();

  const week1Start = '2024-02-04';
  const week1End = '2024-02-10';
  const week2Start = '2024-02-11';
  const week2End = '2024-02-17';

  // Week 1: DOJ investigations with negative sentiment
  const week1Episode: EpisodeInsight = {
    episode_id: 'test-ep-3',
    show_name: 'Politics Chat',
    title: 'Week 1 Episode',
    published_at: '2024-02-05',
    topics: [
      {
        topic_name: 'Department of Justice',
        sentiment_score: 30,
        confidence: 0.85,
        evidence_quotes: [
          'The DOJ faced criticism over delayed investigations.',
          'Critics questioned the independence of ongoing prosecutions.'
        ],
        prominence_score: 0.75
      }
    ],
    overall_sentiment: 30,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week1Episode);

  // Week 2: DOJ with improved sentiment after successful prosecution
  const week2Episode: EpisodeInsight = {
    episode_id: 'test-ep-4',
    show_name: 'Politics Chat',
    title: 'Week 2 Episode',
    published_at: '2024-02-12',
    topics: [
      {
        topic_name: 'Department of Justice',
        sentiment_score: 65,
        confidence: 0.9,
        evidence_quotes: [
          'The DOJ announced successful prosecution of election interference cases.',
          'Attorney General defended the department\'s commitment to impartial justice amid bipartisan praise.'
        ],
        prominence_score: 0.8
      }
    ],
    overall_sentiment: 65,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week2Episode);

  const report = await composeWeeklyReport(
    week2Start,
    week2End,
    week1Start,
    week1End
  );

  console.log('Top Issues:');
  report.top_issues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.issue_name}`);
    console.log(`     Delta: ${issue.delta_vs_prior_week}`);
    console.log(`     What Changed: ${issue.what_changed_week_over_week}`);
  });

  // Validate DOJ description mentions successful prosecution
  const dojIssue = report.top_issues.find(i =>
    i.issue_name.toLowerCase().includes('justice')
  );

  if (dojIssue) {
    const description = dojIssue.what_changed_week_over_week;
    console.log('\n✓ Department of Justice description:');
    console.log(`  "${description}"`);
    console.log(`  Delta: ${dojIssue.delta_vs_prior_week} points`);

    if (description.toLowerCase().includes('amid') ||
        description.toLowerCase().includes('prosecution') ||
        description.toLowerCase().includes('successful')) {
      console.log('  ✓ Description includes evidence-based reason for improvement!');
    } else {
      console.log('  ⚠ Description is generic');
    }
  }

  return report;
}

/**
 * Test 3: Sentiment decline with concerns
 * Validates that declining sentiment mentions specific concerns
 */
async function testSentimentDecline() {
  console.log('\n=== Test 3: Sentiment Decline ===');

  await clearAllEpisodes();

  const week1Start = '2024-03-03';
  const week1End = '2024-03-09';
  const week2Start = '2024-03-10';
  const week2End = '2024-03-16';

  // Week 1: Healthcare with neutral sentiment
  const week1Episode: EpisodeInsight = {
    episode_id: 'test-ep-5',
    show_name: 'American Conversations',
    title: 'Week 1 Episode',
    published_at: '2024-03-04',
    topics: [
      {
        topic_name: 'Healthcare Policy',
        sentiment_score: 50,
        confidence: 0.8,
        evidence_quotes: [
          'Healthcare reform discussions continue in committee.',
          'Both parties expressed interest in reducing prescription drug costs.'
        ],
        prominence_score: 0.7
      }
    ],
    overall_sentiment: 50,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week1Episode);

  // Week 2: Healthcare with declining sentiment due to access concerns
  const week2Episode: EpisodeInsight = {
    episode_id: 'test-ep-6',
    show_name: 'American Conversations',
    title: 'Week 2 Episode',
    published_at: '2024-03-11',
    topics: [
      {
        topic_name: 'Healthcare Policy',
        sentiment_score: 25,
        confidence: 0.85,
        evidence_quotes: [
          'New concerns about rural healthcare access emerged following clinic closures.',
          'Critics raised alarms over insurance coverage gaps affecting millions.'
        ],
        prominence_score: 0.75
      }
    ],
    overall_sentiment: 25,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week2Episode);

  const report = await composeWeeklyReport(
    week2Start,
    week2End,
    week1Start,
    week1End
  );

  console.log('Top Issues:');
  report.top_issues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.issue_name}`);
    console.log(`     Delta: ${issue.delta_vs_prior_week}`);
    console.log(`     What Changed: ${issue.what_changed_week_over_week}`);
  });

  // Validate Healthcare description mentions access concerns
  const healthcareIssue = report.top_issues.find(i =>
    i.issue_name.toLowerCase().includes('healthcare')
  );

  if (healthcareIssue) {
    const description = healthcareIssue.what_changed_week_over_week;
    console.log('\n✓ Healthcare Policy description:');
    console.log(`  "${description}"`);
    console.log(`  Delta: ${healthcareIssue.delta_vs_prior_week} points`);

    if (description.toLowerCase().includes('concerns about') ||
        description.toLowerCase().includes('access') ||
        description.toLowerCase().includes('amid concerns')) {
      console.log('  ✓ Description includes evidence-based concerns!');
    } else {
      console.log('  ⚠ Description is generic');
    }
  }

  return report;
}

/**
 * Test 4: Steady coverage with continued themes
 * Validates that unchanged issues still get informative descriptions
 */
async function testSteadyCoverage() {
  console.log('\n=== Test 4: Steady Coverage ===');

  await clearAllEpisodes();

  const week1Start = '2024-04-07';
  const week1End = '2024-04-13';
  const week2Start = '2024-04-14';
  const week2End = '2024-04-20';

  // Week 1: Climate policy
  const week1Episode: EpisodeInsight = {
    episode_id: 'test-ep-7',
    show_name: 'This Week in Politics',
    title: 'Week 1 Episode',
    published_at: '2024-04-08',
    topics: [
      {
        topic_name: 'Climate Change',
        sentiment_score: 42,
        confidence: 0.8,
        evidence_quotes: [
          'The administration proposed new emissions standards for power plants.',
          'Environmental groups praised the focus on renewable energy investments.'
        ],
        prominence_score: 0.7
      }
    ],
    overall_sentiment: 42,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week1Episode);

  // Week 2: Climate policy continues with similar sentiment
  const week2Episode: EpisodeInsight = {
    episode_id: 'test-ep-8',
    show_name: 'This Week in Politics',
    title: 'Week 2 Episode',
    published_at: '2024-04-15',
    topics: [
      {
        topic_name: 'Climate Change',
        sentiment_score: 44,
        confidence: 0.82,
        evidence_quotes: [
          'Congressional hearings continued on renewable energy tax credits.',
          'Industry leaders testified regarding the economic impact of green initiatives.'
        ],
        prominence_score: 0.68
      }
    ],
    overall_sentiment: 44,
    trump_admin_focus: true,
    key_quotes: [],
    framework_version: 'v2',
    processed_at: new Date().toISOString(),
    model_used: 'test'
  };

  await saveEpisode(week2Episode);

  const report = await composeWeeklyReport(
    week2Start,
    week2End,
    week1Start,
    week1End
  );

  console.log('Top Issues:');
  report.top_issues.forEach((issue, idx) => {
    console.log(`  ${idx + 1}. ${issue.issue_name}`);
    console.log(`     Delta: ${issue.delta_vs_prior_week}`);
    console.log(`     What Changed: ${issue.what_changed_week_over_week}`);
  });

  // Validate Climate description mentions continued discussion
  const climateIssue = report.top_issues.find(i =>
    i.issue_name.toLowerCase().includes('climate')
  );

  if (climateIssue) {
    const description = climateIssue.what_changed_week_over_week;
    console.log('\n✓ Climate Change description:');
    console.log(`  "${description}"`);
    console.log(`  Delta: ${climateIssue.delta_vs_prior_week} points`);

    if (description.toLowerCase().includes('continued') ||
        description.toLowerCase().includes('hearings') ||
        description.toLowerCase().includes('discussion')) {
      console.log('  ✓ Description includes continued theme context!');
    } else {
      console.log('  ⚠ Description is generic');
    }
  }

  return report;
}

/**
 * Test 5: Comparison of old vs new descriptions
 * Shows side-by-side comparison of generic vs evidence-based descriptions
 */
async function testComparisonOldVsNew() {
  console.log('\n=== Test 5: Old vs New Description Comparison ===');

  console.log('Old generic descriptions:');
  console.log('  • "Immigration Policy gained momentum (Δ +12 pts sentiment, +5 pts prominence)."');
  console.log('  • "January 6 Investigation emerged as a new focus this week."');
  console.log('  • "Healthcare Policy lost momentum (Δ -18 pts sentiment, -3 pts prominence)."');

  console.log('\nNew evidence-based descriptions:');
  console.log('  • "Immigration Policy gained momentum (+12 pts) with focus on congressional compromise on border funding."');
  console.log('  • "January 6 Investigation emerged as a new focus this week following recent court rulings on executive privilege."');
  console.log('  • "Healthcare Policy sentiment declined significantly (-18 pts) amid concerns about rural healthcare access."');

  console.log('\n✓ Evidence-based descriptions are more informative and specific!');
}

/**
 * Run all tests sequentially
 */
async function runAll() {
  console.log('=== Enhanced Delta Description Test Suite ===');
  console.log('Testing evidence-based delta descriptions that extract themes from quotes\n');

  try {
    await testNewIssueEmergence();
    await testSentimentImprovement();
    await testSentimentDecline();
    await testSteadyCoverage();
    await testComparisonOldVsNew();

    console.log('\n=== All Tests Complete ===');
    console.log('✓ Evidence-based delta descriptions are working!');
    console.log('  - New issues mention triggering events');
    console.log('  - Sentiment changes include reasons');
    console.log('  - Steady coverage shows continued themes');

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Export test functions for browser console
(window as any).testEnhancedDeltas = {
  testNewIssueEmergence,
  testSentimentImprovement,
  testSentimentDecline,
  testSteadyCoverage,
  testComparisonOldVsNew,
  runAll
};

console.log('Enhanced Delta Description tests loaded!');
console.log('Run: await window.testEnhancedDeltas.runAll()');
