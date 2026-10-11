"use client";

// Ask MediFlow IQ — the in-app help assistant.
//
// A deterministic, offline-capable documentation assistant: it matches a
// question against a bundled knowledge base and renders a structured answer.
// It never calls an external AI service, never reads live records and never
// performs any account-, inventory- or financial-changing operation.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { HelpAnswerView } from "@/components/help/help-answer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  askHelp,
  getArticleAnswer,
  moduleSuggestions,
  optionToAnswer,
  ROUTE_TO_MODULE,
  sanitizeInput,
  type HelpAnswer,
  type TroubleshootingOption,
} from "@/lib/help";
import {
  Sparkles,
  Send,
  RotateCcw,
  WifiOff,
  Wifi,
  Loader2,
  User,
  HelpCircle,
  Lightbulb,
} from "lucide-react";

const MAX_MESSAGES = 60;
const FEEDBACK_KEY = "mediflow.help.feedback";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: HelpAnswer };

interface PermissionState {
  status: "loading" | "ready" | "error";
  permissions: string[] | null;
}

let messageSeq = 0;
function nextId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${messageSeq}-${Date.now()}`;
}

function loadFeedback(): Record<string, "helpful" | "unhelpful"> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFeedback(map: Record<string, "helpful" | "unhelpful">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — feedback is optional */
  }
}

export function AskMediFlow() {
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const fromPath = searchParams.get("from") ?? "";
  const contextModule = fromPath ? ROUTE_TO_MODULE[fromPath] ?? null : null;

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [perm, setPerm] = React.useState<PermissionState>({ status: "loading", permissions: null });
  const [feedback, setFeedback] = React.useState<Record<string, "helpful" | "unhelpful">>({});

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Load permissions once. Offline, the fetch fails and we keep showing links
  // optimistically (the destination pages enforce their own authorization).
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no"))))
      .then((data) => {
        if (cancelled) return;
        setPerm({ status: "ready", permissions: Array.isArray(data.permissions) ? data.permissions : [] });
      })
      .catch(() => {
        if (!cancelled) setPerm({ status: "error", permissions: null });
      });
    setFeedback(loadFeedback());
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const append = React.useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });
  }, []);

  const ask = React.useCallback(
    (raw: string) => {
      const text = sanitizeInput(raw).trim();
      if (!text) return;
      append({ id: nextId("u"), role: "user", text });
      setInput("");
      setBusy(true);
      // Small delay so the "searching" state is visible without pretending to
      // be an AI "thinking". Matching itself is synchronous and offline.
      window.setTimeout(() => {
        const result = askHelp(text, { contextModule });
        append({ id: nextId("a"), role: "assistant", answer: result.answer });
        setBusy(false);
        inputRef.current?.focus();
      }, 350);
    },
    [append, contextModule],
  );

  const openArticle = React.useCallback(
    (articleId: string) => {
      const answer = getArticleAnswer(articleId);
      if (answer) append({ id: nextId("a"), role: "assistant", answer });
    },
    [append],
  );

  const chooseOption = React.useCallback(
    (option: TroubleshootingOption, parentArticleId: string) => {
      append({ id: nextId("u"), role: "user", text: option.label });
      const answer = optionToAnswer(parentArticleId, option);
      append({ id: nextId("a"), role: "assistant", answer });
    },
    [append],
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    ask(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const onFeedback = (articleId: string, value: "helpful" | "unhelpful") => {
    const next = { ...feedback, [articleId]: value };
    setFeedback(next);
    saveFeedback(next);
    toast({ description: value === "helpful" ? "Thanks — noted as helpful." : "Thanks — we'll use this to improve." });
  };

  const showWelcome = messages.length === 0 && !busy;
  const suggestions = moduleSuggestions(contextModule);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        icon={Sparkles}
        title="Ask MediFlow IQ"
        description="Your in-app guide — ask how to do anything in MediFlow IQ."
      >
        <div className="flex items-center gap-2">
          {contextModule && (
            <Badge variant="outline" className="gap-1">
              <Lightbulb className="h-3 w-3" />
              Context: {contextModule}
            </Badge>
          )}
          <Badge variant={isOnline ? "success" : "warning"} className="gap-1">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              New conversation
            </Button>
          )}
        </div>
      </PageHeader>

      {!isOnline && (
        <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          You are offline. Ask MediFlow IQ still searches the bundled help content — live figures are not available.
        </p>
      )}

      <div className="flex min-h-[60vh] flex-col rounded-xl border bg-card shadow">
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation with Ask MediFlow IQ"
          className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
        >
          {showWelcome ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Hi — I&apos;m Ask MediFlow IQ</h2>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Ask a question about POS, Products, Inventory, Purchases, Reports or any other MediFlow IQ
                  feature and I&apos;ll show you the steps.
                </p>
              </div>
              <div className="flex max-w-xl flex-wrap justify-center gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="flex max-w-[85%] items-start gap-2">
                      <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                        {m.text}
                      </div>
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              }
              const articleId = m.answer.kind === "answer" ? m.answer.articleId : null;
              return (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="w-full max-w-[90%] rounded-2xl rounded-tl-sm border bg-background p-4">
                    <HelpAnswerView
                      answer={m.answer}
                      permissions={perm.permissions}
                      feedback={articleId ? feedback[articleId] ?? null : null}
                      onFeedback={
                        articleId ? (v) => onFeedback(articleId, v) : undefined
                      }
                      onAsk={ask}
                      onOpenArticle={openArticle}
                      onOption={(opt) => {
                        if (m.answer.kind === "answer") chooseOption(opt, m.answer.articleId);
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching help content…
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <label htmlFor="ask-input" className="sr-only">
              Ask a question about MediFlow IQ
            </label>
            <Textarea
              id="ask-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask how to do something… (Enter to send, Shift+Enter for a new line)"
              rows={1}
              className="min-h-[44px] flex-1 resize-none"
              aria-describedby="ask-hint"
            />
            <Button type="submit" disabled={busy || !input.trim()} className={cn("h-11 shrink-0")}>
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <p id="ask-hint" className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <HelpCircle className="h-3 w-3" />
            Ask MediFlow IQ answers questions about using MediFlow IQ. It does not change any data.
          </p>
        </form>
      </div>
    </div>
  );
}
