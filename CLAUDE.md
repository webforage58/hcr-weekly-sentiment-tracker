# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HCR Weekly Sentiment Tracker is a React/TypeScript application that analyzes political sentiment from Heather Cox Richardson's shows using Google Gemini AI with Search Grounding. The app converts qualitative political commentary into quantitative metrics (0-100 sentiment index) and tracks narrative shifts over time.

## Development Commands

```bash
# Start development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Data Flow

1. **Date Range Selection** → Week Windows Generation → Report Generation (with caching)
2. **Report Analysis** → Google Gemini API (with Search Grounding) → Structured JSON
3. **Multi-Week Aggregation** → Dashboard Visualization
4. **Optional Market Analysis** → Correlation with S&P 500, VIX, Treasury Yields

### Core Components

- **App.tsx**: Root component, handles API key gating via `window.aistudio`, manages report import/export
- **DashboardSetup.tsx**: Date range selection, multi-week generation orchestration, file upload, demo loading
- **ReportDashboard.tsx**: Main visualization showing sentiment charts, issue cards, evidence, and market analysis
- **BrainstormModal.tsx**: Market correlation analysis modal with PDF export functionality

### Key Services

**services/gemini.ts**
- Uses `@google/genai` SDK with `gemini-3-flash-preview` model
- Two main functions:
  - `generateReport()`: Generates weekly sentiment analysis with Google Search grounding
  - `generateMarketBrainstorm()`: Correlates sentiment with market data (S&P 500, VIX, TNX)
- Implements automatic retry logic for network/server errors and JSON parsing failures
- Uses structured prompts requiring strict JSON output (no markdown code blocks)
- Safety settings configured to BLOCK_ONLY_HIGH for all harm categories

**services/storage.ts**
- LocalStorage-based caching layer keyed by week start date (YYYY-MM-DD)
- Prevents redundant API calls when re-analyzing previously processed weeks
- All data stored in single key: `hcr_sentiment_weeks`

**utils/reportUtils.ts**
- `getWeekWindows()`: Converts arbitrary date ranges into Sunday-Saturday aligned windows
- `aggregateReports()`: Merges multiple weekly reports into a single dashboard view
- Handles local timezone parsing to avoid UTC shifts

### Type System

The `types.ts` file defines the complete data schema:

- **HCRReport**: Top-level report structure with executive summary, top 5 issues, narrative shifts, quality flags
- **IssueEntry**: Individual issue with sentiment_index (0-100), confidence score, delta from prior week, evidence array
- **Evidence**: Quote/paraphrase with episode metadata and offsets
- **MarketAnalysisResult**: Market data correlation with daily_data array for charting

### Environment & Configuration

**API Key Management**
- The app expects a `window.aistudio` object (Google AI Studio integration) for API key selection
- API key is exposed via `process.env.API_KEY` (from `GEMINI_API_KEY` env var)
- If `window.aistudio` is not available, app assumes key is present (fallback mode)
- vite.config.ts defines both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` from env

**Vite Configuration**
- Dev server: `0.0.0.0:3000`
- Path alias: `@/*` maps to project root
- Environment variables loaded from `.env` files via `loadEnv()`

## Critical Implementation Details

### Date Windowing System
The app processes data in 7-day Sunday-Saturday windows to maintain consistency:
- User selects arbitrary date range → automatically aligned to week boundaries
- Each window includes prior week dates for delta calculations
- Maximum 4 weeks per generation run (28-day limit enforced in UI)

### Caching Strategy
Before generating a report for a week, the system checks LocalStorage. This means:
- Running the same date range multiple times is instant
- Clearing browser data loses all cached analyses
- No backend persistence exists

### Aggregation Logic
When multiple weeks are analyzed:
- Each week is processed sequentially with 1-second delays between API calls
- Final report uses latest week's analysis but extends window_start to cover full range
- Report is marked with `isAggregated: true` flag

### Google Gemini Integration
The prompts are designed for search-grounded analysis:
- Gemini searches for HCR show transcripts within the specified date window
- Model must return structured JSON with evidence citations
- All sentiment scores require supporting evidence from search results
- JSON parsing errors trigger automatic retry (up to 3 attempts)

### Market Analysis Workflow
Triggered after report generation:
- Uses Google Search to fetch historical market data for the report date range
- Gemini acts as "quantitative strategist" correlating political sentiment with asset performance
- Output includes daily time-series data for charting and markdown analysis text
- PDF export uses html2pdf.js library

## Common Pitfalls

1. **Date Parsing**: Always use local date parsing (not `new Date("YYYY-MM-DD")` which shifts to UTC)
2. **JSON Prompts**: Gemini sometimes wraps JSON in markdown code blocks - `cleanJsonText()` handles this
3. **API Key Reset**: If "Requested entity was not found" error occurs, app automatically triggers key reselection
4. **LocalStorage Limits**: Very large multi-month datasets may exceed quota - error handling logs but doesn't block
5. **Retry Logic**: Network errors and 500/503 responses are automatically retried with exponential backoff

## Data Schema Expectations

Every `HCRReport` must include:
- `run_window` and `prior_window` with Sunday-Saturday aligned dates
- `top_issues` array (typically 5 items, ranked by importance)
- Each issue must have `evidence` array with episode citations
- `quality_flags` indicating hallucination risk and data coverage
- `executive_summary` as array of detailed paragraph strings (50-80 words each)

## Styling & UI Framework

- Pure Tailwind CSS (no component library)
- Custom color palette: indigo primary, slate neutrals
- Responsive breakpoints: sm, md, lg
- Icons from `lucide-react`
- Charts from `recharts` library
