# Project State: HCR Sentiment Tracker Performance Optimization

**Project Goal**: Scale from 4-week to 24-week (and eventually 52-week) analysis capability through episode-centric architecture

**Last Updated**: 2025-12-17

---

## Current Phase

**Phase**: Phase 5 - Scale Testing
**Status**: Not Started (0/5 tasks complete)
**Start Date**: TBD
**Current Task**: Task 5.1 - Create Performance Benchmarking Suite
**Previous Phase**: Phase 4 - Optimization ✅ (Completed 2025-12-17)

---

## Metrics Tracking

### Baseline (Current System)
- **First-run time (4 weeks)**: ~24s (4 weeks × 6s per week)
- **First-run time (24 weeks)**: ~144s (projected)
- **Re-run time (same dates)**: ~144s (no optimization)
- **Storage approach**: LocalStorage, week-level caching
- **Max practical analysis range**: 4 weeks (UI enforced limit)

### Targets

| Metric | Current | Phase 3 Target | Phase 5 Target (Final) |
|--------|---------|----------------|------------------------|
| First 24-week analysis | ~144s | <60s | <40s |
| First 52-week analysis | N/A | N/A | <90s |
| Re-run (same dates) | ~144s | <10s | <5s |
| Incremental (4 new weeks) | ~24s | ~15s | ~10s |
| Storage per episode | N/A | ~150KB | ~150KB |
| Total storage (52 weeks) | ~5MB | ~10MB | ~15MB |

---

## Phase Completion Status

### ✅ Phase 0: Planning & Analysis
- [x] Architecture analysis completed
- [x] Bottleneck identification complete
- [x] Optimization strategies defined
- [x] Implementation roadmap created
- [x] State tracking established

### ✅ Phase 1: Foundation (Target: 2 days)
- [x] Task 1.1: IndexedDB wrapper library selected and installed (idb v8.0.3)
- [x] Task 1.2: Create episode-level database schema
- [x] Task 1.3: Implement episode CRUD operations
- [x] Task 1.4: Create migration utility for existing data
- [x] Task 1.5: Implement episode search API

**Status**: Complete (5/5 tasks complete - 100%)
**Blockers**: None
**Notes**: Started 2025-12-17, Completed 2025-12-17 (same day). Selected `idb` library for lightweight, promise-based IndexedDB wrapper. Database schema created with three object stores (episodes, weeklyAggregations, searchCache) and proper indexes. Complete CRUD layer implemented with 24 operations. Migration utility complete with UI integration. Episode search API with caching complete.

### 🟢 Phase 2: Parallel Processing (Target: 1 day)
- [x] Task 2.1: Extract episode analysis function (analyzeEpisode())
- [x] Task 2.2: Create weekly report composition function
- [x] Task 2.3: Implement parallel episode processing
- [x] Task 2.4: Update UI to show episode-level progress

**Status**: Complete (4/4 tasks complete - 100%)
**Blockers**: None
**Notes**: Started 2025-12-17. Task 2.1: Created new `analyzeEpisode()` function in services/gemini.ts that analyzes individual episodes instead of week-level aggregations. Added EPISODE_ANALYSIS_PROMPT for single-episode analysis with Google Search grounding. Function uses existing retry logic and returns EpisodeInsight with topics, sentiment scores, and quotes. Test file created (test-analyzeEpisode.ts) with 5 comprehensive test scenarios. Build passes successfully. Task 2.2: Created `composeWeeklyReport()` function in services/reportComposer.ts that aggregates episode insights into weekly reports without calling AI. Implemented ranking algorithm (frequency × prominence × consistency), week-over-week delta calculation, topic normalization, evidence building, and quality flags computation. Test file created (test-reportComposer.ts) with 5 test scenarios. Build passes successfully. Task 2.3: Created `services/episodeProcessor.ts` with complete parallel processing orchestration. Implemented `processEpisodesInRange()` function with configurable concurrency (default: 10), progress callbacks, cache checking, and error handling for partial failures. Uses worker pool pattern for efficient parallel execution. Added helper functions: `getEpisodesForWeek()`, `estimateProcessingTime()`, and `categorizeEpisodes()`. Created `test-episodeProcessor.ts` with 7 comprehensive test scenarios covering basic processing, cache performance, concurrency comparison, multi-week processing, week retrieval, force reprocess, and time estimation. Build passes successfully. Task 2.4: Updated DashboardSetup UI to surface episode-level progress: integrated `processEpisodesInRange()` and `composeWeeklyReport()`, added phased progress bar with cached vs. new episode messaging, time estimates, and cancel support via AbortController. Button text now mirrors current phase.

