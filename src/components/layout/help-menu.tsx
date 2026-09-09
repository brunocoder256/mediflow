"use client";

// Help ("?") button in the top bar. Opens a documentation dialog with an
// overview of every module, offline-mode guidance and the screen-recording
// tutorials listed in docs/help.md. The Back button returns to the app.

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  ArrowLeft,
  ArrowUp,
  PlayCircle,
  ExternalLink,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { HELP_SECTIONS, HELP_VIDEOS, type HelpSection } from "@/lib/help-content";

function videoId(url: string): string {
  const m = url.match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/);
  return m ? m[1] : "";
}

function VideoCard({ label, url }: { label: string; url: string }) {
  const id = videoId(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
        {id ? (
          <Image
            src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
            alt=""
            width={112}
            height={63}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlayCircle className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <PlayCircle className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight group-hover:underline">{label}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          Watch tutorial <ExternalLink className="h-3 w-3" />
        </p>
      </div>
    </a>
  );
}

function SectionCard({ section, isVideo }: { section: HelpSection; isVideo?: boolean }) {
  return (
    <section id={"help-" + section.id} className="scroll-mt-4 space-y-2 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {isVideo ? (
          <PlayCircle className="h-4 w-4 text-primary" />
        ) : (
          <BookOpen className="h-4 w-4 text-primary" />
        )}
        <h3 className="text-sm font-semibold">{section.title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{section.summary}</p>
      <ul className="space-y-1.5">
        {section.bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {section.tip && (
        <p className="flex items-start gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>{section.tip}</span>
        </p>
      )}
    </section>
  );
}

export function HelpMenu() {
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Esc / Back button closes the dialog and returns to the page the user was on.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        title="Help"
        aria-label="Help"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="sr-only">Help</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="border-b px-5 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Mediflow&nbsp;IQ Help
                </DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Everything you need to work with Mediflow IQ — modules, offline mode and video tutorials.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </div>
          </DialogHeader>

          <div ref={contentRef} className="max-h-[70vh] overflow-y-auto px-5 py-4">
            {/* Table of contents / quick navigation */}
            <nav className="mb-4 grid gap-1 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              {HELP_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={"#help-" + s.id}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById("help-" + s.id);
                    if (el && contentRef.current) {
                      contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 8, behavior: "smooth" });
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {s.title}
                </a>
              ))}
            </nav>

            {/* Video tutorials (from docs/help.md) — shown first as the quickest help */}
            <SectionCard
              isVideo
              section={{
                id: "video-tutorials",
                title: "Video tutorials",
                summary:
                  "Short screen recordings that walk you through the key features. Each video opens in a new tab so you do not lose your place.",
                bullets: [
                  "Covered: inventory overview, adding a product, POS sales, creating a purchase and the supplier feature.",
                ],
              }}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {HELP_VIDEOS.map((v) => (
                <VideoCard key={v.url} label={v.label} url={v.url} />
              ))}
            </div>

            {/* Documentation sections */}
            {HELP_SECTIONS.filter((s) => s.id !== "video-tutorials").map((s) => (
              <div key={s.id} className="mt-3">
                <SectionCard section={s} />
              </div>
            ))}

            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <ArrowUp className="mr-1 h-4 w-4" />
                Back to top
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}