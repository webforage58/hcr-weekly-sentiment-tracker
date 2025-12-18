/**
 * Test Suite: Framework Versioning
 *
 * Tests framework version management, episode reprocessing, and version utilities.
 *
 * Run in browser console:
 * - window.testFrameworkVersioning.runAll()
 * - window.testFrameworkVersioning.testVersionComparison()
 * - window.testFrameworkVersioning.testGetEpisodesNeedingUpdate()
 * - etc.
 */

import {
  FRAMEWORK_VERSION,
  FRAMEWORK_CHANGELOG,
  getVersionChangelog,
  compareVersions,
  isVersionOutdated,
  getAllVersions
} from './constants/frameworkVersion';
import {
  getEpisodesNeedingUpdate,
  getEpisodeCountsByVersion,
  reprocessWithFrameworkVersion,
  upgradeEpisodeToCurrentVersion
} from './services/episodeProcessor';
import {
  getAllEpisodes,
  saveEpisode,
  clearAllEpisodes
} from './services/episodeDB';
import { EpisodeInsight } from './types';

/**
 * Test 1: Version comparison utility
 */
async function testVersionComparison(): Promise<void> {
  console.log('\n=== Test 1: Version Comparison ===');

  // Test basic version comparisons
  const tests = [
    { v1: 'v2.0.0', v2: 'v1.0.0', expected: 1, desc: 'v2.0.0 > v1.0.0' },
    { v1: 'v1.0.0', v2: 'v2.0.0', expected: -1, desc: 'v1.0.0 < v2.0.0' },
    { v1: 'v2.0.0', v2: 'v2.0.0', expected: 0, desc: 'v2.0.0 = v2.0.0' },
    { v1: 'v2.1.0', v2: 'v2.0.0', expected: 1, desc: 'v2.1.0 > v2.0.0' },
    { v1: 'v2.0.1', v2: 'v2.0.0', expected: 1, desc: 'v2.0.1 > v2.0.0' },
    { v1: 'v1-legacy', v2: 'v2.0.0', expected: -1, desc: 'v1-legacy < v2.0.0' }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = compareVersions(test.v1, test.v2);
    const success = result === test.expected;

    console.log(`${success ? '✓' : '✗'} ${test.desc}: ${result === test.expected ? 'PASS' : 'FAIL'}`);
    console.log(`  Expected: ${test.expected}, Got: ${result}`);

    if (success) passed++;
    else failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
}

/**
 * Test 2: Version outdated check
 */
async function testVersionOutdatedCheck(): Promise<void> {
  console.log('\n=== Test 2: Version Outdated Check ===');

  console.log(`Current framework version: ${FRAMEWORK_VERSION}`);

  const testVersions = ['v1.0.0', 'v1-legacy', 'v2.0.0', 'v2.1.0'];

  for (const version of testVersions) {
    const outdated = isVersionOutdated(version);
    console.log(`${version}: ${outdated ? 'OUTDATED' : 'CURRENT OR NEWER'}`);
  }
}

/**
 * Test 3: Get all known versions
 */
async function testGetAllVersions(): Promise<void> {
  console.log('\n=== Test 3: Get All Known Versions ===');

  const versions = getAllVersions();
  console.log('All known framework versions (newest first):');
  versions.forEach((v, idx) => {
    const changelog = getVersionChangelog(v);
    console.log(`${idx + 1}. ${v}`);
    console.log(`   ${changelog}`);
  });
}

/**
 * Test 4: Episode version distribution
 */
async function testEpisodeVersionDistribution(): Promise<void> {
  console.log('\n=== Test 4: Episode Version Distribution ===');

  const versionCounts = await getEpisodeCountsByVersion();

  if (versionCounts.size === 0) {
    console.log('No episodes in database');
    return;
  }

  console.log('Episode count by framework version:');
  for (const [version, count] of versionCounts.entries()) {
    console.log(`  ${version}: ${count} episodes`);
  }

  const totalEpisodes = Array.from(versionCounts.values()).reduce((sum, count) => sum + count, 0);
  console.log(`Total: ${totalEpisodes} episodes`);
}

/**
 * Test 5: Get episodes needing update
 */
async function testGetEpisodesNeedingUpdate(): Promise<void> {
  console.log('\n=== Test 5: Get Episodes Needing Update ===');

  console.log(`Current framework version: ${FRAMEWORK_VERSION}`);

  const outdatedEpisodes = await getEpisodesNeedingUpdate();

  if (outdatedEpisodes.length === 0) {
    console.log('All episodes are up to date!');
    return;
  }

  console.log(`Found ${outdatedEpisodes.length} episodes needing update:`);

  // Group by version
  const byVersion = new Map<string, number>();
  for (const episode of outdatedEpisodes) {
    const version = episode.framework_version || 'unknown';
    byVersion.set(version, (byVersion.get(version) || 0) + 1);
  }

  for (const [version, count] of byVersion.entries()) {
    console.log(`  ${version}: ${count} episodes`);
  }

  // Show first 5 episodes as examples
  console.log('\nExample episodes (first 5):');
  outdatedEpisodes.slice(0, 5).forEach((ep, idx) => {
    console.log(`${idx + 1}. ${ep.title}`);
    console.log(`   Version: ${ep.framework_version}, Published: ${ep.published_at}`);
  });
}

/**
 * Test 6: Create test episodes with mixed versions
 */
async function testCreateMixedVersionEpisodes(): Promise<void> {
  console.log('\n=== Test 6: Create Test Episodes with Mixed Versions ===');

  // Create 5 test episodes with different framework versions
  const testEpisodes: EpisodeInsight[] = [
    {
      episode_id: 'test-v1-legacy-1',
      show_name: 'Test Show',
      title: 'Test Episode - Legacy v1',
      published_at: '2024-01-01',
      topics: [
        {
          topic_name: 'Test Topic',
          sentiment_score: 50,
          confidence: 0.8,
          evidence_quotes: ['Test quote'],
          prominence_score: 0.7
        }
      ],
      overall_sentiment: 50,
      trump_admin_focus: true,
      key_quotes: ['Test quote 1'],
      framework_version: 'v1-legacy',
      processed_at: new Date('2024-01-01').toISOString(),
      model_used: 'gemini-3-flash-preview'
    },
    {
      episode_id: 'test-v1.0.0-1',
      show_name: 'Test Show',
      title: 'Test Episode - v1.0.0',
      published_at: '2024-02-01',
      topics: [
        {
          topic_name: 'Test Topic',
          sentiment_score: 45,
          confidence: 0.85,
          evidence_quotes: ['Test quote'],
          prominence_score: 0.75
        }
      ],
      overall_sentiment: 45,
      trump_admin_focus: true,
      key_quotes: ['Test quote 2'],
      framework_version: 'v1.0.0',
      processed_at: new Date('2024-02-01').toISOString(),
      model_used: 'gemini-3-flash-preview'
    },
    {
      episode_id: 'test-v2.0.0-1',
      show_name: 'Test Show',
      title: 'Test Episode - v2.0.0 (current)',
      published_at: '2024-03-01',
      topics: [
        {
          topic_name: 'Test Topic',
          sentiment_score: 55,
          confidence: 0.9,
          evidence_quotes: ['Test quote'],
          prominence_score: 0.8
        }
      ],
      overall_sentiment: 55,
      trump_admin_focus: true,
      key_quotes: ['Test quote 3'],
      framework_version: 'v2.0.0',
      processed_at: new Date().toISOString(),
      model_used: 'gemini-3-flash-preview'
    }
  ];

  console.log('Creating 3 test episodes with different framework versions...');

  for (const episode of testEpisodes) {
    await saveEpisode(episode);
    console.log(`✓ Created: ${episode.title} (${episode.framework_version})`);
  }

  console.log('\nTest episodes created successfully!');
  console.log('You can now run testGetEpisodesNeedingUpdate() to see them.');
}

/**
 * Test 7: Clean up test episodes
 */
async function testCleanupTestEpisodes(): Promise<void> {
  console.log('\n=== Test 7: Clean Up Test Episodes ===');

  const allEpisodes = await getAllEpisodes();
  const testEpisodes = allEpisodes.filter(ep => ep.episode_id.startsWith('test-'));

  if (testEpisodes.length === 0) {
    console.log('No test episodes to clean up');
    return;
  }

  console.log(`Found ${testEpisodes.length} test episodes to remove`);

  // Note: We can't delete individual episodes in the current implementation,
  // so we'll just list them here. In production, you'd use deleteEpisode().
  console.log('Test episodes:');
  testEpisodes.forEach(ep => {
    console.log(`  - ${ep.episode_id} (${ep.framework_version})`);
  });

  console.log('\nTo fully clean up, you can run: await clearAllEpisodes()');
  console.log('WARNING: This will delete ALL episodes, not just test ones!');
}

/**
 * Test 8: Upgrade single episode (dry run simulation)
 */
async function testUpgradeSingleEpisode(): Promise<void> {
  console.log('\n=== Test 8: Upgrade Single Episode (Simulation) ===');

  const outdatedEpisodes = await getEpisodesNeedingUpdate();

  if (outdatedEpisodes.length === 0) {
    console.log('No outdated episodes to upgrade');
    console.log('Run testCreateMixedVersionEpisodes() first to create test episodes');
    return;
  }

  const episode = outdatedEpisodes[0];
  console.log(`Selected episode for upgrade:`);
  console.log(`  ID: ${episode.episode_id}`);
  console.log(`  Title: ${episode.title}`);
  console.log(`  Current version: ${episode.framework_version}`);
  console.log(`  Target version: ${FRAMEWORK_VERSION}`);

  console.log('\nTo actually upgrade this episode, run:');
  console.log(`await upgradeEpisodeToCurrentVersion('${episode.episode_id}')`);
  console.log('\nWARNING: This will call the Gemini API and consume API quota!');
}

/**
 * Test 9: Reprocess with framework version (dry run simulation)
 */
async function testReprocessWithVersion(): Promise<void> {
  console.log('\n=== Test 9: Reprocess with Framework Version (Simulation) ===');

  const versionCounts = await getEpisodeCountsByVersion();

  if (versionCounts.size === 0) {
    console.log('No episodes in database');
    return;
  }

  console.log('Current episode distribution:');
  for (const [version, count] of versionCounts.entries()) {
    console.log(`  ${version}: ${count} episodes`);
  }

  console.log(`\nTo upgrade all outdated episodes to ${FRAMEWORK_VERSION}, run:`);
  console.log('await reprocessWithFrameworkVersion()');

  console.log('\nTo upgrade specific version (e.g., v1.0.0 to v2.0.0), run:');
  console.log("await reprocessWithFrameworkVersion('v2.0.0', 'v1.0.0')");

  console.log('\nTo upgrade episodes in a date range, run:');
  console.log("await reprocessWithFrameworkVersion('v2.0.0', undefined, { start: '2024-01-01', end: '2024-12-31' })");

  console.log('\nWARNING: These operations will call the Gemini API and consume API quota!');
}

/**
 * Test 10: Backward compatibility check
 */
async function testBackwardCompatibility(): Promise<void> {
  console.log('\n=== Test 10: Backward Compatibility Check ===');

  const allEpisodes = await getAllEpisodes();

  if (allEpisodes.length === 0) {
    console.log('No episodes in database');
    return;
  }

  // Group episodes by version
  const versionGroups = new Map<string, EpisodeInsight[]>();
  for (const episode of allEpisodes) {
    const version = episode.framework_version || 'unknown';
    if (!versionGroups.has(version)) {
      versionGroups.set(version, []);
    }
    versionGroups.get(version)!.push(episode);
  }

  console.log('Testing backward compatibility across framework versions:');
  console.log(`Found ${versionGroups.size} different versions\n`);

  for (const [version, episodes] of versionGroups.entries()) {
    console.log(`Version ${version}: ${episodes.length} episodes`);

    // Check if episodes have required fields
    const sample = episodes[0];
    const hasRequiredFields =
      sample.episode_id &&
      sample.show_name &&
      sample.title &&
      sample.published_at &&
      Array.isArray(sample.topics) &&
      typeof sample.overall_sentiment === 'number' &&
      typeof sample.trump_admin_focus === 'boolean';

    console.log(`  Required fields: ${hasRequiredFields ? '✓ Present' : '✗ Missing'}`);
    console.log(`  Topics count: ${sample.topics?.length || 0}`);
    console.log(`  Overall sentiment: ${sample.overall_sentiment}`);
    console.log('');
  }

  console.log('Backward compatibility check complete!');
  console.log('All versions should be readable without errors.');
}

/**
 * Run all tests sequentially
 */
async function runAll(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    Framework Versioning Test Suite                    ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    await testVersionComparison();
    await testVersionOutdatedCheck();
    await testGetAllVersions();
    await testEpisodeVersionDistribution();
    await testGetEpisodesNeedingUpdate();
    await testUpgradeSingleEpisode();
    await testReprocessWithVersion();
    await testBackwardCompatibility();

    console.log('\n✓ All tests completed!');
    console.log('\nOptional tests (require manual action):');
    console.log('  - testCreateMixedVersionEpisodes() - Create test data');
    console.log('  - testCleanupTestEpisodes() - Remove test data');

  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
  }
}

// Export test functions for browser console access
export const testFrameworkVersioning = {
  runAll,
  testVersionComparison,
  testVersionOutdatedCheck,
  testGetAllVersions,
  testEpisodeVersionDistribution,
  testGetEpisodesNeedingUpdate,
  testCreateMixedVersionEpisodes,
  testCleanupTestEpisodes,
  testUpgradeSingleEpisode,
  testReprocessWithVersion,
  testBackwardCompatibility
};

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).testFrameworkVersioning = testFrameworkVersioning;
  console.log('Framework versioning tests loaded! Run: window.testFrameworkVersioning.runAll()');
}