### ✅ Phase 3: Aggregation Engine (Target: 1 day)
- [x] Build deterministic topic ranking algorithm (Task 3.1)
- [x] Implement week-over-week delta computation with evidence-based descriptions (Task 3.2)
- [x] Cache weekly aggregations (Task 3.3)
- [x] Update main generation flow (Task 3.4)

**Status**: Complete (All 4 tasks complete - 100%)
**Blockers**: None
**Notes**:
- **Task 3.1 (Completed 2025-12-18)**: Manual app testing surfaced a critical aggregation bug: weeks with episodes were returning an empty `top_issues` list. Root causes: overly strict filtering, missing/malformed topic fields causing NaN averages, and date range queries missing timestamped episodes. Fixes: hardened topic parsing with numeric coercion, added fallback ranking behavior, normalized `published_at` to YYYY-MM-DD, and extended test harness.
- **Task 3.2 (Completed 2025-12-18)**: Implemented evidence-based delta descriptions that extract key themes from evidence quotes. Created `buildEnhancedDeltaDescription()` function that analyzes evidence using regex patterns to identify developments, concerns, actions, and focus areas. Delta descriptions now include specific context like "emerged following recent court rulings" instead of generic "emerged as new focus." Test suite (test-enhanced-deltas.ts) includes 5 scenarios validating new issues, sentiment improvements, declines, and steady coverage.
- **Task 3.3 (Completed 2025-12-18)**: Implemented weekly aggregation caching to speed up re-runs. Added cache validation logic that checks framework version and episode IDs. Implemented convertAggregationToReport() to reconstruct HCRReport from cached WeeklyAggregation. Added automatic cache pruning to keep only the most recent 52 weeks. Created test-weeklyCache.ts with 5 comprehensive test scenarios covering cache hits, misses, invalidation, pruning, and performance. Build passes successfully.
- **Task 3.4 (Completed 2025-12-18)**: Updated DashboardSetup.tsx to complete the two-phase pipeline migration. Removed 4-week limit and increased to 52 weeks (1 year). Added comprehensive validation: date range ordering, partial episode processing failures, and weekly episode coverage checks. Added better error messages for edge cases. Added inline documentation of new pipeline architecture. UI text updated to reflect new 52-week capability. Build passes successfully. Core pipeline was already implemented in Task 2.4; this task added the final validations and removed legacy limits.

### ✅ Phase 4: Optimization (Target: 1 day)
- [x] Task 4.1: Incremental analysis (skip cached episodes)
- [x] Task 4.2: Framework versioning
- [x] Task 4.3: Executive summary synthesis (optional AI call)
- [x] Task 4.4: Add configuration options

**Status**: Complete (All 4 tasks complete - 100%)
**Blockers**: None
**Notes**:
- **Task 4.1 (Completed 2025-12-17)**: Most functionality was already present from Phase 2 (Task 2.3). Added cache staleness detection as the missing piece - episodes cached longer than a configurable threshold are automatically reprocessed. Created comprehensive test suite (test-cachesStaleness.ts) with 5 test scenarios.
- **Task 4.2 (Completed 2025-12-17)**: Created centralized framework version management system with FRAMEWORK_VERSION constant, version comparison utilities, and reprocessing functions. Added getEpisodesNeedingUpdate(), getEpisodeCountsByVersion(), reprocessWithFrameworkVersion(), and upgradeEpisodeToCurrentVersion(). Updated episodeProcessor.ts and reportComposer.ts to use centralized constant. Added version display UI in DashboardSetup. Created comprehensive test suite (test-frameworkVersioning.ts) with 10 test scenarios. Build passes successfully.
- **Task 4.3 (Completed 2025-12-17)**: Implemented AI-powered executive summary synthesis. Created `synthesizeExecutiveSummary()` function in services/gemini.ts with SUMMARY_SYNTHESIS_PROMPT template. Function generates 3-5 paragraph summaries (50-80 words each) from top issues, episode summaries, and narrative shifts. Uses gemini-3-flash-preview (no search needed, ~2-3s per week). Integrated into reportComposer.ts with config-based toggling via `config.features.enableAIExecutiveSummary` (default: false). Includes graceful fallback to placeholder summaries if AI synthesis fails. Created comprehensive test suite (test-executiveSummary.ts) with 5 scenarios covering direct synthesis, AI-enabled composition, placeholder composition, performance comparison, and config persistence. Available in browser console via window.testExecutiveSummary. Build passes successfully.
- **Task 4.4 (Completed 2025-12-17)**: Created complete configuration management system in constants/config.ts (200+ lines). Implemented AppConfig interface with three sections (processing, caching, features), LocalStorage persistence, validation, and update/reset helpers. Configuration options include concurrency (1-20), retry settings, cache thresholds, and feature flags (AI summaries, detailed progress, cache analytics). Added collapsible "Advanced Settings" UI panel in DashboardSetup.tsx with three sections: Processing (concurrency slider), Features (AI summaries toggle, detailed progress toggle), and Caching (weekly aggregation cache toggle). Settings persist automatically to LocalStorage with real-time updates. Includes "Reset to Defaults" button. Integrates seamlessly with Task 4.3 AI synthesis feature. Build passes successfully.

