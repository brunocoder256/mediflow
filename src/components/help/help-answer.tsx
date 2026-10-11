"use client";

// Renders a structured HelpAnswer as readable, accessible content.
//
// Everything is rendered as React text nodes — never raw HTML — so user input
// and help content cannot inject markup. Links are restricted to safe internal
// routes and filtered by the viewer's permissions.

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterHelpLinks,
  type HelpAnswer,
  type HelpRelated,
  type TroubleshootingOption,
} from "@/lib/help";
import {
  BookOpen,
  ListChecks,
  AlertTriangle,
  Wrench,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Info,
  Sparkles,
} from "lucide-react";

export interface HelpAnswerViewProps {
  answer: HelpAnswer;
  permissions: string[] | null;
  feedback?: "helpful" | "unhelpful" | null;
  onFeedback?: (value: "helpful" | "unhelpful") => void;
  onAsk?: (text: string) => void;
  onOpenArticle?: (articleId: string) => void;
  onOption?: (option: TroubleshootingOption) => void;
}

function ChipList({
  items,
  onSelect,
}: {
  items: HelpRelated[];
  onSelect: (item: HelpRelated) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <button
          key={`${item.text}-${i}`}
          type="button"
          onClick={() => onSelect(item)}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.text}
          <ArrowRight className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items, tone }: { items: string[]; tone?: "warning" | "info" }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span
            className={cn(
              "mt-1.5 h-1 w-1 shrink-0 rounded-full",
              tone === "warning" ? "bg-red-500" : "bg-primary",
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AnswerBody({
  answer,
  permissions,
  onAsk,
  onOpenArticle,
  onOption,
}: Pick<HelpAnswerViewProps, "permissions" | "onAsk" | "onOpenArticle" | "onOption"> & {
  answer: Extract<HelpAnswer, { kind: "answer" }>;
}) {
  const links = filterHelpLinks(answer.links, permissions);
  const lowConfidence = answer.confidence < 0.6;

  const handleRelated = (item: HelpRelated) => {
    if (item.articleId && onOpenArticle) onOpenArticle(item.articleId);
    else onAsk?.(item.text);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          {answer.moduleLabel}
        </Badge>
        {lowConfidence && (
          <Badge variant="warning" className="gap-1">
            Possible match
          </Badge>
        )}
      </div>

      <h3 className="text-base font-semibold">{answer.title}</h3>

      {answer.note && (
        <p className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{answer.note}</span>
        </p>
      )}

      {answer.intro && <p className="text-sm text-muted-foreground">{answer.intro}</p>}

      {answer.prerequisites.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Before you start
          </p>
          <Bullets items={answer.prerequisites} />
        </div>
      )}

      {answer.steps.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" /> Steps
          </p>
          <StepList steps={answer.steps} />
        </div>
      )}

      {answer.warnings.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> Important
          </p>
          <Bullets items={answer.warnings} tone="warning" />
        </div>
      )}

      {answer.troubleshooting.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Troubleshooting
          </p>
          <Bullets items={answer.troubleshooting} />
        </div>
      )}

      {answer.options.length > 0 && onOption && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Narrow it down
          </p>
          <div className="flex flex-wrap gap-1.5">
            {answer.options.map((opt, i) => (
              <Button key={i} type="button" variant="outline" size="sm" onClick={() => onOption(opt)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(buttonVariants({ variant: "soft", size: "sm" }))}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {link.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      )}

      {answer.related.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Related questions
          </p>
          <ChipList items={answer.related} onSelect={handleRelated} />
        </div>
      )}
    </div>
  );
}

function SuggestionChips({
  suggestions,
  onAsk,
}: {
  suggestions: string[];
  onAsk?: (text: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onAsk?.(s)}
          className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function HelpAnswerView({
  answer,
  permissions,
  feedback,
  onFeedback,
  onAsk,
  onOpenArticle,
  onOption,
}: HelpAnswerViewProps) {
  if (answer.kind === "empty") {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold">{answer.title}</h3>
        <p className="text-sm text-muted-foreground">{answer.message}</p>
        <SuggestionChips suggestions={answer.suggestions} onAsk={onAsk} />
      </div>
    );
  }

  if (answer.kind === "fallback") {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold">{answer.title}</h3>
        <p className="text-sm text-muted-foreground">{answer.message}</p>
        <SuggestionChips suggestions={answer.suggestions} onAsk={onAsk} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnswerBody
        answer={answer}
        permissions={permissions}
        onAsk={onAsk}
        onOpenArticle={onOpenArticle}
        onOption={onOption}
      />

      {onFeedback && (
        <div className="flex items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {feedback ? "Thanks for your feedback." : "Was this helpful?"}
          </span>
          <Button
            type="button"
            variant={feedback === "helpful" ? "default" : "ghost"}
            size="sm"
            aria-pressed={feedback === "helpful"}
            onClick={() => onFeedback("helpful")}
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Helpful
          </Button>
          <Button
            type="button"
            variant={feedback === "unhelpful" ? "default" : "ghost"}
            size="sm"
            aria-pressed={feedback === "unhelpful"}
            onClick={() => onFeedback("unhelpful")}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Not helpful
          </Button>
        </div>
      )}
    </div>
  );
}
