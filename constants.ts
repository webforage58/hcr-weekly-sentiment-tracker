import { HCRReport } from "./types";

export const SAMPLE_REPORT: HCRReport = {
  "run_window": {
    "window_start": "2023-10-22",
    "window_end": "2023-10-28",
    "timezone": "America/Denver"
  },
  "prior_window": {
    "window_start": "2023-10-15",
    "window_end": "2023-10-21",
    "timezone": "America/Denver"
  },
  "generated_at": "2023-10-29T08:00:00Z",
  "sources_analyzed": [
    {
      "episode_id": "ep123",
      "show_name": "This Week in Politics",
      "title": "Chaos in the House",
      "published_at": "2023-10-27T10:00:00Z",
      "input_types_present": ["transcript"]
    },
    {
      "episode_id": "ep124",
      "show_name": "Politics Chat",
      "title": "October Surprise?",
      "published_at": "2023-10-24T14:00:00Z",
      "input_types_present": ["transcript"]
    }
  ],
  "executive_summary": [
    "The ongoing speakership crisis dominates the narrative, framing the GOP as fundamentally unable to govern.",
    "Economic anxiety is being leveraged by the opposition, though metrics remain strong.",
    "International relations focus has shifted slightly away from Ukraine towards the Middle East."
  ],
  "top_issues": [
    {
      "issue_id": "issue_001",
      "issue_name": "House Speakership Crisis",
      "rank_this_week": 1,
      "sentiment_index": 15,
      "sentiment_label": "negative",
      "confidence": 0.95,
      "delta_vs_prior_week": -10,
      "why_this_week": "Central topic in all episodes; framed as a historic failure of party discipline.",
      "what_changed_week_over_week": "Moved from uncertainty to active chaos with multiple failed votes.",
      "evidence": [
        {
          "episode_id": "ep123",
          "show_name": "This Week in Politics",
          "published_at": "2023-10-27T10:00:00Z",
          "evidence_type": "quote_excerpt",
          "evidence_text": "We are witnessing a party that has completely lost the ability to perform the basic functions of governance.",
          "offsets": "12:45"
        }
      ]
    },
    {
      "issue_id": "issue_002",
      "issue_name": "Judicial Independence",
      "rank_this_week": 2,
      "sentiment_index": 35,
      "sentiment_label": "negative",
      "confidence": 0.88,
      "delta_vs_prior_week": 5,
      "why_this_week": "Discussion of recent court rulings and threats to judges.",
      "what_changed_week_over_week": "Increased urgency due to new gag orders.",
      "evidence": [
        {
          "episode_id": "ep124",
          "show_name": "Politics Chat",
          "published_at": "2023-10-24T14:00:00Z",
          "evidence_type": "paraphrase",
          "evidence_text": "Richardson emphasized that attacks on the judiciary are a hallmark of authoritarian sliding.",
          "offsets": null
        }
      ]
    },
    {
      "issue_id": "issue_003",
      "issue_name": "Infrastructure Investments",
      "rank_this_week": 3,
      "sentiment_index": 75,
      "sentiment_label": "positive",
      "confidence": 0.90,
      "delta_vs_prior_week": 0,
      "why_this_week": "Highlighted as a counter-narrative to the dysfunction in Congress.",
      "what_changed_week_over_week": "Steady positive coverage of new bridge projects.",
      "evidence": [
        {
          "episode_id": "ep123",
          "show_name": "This Week in Politics",
          "published_at": "2023-10-27T10:00:00Z",
          "evidence_type": "sentiment_signal",
          "evidence_text": "Positive tone when discussing the allocation of funds for rural broadband.",
          "offsets": "24:10"
        }
      ]
    },
    {
      "issue_id": "issue_004",
      "issue_name": "Labor Unions",
      "rank_this_week": 4,
      "sentiment_index": 65,
      "sentiment_label": "positive",
      "confidence": 0.85,
      "delta_vs_prior_week": 15,
      "why_this_week": "Resolution of recent strikes framed as a victory for the middle class.",
      "what_changed_week_over_week": "Shifted from tense negotiation to celebration of agreements.",
      "evidence": [
        {
          "episode_id": "ep124",
          "show_name": "Politics Chat",
          "published_at": "2023-10-24T14:00:00Z",
          "evidence_type": "topic_mention",
          "evidence_text": "Mentioned the UAW deal as a template for future labor relations.",
          "offsets": "05:30"
        }
      ]
    },
    {
      "issue_id": "issue_005",
      "issue_name": "Election Integrity",
      "rank_this_week": 5,
      "sentiment_index": 45,
      "sentiment_label": "mixed",
      "confidence": 0.80,
      "delta_vs_prior_week": -5,
      "why_this_week": "Concerns raised about upcoming local elections.",
      "what_changed_week_over_week": "New reports of polling place intimidation discussed.",
      "evidence": [
        {
          "episode_id": "ep123",
          "show_name": "This Week in Politics",
          "published_at": "2023-10-27T10:00:00Z",
          "evidence_type": "quote_excerpt",
          "evidence_text": "The ballot box remains the ultimate check on power, but it is under siege.",
          "offsets": "31:20"
        }
      ]
    }
  ],
  "issues_gaining_importance": [
    {
      "issue_name": "Labor Unions",
      "movement": "up",
      "reason": "Successful strike resolutions.",
      "supporting_evidence": []
    }
  ],
  "issues_losing_importance": [
    {
      "issue_name": "Budget Deficit",
      "movement": "down",
      "reason": "Overshadowed by speakership fight.",
      "supporting_evidence": []
    }
  ],
  "narrative_shifts": [
    {
      "shift": "From Legislative Stalemate to Institutional Collapse",
      "why_it_changed": "The failure to elect a speaker moved the narrative from 'gridlock' to 'breakdown'.",
      "supporting_evidence": [
         {
          "episode_id": "ep123",
          "show_name": "This Week in Politics",
          "published_at": "2023-10-27T10:00:00Z",
          "evidence_type": "quote_excerpt",
          "evidence_text": "This isn't just stopping the car; this is taking the wheels off.",
          "offsets": "15:00"
        }
      ]
    }
  ],
  "evidence_gaps": [],
  "quality_flags": {
    "hallucination_risk": "low",
    "data_coverage": "full",
    "notes": []
  }
};