### ⬜ Phase 5: Scale Testing (Target: 1 day)
- [ ] Test with 52 weeks (100+ episodes)
- [ ] Measure performance against targets
- [ ] Stress test storage limits

**Status**: Not Started
**Blockers**: Requires Phase 4 completion
**Notes**: -

---

## Current Architecture

### Data Flow (As-Is)
```
User selects date range
  ↓
Generate week windows (Sunday-Saturday aligned)
  ↓
For each week (sequential):
  → Gemini API call with Google Search
  → Extract topics, sentiment, evidence
  → Cache entire week report in LocalStorage
  ↓
Aggregate multiple week reports
  ↓
Display dashboard
```

### Storage (As-Is)
- **Storage Type**: LocalStorage
- **Cache Key**: `hcr_sentiment_weeks`
- **Cache Granularity**: Week-level (keyed by week start date)
- **Cache Size**: ~200-300KB per week report

---

## Target Architecture

### Data Flow (To-Be)
```
User selects date range
  ↓
Identify episodes in range (Google Search or cached list)
  ↓
For each episode (parallel, up to 10 concurrent):
  → Check EpisodeInsightsDB cache
  → If not cached: Gemini API call to analyze episode
  → Store episode insights in IndexedDB
  ↓
For each week in range:
  → Query episodes from cache
  → Aggregate topics → rank top 5
  → Compute week-over-week deltas
  → (Optional) Generate executive summary
  → Cache weekly aggregation
  ↓
Display dashboard
```

### Storage (To-Be)
- **Storage Type**: IndexedDB
- **Primary Cache**: Episode-level insights (keyed by episode_id)
- **Secondary Cache**: Weekly aggregations (computed from episodes)
- **Cache Size**: ~150KB per episode, ~50KB per weekly aggregation

---

## Technical Decisions

### Completed Decisions
- **Storage**: IndexedDB chosen over LocalStorage for 50MB+ capacity
- **Concurrency**: Target 10 parallel episode analyses (configurable)
- **Framework Versioning**: Include `framework_version` field in episode insights
- **Backward Compatibility**: Maintain week-level report schema for UI

### Pending Decisions
- [ ] IndexedDB wrapper library (Dexie.js vs idb vs native)
- [ ] Episode ID format (hash vs compound key vs API-provided)
- [ ] Transcript storage strategy (store full text vs metadata only)
- [ ] Cloud backup mechanism (optional feature scope)

---

## Known Issues & Risks

### Active Issues
- None (pre-implementation)

### Risk Register

| Risk | Probability | Impact | Mitigation Status |
|------|-------------|--------|-------------------|
| IndexedDB browser compatibility | Low | High | Will test across browsers in Phase 1 |
| API rate limits with parallel calls | Medium | Medium | Configurable concurrency, exponential backoff |
| Framework changes invalidate cache | Medium | Low | Versioning strategy designed |
| Storage quota exceeded | Low | Medium | Auto-cleanup, compression, export options |

---

## Dependencies

### External Dependencies
- `idb` or `dexie` library for IndexedDB wrapper (to be selected in Phase 1)
- Google Gemini API (existing dependency, no changes)
- `@google/genai` SDK (existing, version pinned)

### Internal Dependencies
- Phase 2 requires Phase 1 storage layer complete
- Phase 3 requires Phase 2 episode analysis refactor
- Phase 4 optimization builds on Phase 3 aggregation
- Phase 5 testing validates all prior phases

---

## Testing Strategy

### Phase 1 Testing
- [ ] IndexedDB CRUD operations work correctly
- [ ] Episode schema stores all required fields
- [ ] Migration from LocalStorage preserves existing data

### Phase 2 Testing
- [ ] Individual episode analysis produces valid insights
- [ ] Parallel processing completes without race conditions
- [ ] Progress UI updates correctly

### Phase 3 Testing
- [ ] Aggregated weekly reports match expected schema
- [ ] Week-over-week deltas calculate correctly
- [ ] Top 5 issue ranking is deterministic and sensible

### Phase 4 Testing
- [ ] Incremental analysis skips cached episodes correctly
- [ ] Framework versioning allows selective reprocessing
- [ ] Executive summary generation integrates smoothly

### Phase 5 Testing
- [ ] 52-week analysis completes in <90s
- [ ] Re-run of 52 weeks completes in <5s
- [ ] Storage usage stays under 20MB for 100+ episodes
- [ ] No memory leaks with large datasets

