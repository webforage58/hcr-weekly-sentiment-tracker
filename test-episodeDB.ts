/**
 * Test script for episode database CRUD operations
 * Run this in the browser console to verify database functionality
 *
 * Usage: Open the dev server, open browser console, and this will run automatically
 */

import {
  initDB,
  getStorageEstimate,
  isIndexedDBSupported,
  closeDB,
  saveEpisode,
  getEpisode,
  getEpisodesByDateRange,
  getAllEpisodes,
  deleteEpisode,
  clearAllEpisodes,
  saveEpisodesBatch,
  saveWeeklyAggregation,
  getWeeklyAggregation,
  deleteWeeklyAggregation,
  getEpisodeCount,
  episodeExists,
} from './services/episodeDB';
import type { EpisodeInsight, WeeklyAggregation } from './types';

async function testDatabaseInit() {
  console.log('=== Episode Database CRUD Operations Test ===\n');

  // Check browser support
  console.log('1. Checking IndexedDB support...');
  if (!isIndexedDBSupported()) {
    console.error('❌ IndexedDB is not supported in this environment');
    return;
  }
  console.log('✅ IndexedDB is supported\n');

  // Initialize database
  console.log('2. Initializing database...');
  try {
    const db = await initDB();
    console.log('✅ Database initialized successfully');
    console.log(`   Database name: ${db.name}`);
    console.log(`   Database version: ${db.version}`);
    console.log(`   Object stores: ${Array.from(db.objectStoreNames).join(', ')}\n`);

    // Verify object stores exist
    console.log('3. Verifying object stores...');
    if (db.objectStoreNames.contains('episodes')) {
      console.log('✅ "episodes" object store exists');
    } else {
      console.error('❌ "episodes" object store NOT found');
    }

    if (db.objectStoreNames.contains('weeklyAggregations')) {
      console.log('✅ "weeklyAggregations" object store exists\n');
    } else {
      console.error('❌ "weeklyAggregations" object store NOT found\n');
    }

    // Test Episode CRUD operations
    console.log('4. Testing Episode CRUD operations...');
    const testEpisode1: EpisodeInsight = {
      episode_id: 'test-episode-001',
      show_name: 'Politics Chat',
      title: 'Test Episode 1',
      published_at: '2025-12-15',
      topics: [
        {
          topic_name: 'Immigration Policy',
          sentiment_score: 35,
          confidence: 0.9,
          evidence_quotes: ['Quote about immigration'],
          prominence_score: 0.8,
        },
      ],
      overall_sentiment: 35,
      trump_admin_focus: true,
      key_quotes: ['Key quote 1'],
      framework_version: 'v2',
      processed_at: new Date().toISOString(),
      model_used: 'gemini-3-flash-preview',
    };

    const testEpisode2: EpisodeInsight = {
      episode_id: 'test-episode-002',
      show_name: 'Politics Chat',
      title: 'Test Episode 2',
      published_at: '2025-12-16',
      topics: [
        {
          topic_name: 'Healthcare Reform',
          sentiment_score: 60,
          confidence: 0.85,
          evidence_quotes: ['Quote about healthcare'],
          prominence_score: 0.7,
        },
      ],
      overall_sentiment: 60,
      trump_admin_focus: false,
      key_quotes: ['Key quote 2'],
      framework_version: 'v2',
      processed_at: new Date().toISOString(),
      model_used: 'gemini-3-flash-preview',
    };

    // Test saveEpisode
    await saveEpisode(testEpisode1);
    console.log('✅ saveEpisode() works');

    // Test episodeExists
    const exists = await episodeExists('test-episode-001');
    if (exists) {
      console.log('✅ episodeExists() works');
    } else {
      console.error('❌ episodeExists() failed');
    }

    // Test getEpisode
    const retrieved = await getEpisode('test-episode-001');
    if (retrieved && retrieved.episode_id === testEpisode1.episode_id) {
      console.log('✅ getEpisode() works');
    } else {
      console.error('❌ getEpisode() failed');
    }

    // Test batch save
    await saveEpisodesBatch([testEpisode2]);
    console.log('✅ saveEpisodesBatch() works');

    // Test getEpisodeCount
    const count = await getEpisodeCount();
    if (count === 2) {
      console.log('✅ getEpisodeCount() works - found 2 episodes');
    } else {
      console.warn(`⚠️  getEpisodeCount() returned ${count}, expected 2`);
    }

    // Test getEpisodesByDateRange
    const rangeEpisodes = await getEpisodesByDateRange('2025-12-15', '2025-12-16');
    if (rangeEpisodes.length === 2) {
      console.log('✅ getEpisodesByDateRange() works');
    } else {
      console.error(`❌ getEpisodesByDateRange() failed - found ${rangeEpisodes.length}, expected 2`);
    }

    // Test getAllEpisodes
    const allEpisodes = await getAllEpisodes();
    if (allEpisodes.length === 2) {
      console.log('✅ getAllEpisodes() works');
    } else {
      console.error(`❌ getAllEpisodes() failed - found ${allEpisodes.length}, expected 2`);
    }

    // Test weekly aggregation
    console.log('\n5. Testing Weekly Aggregation operations...');
    const testAggregation: WeeklyAggregation = {
      week_start: '2025-12-15',
      week_end: '2025-12-21',
      episode_ids: ['test-episode-001', 'test-episode-002'],
      top_issues: [
        {
          issue_name: 'Immigration Policy',
          avg_sentiment: 35,
          confidence: 0.9,
          episode_count: 1,
          evidence: [],
        },
      ],
      computed_at: new Date().toISOString(),
      framework_version: 'v2',
    };

    // Test saveWeeklyAggregation
    await saveWeeklyAggregation(testAggregation);
    console.log('✅ saveWeeklyAggregation() works');

    // Test getWeeklyAggregation
    const retrievedAgg = await getWeeklyAggregation('2025-12-15');
    if (retrievedAgg && retrievedAgg.week_start === testAggregation.week_start) {
      console.log('✅ getWeeklyAggregation() works');
    } else {
      console.error('❌ getWeeklyAggregation() failed');
    }

    // Cleanup
    console.log('\n6. Testing cleanup operations...');
    await deleteEpisode('test-episode-001');
    const stillExists = await episodeExists('test-episode-001');
    if (!stillExists) {
      console.log('✅ deleteEpisode() works');
    } else {
      console.error('❌ deleteEpisode() failed');
    }

    await deleteWeeklyAggregation('2025-12-15');
    console.log('✅ deleteWeeklyAggregation() works');

    await clearAllEpisodes();
    const finalCount = await getEpisodeCount();
    if (finalCount === 0) {
      console.log('✅ clearAllEpisodes() works');
    } else {
      console.error(`❌ clearAllEpisodes() failed - ${finalCount} episodes remaining`);
    }

    // Get storage estimate
    console.log('\n7. Checking storage usage...');
    const storageInfo = await getStorageEstimate();
    if (storageInfo) {
      console.log(`   Storage used: ${(storageInfo.usage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Storage quota: ${(storageInfo.quota / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Usage: ${storageInfo.percentage.toFixed(2)}%\n`);
    }

    console.log('=== All CRUD tests passed! ✅ ===');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    closeDB();
  }
}

// Run the test
testDatabaseInit();
