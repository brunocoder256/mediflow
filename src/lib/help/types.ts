// Types for the "Ask MediFlow IQ" in-app help assistant.
//
// The knowledge base is a plain, typed data structure so content authors can
// add/update articles without touching the matching engine or UI. Nothing here
// performs I/O, database access, or any privileged operation — answers are built
// purely from bundled, reviewed help content.

/** A clickable follow-up option used by guided troubleshooting flows. */
export interface TroubleshootingOption {
  /** Short button label, e.g. "The product has no stock". */
  label: string;
  /** Short explanation shown when the option is chosen. */
  intro: string;
  /** Optional concrete steps for this branch. */
  steps?: string[];
}

/** An internal navigation link surfaced inside an answer. */
export interface HelpLink {
  label: string;
  /** Verified, internal application route (must start with "/"). */
  href: string;
  /** Permission code required to see/use this link, when applicable. */
  permission?: string | null;
}

/** A structured help article. */
export interface HelpArticle {
  /** Unique, stable id (also used as the knowledge-base key). */
  id: string;
  /** Canonical module key, e.g. "pos", "inventory", "offline". */
  module: string;
  /** Human-readable module label for badges/breadcrumbs. */
  moduleLabel: string;
  title: string;
  /** Concise, one-or-two sentence overview. */
  intro: string;
  /** Canonical/common questions this article answers. */
  questions: string[];
  /** Alternative phrasings / synonyms of the same questions. */
  phrasings?: string[];
  /** Keywords and synonyms used for matching. */
  keywords: string[];
  /** Things the user should have done first. */
  prerequisites?: string[];
  /** Numbered instructions. */
  steps: string[];
  /** Important warnings / cautions. */
  warnings?: string[];
  /** Short troubleshooting bullets. */
  troubleshooting?: string[];
  /** Decision-tree branches (guided troubleshooting). */
  options?: TroubleshootingOption[];
  /** Ids of closely related articles. */
  relatedArticleIds?: string[];
  /** Extra free-form related questions (not backed by an article id). */
  relatedQuestions?: string[];
  /** Verified internal route for "open the module" links. */
  route?: string;
  /** Permission required to open `route` (from the RBAC catalog). */
  permission?: string | null;
  /** Whether the described behaviour is shipped today or planned. */
  status?: "available" | "planned";
  /** ISO date the content was last reviewed against the codebase. */
  lastReviewed?: string;
}

/** A related-question chip shown after an answer. */
export interface HelpRelated {
  text: string;
  /** When present, the answer can be rendered directly without re-matching. */
  articleId?: string;
}

/** The assistant's structured answer. */
export type HelpAnswer =
  | {
      kind: "answer";
      articleId: string;
      title: string;
      module: string;
      moduleLabel: string;
      intro: string;
      prerequisites: string[];
      steps: string[];
      warnings: string[];
      troubleshooting: string[];
      links: HelpLink[];
      related: HelpRelated[];
      options: TroubleshootingOption[];
      /** 0–1 style confidence derived from the best match score. */
      confidence: number;
      /** Optional context note (e.g. live-data question). */
      note?: string;
    }
  | {
      kind: "fallback";
      title: string;
      message: string;
      suggestions: string[];
    }
  | {
      kind: "empty";
      title: string;
      message: string;
      suggestions: string[];
    };

/** A ranked knowledge-base hit. */
export interface HelpMatch {
  articleId: string;
  module: string;
  title: string;
  /** Representative question to show as a clickable chip. */
  question: string;
  score: number;
}

export interface AskOptions {
  /** Module the user is currently in (if opened contextually). */
  contextModule?: string | null;
  /** Max number of secondary matches to return. */
  limit?: number;
}

export interface AskResult {
  query: string;
  answer: HelpAnswer;
  /** Ranked matches (best first); useful for "related help articles". */
  matches: HelpMatch[];
}
