import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Trend = {
  direction: "up" | "down" | "neutral";
  label: string;
};

type StatCardProps = {
  title: string;
  value: string;
  description: string;
  subDescription?: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "emerald" | "violet" | "slate";
  trend?: Trend;
};

const toneClasses: Record<StatCardProps["tone"], { icon: string; badge: string }> = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    badge: "bg-blue-50 text-blue-700",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    badge: "bg-amber-50 text-amber-700",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    badge: "bg-violet-50 text-violet-700",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600",
    badge: "bg-slate-100 text-slate-700",
  },
};

export function StatCard({
  title,
  value,
  description,
  subDescription,
  icon: Icon,
  tone,
  trend,
}: StatCardProps) {
  const colors = toneClasses[tone];

  return (
    <Card className="rounded-xl border border-border bg-card subtle-shadow gap-0">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-5 px-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("flex size-9 items-center justify-center rounded-lg", colors.icon)}>
          <Icon className="size-4.5" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <p className="mt-2 text-sm text-muted-foreground leading-snug">
          {description}
        </p>
        {(trend ?? subDescription) && (
          <div className="mt-3 flex items-center gap-2">
            {trend && trend.direction !== "neutral" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  trend.direction === "up"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                )}
              >
                {trend.direction === "up" ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {trend.label}
              </span>
            )}
            {subDescription && (
              <span className="text-xs text-muted-foreground">{subDescription}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
