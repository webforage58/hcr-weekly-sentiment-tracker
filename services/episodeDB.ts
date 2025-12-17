import { openDB, IDBPDatabase, DBSchema } from 'idb';
import type { EpisodeInsight, WeeklyAggregation, SearchCacheEntry } from '../types';

// Database name and version
const DB_NAME = 'HCR_EpisodeInsightsDB';
const DB_VERSION = 2; // Updated to v2 to add searchCache object store

// Database schema definition for TypeScript
interface EpisodeDBSchema extends DBSchema {
  episodes: {
    key: string; // episode_id
    value: EpisodeInsight;
    indexes: {
      'by-published-date': string; // published_at
      'by-show-name': string; // show_name
      'by-framework-version': string; // framework_version
    };
  };
  weeklyAggregations: {
    key: string; // week_start (YYYY-MM-DD)
    value: WeeklyAggregation;
    indexes: {
      'by-framework-version': string; // framework_version
    };
  };
  searchCache: {
    key: string; // cache_key
    value: SearchCacheEntry;
    indexes: {
      'by-expires-at': string; // expires_at (for cleanup)
    };
  };
}

// Database instance cache
let dbInstance: IDBPDatabase<EpisodeDBSchema> | null = null;

/**
 * Initialize and open the IndexedDB database
 * Creates object stores and indexes if they don't exist
 */
export async function initDB(): Promise<IDBPDatabase<EpisodeDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB<EpisodeDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

        // Create episodes object store if it doesn't exist
        if (!db.objectStoreNames.contains('episodes')) {
          const episodeStore = db.createObjectStore('episodes', {
            keyPath: 'episode_id',
          });

          // Create indexes for efficient querying
          episodeStore.createIndex('by-published-date', 'published_at');
          episodeStore.createIndex('by-show-name', 'show_name');
          episodeStore.createIndex('by-framework-version', 'framework_version');

          console.log('Created "episodes" object store with indexes');
        }

        // Create weeklyAggregations object store if it doesn't exist
        if (!db.objectStoreNames.contains('weeklyAggregations')) {
          const weeklyStore = db.createObjectStore('weeklyAggregations', {
            keyPath: 'week_start',
          });

          // Create index for framework version
          weeklyStore.createIndex('by-framework-version', 'framework_version');

          console.log('Created "weeklyAggregations" object store with indexes');
        }

        // Create searchCache object store if it doesn't exist
        if (!db.objectStoreNames.contains('searchCache')) {
          const searchStore = db.createObjectStore('searchCache', {
            keyPath: 'cache_key',
          });

          // Create index for expiration time (for cleanup)
          searchStore.createIndex('by-expires-at', 'expires_at');

          console.log('Created "searchCache" object store with indexes');
        }
      },
      blocked() {
        console.warn('Database upgrade blocked - another tab may have an older version open');
      },
      blocking() {
        console.warn('This tab is blocking a database upgrade in another tab');
        // Close the database to allow the upgrade
        if (dbInstance) {
          dbInstance.close();
          dbInstance = null;
        }
      },
      terminated() {
        console.error('Database connection was unexpectedly terminated');
        dbInstance = null;
      },
    });

    console.log('IndexedDB initialized successfully');
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the database instance, initializing if needed
 */
export async function getDB(): Promise<IDBPDatabase<EpisodeDBSchema>> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('Database connection closed');
  }
}

/**
 * Delete the entire database (use with caution!)
 */
export async function deleteDB(): Promise<void> {
  closeDB();

  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onsuccess = () => {
      console.log('Database deleted successfully');
      resolve();
    };

    deleteRequest.onerror = () => {
      console.error('Failed to delete database');
      reject(new Error('Failed to delete database'));
    };

    deleteRequest.onblocked = () => {
      console.warn('Database deletion blocked - close all tabs using this database');
    };
  });
}

/**
 * Check if IndexedDB is supported in the current browser
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Get database storage usage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percentage: number } | null> {
  if (!navigator.storage || !navigator.storage.estimate) {
    console.warn('Storage estimate API not supported');
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      percentage,
    };
  } catch (error) {
    console.error('Failed to get storage estimate:', error);
    return null;
  }
}

// Export database constants for use in other modules
export { DB_NAME, DB_VERSION };

// ============================================================================
// Episode CRUD Operations
// ============================================================================

/**
 * Save an episode insight to the database
 * If episode already exists, it will be updated
 */
