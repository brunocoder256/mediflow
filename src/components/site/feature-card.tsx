import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  bulletPoints?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
  delay?: number;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  bulletPoints,
  ctaLabel,
  ctaHref,
  className,
  delay,
}: FeatureCardProps) {
  return (
    <Reveal
      delay={delay}
      className={cn(
        "group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-900/5 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-700",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-700 group-hover:text-white dark:bg-teal-900/40 dark:text-teal-300 dark:group-hover:bg-teal-700 dark:group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
      {bulletPoints && bulletPoints.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          {bulletPoints.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              {point}
            </li>
          ))}
        </ul>
      )}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  );
}