---

## Success Criteria

### Phase 1 Complete When:
- IndexedDB storage layer functional
- Episode insights can be stored and retrieved
- Existing week-level reports migrated or preserved

### Phase 2 Complete When:
- Single episode can be analyzed independently
- 10+ episodes can process in parallel without errors
- UI shows episode-level progress

### Phase 3 Complete When:
- Weekly reports compose correctly from episode data
- Aggregation completes in <2s for 24 weeks
- Week-over-week deltas match manual calculations

### Phase 4 Complete When:
- Re-analyzing same range uses only cached data (0 API calls)
- Adding 4 new weeks only analyzes those 8 new episodes
- Framework version changes trigger appropriate reprocessing

### Phase 5 Complete When:
- All success metrics hit or exceed targets
- 52-week analysis tested successfully
- Performance benchmarks documented

---

## Next Actions

1. **Immediate**: Begin Phase 5 - Task 5.1 (Create Performance Benchmarking Suite)
2. **Phase 5 Tasks**:
   - Task 5.1: Create Performance Benchmarking Suite
   - Task 5.2: Real-World 52-Week Test
   - Task 5.3: Storage Stress Testing
   - Task 5.4: Cross-Browser Compatibility Testing
   - Task 5.5: Document Performance Improvements
3. **Note**: Phase 4 complete (2025-12-17) - All optimization tasks finished including AI executive summary synthesis and configuration management system.

---

## Notes & Learnings

### Phase 1 Implementation Notes

**Task 1.1 (2025-12-17):**
- Selected `idb` library (v8.0.3) over `dexie` for IndexedDB wrapper
- Rationale: Lightweight (~1KB vs ~18KB), promise-based API, sufficient for our simple schema needs
- Installation successful, TypeScript types included automatically
- Created test-idb.ts to verify basic CRUD operations work correctly

**Task 1.2 (2025-12-17):**
- Created `services/episodeDB.ts` with complete database schema and initialization logic
- Added four new TypeScript interfaces to `types.ts`: EpisodeInsight, TopicInsight, WeeklyAggregation, AggregatedIssue
- Implemented two object stores:
  - `episodes`: Primary key = episode_id, indexes on published_at, show_name, framework_version
  - `weeklyAggregations`: Primary key = week_start, index on framework_version
- Database schema includes upgrade logic for version migrations
- Added utility functions: initDB(), getDB(), closeDB(), deleteDB(), isIndexedDBSupported(), getStorageEstimate()
- Proper error handling with blocked/blocking/terminated callbacks
- TypeScript compilation verified - build passes successfully
- Created test-episodeDB.ts for manual browser testing (IndexedDB requires browser environment)

**Task 1.3 (2025-12-17):**
- Implemented complete CRUD layer for episode insights (19 total operations)
- Episode operations (11): saveEpisode, getEpisode, getEpisodesByDateRange, getAllEpisodes, getEpisodesByShow, getEpisodesByFrameworkVersion, deleteEpisode, clearAllEpisodes, saveEpisodesBatch, getEpisodeCount, episodeExists
- Weekly aggregation operations (5): saveWeeklyAggregation, getWeeklyAggregation, getAllWeeklyAggregations, deleteWeeklyAggregation, clearAllWeeklyAggregations
- Additional utilities (3): getWeeklyAggregationCount, episodeExists, getEpisodeCount
- All operations include comprehensive error handling with try-catch and detailed logging
- Batch operations use proper transactions for atomic updates
- Date range queries leverage IndexedDB indexes (IDBKeyRange) for efficiency
- Updated test-episodeDB.ts with 10+ test scenarios covering all operations
- TypeScript compilation verified - build passes successfully

**Task 1.4 (2025-12-17):**
- Created `utils/migration.ts` - comprehensive migration utility (450+ lines)
- Converts LocalStorage week-level reports to IndexedDB episode-level insights
- Key functions implemented:
  - `migrateWeeklyReportsToEpisodes()` - Main migration function with dry-run and force options
  - `generateEpisodeId()` - Creates deterministic episode IDs from metadata
  - `extractTopicsForEpisode()` - Maps week report issues back to individual episodes
  - `isMigrationNeeded()` - Checks if LocalStorage has data to migrate
  - `getMigrationStats()` - Returns migration statistics without running migration
- Migration features:
  - Idempotent: safe to run multiple times (checks existing episodes, skips newer versions)
  - Preserves LocalStorage data as backup (never deletes original data)
  - Tags migrated data with framework_version = "v1-legacy"
  - Calculates overall sentiment as weighted average of topic sentiments
  - Detects Trump administration focus based on topic keywords
  - Comprehensive error handling and logging
  - Returns detailed MigrationResult with statistics
