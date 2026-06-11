import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "emerald" | "violet" | "slate";
};

const toneClasses: Record<StatCardProps["tone"], string> = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: StatCardProps) {
  return (
    <Card className="rounded-lg border border-slate-200 bg-white py-0 subtle-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">
              {value}
            </p>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ring-1 ${toneClasses[tone]}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-4 text-sm leading-5 text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}
