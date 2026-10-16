"use client";

// Promise-based replacements for the browser's native confirm()/prompt().
// Rendered with the app's own Dialog so destructive actions get consistent,
// accessible, themeable UI instead of a blocking browser popup.

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  inputLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  // When true the confirm button stays disabled until the field is non-empty.
  required?: boolean;
  multiline?: boolean;
}

type Active =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

export interface ConfirmApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = React.createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState<Active | null>(null);
  const [value, setValue] = React.useState("");
  const activeRef = React.useRef<Active | null>(null);
  activeRef.current = active;

  const confirm = React.useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setActive({ kind: "confirm", opts, resolve })),
    [],
  );

  const prompt = React.useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? "");
        setActive({ kind: "prompt", opts, resolve });
      }),
    [],
  );

  const settle = React.useCallback((result: boolean | string | null) => {
    const cur = activeRef.current;
    if (!cur) return;
    if (cur.kind === "confirm") cur.resolve(result as boolean);
    else cur.resolve(result as string | null);
    setActive(null);
  }, []);

  const opts = active?.opts;
  const isPrompt = active?.kind === "prompt";
  const promptOpts = isPrompt ? (active!.opts as PromptOptions) : undefined;
  const disableConfirm = isPrompt && !!promptOpts?.required && !value.trim();

  const handleConfirm = () => {
    if (disableConfirm) return;
    settle(isPrompt ? value : true);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      <Dialog
        open={!!active}
        onOpenChange={(o) => {
          if (!o) settle(isPrompt ? null : false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{opts?.title}</DialogTitle>
            {opts?.description && <DialogDescription>{opts.description}</DialogDescription>}
          </DialogHeader>

          {isPrompt && (
            <div className="space-y-1.5">
              {promptOpts?.inputLabel && <Label>{promptOpts.inputLabel}</Label>}
              {promptOpts?.multiline ? (
                <textarea
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={promptOpts?.placeholder}
                  className="min-h-[80px] w-full rounded-md border border-[var(--input)] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleConfirm();
                  }}
                />
              ) : (
                <Input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={promptOpts?.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                  }}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => settle(isPrompt ? null : false)}>
              {opts?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={opts?.destructive ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={disableConfirm}
            >
              {opts?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
