// Deterministic, offline question-answering engine for Ask MediFlow IQ.
//
// No external AI model, no network calls, no database access. Matching is a
// transparent weighted overlap score across a normalised, synonym-expanded
// knowledge base. The same code powers the UI and the unit tests.

import type {
  AskOptions,
  AskResult,
  HelpAnswer,
  HelpArticle,
  HelpLink,
  HelpMatch,
  HelpRelated,
  TroubleshootingOption,
} from "./types";
import {
  EXAMPLE_QUESTIONS,
  HELP_ARTICLES,
  MODULE_LABELS,
  MODULE_QUESTIONS,
  getArticle,
} from "./knowledge-base";
import { normalizeText, sanitizeInput, searchKeys } from "./normalize";

// --- Tunables -------------------------------------------------------------
// Minimum fraction of the query's meaningful concepts that must be present.
// Deliberately high: a question that only shares one generic word (e.g. "stock"
// in "what is the stock market doing today") must NOT receive a help answer.
const MIN_COVERAGE = 0.7;
// Minimum weighted score required to treat a match as reliable.
const MIN_SCORE = 60;
// Score at/above which confidence is reported as "strong".
const STRONG_SCORE = 160;

export const FALLBACK_MESSAGE =
  "I'm designed to help you use MediFlow IQ. I couldn't find a reliable answer to that question in the " +
  "available help content. Try asking about POS, Products, Inventory, Purchases, Reports, or another " +
  "MediFlow IQ feature.";

export const EMPTY_MESSAGE =
  "Type a question about MediFlow IQ and I'll search the help content for the answer.";

// --- Index ----------------------------------------------------------------
interface HelpDoc {
  article: HelpArticle;
  /** Normalized canonical questions (questions + phrasings). */
  questionTexts: string[];
  /** Concept/token keys across every searchable field. */
  searchKeys: Set<string>;
  titleKeys: Set<string>;
  keywordKeys: Set<string>;
  repQuestion: string;
}

function keysOf(text: string): Set<string> {
  try {
    return searchKeys(text);
  } catch {
    return new Set<string>();
  }
}

function articleText(a: HelpArticle): string {
  const parts: Array<string | undefined> = [
    a.title,
    a.intro,
    ...(a.questions ?? []),
    ...(a.phrasings ?? []),
    ...(a.keywords ?? []),
    ...(a.prerequisites ?? []),
    ...(a.steps ?? []),
    ...(a.warnings ?? []),
    ...(a.troubleshooting ?? []),
    ...(a.options ?? []).flatMap((o) => [o.label, o.intro, ...(o.steps ?? [])]),
    ...(a.relatedQuestions ?? []),
    a.module,
    a.moduleLabel,
  ];
  return parts.filter(Boolean).join(" ");
}

function buildDoc(article: HelpArticle): HelpDoc {
  // Spread first, then fill in required arrays so malformed/incomplete content
  // (e.g. in tests) never throws during indexing.
  const safe: HelpArticle = {
    ...article,
    questions: article.questions ?? [],
    steps: article.steps ?? [],
    keywords: article.keywords ?? [],
  };
  const questions = [...(safe.questions ?? []), ...(safe.phrasings ?? [])];
  return {
    article: safe,
    questionTexts: questions.map((q) => normalizeText(q)).filter(Boolean),
    searchKeys: keysOf(articleText(safe)),
    titleKeys: keysOf(safe.title ?? ""),
    keywordKeys: keysOf((safe.keywords ?? []).join(" ")),
    repQuestion: (safe.questions ?? [])[0] ?? safe.title ?? "",
  };
}

let DOCS: HelpDoc[] | null = null;
function docs(): HelpDoc[] {
  if (!DOCS) DOCS = HELP_ARTICLES.map(buildDoc);
  return DOCS;
}

// --- Scoring --------------------------------------------------------------
export interface ArticleScore {
  score: number;
  coverage: number;
  titleHits: number;
  keywordHits: number;
  exact: boolean;
  contextBonus: number;
}

/**
 * Score a single article against a query. Higher is better; 0 means no match.
 * The formula is intentionally simple and inspectable.
 */
export function scoreArticle(
  article: HelpArticle,
  query: string,
  contextModule?: string | null,
): ArticleScore {
  const doc = buildDoc(article);
  return scoreDoc(doc, query, contextModule ?? null);
}

