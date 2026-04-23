import { useMemo, useState } from "react";
import { format, startOfMonth, addMonths, isAfter, isSameMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { Transaction } from "@/components/TransactionTable";
import { fmtMoney } from "@/lib/financialModel";
import { TrendingUp, TrendingDown, Calendar, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Все транзакции компании за период с начала года и далее (нужно для исторической базы) */
  transactions: Transaction[];
  /** Текущий выбранный месяц финмодели */
  currentMonth: Date;
  /** Run-rate чистой прибыли текущего месяца — используется как базовый прогноз для незакрытого месяца */
  currentMonthRunRateNet: number;
  /** Run-rate выручки текущего месяца */
  currentMonthRunRateRevenue: number;
  /** Run-rate расходов текущего месяца */
  currentMonthRunRateExpenses: number;
}

const TRANSFER = "Перевод между счетами";
const WITHDRAWAL = "Вывод средств";

interface MonthRow {
  key: string; // yyyy-MM
  date: Date;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
  type: "fact" | "current" | "forecast";
}

export function YearForecastBlock({
  transactions,
  currentMonth,
  currentMonthRunRateNet,
  currentMonthRunRateRevenue,
  currentMonthRunRateExpenses,
}: Props) {
  const [mode, setMode] = useState<"avg3" | "avg6" | "runrate">("avg3");

  const data = useMemo<MonthRow[]>(() => {
    const year = currentMonth.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const today = new Date();

    // Группируем транзакции по месяцу года
    const buckets = new Map<string, { revenue: number; expenses: number }>();
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      buckets.set(format(d, "yyyy-MM"), { revenue: 0, expenses: 0 });
    }
    for (const t of transactions) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (d < yearStart || d > yearEnd) continue;
      if (t.category === TRANSFER || t.category === WITHDRAWAL) continue;
      const key = format(startOfMonth(d), "yyyy-MM");
      const b = buckets.get(key);
      if (!b) continue;
      const amt = Number(t.amount || 0);
      if (t.type === "income") b.revenue += amt;
      else if (t.type === "expense") b.expenses += amt;
    }

    // Сначала формируем фактические месяцы (закрытые) и текущий
    const rows: MonthRow[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      const key = format(d, "yyyy-MM");
      const b = buckets.get(key)!;
      const isCurrent = isSameMonth(d, currentMonth) && isSameMonth(d, today);
      const isPast = !isAfter(d, today) && !isSameMonth(d, today);
      let revenue = b.revenue;
      let expenses = b.expenses;
      let type: MonthRow["type"] = isPast ? "fact" : isCurrent ? "current" : "forecast";

      if (type === "current") {
        // Используем run-rate для текущего месяца
        revenue = currentMonthRunRateRevenue;
        expenses = currentMonthRunRateExpenses;
      }

      rows.push({
        key,
        date: d,
        label: format(d, "LLL", { locale: ru }),
        revenue,
        expenses,
        net: type === "current" ? currentMonthRunRateNet : revenue - expenses,
        type,
      });
    }

    // Считаем базу для прогноза — среднее за последние N закрытых месяцев
    const closed = rows.filter((r) => r.type === "fact" && (r.revenue > 0 || r.expenses > 0));
    const sliceN = mode === "avg3" ? 3 : mode === "avg6" ? 6 : 1;
    const base = mode === "runrate"
      ? { revenue: currentMonthRunRateRevenue, expenses: currentMonthRunRateExpenses }
      : (() => {
          const last = closed.slice(-sliceN);
          if (last.length === 0) {
            return { revenue: currentMonthRunRateRevenue, expenses: currentMonthRunRateExpenses };
          }
          const r = last.reduce((s, x) => s + x.revenue, 0) / last.length;
          const e = last.reduce((s, x) => s + x.expenses, 0) / last.length;
          return { revenue: r, expenses: e };
        })();

    // Заполняем прогнозные месяцы
    return rows.map((r) =>
      r.type === "forecast"
        ? { ...r, revenue: base.revenue, expenses: base.expenses, net: base.revenue - base.expenses }
        : r
    );
  }, [transactions, currentMonth, currentMonthRunRateRevenue, currentMonthRunRateExpenses, currentMonthRunRateNet, mode]);

  const totals = useMemo(() => {
    const sumAll = data.reduce(
      (s, r) => ({
        revenue: s.revenue + r.revenue,
        expenses: s.expenses + r.expenses,
        net: s.net + r.net,
      }),
      { revenue: 0, expenses: 0, net: 0 }
    );
    const factRows = data.filter((r) => r.type === "fact");
    const sumFact = factRows.reduce(
      (s, r) => ({
        revenue: s.revenue + r.revenue,
        net: s.net + r.net,
      }),
      { revenue: 0, net: 0 }
    );
    const remaining = data.filter((r) => r.type === "forecast" || r.type === "current");
    const sumRemaining = remaining.reduce(
      (s, r) => ({
        revenue: s.revenue + r.revenue,
        net: s.net + r.net,
      }),
      { revenue: 0, net: 0 }
    );
    return { sumAll, sumFact, sumRemaining, monthsRemaining: remaining.length, monthsFact: factRows.length };
  }, [data]);

  const cashFlow = useMemo(() => {
    let acc = 0;
    return data.map((r) => {
      acc += r.net;
      return { ...r, cumulative: acc };
    });
  }, [data]);

  const year = currentMonth.getFullYear();

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Прогноз до конца {year}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Факт по закрытым месяцам + экстраполяция на оставшиеся {totals.monthsRemaining} мес.
          </p>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList>
            <TabsTrigger value="avg3">Средн. 3 мес.</TabsTrigger>
            <TabsTrigger value="avg6">Средн. 6 мес.</TabsTrigger>
            <TabsTrigger value="runrate">Run-rate</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Сводные показатели */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile
            label={`Выручка ${year}`}
            value={totals.sumAll.revenue}
            sub={`Факт: ${fmtMoney(totals.sumFact.revenue)}`}
            tone="primary"
            icon={TrendingUp}
          />
          <SummaryTile
            label={`Расходы ${year}`}
            value={totals.sumAll.expenses}
            sub={`Прогноз на ${totals.monthsRemaining} мес.`}
            tone="muted"
            icon={TrendingDown}
          />
          <SummaryTile
            label={`Чистая прибыль ${year}`}
            value={totals.sumAll.net}
            sub={`Факт: ${fmtMoney(totals.sumFact.net)}`}
            tone={totals.sumAll.net >= 0 ? "success" : "destructive"}
            icon={Wallet}
          />
          <SummaryTile
            label="Осталось заработать"
            value={totals.sumRemaining.net}
            sub={`за ${totals.monthsRemaining} мес.`}
            tone={totals.sumRemaining.net >= 0 ? "success" : "destructive"}
            icon={TrendingUp}
          />
        </div>

        {/* График */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
                  return String(v);
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(v: number, name: string) => [fmtMoney(v), name]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as MonthRow | undefined;
                  if (!row) return label;
                  const tag =
                    row.type === "fact" ? "Факт" : row.type === "current" ? "Текущий (run-rate)" : "Прогноз";
                  return `${label} · ${tag}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <Bar dataKey="revenue" name="Выручка" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Расходы" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line
                type="monotone"
                dataKey="net"
                name="Чистая прибыль"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Таблица помесячно */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Месяц</th>
                <th className="px-3 py-2 font-medium text-right">Выручка</th>
                <th className="px-3 py-2 font-medium text-right">Расходы</th>
                <th className="px-3 py-2 font-medium text-right">Чистая прибыль</th>
                <th className="px-3 py-2 font-medium text-right">Накопл. итог</th>
                <th className="px-3 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 capitalize">
                    {format(r.date, "LLLL", { locale: ru })}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtMoney(r.revenue)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtMoney(r.expenses)}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-medium",
                      r.net >= 0 ? "text-green-600" : "text-destructive"
                    )}
                  >
                    {fmtMoney(r.net)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right",
                      r.cumulative >= 0 ? "text-green-600" : "text-destructive"
                    )}
                  >
                    {fmtMoney(r.cumulative)}
                  </td>
                  <td className="px-3 py-2">
                    {r.type === "fact" && <Badge variant="secondary">Факт</Badge>}
                    {r.type === "current" && <Badge>Сейчас</Badge>}
                    {r.type === "forecast" && <Badge variant="outline">Прогноз</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2">Итого {year}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(totals.sumAll.revenue)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(totals.sumAll.expenses)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right",
                    totals.sumAll.net >= 0 ? "text-green-600" : "text-destructive"
                  )}
                >
                  {fmtMoney(totals.sumAll.net)}
                </td>
                <td className="px-3 py-2 text-right">—</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Прогноз для будущих месяцев = среднее по выбранной базе. Текущий месяц использует run-rate
          (экстраполяция фактических цифр на полный месяц). Переводы между счетами и выводы средств исключены.
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "primary" | "success" | "destructive" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClass =
    tone === "success"
      ? "text-green-600"
      : tone === "destructive"
      ? "text-destructive"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("h-4 w-4", toneClass)} />
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold", toneClass)}>{fmtMoney(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