- Updated `components/DashboardSetup.tsx`:
  - Added migration state management (isMigrating, migrationComplete, etc.)
  - Added useEffect hook to check migration status on component mount
  - Created migration UI section (amber banner) conditionally shown when needed
  - Displays migration statistics (weeks and episodes to migrate)
  - "Migrate Data" button with loading and success states
  - "Skip for Now" button to dismiss banner
  - Success and error message displays with icons
  - Auto-hides banner 3 seconds after successful migration
- Created `test-migration.ts` - test suite with functions for:
  - testMigrationCheck() - Verify migration detection
  - testMigrationDryRun() - Simulate migration without writing
  - testMigrationReal() - Run actual migration
  - testVerifyMigration() - Confirm migrated data in IndexedDB
- TypeScript compilation verified - build passes successfully

**Task 1.5 (2025-12-17):**
- Created `services/episodeSearch.ts` - comprehensive episode search service (350+ lines)
- Added EpisodeMetadata and SearchCacheEntry types to `types.ts`
- Updated `services/episodeDB.ts` to v2:
  - Added searchCache object store with cache_key primary key
  - Added by-expires-at index for efficient cleanup
  - Added 5 new CRUD operations for search cache management
- Key functions implemented:
  - `searchEpisodesInRange()` - Main search function using Gemini API with Google Search
  - `searchEpisodesWithValidation()` - Wrapper with input validation
  - `getEpisodeMetadata()` - Single episode lookup (placeholder for future integration)
  - `validateDateFormat()` - Date validation utility
  - Episode ID normalization and deduplication logic
- Search caching features:
  - 7-day cache expiry (configurable via CACHE_EXPIRY_DAYS constant)
  - Cache key format: "search_{startDate}_{endDate}"
  - Automatic cleanup of expired entries before each search
  - Cache hit/miss logging for debugging
- Error handling:
  - Retry logic with exponential backoff (3 attempts)
  - Handles network errors, server errors, JSON parse errors
  - API key reset integration for invalid key errors
- Created `test-episodeSearch.ts` - comprehensive test suite with 7 test scenarios:
  - Basic search, cache hit/miss, empty results, date validation
  - Validation wrapper, cache management, multi-week search
  - Available in browser console via window.episodeSearchTests
- TypeScript compilation verified - build passes successfully
- Ready for integration with Phase 2 episode processor

### Phase 2 Implementation Notes

**Task 2.1 (2025-12-17):**
- Created new `analyzeEpisode()` function in `services/gemini.ts` - the core episode-level analysis function
- Added `EPISODE_ANALYSIS_PROMPT` template for single-episode analysis:
  - Focuses on individual episode analysis (no week-over-week comparison)
  - Uses Google Search to find episode transcripts/summaries
  - Extracts topics with sentiment scores (0-100), confidence (0-1), evidence quotes, and prominence (0-1)
  - Assesses overall episode sentiment and Trump administration focus
  - Returns structured EpisodeInsight JSON
- Function signature: `analyzeEpisode(episodeId, episodeMetadata, frameworkVersion)`
- Key implementation details:
  - Reuses existing `withRetry()` function for automatic retry logic (3 attempts)
  - Reuses existing `cleanJsonText()` helper to handle markdown-wrapped JSON
  - Uses same Gemini model (gemini-3-flash-preview) and safety settings as week-level analysis
  - Automatically adds system metadata fields: framework_version, processed_at, model_used
  - Validates required fields before returning (episode_id, topics array)
  - Comprehensive error handling with descriptive error messages
- Added EpisodeMetadata and EpisodeInsight imports to gemini.ts
- Created `test-analyzeEpisode.ts` - comprehensive test suite (400+ lines):
  - testSingleEpisode() - Basic single episode analysis
  - testMultipleEpisodes() - Sequential processing of 3 episodes
  - testCachedRetrieval() - Verify IndexedDB cache retrieval
  - testCachePerformance() - Compare API call vs cache performance
  - testInsightValidation() - Validate EpisodeInsight structure
  - runAll() - Execute all tests sequentially
  - Available in browser console via window.testAnalyzeEpisode
- TypeScript compilation verified - build passes successfully
- Ready for Task 2.2 (report composition from episode insights)

**Task 2.2 (2025-12-17):**
- Created `services/reportComposer.ts` - comprehensive report composition service (650+ lines)
- Implemented `composeWeeklyReport()` function that aggregates episode insights into weekly reports WITHOUT calling AI:
  - Queries episodes from current week and prior week using IndexedDB
  - Aggregates topics across episodes using weighted ranking algorithm
  - Ranking formula: (frequency × 0.40) + (prominence × 0.35) + (consistency × 0.25)
  - Selects top 5 issues based on rank scores
  - Computes week-over-week deltas by matching issues between weeks
  - Identifies gaining/losing issues (±10 point threshold)
  - Detects narrative shifts (new topics, significant sentiment changes)
  - Builds evidence arrays from episode quotes (max 15 entries per issue)
  - Computes quality flags based on episode coverage and confidence
  - Generates placeholder executive summary (AI synthesis will be added in Phase 4)
  - Returns complete HCRReport matching existing schema for UI compatibility