function scoreDoc(doc: HelpDoc, query: string, contextModule?: string | null): ArticleScore {
  const qKeys = keysOf(query);
  const empty: ArticleScore = {
    score: 0,
    coverage: 0,
    titleHits: 0,
    keywordHits: 0,
    exact: false,
    contextBonus: 0,
  };
  if (qKeys.size === 0) return empty;

  let hits = 0;
  for (const key of qKeys) if (doc.searchKeys.has(key)) hits++;
  const coverage = hits / qKeys.size;

  let titleHits = 0;
  let keywordHits = 0;
  for (const key of qKeys) {
    if (doc.titleKeys.has(key)) titleHits++;
    if (doc.keywordKeys.has(key)) keywordHits++;
  }

  const nq = normalizeText(query);
  const exact = nq.length > 0 && doc.questionTexts.includes(nq);
  const contextBonus =
    contextModule && doc.article.module === contextModule ? 25 : 0;

  const score =
    coverage * 100 +
    titleHits * 18 +
    keywordHits * 14 +
    (exact ? 900 : 0) +
    contextBonus;

  return { score, coverage, titleHits, keywordHits, exact, contextBonus };
}

function toMatch(doc: HelpDoc, score: number): HelpMatch {
  return {
    articleId: doc.article.id,
    module: doc.article.module,
    title: doc.article.title,
    question: doc.repQuestion,
    score,
  };
}

/** Rank all articles for a query (best first). Only reliable matches survive. */
export function rankArticles(query: string, contextModule?: string | null): HelpMatch[] {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];

  const results: Array<{ doc: HelpDoc; s: ArticleScore }> = [];
  for (const doc of docs()) {
    const s = scoreDoc(doc, trimmed, contextModule ?? null);
    if (s.coverage >= MIN_COVERAGE && s.score >= MIN_SCORE) {
      results.push({ doc, s });
    }
  }

  results.sort(
    (a, b) => b.s.score - a.s.score || a.doc.article.title.localeCompare(b.doc.article.title),
  );
  return results.map((r) => toMatch(r.doc, r.s.score));
}

// --- Answer construction --------------------------------------------------
function buildLinks(article: HelpArticle): HelpLink[] {
  if (!article.route) return [];
  return [
    {
      label: `Open ${MODULE_LABELS[article.module] ?? article.moduleLabel ?? "module"}`,
      href: article.route,
      permission: article.permission ?? null,
    },
  ];
}

function buildRelated(article: HelpArticle): HelpRelated[] {
  const out: HelpRelated[] = [];
  for (const id of article.relatedArticleIds ?? []) {
    const a = getArticle(id);
    if (!a) continue;
    out.push({ text: a.questions?.[0] ?? a.title, articleId: a.id });
  }
  for (const q of article.relatedQuestions ?? []) {
    out.push({ text: q });
  }
  return out;
}

function confidenceFor(score: number): number {
  return Math.max(0, Math.min(1, Math.round((score / STRONG_SCORE) * 100) / 100));
}

function buildAnswer(article: HelpArticle, score: number): Extract<HelpAnswer, { kind: "answer" }> {
  return {
    kind: "answer",
    articleId: article.id,
    title: article.title,
    module: article.module,
    moduleLabel: MODULE_LABELS[article.module] ?? article.moduleLabel ?? article.module,
    intro: article.intro ?? "",
    prerequisites: article.prerequisites ?? [],
    steps: article.steps ?? [],
    warnings: article.warnings ?? [],
    troubleshooting: article.troubleshooting ?? [],
    links: buildLinks(article),
    related: buildRelated(article),
    options: article.options ?? [],
    confidence: confidenceFor(score),
  };
}

/** Build an answer for a specific article (used by related links / follow-ups). */
export function getArticleAnswer(articleId: string): HelpAnswer | null {
  const article = getArticle(articleId);
  if (!article) return null;
  return buildAnswer(article, STRONG_SCORE);
}

