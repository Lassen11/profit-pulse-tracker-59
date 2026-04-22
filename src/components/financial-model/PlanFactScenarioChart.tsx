import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { fmtMoney, PnL } from "@/lib/financialModel";
import { PlanValues } from "./PnlTable";

interface Props {
  pnl: PnL;
  scenario: PnL;
  plan: PlanValues;
}

export function PlanFactScenarioChart({ pnl, scenario, plan }: Props) {
  const data = [
    { name: "Выручка", План: plan.revenue, Факт: pnl.revenue, Сценарий: scenario.revenue },
    { name: "ФОТ", План: plan.fot, Факт: pnl.fot, Сценарий: scenario.fot },
    { name: "Маркетинг", План: plan.marketing, Факт: pnl.marketing, Сценарий: scenario.marketing },
    { name: "ОПЭКС", План: plan.opex, Факт: pnl.opex, Сценарий: scenario.opex },
    { name: "Чистая прибыль", План: plan.net, Факт: pnl.net, Сценарий: scenario.net },
  ];

  const formatTick = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
    return String(v);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>План / Факт / Сценарий</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatTick} />
            <Tooltip
              formatter={(v: number) => fmtMoney(v)}
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
              }}
            />
            <Legend />
            <Bar dataKey="План" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Факт" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Сценарий" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