- Key features implemented:
  - Topic normalization for handling variations ("Jan 6" vs "January 6", "DOJ" vs "Department of Justice")
  - Aggregation algorithm with episode_count, avg_prominence, sentiment_consistency metrics
  - Delta calculation with "new", "gaining", "losing", "dropped", "unchanged" movement types
  - Quality flag computation (hallucination_risk, data_coverage, notes)
  - Minimum thresholds (≥1 episode, prominence >0.2) with adjustment for single-episode weeks
  - Evidence building from episode quotes with proper Evidence type structure
  - Helper utilities: mean(), standardDeviation(), normalizeTopic(), getSentimentLabel(), etc.
- Created `test-reportComposer.ts` - comprehensive test suite (500+ lines) with 5 test scenarios:
  - testBasicComposition() - Validates 3-episode aggregation and top issue ranking
  - testDeltaCalculation() - Tests week-over-week sentiment delta computation
  - testTopicNormalization() - Verifies topic name variations are merged correctly
  - testPerformance() - Measures composition speed with 10 episodes (target: <2s)
  - testQualityFlags() - Validates hallucination risk and data coverage flags
  - Available in browser console via window.testReportComposer
- TypeScript compilation verified - build passes successfully
- Ready for Task 2.3 (parallel episode processing)

**Task 2.3 (2025-12-17):**
- Created `services/episodeProcessor.ts` - complete parallel processing orchestration service (350+ lines)
- Implemented `processEpisodesInRange()` function - main orchestrator for parallel episode processing:
  - Phase 1: Episode discovery via `searchEpisodesInRange()` from Task 1.5
  - Phase 2: Cache categorization - separates cached vs. uncached episodes
  - Phase 3: Parallel analysis of uncached episodes with configurable concurrency
  - Returns ProcessResult with all episodes (cached + new), statistics, and errors
- Key features implemented:
  - Configurable concurrency with default of 10 parallel workers
  - Worker pool pattern using `processInParallel()` helper for efficient parallel execution
  - Progress callback support: fires after each episode completion with (completed, total, episode, isCached)
  - Discovery callback: notifies when search completes with (total, cached, new) counts
  - Immediate cache persistence: saves each analyzed episode to IndexedDB immediately
  - Graceful error handling: logs failures but continues processing, returns errors in result
  - Force reprocess option: allows re-analyzing cached episodes (useful for framework changes)
  - Framework version support: tags new episodes with specified version (default: "v2")
- Helper functions implemented:
  - `categorizeEpisodes()` - Separates episodes into cached/uncached based on IndexedDB lookup
  - `processInParallel()` - Generic worker pool pattern with concurrency limit and progress callbacks
  - `getEpisodesForWeek()` - Retrieves episodes for a specific week window (for report composition)
  - `estimateProcessingTime()` - Estimates duration based on episode count, cache status, and concurrency
- ProcessResult interface provides detailed statistics:
  - totalEpisodes, cachedEpisodes, newlyAnalyzed, failed counts
  - durationMs for performance tracking
  - errors array with episodeId and error message for each failure
- Created `test-episodeProcessor.ts` - comprehensive test suite (700+ lines) with 7 test scenarios:
  - testBasicProcessing() - Validates basic processing with progress tracking
  - testCachePerformance() - Runs same range twice, measures speedup from caching
  - testConcurrency() - Compares concurrency=5 vs concurrency=10 performance
  - testMultiWeekProcessing() - Processes 4 weeks (~28 episodes), validates multi-week handling
  - testGetEpisodesForWeek() - Tests week-specific episode retrieval
  - testForceReprocess() - Validates force reprocess option bypasses cache
- testEstimateProcessingTime() - Tests time estimation accuracy
  - Available in browser console via window.testEpisodeProcessor
- TypeScript compilation verified - build passes successfully

**Task 2.4 (2025-12-17):**
- Updated `components/DashboardSetup.tsx` to display episode-level progress with phased states (discovering → analyzing → composing) and smooth progress bar.
- Integrated new pipeline (`processEpisodesInRange()` + `composeWeeklyReport()`) so UI reflects episode-centric processing rather than week-looping.
- Added cached vs. new episode messaging, episode titles in progress text, and time estimates via `estimateProcessingTime()`.
- Introduced cancel support using `AbortController` to halt processing and suppress further progress callbacks when requested.
- Progress UI now anchors in the generate card with responsive layout; button copy mirrors the active phase for user clarity.