/** Turn a guided-troubleshooting option into a standalone answer. */
export function optionToAnswer(articleId: string, option: TroubleshootingOption): HelpAnswer {
  const article = getArticle(articleId);
  return {
    kind: "answer",
    articleId: article ? `${article.id}#opt` : "option",
    title: article ? `${article.title} — ${option.label}` : option.label,
    module: article?.module ?? "getting_started",
    moduleLabel: article ? MODULE_LABELS[article.module] ?? article.module : "Help",
    intro: option.intro,
    prerequisites: [],
    steps: option.steps ?? [],
    warnings: [],
    troubleshooting: [],
    links: article ? buildLinks(article) : [],
    related: [],
    options: [],
    confidence: 0.7,
  };
}

function suggestionsFor(contextModule?: string | null): string[] {
  if (contextModule && MODULE_QUESTIONS[contextModule]) return MODULE_QUESTIONS[contextModule];
  return EXAMPLE_QUESTIONS;
}

function fallbackAnswer(contextModule?: string | null): HelpAnswer {
  return {
    kind: "fallback",
    title: "I couldn't find a reliable answer",
    message: FALLBACK_MESSAGE,
    suggestions: suggestionsFor(contextModule),
  };
}

function emptyAnswer(contextModule?: string | null): HelpAnswer {
  return {
    kind: "empty",
    title: "Ask MediFlow IQ",
    message: EMPTY_MESSAGE,
    suggestions: suggestionsFor(contextModule),
  };
}

// --- Live-data intent -----------------------------------------------------
/**
 * Detect questions that ask for the user's current data (rather than "how do
 * I"). The assistant never returns live figures; it explains how to find them.
 */
export function detectLiveDataIntent(query: string): boolean {
  const n = normalizeText(query);
  if (!n) return false;
  // Documentation-style questions are never live-data questions.
  if (/\bhow (do|does|can|should|to)\b/.test(n)) return false;
  if (/\bexplain\b/.test(n) || /\bmeaning of\b/.test(n)) return false;

  const asks = /\b(which|what|how many|list|show me|show all|do i have|are there)\b/.test(n);
  const current =
    /\b(current|currently|right now|today|tonight|this week|this month|this year|now|left|remaining|in stock|low in stock|available)\b/.test(
      n,
    );
  return asks && current;
}

function liveDataNote(article: HelpArticle): string {
  const label = MODULE_LABELS[article.module] ?? article.moduleLabel ?? "the module";
  return (
    `That looks like a question about your current data. Ask MediFlow IQ explains how to find things ` +
    `but does not read your live records. Open ${label} to see the latest figures.`
  );
}

// --- Public API -----------------------------------------------------------
/**
 * Answer a question. Always returns a structured HelpAnswer, even for empty
 * input or unrelated questions.
 */
export function askHelp(query: string, options: AskOptions = {}): AskResult {
  const raw = sanitizeInput(query ?? "");
  const trimmed = raw.trim();
  const contextModule = options.contextModule ?? null;

  if (!trimmed) {
    return { query: trimmed, answer: emptyAnswer(contextModule), matches: [] };
  }

  const ranked = rankArticles(trimmed, contextModule);
  if (!ranked.length) {
    return { query: trimmed, answer: fallbackAnswer(contextModule), matches: [] };
  }

  const best = ranked[0];
  const article = getArticle(best.articleId);
  if (!article) {
    // Should not happen, but never throw on malformed content.
    return { query: trimmed, answer: fallbackAnswer(contextModule), matches: ranked };
  }

  let answer = buildAnswer(article, best.score);
  if (detectLiveDataIntent(trimmed)) {
    answer = { ...answer, note: liveDataNote(article) };
  }

  const limit = options.limit ?? 4;
  return { query: trimmed, answer, matches: ranked.slice(0, limit) };
}

// --- Security helpers -----------------------------------------------------
/** Only allow safe, internal navigation links. */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  if (!href.startsWith("/")) return false;
  if (href.startsWith("//")) return false;
  if (href.includes("\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(href)) return false;
  return true;
}

/**
 * Hide links the current user is not allowed to use. When permissions are
 * unknown (still loading, or offline), links are shown optimistically — the
 * destination page still enforces its own authorization.
 */
export function filterHelpLinks(links: HelpLink[], permissions: string[] | null): HelpLink[] {
  const safe = links.filter((l) => isSafeHref(l.href));
  if (permissions === null) return safe;
  return safe.filter((l) => !l.permission || permissions.includes(l.permission));
}

/** Contextual suggestions for a module (used by the empty state). */
export function moduleSuggestions(module?: string | null): string[] {
  return suggestionsFor(module);
}
