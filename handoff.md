# Handoff Document: HCR Sentiment Tracker Performance Optimization

**Date**: 2025-12-17
**Project**: Scaling HCR Sentiment Tracker from 4-week to 52-week analysis capability
**Status**: Phase 1 complete (100%) - Ready for Phase 2

---

## Project Overview

This is a performance optimization project to transform the HCR Sentiment Tracker from a **week-centric** architecture to an **episode-centric** architecture. The goal is to enable analysis of 24-52 weeks of political sentiment data efficiently.

### Key Objectives
- Enable 24-week analysis in <40 seconds (currently ~144s)
- Enable 52-week analysis in <90 seconds (currently N/A)
- Make re-runs of same date range instant (<5s)
- Reduce redundant AI API calls by ~10x
- Scale storage to support 100+ episodes

### Architectural Change
**Current (Week-Level Caching):**
```
User selects dates → Generate weeks → For each week: Call AI → Cache week report
```

**Target (Episode-Level Caching):**
```
User selects dates → Discover episodes → Analyze each episode once (parallel) →
Store in IndexedDB → Compose weekly reports from cached episodes (fast)
```

---

## Critical Files

### Project Documentation
- **CLAUDE.md** - Codebase architecture and development guide
- **README.md** - User-facing project documentation
- **state.md** - ⭐ **Current project state and metrics tracking**
- **todo.md** - ⭐ **Detailed task list with step-by-step instructions**
- **handoff.md** - This file

### Key Source Files
- `services/gemini.ts` - AI API integration (will be refactored)
- `services/storage.ts` - Current LocalStorage implementation (will be replaced)
- `components/DashboardSetup.tsx` - Main UI for generating reports
- `types.ts` - Data schema definitions
- `utils/reportUtils.ts` - Date windowing and aggregation logic

---

## Your Mission

### Immediate Next Task
**Start here**: Phase 2, Task 2.1 - "Extract Episode Analysis Function"

### Recently Completed
✅ **Phase 1** (2025-12-17): Foundation - Complete (100%)
- All 5 tasks completed in single day
- IndexedDB infrastructure established with 3 object stores
- 24 CRUD operations implemented
- Migration utility for existing data created
- Episode search API with 7-day caching implemented
- All TypeScript compilation verified
- Comprehensive test suites created

### Workflow Instructions

1. **Read state.md and todo.md**
   - `state.md` shows current phase, completed tasks, and metrics
   - `todo.md` contains detailed instructions for each task
   - Find the first task marked ⬜ (Not Started) - that's your next task

2. **Execute the task**
   - Follow the step-by-step instructions in todo.md
   - Implement the code changes as specified
   - Test against the acceptance criteria
   - Do NOT skip steps or take shortcuts

3. **Update tracking files IMMEDIATELY after completion**

   In **todo.md**:
   - Change task status from ⬜ to ✅
   - Add any notes about implementation decisions
   - Update "Notes" section if you encountered issues

   In **state.md**:
   - Check off completed task in phase checklist
   - Update "Current Phase" status if needed
   - Record any metrics or test results
   - Add learnings to "Notes & Learnings" section
   - Update "Next Actions"

4. **Move to next task**
   - Identify the next ⬜ task in todo.md
   - Verify dependencies are met
   - Repeat the cycle

### Task Completion Checklist

Before marking a task as complete (✅), ensure:
- [ ] All steps in todo.md executed
- [ ] All acceptance criteria met
- [ ] Code tested (manually or automated)
- [ ] Files created/modified as specified
- [ ] No breaking changes to existing functionality
- [ ] todo.md updated with task status
- [ ] state.md updated with progress
- [ ] Any blocking issues documented

---

## Important Guidelines

### DO:
- ✅ Read the full task description before starting
- ✅ Follow the architectural patterns from the planning doc
- ✅ Test each task thoroughly before moving on
- ✅ Update state.md and todo.md after EVERY completed task
- ✅ Document any deviations from the plan
- ✅ Ask for clarification if task is ambiguous
- ✅ Check dependencies before starting a task
- ✅ Preserve backward compatibility where noted

### DON'T:
- ❌ Skip tasks or do them out of order (unless justified)
- ❌ Make major architectural changes without documenting
- ❌ Delete existing functionality until replacement is tested
- ❌ Forget to update tracking files
- ❌ Rush through acceptance criteria
- ❌ Ignore errors or warnings
- ❌ Batch multiple tasks before updating docs

---

## Phase 1 Overview (Complete ✅)

**Goal**: Replace LocalStorage with IndexedDB and establish episode-level caching foundation

**Tasks in Phase 1:**
1. ✅ Task 1.1: Select and Install IndexedDB Wrapper Library (30 min) - **COMPLETE**
2. ✅ Task 1.2: Create Episode-Level Database Schema (1 hour) - **COMPLETE**
3. ✅ Task 1.3: Implement Episode CRUD Operations (1.5 hours) - **COMPLETE**
4. ✅ Task 1.4: Create Migration Utility for Existing Data (1 hour) - **COMPLETE**
5. ✅ Task 1.5: Implement Episode Search API (2 hours) - **COMPLETE**

**Expected Duration**: 2 days
**Actual Duration**: 1 day (2025-12-17)
**Progress**: 100% complete (5/5 tasks done)
**Success Criteria**: IndexedDB operational ✅, episode insights can be stored/retrieved ✅, existing data preserved ✅, episode search API ready ✅

---

## Key Architectural Decisions Already Made