### Phase 4 Implementation Notes

**Task 4.1 (2025-12-17):**
- **Core functionality already implemented:** Most incremental analysis logic was already present from Task 2.3 (Episode Processor). The `categorizeEpisodes()` function in `services/episodeProcessor.ts` already separated cached vs. uncached episodes and only analyzed new episodes.
- **Added cache staleness detection:** This was the only missing piece from the original requirements:
  - Added `stalenessThresholdDays` option to ProcessOptions interface (default: null = disabled)
  - Modified `categorizeEpisodes()` function to check `processed_at` timestamp against threshold
  - Episodes older than the threshold are treated as uncached and automatically reprocessed
  - Updated logging to show stale episode count: "40 cached, 8 new, 2 stale"
  - `forceReprocess` option overrides staleness detection (reprocesses all episodes)
- **Created comprehensive test suite:** `test-cachesStaleness.ts` with 5 test scenarios:
  1. Staleness detection disabled by default - verifies old episodes use cache
  2. Staleness detection enabled with 30-day threshold - verifies old episodes trigger reprocessing
  3. Fresh episodes not reprocessed - verifies episodes within threshold use cache
  4. Force reprocess overrides staleness check - verifies forceReprocess works correctly
  5. Mixed fresh and stale episodes - verifies correct handling of both types
- **Available in browser console:** `window.testCacheStaleness.runAll()`
- **Files modified:** `services/episodeProcessor.ts`, `index.tsx`
- **Files created:** `test-cachesStaleness.ts`
- **Build passes successfully** - TypeScript compilation verified

**Task 4.2 (2025-12-17):**
- **Created centralized framework version management system:**
  - Created `constants/frameworkVersion.ts` with FRAMEWORK_VERSION = "v2.0.0" constant
  - Added FRAMEWORK_CHANGELOG documenting changes in each version (v2.0.0, v1.0.0, v1-legacy)
  - Implemented version comparison utilities: compareVersions(), isVersionOutdated(), getAllVersions(), getVersionChangelog()
  - Handles semantic versioning and special "v1-legacy" version from migration
- **Implemented version management functions in episodeProcessor.ts:**
  - getEpisodesNeedingUpdate() - Identifies all episodes with outdated framework versions
  - getEpisodeCountsByVersion() - Returns episode count distribution by version (useful for analytics/UI)
  - reprocessWithFrameworkVersion() - Main reprocessing function with flexible options:
    - Reprocess all outdated episodes or specific source version
    - Optional date range filtering to limit scope
    - Full ProcessOptions support (concurrency, callbacks, abort signals)
    - Force reprocess option to override cache
    - Returns ProcessResult with detailed statistics and error tracking
  - upgradeEpisodeToCurrentVersion() - Single-episode upgrade function for targeted updates
- **Updated existing code to use centralized constant:**
  - Updated episodeProcessor.ts default options: frameworkVersion = FRAMEWORK_VERSION
  - Updated reportComposer.ts: CURRENT_FRAMEWORK_VERSION = FRAMEWORK_VERSION
  - Episode tagging already implemented in Task 2.1 (analyzeEpisode function)
  - All new episodes automatically tagged with current version
- **Added minimal version display UI:**
  - Added version footer to DashboardSetup component showing current framework version
  - Non-intrusive, informative display for users and developers
  - Imported FRAMEWORK_VERSION constant into React component
- **Created comprehensive test suite:** `test-frameworkVersioning.ts` with 10 test scenarios:
  1. testVersionComparison() - Validates version comparison logic (v2.0.0 > v1.0.0, etc.)
  2. testVersionOutdatedCheck() - Tests isVersionOutdated() function
  3. testGetAllVersions() - Lists all known versions with changelog
  4. testEpisodeVersionDistribution() - Shows episode count by version from database
  5. testGetEpisodesNeedingUpdate() - Identifies outdated episodes needing upgrade
  6. testCreateMixedVersionEpisodes() - Creates test data with v1-legacy, v1.0.0, v2.0.0 episodes
  7. testCleanupTestEpisodes() - Lists and cleanup instructions for test episodes
  8. testUpgradeSingleEpisode() - Demonstrates upgradeEpisodeToCurrentVersion() usage (dry run)
  9. testReprocessWithVersion() - Demonstrates batch reprocessing options (dry run)
  10. testBackwardCompatibility() - Verifies all versions can be read without errors
- **Available in browser console:** `window.testFrameworkVersioning.runAll()`
- **Files created:** `constants/frameworkVersion.ts`, `test-frameworkVersioning.ts`
- **Files modified:** `services/episodeProcessor.ts`, `services/reportComposer.ts`, `components/DashboardSetup.tsx`, `index.tsx`
- **Build passes successfully** - TypeScript compilation verified

