# Sentiment-to-Data Correlation Framework

A React/TypeScript application that converts qualitative narrative content into quantitative sentiment metrics and correlates those metrics with time-series data to identify causal relationships and predictive patterns.

## Core Concept

This framework demonstrates a powerful analytical approach:

1. **Qualitative Content Ingestion** → AI-powered extraction of themes, sentiment, and narrative shifts
2. **Sentiment Quantification** → Conversion to structured 0-100 sentiment indices with confidence scores
3. **Time-Series Correlation** → Automatic correlation with external datasets (financial markets, weather data, employment statistics, etc.)
4. **Evidence-Grounded Analysis** → All claims backed by citations from source material

The current implementation analyzes political sentiment from Heather Cox Richardson's shows and correlates it with financial markets (S&P 500, VIX, Treasury Yields), but the architecture is designed to support **any content source and any time-series dataset**.

## Current Use Case: Political Sentiment → Market Performance

The app currently tracks political narrative sentiment from historian Heather Cox Richardson's weekly shows and correlates changes with financial market performance.

**Key Findings Pattern:**
- Political instability narratives → VIX (volatility) spikes
- Policy clarity improvements → Treasury yield stabilization
- Executive overreach concerns → S&P 500 defensive sector rotation

This demonstrates the framework's ability to quantify abstract qualitative content and find statistically meaningful correlations with measurable outcomes.

## Potential Alternative Use Cases

The same framework can be adapted to analyze various sentiment-to-outcome relationships:

### 1. Climate Change Communication → Regional Economic Impact
**Content Source:** Climate scientist blogs, environmental policy podcasts, regional news coverage
**Sentiment Target:** "Climate Anxiety Index" or "Environmental Policy Uncertainty Score"
**Data Correlation:**
- Regional employment statistics (FTE changes in affected industries)
- Insurance claim frequency and severity
- Migration patterns and real estate market shifts
- Renewable energy investment flows

**Hypothesis:** Regions with high climate anxiety sentiment may show accelerated economic transitions, insurance market stress, or demographic shifts before they appear in traditional economic indicators.

### 2. AI Progress Narratives → Labor Market Disruption
**Content Source:** Tech industry podcasts, AI research publications, CEO earnings calls
**Sentiment Target:** "Automation Urgency Index" or "AI Capability Confidence Score"
**Data Correlation:**
- Job posting trends by category (creative, analytical, manual)
- Wage growth rates in automation-vulnerable sectors
- Venture capital investment in AI tooling vs. human-augmentation
- Freelance platform pricing and volume changes

**Hypothesis:** Spikes in AI capability sentiment may predict sector-specific employment contractions 2-3 quarters ahead of official labor statistics.

### 3. Healthcare Policy Discourse → Insurance Market Behavior
**Content Source:** Healthcare policy analysis, medical journal editorials, patient advocacy podcasts
**Sentiment Target:** "Healthcare Access Concern Index" or "Policy Stability Score"
**Data Correlation:**
- Health insurance stock performance
- Medicaid enrollment changes
- Telemedicine adoption rates
- Pharmaceutical pricing volatility

**Hypothesis:** Healthcare policy uncertainty sentiment correlates with defensive positioning in insurance equities and accelerated adoption of alternative care models.

### 4. Supply Chain Narrative → Commodity Price Movements
**Content Source:** Logistics industry reports, geopolitical risk analysis, trade policy commentary
**Sentiment Target:** "Supply Chain Resilience Index" or "Trade Route Risk Score"
**Data Correlation:**
- Shipping container rates (spot vs. contract)
- Commodity futures (semiconductors, rare earths, agricultural products)
- Manufacturing inventory levels
- Reshoring investment announcements

**Hypothesis:** Supply chain concern sentiment leads commodity price volatility by 4-8 weeks as companies adjust procurement strategies.

### 5. Housing Affordability Discourse → Migration Patterns
**Content Source:** Urban planning podcasts, housing advocacy blogs, local government meeting transcripts
**Sentiment Target:** "Housing Accessibility Crisis Index" by metro area
**Data Correlation:**
- Net migration flows (county-level Census estimates)
- Remote work job posting concentration
- U-Haul pricing asymmetries
- School enrollment changes

**Hypothesis:** Housing affordability sentiment intensity predicts population outflows from high-cost metros 6-12 months in advance.

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Content Source (Transcripts, Articles, Audio, etc.)         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Google Gemini AI with Search Grounding                      │
│    • Finds relevant content within date windows                │
│    • Extracts themes and sentiment                             │
│    • Generates 0-100 sentiment indices                         │
│    • Provides evidence citations for every claim               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Structured Sentiment Report (JSON)                          │
│    • Top issues ranked by importance                           │
│    • Week-over-week delta tracking                             │
│    • Confidence scores and quality flags                       │
│    • Evidence array with source citations                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Time-Series Data Correlation                                │
│    • Gemini searches for historical data (markets, weather,    │
│      employment, etc.)                                         │
│    • Generates daily correlation charts                        │
│    • Provides causal analysis and attribution scores           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Interactive Dashboard + PDF Export                          │
│    • Sentiment trend visualization                             │
│    • Correlation charts with overlays                          │
│    • Evidence explorer with citations                          │
│    • Export/import for reproducibility                         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Features

