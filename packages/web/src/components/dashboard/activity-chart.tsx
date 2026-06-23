"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { RootDashboardChartPoint } from "@/types/dashboard";

const chartConfig = {
  events: {
    label: "Eventos",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

type ActivityChartProps = {
  data: RootDashboardChartPoint[];
  loading?: boolean;
};

export function ActivityChart({ data, loading }: ActivityChartProps) {
  return (
    <Card className="rounded-lg border border-border bg-card subtle-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Actividad operativa</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Eventos de juzgamiento registrados en los últimos 6 meses
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <Skeleton className="h-[200px] w-full rounded-md" />
        ) : (
          <div className="h-[200px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-events)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-events)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="var(--color-events)"
                strokeWidth={2}
                fill="url(#fillEvents)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
