import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  description?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: React.ReactNode;
  accent?: string;
  onClick?: () => void;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  accent,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn("transition-shadow hover:shadow-md", onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && (
          <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && trendValue ? (
          <p
            className={`mt-1 text-xs font-medium ${
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { StatCard };