**Date Windowing System**
- Processes content in configurable time windows (default: 7-day Sunday-Saturday)
- Automatically aligns arbitrary date ranges to window boundaries
- Supports multi-week aggregation with delta calculations

**Evidence Grounding**
- Every sentiment score requires supporting evidence from source material
- Citations include episode/article metadata and quote offsets
- Quality flags indicate hallucination risk and data coverage gaps

**Intelligent Caching**
- LocalStorage-based caching prevents redundant API calls
- Week-based cache keys enable instant re-analysis
- Supports offline review of previously generated reports

**Correlation Engine**
- Uses Google Search to retrieve historical time-series data
- AI acts as domain expert (e.g., "quantitative strategist" for markets)
- Generates attribution scores linking sentiment shifts to outcome changes

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Google AI Studio API key (requires paid Google Cloud project for Search Grounding)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd hcr-weekly-sentiment-tracker

# Install dependencies
npm install

# Create .env file with your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Start development server
npm run dev
```

The app will run on `http://localhost:3000`.

### Configuration for Alternative Use Cases

To adapt this framework for a different use case, modify:

1. **services/gemini.ts** - Update prompts in `generateReport()` to target your content source
2. **services/gemini.ts** - Update `generateMarketBrainstorm()` to query your target dataset
3. **types.ts** - Adjust `IssueEntry` structure if needed for domain-specific fields
4. **DashboardSetup.tsx** - Change date window sizing (currently 7-day weeks)

## How to Use the App

### Generating a New Analysis

1. **Connect API Key**
   Click "Connect API Key" and select your Google AI Studio key. Search Grounding requires a paid Cloud project.

2. **Select Date Range**
   Choose start and end dates (max 4 weeks per run for current implementation).
   The system automatically aligns to Sunday-Saturday week boundaries.

3. **Run Analysis**
   Click "Run Analysis". The system processes week-by-week with intelligent caching.
   Previously analyzed weeks load instantly from LocalStorage.

### Exploring the Dashboard

- **Sentiment Chart**: Hover over bars to see exact scores for each tracked issue
- **Evidence Explorer**: Click "Evidence & Citations" to review source quotes supporting each sentiment score
- **Correlation Analysis**: Click "Market Analysis" (or equivalent button) to see time-series correlation
- **Export/Import**: Save reports as JSON for reproducibility or sharing

### Running Correlation Analysis

1. Generate a sentiment report first
2. Click the correlation button (labeled "Market Analysis" in current implementation)
3. The AI will:
   - Search for historical data matching your report's date range
   - Generate daily time-series correlation charts
   - Provide causal analysis with attribution scores
4. Export as PDF for presentation or further analysis

## Data Structure

The app generates structured JSON reports containing:

```typescript
{
  run_window: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" },
  executive_summary: string[],  // Array of detailed paragraphs
  top_issues: [
    {
      issue_label: string,
      sentiment_index: number,     // 0-100 scale
      confidence: number,          // 0-1 scale
      delta_from_prior: number,    // Week-over-week change
      evidence: [
        {
          quote_or_paraphrase: string,
          episode_or_source: string,
          approximate_offset: string
        }
      ]
    }
  ],
  narrative_shifts: string[],
  quality_flags: {
    hallucination_risk: "Low" | "Medium" | "High",
    data_coverage: string
  }
}
```

## Accuracy & Limitations

**Strengths:**
- Evidence-grounded analysis minimizes AI hallucinations
- Structured JSON output enables programmatic validation
- Caching ensures reproducibility
- Multi-week aggregation captures trend shifts

**Limitations:**
- **Single Source Analysis**: Current implementation analyzes one content creator's perspective, not broad public opinion
- **Correlation ≠ Causation**: Statistical correlation requires human interpretation
- **API Dependency**: Requires paid Google Cloud credits for Search Grounding
- **LocalStorage Limits**: Very large multi-month datasets may exceed browser storage quota
- **Time Lag**: Some external datasets may have reporting delays (e.g., employment data released monthly)

**Best Practices:**
- Always verify critical findings against original source material using provided citations
- Use correlation insights as hypotheses, not conclusions
- Cross-reference with traditional domain-specific indicators
- Consider lead/lag relationships (sentiment may lead or lag outcomes by weeks/months)

## Development Commands

```bash
# Start development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: Google Gemini 3 Flash with Search Grounding
- **Storage**: Browser LocalStorage (client-side only)
- **Export**: html2pdf.js for PDF generation

## Contributing & Customization

This framework is designed to be forked and adapted for domain-specific use cases. When customizing:

1. **Define Your Content Source**: What qualitative content will you analyze? (podcasts, blogs, reports, etc.)
2. **Define Your Sentiment Target**: What are you measuring? (anxiety, confidence, urgency, optimism, etc.)
3. **Define Your Correlation Dataset**: What outcomes do you hypothesize sentiment predicts? (markets, employment, migration, etc.)
4. **Adjust Time Windows**: Different domains may require different analysis periods (daily, weekly, monthly)
5. **Customize Evidence Structure**: Adapt citation format to your content source (timestamps for audio, page numbers for documents, etc.)

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Original implementation focused on analyzing Heather Cox Richardson's political commentary
- Powered by Google Gemini AI with Search Grounding
- Inspired by the need to quantify qualitative narrative shifts and find predictive correlations