export async function saveEpisode(episode: EpisodeInsight): Promise<void> {
  try {
    const db = await getDB();
    await db.put('episodes', episode);
    console.log(`Saved episode: ${episode.episode_id}`);
  } catch (error) {
    console.error(`Failed to save episode ${episode.episode_id}:`, error);
    throw new Error(`Failed to save episode: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a single episode by its ID
 */
export async function getEpisode(episodeId: string): Promise<EpisodeInsight | null> {
  try {
    const db = await getDB();
    const episode = await db.get('episodes', episodeId);
    return episode || null;
  } catch (error) {
    console.error(`Failed to get episode ${episodeId}:`, error);
    throw new Error(`Failed to get episode: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all episodes within a date range (inclusive)
 * Uses the by-published-date index for efficient querying
 */
export async function getEpisodesByDateRange(startDate: string, endDate: string): Promise<EpisodeInsight[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('episodes', 'readonly');
    const index = tx.store.index('by-published-date');

    // Get all episodes in the date range using the index
    const episodes = await index.getAll(IDBKeyRange.bound(startDate, endDate));

    await tx.done;
    console.log(`Retrieved ${episodes.length} episodes between ${startDate} and ${endDate}`);
    return episodes;
  } catch (error) {
    console.error(`Failed to get episodes in date range ${startDate} to ${endDate}:`, error);
    throw new Error(`Failed to get episodes by date range: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all episodes in the database
 * Use with caution for large datasets
 */
export async function getAllEpisodes(): Promise<EpisodeInsight[]> {
  try {
    const db = await getDB();
    const episodes = await db.getAll('episodes');
    console.log(`Retrieved all ${episodes.length} episodes`);
    return episodes;
  } catch (error) {
    console.error('Failed to get all episodes:', error);
    throw new Error(`Failed to get all episodes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get episodes by show name
 */
export async function getEpisodesByShow(showName: string): Promise<EpisodeInsight[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('episodes', 'readonly');
    const index = tx.store.index('by-show-name');

    const episodes = await index.getAll(showName);
    await tx.done;

    console.log(`Retrieved ${episodes.length} episodes for show: ${showName}`);
    return episodes;
  } catch (error) {
    console.error(`Failed to get episodes for show ${showName}:`, error);
    throw new Error(`Failed to get episodes by show: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get episodes by framework version
 * Useful for identifying episodes that need reprocessing after framework changes
 */
export async function getEpisodesByFrameworkVersion(version: string): Promise<EpisodeInsight[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('episodes', 'readonly');
    const index = tx.store.index('by-framework-version');

    const episodes = await index.getAll(version);
    await tx.done;

    console.log(`Retrieved ${episodes.length} episodes with framework version: ${version}`);
    return episodes;
  } catch (error) {
    console.error(`Failed to get episodes for framework version ${version}:`, error);
    throw new Error(`Failed to get episodes by framework version: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a single episode by ID
 */
export async function deleteEpisode(episodeId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('episodes', episodeId);
    console.log(`Deleted episode: ${episodeId}`);
  } catch (error) {
    console.error(`Failed to delete episode ${episodeId}:`, error);
    throw new Error(`Failed to delete episode: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete all episodes from the database
 * Use with caution!
 */
export async function clearAllEpisodes(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('episodes');
    console.log('Cleared all episodes from database');
  } catch (error) {
    console.error('Failed to clear all episodes:', error);
    throw new Error(`Failed to clear all episodes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save multiple episodes in a single transaction (batch operation)
 * More efficient than saving one at a time
 */
export async function saveEpisodesBatch(episodes: EpisodeInsight[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('episodes', 'readwrite');

    // Queue all put operations
    const promises = episodes.map(episode => tx.store.put(episode));

    // Wait for all operations to complete
    await Promise.all([...promises, tx.done]);

    console.log(`Batch saved ${episodes.length} episodes`);
  } catch (error) {
    console.error(`Failed to batch save ${episodes.length} episodes:`, error);
    throw new Error(`Failed to batch save episodes: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Weekly Aggregation Operations
// ============================================================================

/**
 * Save a weekly aggregation to the database
 * If aggregation for this week already exists, it will be updated
 */
export async function saveWeeklyAggregation(aggregation: WeeklyAggregation): Promise<void> {
  try {
    const db = await getDB();
    await db.put('weeklyAggregations', aggregation);
    console.log(`Saved weekly aggregation for week: ${aggregation.week_start}`);
  } catch (error) {
    console.error(`Failed to save weekly aggregation for ${aggregation.week_start}:`, error);
    throw new Error(`Failed to save weekly aggregation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a weekly aggregation by week start date
 */
export async function getWeeklyAggregation(weekStart: string): Promise<WeeklyAggregation | null> {
  try {
    const db = await getDB();
    const aggregation = await db.get('weeklyAggregations', weekStart);
    return aggregation || null;
  } catch (error) {
    console.error(`Failed to get weekly aggregation for ${weekStart}:`, error);
    throw new Error(`Failed to get weekly aggregation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all weekly aggregations
 */
export async function getAllWeeklyAggregations(): Promise<WeeklyAggregation[]> {
  try {
    const db = await getDB();
    const aggregations = await db.getAll('weeklyAggregations');
    console.log(`Retrieved all ${aggregations.length} weekly aggregations`);
    return aggregations;
  } catch (error) {
    console.error('Failed to get all weekly aggregations:', error);
    throw new Error(`Failed to get all weekly aggregations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a weekly aggregation by week start date
 */
export async function deleteWeeklyAggregation(weekStart: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('weeklyAggregations', weekStart);
    console.log(`Deleted weekly aggregation for week: ${weekStart}`);
  } catch (error) {
    console.error(`Failed to delete weekly aggregation for ${weekStart}:`, error);
    throw new Error(`Failed to delete weekly aggregation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete all weekly aggregations from the database
 * Use with caution!
 */
export async function clearAllWeeklyAggregations(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('weeklyAggregations');
    console.log('Cleared all weekly aggregations from database');
  } catch (error) {
    console.error('Failed to clear all weekly aggregations:', error);
    throw new Error(`Failed to clear all weekly aggregations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Utility Operations
// ============================================================================

/**
 * Get the total count of episodes in the database
 */
export async function getEpisodeCount(): Promise<number> {
  try {
    const db = await getDB();
    const count = await db.count('episodes');
    return count;
  } catch (error) {
    console.error('Failed to get episode count:', error);
    throw new Error(`Failed to get episode count: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the total count of weekly aggregations in the database
 */
export async function getWeeklyAggregationCount(): Promise<number> {
  try {
    const db = await getDB();
    const count = await db.count('weeklyAggregations');
    return count;
  } catch (error) {
    console.error('Failed to get weekly aggregation count:', error);
    throw new Error(`Failed to get weekly aggregation count: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if an episode exists in the database
 */
export async function episodeExists(episodeId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const key = await db.getKey('episodes', episodeId);
    return key !== undefined;
  } catch (error) {
    console.error(`Failed to check if episode ${episodeId} exists:`, error);
    throw new Error(`Failed to check episode existence: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Search Cache Operations
// ============================================================================

/**
 * Save a search cache entry to the database
 * If cache entry already exists for this key, it will be updated
 */
export async function saveSearchCache(cacheEntry: SearchCacheEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put('searchCache', cacheEntry);
    console.log(`Saved search cache: ${cacheEntry.cache_key}`);
  } catch (error) {
    console.error(`Failed to save search cache ${cacheEntry.cache_key}:`, error);
    throw new Error(`Failed to save search cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a search cache entry by cache key
 * Returns null if cache entry doesn't exist or has expired
 */
export async function getSearchCache(cacheKey: string): Promise<SearchCacheEntry | null> {
  try {
    const db = await getDB();
    const cacheEntry = await db.get('searchCache', cacheKey);

    if (!cacheEntry) {
      return null;
    }

    // Check if cache has expired
    const now = new Date().toISOString();
    if (cacheEntry.expires_at < now) {
      console.log(`Search cache expired: ${cacheKey}`);
      // Delete expired cache entry
      await db.delete('searchCache', cacheKey);
      return null;
    }

    return cacheEntry;
  } catch (error) {
    console.error(`Failed to get search cache ${cacheKey}:`, error);
    throw new Error(`Failed to get search cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a search cache entry by cache key
 */
export async function deleteSearchCache(cacheKey: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('searchCache', cacheKey);
    console.log(`Deleted search cache: ${cacheKey}`);
  } catch (error) {
    console.error(`Failed to delete search cache ${cacheKey}:`, error);
    throw new Error(`Failed to delete search cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clear all expired search cache entries
 * This is a cleanup operation that should be run periodically
 */
export async function clearExpiredSearchCache(): Promise<number> {
  try {
    const db = await getDB();
    const tx = db.transaction('searchCache', 'readwrite');
    const index = tx.store.index('by-expires-at');

    const now = new Date().toISOString();
    const expiredEntries = await index.getAll(IDBKeyRange.upperBound(now));

    // Delete all expired entries
    const deletePromises = expiredEntries.map(entry => tx.store.delete(entry.cache_key));
    await Promise.all([...deletePromises, tx.done]);

    console.log(`Cleared ${expiredEntries.length} expired search cache entries`);
    return expiredEntries.length;
  } catch (error) {
    console.error('Failed to clear expired search cache:', error);
    throw new Error(`Failed to clear expired search cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clear all search cache entries
 * Use with caution!
 */
export async function clearAllSearchCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('searchCache');
    console.log('Cleared all search cache entries');
  } catch (error) {
    console.error('Failed to clear all search cache:', error);
    throw new Error(`Failed to clear all search cache: ${error instanceof Error ? error.message : String(error)}`);
  }
}