1. **Storage**: IndexedDB chosen over LocalStorage (50MB+ capacity needed)
2. **Concurrency**: Target 10 parallel episode analyses (configurable)
3. **Framework Versioning**: Episodes tagged with `framework_version` for selective reprocessing
4. **Backward Compatibility**: Maintain existing `HCRReport` schema for UI
5. **Episode Schema**: Defined in todo.md Task 1.2
6. **Caching Strategy**: Two-level (episode insights + weekly aggregations)

---

## Success Metrics (Targets)

| Metric | Current | Phase 3 Target | Final Target |
|--------|---------|----------------|--------------|
| 24-week first run | ~144s | <60s | <40s |
| 24-week re-run | ~144s | <10s | <5s |
| 52-week first run | N/A | N/A | <90s |
| Storage (52 weeks) | ~5MB | ~10MB | ~15MB |

Track actual results in state.md as you test.

---

## Common Pitfalls to Avoid

1. **IndexedDB Complexity**: Use a wrapper library (idb or dexie) - don't use raw IndexedDB API
2. **Async Handling**: IndexedDB operations are async - handle promises correctly
3. **Transaction Errors**: Always use transactions for data consistency
4. **Cache Invalidation**: Ensure weekly aggregation cache invalidates when episodes change
5. **Parallel Limits**: Respect API rate limits with concurrency controls
6. **TypeScript Types**: Keep type definitions in sync with schema changes
7. **Testing**: Test with real API calls occasionally, not just mocks

---

## Testing Strategy

### Phase 1 Testing
- Verify IndexedDB CRUD operations work
- Test migration from LocalStorage
- Ensure episode search returns valid results
- Check error handling for quota exceeded

### Ongoing Testing
- After each task, test affected functionality
- Keep existing features working during refactor
- Test in browser DevTools (check IndexedDB contents)
- Monitor console for errors/warnings

---

## When to Ask for Help

If you encounter:
- Ambiguous requirements in todo.md
- Architectural decisions not documented
- Breaking changes that affect multiple files
- Performance issues that deviate significantly from targets
- Blocker issues (API failures, browser incompatibilities)

Document the issue in state.md "Known Issues" section and consult with the user.

---

## Resources

### Documentation
- **Architecture Analysis**: See the comprehensive analysis in this chat history
- **IndexedDB**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **idb library**: https://github.com/jakearchibald/idb
- **Gemini API**: https://ai.google.dev/gemini-api/docs

### Code Patterns
Refer to existing code in:
- `services/gemini.ts` for API call patterns
- `services/storage.ts` for storage patterns (will be replaced but shows intent)
- `utils/reportUtils.ts` for aggregation patterns

---

## Progress Tracking

After completing each task, update this checklist in state.md:

**Phase 1**: ✅ Foundation (Complete - 5/5 tasks, 100%)
- [x] Task 1.1: IndexedDB library installed (idb v8.0.3)
- [x] Task 1.2: Episode schema defined with 3 object stores and indexes
- [x] Task 1.3: CRUD operations implemented (24 operations)
- [x] Task 1.4: Migration utility created with UI integration
- [x] Task 1.5: Episode search API built with 7-day caching

**Phase 2**: ⬜ Parallel Processing (Next)
**Phase 3**: ⬜ Aggregation Engine
**Phase 4**: ⬜ Optimization
**Phase 5**: ⬜ Scale Testing

---

## Final Notes

This is a well-planned, systematic refactoring project. The success depends on:
1. **Following the plan** - Each task builds on the previous one
2. **Testing thoroughly** - Don't rush, validate each step
3. **Updating docs** - Keep state.md and todo.md current
4. **Maintaining quality** - Preserve existing functionality while building new

The architecture analysis and task breakdown are comprehensive. Trust the plan, execute methodically, and document as you go.

---

## Ready to Start?

1. Open `todo.md` and read Task 2.1 completely
2. Open `state.md` to see current project state (Phase 1 complete, Phase 2 starting)
3. Execute Task 2.1 following the detailed instructions
4. Update both files when complete
5. Move to Task 2.2

**Progress so far**: Phase 1 complete (5/5 tasks). Phase 2 ready to start! 🚀

---

**Last Updated**: 2025-12-17
**Next Instance Should**: Begin Phase 2, Task 2.1 - "Extract Episode Analysis Function"

### What Was Just Completed
✅ **Phase 1 - Foundation (Complete)**

Task 1.5 successfully implemented a comprehensive episode search API that:
- Uses Gemini API with Google Search to discover HCR episodes in date ranges
- Implements 7-day caching with automatic expiry and cleanup
- Handles edge cases (no episodes, API failures, duplicates)
- Includes retry logic with exponential backoff
- Provides input validation and error handling
- Created with comprehensive test suite (7 test scenarios)

**Database Updates:**
- Upgraded to DB v2 with searchCache object store
- Added 5 new CRUD operations for search cache management
- Total CRUD operations: 24 (up from 19)
- Total object stores: 3 (episodes, weeklyAggregations, searchCache)

**Phase 1 Summary:**
All 5 tasks completed in 1 day (vs. 2-day target), delivering:
- Complete IndexedDB infrastructure with 3 object stores
- 24 CRUD operations for data management
- Migration utility for existing LocalStorage data
- Episode search API with intelligent caching
- Comprehensive test suites for all components
- All TypeScript compilation verified

Phase 1 foundation is solid and ready for Phase 2 parallel processing implementation.
