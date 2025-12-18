/**
 * Manual test harness for utils/aggregation.ts
 * Run via browser console:
 *  1) npm run dev
 *  2) open console
 *  3) await window.aggregationTests.runAll()
 */

import { computeDeltas, rankIssues } from './utils/aggregation';
import type { EpisodeInsight, RankedIssue } from './types';

function createEpisode(
  episodeId: string,
  publishedAt: string,
  topics: Array<{
    name: string;
    sentiment: number;
    confidence: number;
    prominence: number;
    quotes: string[];
  }>
): EpisodeInsight {
  return {
    episode_id: episodeId,
    show_name: "Test Show",
    title: `Episode ${episodeId}`,
    published_at: publishedAt,
    topics: topics.map(topic => ({
      topic_name: topic.name,
      sentiment_score: topic.sentiment,
      confidence: topic.confidence,
      prominence_score: topic.prominence,
      evidence_quotes: topic.quotes
    })),
    overall_sentiment: topics.reduce((sum, t) => sum + t.sentiment, 0) / topics.length,
    trump_admin_focus: true,
    key_quotes: topics.flatMap(t => t.quotes).slice(0, 3),
    framework_version: "v2-test",
    processed_at: new Date().toISOString(),
    model_used: "test-model"
  };
}

async function testDeterministicRanking(): Promise<void> {
  console.log("\n=== Test: Deterministic Ranking ===");
  const episodes = [
    createEpisode("ep-1", "2025-06-10", [
      { name: "Economic Policy", sentiment: 60, confidence: 0.8, prominence: 0.7, quotes: ["Growth beat expectations."] },
      { name: "Supreme Court", sentiment: 40, confidence: 0.78, prominence: 0.5, quotes: ["Major ruling issued."] }
    ]),
    createEpisode("ep-2", "2025-06-12", [
      { name: "Economic Policy", sentiment: 55, confidence: 0.82, prominence: 0.65, quotes: ["Jobs report remained strong."] }
    ])
  ];

  const forward = rankIssues(episodes);
  const reverse = rankIssues([...episodes].reverse());

  const forwardNames = forward.map(i => i.normalized_name);
  const reverseNames = reverse.map(i => i.normalized_name);

  if (JSON.stringify(forwardNames) !== JSON.stringify(reverseNames)) {
    throw new Error("Ranking changed when episode order changed.");
  }

  console.log("✓ Ranking stable across input order");
}

async function testTopicMerging(): Promise<void> {
  console.log("\n=== Test: Topic Merging ===");
  const episodes = [
    createEpisode("ep-3", "2025-06-14", [
      { name: "Jan 6 Hearing", sentiment: 30, confidence: 0.86, prominence: 0.8, quotes: ["New evidence released."] }
    ]),
    createEpisode("ep-4", "2025-06-15", [
      { name: "January 6 Investigation", sentiment: 28, confidence: 0.81, prominence: 0.7, quotes: ["Probe expands."] }
    ])
  ];

  const ranked = rankIssues(episodes);
  const jan6 = ranked.find(i => i.normalized_name.includes("january 6"));

  if (!jan6) {
    throw new Error("January 6 topics were not merged.");
  }

  if (jan6.episode_count !== 2) {
    throw new Error(`Expected 2 merged episodes, got ${jan6.episode_count}`);
  }

  console.log("✓ Similar topics merged and episode counts aggregated");
}

async function testDeltaComputation(): Promise<void> {
  console.log("\n=== Test: Delta Computation ===");

  const priorIssues: RankedIssue[] = rankIssues([
    createEpisode("ep-5", "2025-06-03", [
      { name: "Immigration Policy", sentiment: 40, confidence: 0.8, prominence: 0.6, quotes: ["Policy faced criticism."] }
    ])
  ]);

  const currentIssues: RankedIssue[] = rankIssues([
    createEpisode("ep-6", "2025-06-11", [
      { name: "Immigration Policy", sentiment: 55, confidence: 0.82, prominence: 0.7, quotes: ["New measures announced."] }
    ]),
    createEpisode("ep-7", "2025-06-12", [
      { name: "Climate Change", sentiment: 45, confidence: 0.75, prominence: 0.5, quotes: ["New bill introduced."] }
    ])
  ]);

  const { deltas, dropped } = computeDeltas(currentIssues, priorIssues);
  const immigrationDelta = deltas.find(d => d.issue.normalized_name === "immigration policy");
  const climateDelta = deltas.find(d => d.issue.normalized_name === "climate change");

  if (!immigrationDelta) {
    throw new Error("Missing delta for Immigration Policy.");
  }

  if (immigrationDelta.movement !== "up") {
    throw new Error(`Expected Immigration Policy to move up, got ${immigrationDelta.movement}`);
  }

  if (!climateDelta) {
    throw new Error("Missing delta for Climate Change.");
  }

  if (climateDelta.movement !== "new") {
    throw new Error(`Expected Climate Change to be new, got ${climateDelta.movement}`);
  }

  if (dropped.length !== 0) {
    throw new Error("Did not expect any dropped issues when prior topics carried over.");
  }

  console.log("✓ Delta computation produced expected movements");
}

async function testSingleMentionTopicsStillSurface(): Promise<void> {
  console.log("\n=== Test: Single-Mention Topics Still Surface ===");

  const episodes = [
    createEpisode("ep-8", "2025-06-20", [
      { name: "Federal Courts", sentiment: 45, confidence: 0.8, prominence: 0.7, quotes: ["Court filings advanced."] }
    ]),
    createEpisode("ep-9", "2025-06-21", [
      { name: "Budget Negotiations", sentiment: 40, confidence: 0.82, prominence: 0.75, quotes: ["Budget talks stalled."] }
    ]),
    createEpisode("ep-10", "2025-06-22", [
      { name: "Immigration Policy", sentiment: 35, confidence: 0.78, prominence: 0.8, quotes: ["Border policy drew scrutiny."] }
    ])
  ];

  const ranked = rankIssues(episodes);
  if (ranked.length === 0) {
    throw new Error("Expected at least one ranked issue, got zero.");
  }

  console.log(`✓ Ranked ${ranked.length} issue(s) even with single-mention topics`);
}

async function runAll(): Promise<void> {
  await testDeterministicRanking();
  await testTopicMerging();
  await testDeltaComputation();
  await testSingleMentionTopicsStillSurface();
  console.log("\nAll aggregation tests passed.");
}

// Expose to browser console for manual testing
if (typeof window !== 'undefined') {
  (window as any).aggregationTests = {
    testDeterministicRanking,
    testTopicMerging,
    testDeltaComputation,
    testSingleMentionTopicsStillSurface,
    runAll
  };
}
