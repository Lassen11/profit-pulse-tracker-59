import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney, PnL, RunRate } from "@/lib/financialModel";
import { PlanValues } from "./PnlTable";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pnl: PnL;
  runRate: RunRate;
  plan: PlanValues;
  daysPassed: number;
  daysInMonth: number;
}

export function ForecastBlock({ pnl, runRate, plan, daysPassed, daysInMonth }: Props) {
  const items = [
    { label: "Прогноз выручки", actual: pnl.revenue, forecast: runRate.revenue, plan: plan.revenue, positive: true },
    {
      label: "Прогноз расходов",
      actual: pnl.fot + pnl.marketing + pnl.opex + pnl.taxes,
      forecast: runRate.expenses,
      plan: plan.fot + plan.marketing + plan.opex,
      positive: false,
    },
    { label: "Прогноз чистой прибыли", actual: pnl.net, forecast: runRate.net, plan: plan.net, positive: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Прогноз до конца месяца</CardTitle>
        <p className="text-sm text-muted-foreground">
          Прошло {daysPassed} из {daysInMonth} дней — экстраполяция по run-rate
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => {
          const diff = it.forecast - it.plan;
          const ahead = it.positive ? diff >= 0 : diff <= 0;
          const Icon = diff === 0 ? Minus : ahead ? TrendingUp : TrendingDown;
          return (
            <div key={it.label} className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">{it.label}</div>
              <div className="mt-1 text-2xl font-semibold">{fmtMoney(it.forecast)}</div>
              <div className="mt-2 text-xs text-muted-foreground">Факт сейчас: {fmtMoney(it.actual)}</div>
              <div className="text-xs text-muted-foreground">План месяца: {fmtMoney(it.plan)}</div>
              {it.plan !== 0 && (
                <div className={cn("mt-2 flex items-center gap-1 text-sm", ahead ? "text-green-600" : "text-destructive")}>
                  <Icon className="h-4 w-4" />
                  {ahead ? "Опережаем план" : "Отстаём от плана"} ({fmtMoney(Math.abs(diff))})
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
