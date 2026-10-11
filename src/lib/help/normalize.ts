// Question normalization + synonym expansion for the Ask MediFlow IQ engine.
//
// Pure functions only. No network, no state. This makes the matching engine
// fully functional offline and trivially unit-testable.

/** Function words removed before scoring (they carry no domain signal). */
export const STOPWORDS = new Set<string>([
  "a", "an", "the", "how", "do", "does", "did", "i", "you", "we", "they", "he", "she",
  "to", "of", "for", "in", "on", "at", "by", "is", "are", "was", "were", "am", "be",
  "can", "could", "would", "should", "will", "shall", "may", "might", "my", "me",
  "it", "this", "that", "these", "those", "with", "and", "or", "if", "then", "than",
  "get", "got", "please", "help", "need", "want", "about", "from", "when", "what",
  "which", "where", "who", "why", "there", "here", "using", "use", "used", "some",
  "any", "all", "into", "out", "up", "down", "so", "as", "but", "not", "no", "yes",
  "cant", "cannot", "dont", "doesnt", "isnt", "im", "ive", "youre", "lets", "whats",
  "new", "again", "also", "just", "very", "now", "make", "making",
]);

// Abbreviations expanded to a canonical token before matching. Applied per
// token, so "p.o." is normalized to "po" first (punctuation stripped).
const ABBREVIATIONS: Record<string, string> = {
  po: "purchase",
  grn: "receive",
  inv: "inventory",
  qty: "quantity",
  cust: "customer",
  mgr: "manager",
  pwd: "password",
  acct: "account",
  bal: "balance",
};

// Common typing mistakes corrected per token. Keys are singular forms.
const MISSPELLINGS: Record<string, string> = {
  reciept: "receipt",
  receit: "receipt",
  recipt: "receipt",
  inventry: "inventory",
  inventroy: "inventory",
  invetory: "inventory",
  suplier: "supplier",
  suppler: "supplier",
  supliers: "supplier",
  medcine: "medicine",
  medicin: "medicine",
  madicine: "medicine",
  expirary: "expiry",
  expry: "expiry",
  expirition: "expiration",
  purchese: "purchase",
  purchace: "purchase",
  purchse: "purchase",
  cusomer: "customer",
  costumer: "customer",
  custmer: "customer",
  sotck: "stock",
  stcok: "stock",
  stok: "stock",
  sesion: "session",
  scession: "session",
  acess: "access",
  acesss: "access",
  acces: "access",
  pasword: "password",
  passord: "password",
  expence: "expense",
  expeense: "expense",
  expendature: "expenditure",
  repport: "report",
  repot: "report",
  trasfer: "transfer",
  transferr: "transfer",
  notifcation: "notification",
  notificaton: "notification",
  balence: "balance",
  balnce: "balance",
};

// Words that must never be singularized (they would lose meaning).
const KEEP_WHOLE = new Set<string>([
  "pos", "status", "access", "business", "process", "class", "address", "less",
  "gas", "yes", "analysis", "basis", "cash", "this", "amox",
]);

// Explicit irregular plurals for domain nouns.
const IRREGULARS: Record<string, string> = {
  batches: "batch",
  boxes: "box",
  worths: "worth",
};

/** Naive but safe singularization. Protects known acronyms/short words. */
export function singularize(word: string): string {
  if (!word) return word;
  if (KEEP_WHOLE.has(word)) return word;
  if (IRREGULARS[word]) return IRREGULARS[word];
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length <= 3) return word;
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Normalize a single token: singularize → correct spelling → expand abbreviation. */
function normalizeToken(token: string): string {
  let t = singularize(token);
  t = MISSPELLINGS[t] ?? t;
  t = ABBREVIATIONS[t] ?? t;
  return t;
}

/**
 * Normalize a full string: lowercase, strip punctuation (preserving
 * alphanumerics and spaces), collapse whitespace, and normalize each token.
 */
