# HCR Weekly Sentiment Tracker

This application is a specialized dashboard designed to analyze, quantify, and track political sentiment over time based on the work of historian and author Heather Cox Richardson.

By leveraging Google Gemini AI with Search Grounding, the app ingests transcripts and summaries from shows like *"This Week in Politics"* and *"Politics Chat"* to generate a structured 0–100 sentiment index.

## Purpose

The primary goal of this tool is to convert qualitative political commentary into quantitative metrics, allowing researchers and followers to visualize shifts in narrative focus and sentiment intensity.

**Important Context:**
*   **Single Source:** This is **not** a general public opinion poll. It represents the sentiment and narrative framing specifically within the ecosystem of Heather Cox Richardson's analysis.
*   **Subject:** The analysis focuses primarily on the Trump administration and the political climate surrounding it.
*   **Metric:** The "Sentiment Index" ranges from 0 (Extremely Negative) to 100 (Extremely Positive), with 50 being Neutral/Mixed.

## Key Features

### 1. Multi-Week Analysis Generation
*   **Windowed Processing:** The app processes data in 7-day increments (Sunday to Saturday) to maintain high resolution.
*   **Caching:** Results are stored in your browser's local storage. If you re-run an analysis for a period you've already analyzed, the app loads it instantly, saving time and API tokens.
*   **Aggregation:** Multiple weeks are automatically merged into a single comprehensive dashboard.

### 2. Market Correlation Analysis (Brainstorming)
*   **Real-world Context:** Once a report is generated, you can trigger a "Market Analysis."
*   **Live Data Retrieval:** The AI uses Google Search to find historical closing prices for the **S&P 500**, **VIX (Volatility Index)**, and **US 10-Year Treasury Yields** for your specific report dates.
*   **Correlation Strategy:** A quantitative strategist agent analyzes how political narrative shifts correlate with market volatility and asset performance.
*   **PDF Export:** The full market analysis—including interactive charts—can be exported as a professional PDF report.

### 3. Data Portability
*   **JSON Export:** Save your analysis as a `.json` file to keep a permanent record or share with others.
*   **JSON Import:** Load any previously saved report instantly.

## How to Use

### Generating a New Analysis
1.  **Connect API Key:** Click the "Connect API Key" button. You must use a key from a paid Google Cloud project to access the advanced search and reasoning features.
2.  **Select Dates:** On the setup screen, choose a range (max 4 weeks per run).
3.  **Run:** Click "Run Analysis". The system will process week-by-week.

### Exploring the Dashboard
*   **Sentiment Chart:** Hover over bars to see exact scores for top issues.
*   **Evidence List:** Click "Evidence & Citations" on any issue card to see the specific quotes and sources that informed the AI's scoring.
*   **Market Analysis:** Click the "Market Analysis" button in the header to see how the week's politics impacted the economy.

## Accuracy & Limitations

*   **AI-Powered:** This tool uses Google's **Gemini 3 Flash** model.
*   **Evidence Grounding:** The system is designed to minimize "hallucinations" by requiring citations for every claim. 
*   **Quality Indicators:** Check the "Hallucination Risk" and "Sources" badges in the dashboard header for a quick health check of the current data.
*   **Manual Verification:** Users are encouraged to use the provided citation links/text to verify critical findings against the original HCR transcripts.

## Data Structure

The app generates a structured JSON format containing:
*   **Top 5 Issues:** Ranked by frequency and emphasis.
*   **Sentiment Index:** Numerical score and label for each issue.
*   **Delta vs Prior Week:** Tracking whether sentiment is improving or declining.
*   **Narrative Shifts:** Explanations of how the story changed week-over-week.
*   **Market Data:** Daily performance metrics and AI attribution scores.