**Task 4.3 (2025-12-17):**
- **Created AI-powered executive summary synthesis** as optional enhancement
- **Added `synthesizeExecutiveSummary()` function** in services/gemini.ts (100+ lines):
  - Function signature: `synthesizeExecutiveSummary(weekStart, weekEnd, topIssues, episodes, narrativeShifts)`
  - Input: Top 5 issues with sentiment/prominence, episode summaries, narrative shift descriptions
  - Output: Array of 3-5 paragraph strings (50-80 words each)
  - Uses gemini-3-flash-preview model (no Google Search needed - all context provided)
  - Typical processing time: 2-3 seconds per week
- **Created SUMMARY_SYNTHESIS_PROMPT** template:
  - Instructs AI to write specific, evidence-based summaries
  - Requires mentioning bills, events, names, dates when available
  - Focuses on WHY sentiment changed, not just that it did
  - Emphasizes narrative shifts and notable developments
  - Returns clean JSON array (no markdown code blocks)
- **Integrated into reportComposer.ts**:
  - Modified `composeWeeklyReport()` to conditionally use AI synthesis
  - Checks `config.features.enableAIExecutiveSummary` setting (default: false)
  - Falls back to `generatePlaceholderSummary()` if AI synthesis fails or disabled
  - Maintains backward compatibility with existing placeholder summaries
- **Created comprehensive test suite** (test-executiveSummary.ts) with 5 scenarios:
  1. testDirectSynthesis() - Direct synthesis with sample data, validates paragraph count and word counts
  2. testReportComposerWithAI() - Full report composition with AI synthesis enabled
  3. testReportComposerWithoutAI() - Full report composition with placeholder (AI disabled)
  4. testPerformanceComparison() - Measures AI overhead vs placeholder (<5s acceptable)
  5. testConfigPersistence() - Validates settings save/load/reset correctly
- **Available in browser console:** `window.testExecutiveSummary.runAll()`
- **Files created:** `test-executiveSummary.ts`
- **Files modified:** `services/gemini.ts`, `services/reportComposer.ts`, `index.tsx`
- **Build passes successfully** - TypeScript compilation verified
- **Feature is optional by design:** Disabled by default for faster processing, can be enabled in settings

**Task 4.4 (2025-12-17):**
- **Created complete configuration management system** in constants/config.ts (200+ lines)
- **Implemented AppConfig interface** with three sections:
  - **Processing:** concurrency (1-20, default: 10), retryAttempts (0-10, default: 3), retryDelayMs (0-10000ms, default: 1000ms)
  - **Caching:** episodeStalenessThresholdDays (null or 1-365, default: null), maxWeeklyCacheEntries (1-104, default: 52), enableWeeklyAggregationCache (boolean, default: true)
  - **Features:** enableAIExecutiveSummary (boolean, default: false), enableDetailedProgress (boolean, default: true), enableCacheAnalytics (boolean, default: false)
- **Configuration persistence functions:**
  - `loadConfig()` - Loads from LocalStorage with deep merge fallback to defaults
  - `saveConfig()` - Persists entire config to LocalStorage
  - `updateConfig()` - Updates single setting and auto-saves
  - `resetConfig()` - Restores all defaults
  - `validateConfig()` - Validates ranges and returns errors array
  - `getConfig()` / `refreshConfig()` - Singleton pattern for efficient access
- **Added settings UI** in DashboardSetup.tsx:
  - Collapsible "Advanced Settings" panel with Settings icon and chevron indicator
  - Three organized sections: Processing, Features, Caching
  - **Processing section:** Slider for concurrency (1-20) with live value display and description
  - **Features section:** Two toggles (AI executive summaries, detailed progress) with descriptions
  - **Caching section:** Toggle for weekly aggregation cache with description
  - "Reset to Defaults" button at bottom
  - All controls have hover states and accessible labels
  - Real-time updates (no save button needed - changes persist immediately)
  - Clean, professional UI using Tailwind CSS
- **Settings state management:**
  - Added useState for showSettings (toggle panel) and config (current settings)
  - Config automatically loaded on component mount via getConfig()
  - All updates use updateConfig() which handles persistence
- **Integrates seamlessly** with Task 4.3 AI synthesis feature via enableAIExecutiveSummary flag
- **Files created:** `constants/config.ts`
- **Files modified:** `components/DashboardSetup.tsx`
- **Build passes successfully** - TypeScript compilation verified

---

**Status Legend**:
- ✅ Complete
- 🟢 In Progress
- ⬜ Not Started
- ⚠️ Blocked
- ❌ Cancelled/Skipped