export function normalizeText(input: string): string {
  if (!input) return "";
  const cleaned = input
    .toLowerCase()
    // Drop apostrophes (straight + typographic) so "can't" -> "cant" rather
    // than "can t", which would create a stray "t" token.
    .replace(/['\u2018\u2019\u201b\u2032]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map(normalizeToken)
    .join(" ");
}

/** All normalized tokens (stopwords retained). */
export function tokens(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(" ").filter(Boolean) : [];
}

/** Normalized tokens with function words removed. */
export function meaningfulTokens(input: string): string[] {
  return tokens(input).filter((t) => !STOPWORDS.has(t));
}

// --- Synonym groups -------------------------------------------------------
// Each group maps many surface forms to one canonical concept id. Terms are
// stored in singular/canonical form.
export const SYNONYM_GROUPS: Record<string, string[]> = {
  pos: ["pos", "checkout", "till", "counter", "register", "sell", "sale", "transaction", "cashier", "point", "sale"],
  product: ["product", "medicine", "drug", "medication", "item", "good", "sku", "barcode", "catalog", "catalogue"],
  inventory: ["inventory", "stock", "stocklevel", "quantity", "onhand", "warehouse", "shelf", "reorder", "disposal", "dispose", "adjustment", "adjust", "movement"],
  expiry: ["expiry", "expire", "expired", "expiring", "expiration", "dated", "date"],
  batch: ["batch", "lot"],
  purchase: ["purchase", "order", "restock", "replenish", "procurement", "receive", "receiving", "grn", "goods"],
  supplier: ["supplier", "vendor", "distributor", "wholesaler", "manufacturer", "creditor"],
  return: ["return", "refund", "exchange"],
  customer: ["customer", "client", "buyer", "patient", "walkin", "loyalty"],
  cash: ["cash", "drawer", "float", "session", "petty", "reconcile", "reconciliation", "denomination"],
  expense: ["expense", "cost", "expenditure", "spending", "overhead"],
  report: ["report", "analytic", "analysis", "summary", "statement", "insight", "export", "reporting", "profit", "margin", "chart"],
  user: ["user", "staff", "employee", "team", "colleague", "member", "account", "login", "role", "permission", "access", "invite", "credential", "password"],
  audit: ["audit", "log", "history", "trail", "activity", "trace"],
  settings: ["setting", "preference", "configuration", "config", "tax", "currency", "organization"],
  offline: ["offline", "disconnected", "connection", "unreachable", "internet", "network"],
  sync: ["sync", "synchronize", "synchronise", "synchronization", "upload", "pending", "queue", "queued", "backlog"],
  transfer: ["transfer", "interbranch"],
  receipt: ["receipt", "print", "printing", "bill", "invoice", "slip"],
  discount: ["discount", "markdown", "promotion", "override"],
  payment: ["payment", "pay", "paid", "money", "card", "bank", "credit", "split"],
  hold: ["hold", "held", "park", "parking", "basket", "cart", "resume"],
  notification: ["notification", "alert", "bell", "reminder", "badge"],
  dashboard: ["dashboard", "home", "overview", "kpi", "metric", "snapshot"],
  security: ["forbidden", "unauthorized", "denied", "lock", "locked", "deactivate", "suspend", "disabled"],
};

// Reverse index: term → concept. First group to claim a term wins (later
// groups do not overwrite), keeping the mapping deterministic.
const TERM_TO_CONCEPT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const concept of Object.keys(SYNONYM_GROUPS)) {
    for (const term of SYNONYM_GROUPS[concept]) {
      if (!(term in map)) map[term] = concept;
    }
  }
  return map;
})();

/** Concept id for a single token, if any. */
export function conceptFor(term: string): string | undefined {
  return TERM_TO_CONCEPT[term];
}

/**
 * Map a token list to a set of search keys. Each token contributes BOTH its
 * literal form and its canonical concept (when it has one). Keeping the literal
 * word means an article that literally contains the user's words ("sell") ranks
 * above one that only shares a broader concept ("pos") — this is what lets
 * "how can I sell a product?" prefer POS over Products. Two-word phrases are
 * also checked.
 */
export function searchKeys(input: string): Set<string> {
  const out = new Set<string>();
  const toks = meaningfulTokens(input);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    out.add(t);
    const c = TERM_TO_CONCEPT[t];
    if (c) out.add(c);
    if (i + 1 < toks.length) {
      const phrase = `${t} ${toks[i + 1]}`;
      const cp = TERM_TO_CONCEPT[phrase];
      if (cp) out.add(cp);
    }
  }
  return out;
}

/** Remove control characters that could confuse terminal/log display. */
export function sanitizeInput(input: string): string {
  return (input ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 500);
}
