import { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, isAfter, isSameMonth, getDaysInMonth, getDate, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
  LineChart,
} from "recharts";
import { Transaction } from "@/components/TransactionTable";
import { fmtMoney } from "@/lib/financialModel";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Все транзакции компании за период с начала года и далее (нужно для исторической базы) */
  transactions: Transaction[];
  /** Помесячные записи department_employees по году (cost = начисленный ФОТ компании) */
  yearEmployees?: { month: string; cost: number }[];
  /** Помесячные записи lead_generation по году (total_cost = бюджет маркетинга) */
  yearLeadGen?: { date: string; total_cost: number }[];
  /** Текущий выбранный месяц финмодели */
  currentMonth: Date;
  /** Идентификатор компании — для изоляции сохранённых сценариев */
  company: string;
}

const TRANSFER = "Перевод между счетами";
const WITHDRAWAL = "Вывод средств";
const SALARY_CATEGORIES = ["Зарплата", "Аванс", "Премия"];
const MARKETING_CATEGORIES = ["Авитолог", "Реклама Авито"];

interface MonthRow {
  key: string; // yyyy-MM
  date: Date;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
  /** Значения «база» — без применения growthPct (для второй линии на графике) */
  revenueBase?: number;
  expensesBase?: number;
  netBase?: number;
  type: "fact" | "current" | "forecast";
  daysPassed?: number;
  daysInMonth?: number;
}

interface Scenario {
  id: string;
  name: string;
  revenuePct: number; // -100..+∞ — единоразовый сдвиг
  expensesPct: number;
  growthPct: number; // % в месяц, компаундинг поверх базы
  color: string;
  visible: boolean;
}

const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "best", name: "Лучший", revenuePct: 10, expensesPct: -5, growthPct: 5, color: "hsl(142, 71%, 45%)", visible: true },
  { id: "base", name: "Базовый", revenuePct: 0, expensesPct: 0, growthPct: 0, color: "hsl(var(--primary))", visible: true },
  { id: "worst", name: "Худший", revenuePct: -10, expensesPct: 10, growthPct: -3, color: "hsl(0, 72%, 51%)", visible: true },
];

export function YearForecastBlock({ transactions, yearEmployees = [], yearLeadGen = [], currentMonth, company }: Props) {
  const [mode, setMode] = useState<"avg3" | "avg6" | "runrate" | "trend">("trend");
  const [view, setView] = useState<"forecast" | "scenarios">("forecast");
  const growthKey = `fm_year_growth_${company}`;
  const [growthPct, setGrowthPct] = useState<number>(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(growthKey);
      setGrowthPct(raw ? Number(raw) || 0 : 0);
    } catch {
      setGrowthPct(0);
    }
  }, [growthKey]);

  const persistGrowth = (v: number) => {
    setGrowthPct(v);
    try {
      localStorage.setItem(growthKey, String(v));
    } catch {
      // ignore
    }
  };

  // Сценарии — храним в localStorage по компании
  const storageKey = `fm_year_scenarios_${company}`;
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Scenario[];
        if (Array.isArray(parsed) && parsed.length) setScenarios(parsed);
        else setScenarios(DEFAULT_SCENARIOS);
      } else {
        setScenarios(DEFAULT_SCENARIOS);
      }
    } catch {
      setScenarios(DEFAULT_SCENARIOS);
    }
  }, [storageKey]);

  const persistScenarios = (next: Scenario[]) => {
    setScenarios(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  // ===== Базовые данные по месяцам года =====
  const baseRows = useMemo<MonthRow[]>(() => {
    const year = currentMonth.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const today = new Date();

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

    const rows: MonthRow[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, 1);
      const key = format(d, "yyyy-MM");
      const b = buckets.get(key)!;
      const isCurrentSystem = isSameMonth(d, today);
      const isSelected = isSameMonth(d, currentMonth);
      const isPast = isAfter(today, endOfMonth(d));

      let type: MonthRow["type"];
      if (isPast) type = "fact";
      else if (isCurrentSystem) type = "current";
      else type = "forecast";

      let revenue = b.revenue;
      let expenses = b.expenses;
      let daysPassed: number | undefined;
      let daysInMonth: number | undefined;

      if (type === "current") {
        // ТОЧНЫЙ run-rate: пересчитываем по фактическому числу прошедших дней.
        daysInMonth = getDaysInMonth(d);
        daysPassed = Math.max(1, getDate(today));
        const factor = daysInMonth / daysPassed;
        revenue = b.revenue * factor;
        expenses = b.expenses * factor;
      }

      rows.push({
        key,
        date: d,
        label: format(d, "LLL", { locale: ru }),
        revenue,
        expenses,
        net: revenue - expenses,
        type,
        daysPassed,
        daysInMonth,
      });
    }
    return rows;
  }, [transactions, currentMonth]);

  // ===== Базовый прогноз (без сценариев) =====
  // Базовое значение для каждого прогнозного месяца считается по выбранному режиму,
  // затем умножается на ручной коэффициент роста (1 + growthPct/100)^k,
  // где k — порядковый номер месяца от первого прогнозного.
  const data = useMemo<MonthRow[]>(() => {
    const closed = baseRows.filter((r) => r.type === "fact" && (r.revenue > 0 || r.expenses > 0));
    const cur = baseRows.find((r) => r.type === "current");
    const sliceN = mode === "avg3" ? 3 : mode === "avg6" ? 6 : 1;

    // Линейная регрессия по последним N месяцам (метод наименьших квадратов).
    // Возвращает функцию-предсказание по индексу месяца от начала года (0..11).
    const linearTrend = (values: number[], indices: number[]) => {
      const n = values.length;
      if (n < 2) {
        const v = values[0] ?? 0;
        return (_x: number) => v;
      }
      const meanX = indices.reduce((s, x) => s + x, 0) / n;
      const meanY = values.reduce((s, y) => s + y, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (indices[i] - meanX) * (values[i] - meanY);
        den += (indices[i] - meanX) ** 2;
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = meanY - slope * meanX;
      return (x: number) => Math.max(0, intercept + slope * x);
    };

    let predictRevenue: (idx: number) => number;
    let predictExpenses: (idx: number) => number;

    if (mode === "trend") {
      // Берём все закрытые месяцы + текущий (run-rate), но не больше 6
      const histRows = [...closed, ...(cur && (cur.revenue > 0 || cur.expenses > 0) ? [cur] : [])].slice(-6);
      const indices = histRows.map((r) => r.date.getMonth());
      predictRevenue = linearTrend(histRows.map((r) => r.revenue), indices);
      predictExpenses = linearTrend(histRows.map((r) => r.expenses), indices);
    } else if (mode === "runrate") {
      const v = cur && (cur.revenue > 0 || cur.expenses > 0)
        ? { r: cur.revenue, e: cur.expenses }
        : closed.length
        ? { r: closed[closed.length - 1].revenue, e: closed[closed.length - 1].expenses }
        : { r: 0, e: 0 };
      predictRevenue = () => v.r;
      predictExpenses = () => v.e;
    } else {
      const last = closed.slice(-sliceN);
      const r = last.length ? last.reduce((s, x) => s + x.revenue, 0) / last.length : (cur?.revenue ?? 0);
      const e = last.length ? last.reduce((s, x) => s + x.expenses, 0) / last.length : (cur?.expenses ?? 0);
      predictRevenue = () => r;
      predictExpenses = () => e;
    }

    // Индекс первого прогнозного месяца — для расчёта k (номер от стартовой точки роста)
    const firstForecastIdx = baseRows.find((r) => r.type === "forecast")?.date.getMonth() ?? 12;
    const growthFactor = 1 + growthPct / 100;

    return baseRows.map((r, i, arr) => {
      if (r.type !== "forecast") {
        // Чтобы пунктирная линия «база» плавно стартовала от последнего реального
        // месяца, дублируем net в netBase для самого последнего fact/current перед прогнозом.
        const isAnchor = arr[i + 1]?.type === "forecast";
        return isAnchor
          ? { ...r, revenueBase: r.revenue, expensesBase: r.expenses, netBase: r.net }
          : r;
      }
      const monthIdx = r.date.getMonth();
      const k = monthIdx - firstForecastIdx + 1; // 1, 2, 3...
      const compound = Math.pow(growthFactor, k);
      const revenueBase = predictRevenue(monthIdx);
      const expensesBase = predictExpenses(monthIdx);
      const revenue = revenueBase * compound;
      const expenses = expensesBase * compound;
      return {
        ...r,
        revenue,
        expenses,
        net: revenue - expenses,
        revenueBase,
        expensesBase,
        netBase: revenueBase - expensesBase,
      };
    });
  }, [baseRows, mode, growthPct]);

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
      (s, r) => ({ revenue: s.revenue + r.revenue, net: s.net + r.net }),
      { revenue: 0, net: 0 }
    );
    const remaining = data.filter((r) => r.type === "forecast" || r.type === "current");
    const sumRemaining = remaining.reduce(
      (s, r) => ({ revenue: s.revenue + r.revenue, net: s.net + r.net }),
      { revenue: 0, net: 0 }
    );
    return {
      sumAll,
      sumFact,
      sumRemaining,
      monthsRemaining: remaining.length,
      monthsFact: factRows.length,
    };
  }, [data]);

  const cashFlow = useMemo(() => {
    let acc = 0;
    return data.map((r) => {
      acc += r.net;
      return { ...r, cumulative: acc };
    });
  }, [data]);

  // ===== Сравнение сценариев =====
  // Применяем к каждому месяцу-прогнозу коэффициенты сценария.
  // Факт остаётся фактом, текущий месяц (run-rate) НЕ модифицируется,
  // только будущие прогнозные месяцы реагируют на сценарий.
  // Для прогнозных месяцев берём «базу» (без глобального growthPct) и применяем
  // сценарный сдвиг (revenuePct/expensesPct) + сценарный рост (growthPct в месяц, компаундинг).
  const firstForecastMonthIdx = useMemo(
    () => baseRows.find((r) => r.type === "forecast")?.date.getMonth() ?? 12,
    [baseRows]
  );

  const applyScenarioToRow = (r: MonthRow, s: Scenario) => {
    if (r.type === "fact" || r.type === "current") {
      return { revenue: r.revenue, expenses: r.expenses, net: r.net };
    }
    const monthIdx = r.date.getMonth();
    const k = monthIdx - firstForecastMonthIdx + 1;
    const compound = Math.pow(1 + s.growthPct / 100, k);
    const baseRev = r.revenueBase ?? r.revenue;
    const baseExp = r.expensesBase ?? r.expenses;
    const rev = baseRev * (1 + s.revenuePct / 100) * compound;
    const exp = baseExp * (1 + s.expensesPct / 100) * compound;
    return { revenue: rev, expenses: exp, net: rev - exp };
  };

  const scenarioChartData = useMemo(() => {
    return data.map((r) => {
      const point: Record<string, number | string> = { label: r.label };
      for (const s of scenarios) {
        point[s.id] = applyScenarioToRow(r, s).net;
      }
      return point;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scenarios, firstForecastMonthIdx]);

  const scenarioTotals = useMemo(() => {
    return scenarios.map((s) => {
      let total = 0;
      let remaining = 0;
      for (const r of data) {
        const { net } = applyScenarioToRow(r, s);
        total += net;
        if (r.type !== "fact") remaining += net;
      }
      return { ...s, total, remaining };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios, data, firstForecastMonthIdx]);

  const year = currentMonth.getFullYear();
  const currentRow = baseRows.find((r) => r.type === "current");

  // ===== Управление сценариями =====
  const openNewScenario = () => {
    setEditing({
      id: `s_${Date.now()}`,
      name: "Новый сценарий",
      revenuePct: 0,
      expensesPct: 0,
      growthPct: 0,
      color: "hsl(220, 80%, 55%)",
      visible: true,
    });
    setDialogOpen(true);
  };

  const openEditScenario = (s: Scenario) => {
    setEditing({ ...s });
    setDialogOpen(true);
  };

  const saveScenario = () => {
    if (!editing) return;
    const next = scenarios.some((s) => s.id === editing.id)
      ? scenarios.map((s) => (s.id === editing.id ? editing : s))
      : [...scenarios, editing];
    persistScenarios(next);
    setDialogOpen(false);
    setEditing(null);
  };

  const deleteScenario = (id: string) => {
    persistScenarios(scenarios.filter((s) => s.id !== id));
  };

  const toggleVisible = (id: string) => {
    persistScenarios(scenarios.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

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
            {currentRow?.daysPassed && currentRow.daysInMonth && (
              <>
                {" "}· Текущий: прошло {currentRow.daysPassed} из {currentRow.daysInMonth} дней (run-rate)
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="forecast">Прогноз</TabsTrigger>
              <TabsTrigger value="scenarios">Сценарии</TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "forecast" && (
            <>
              <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <TabsList>
                  <TabsTrigger value="trend">Тренд</TabsTrigger>
                  <TabsTrigger value="avg3">Средн. 3 мес.</TabsTrigger>
                  <TabsTrigger value="avg6">Средн. 6 мес.</TabsTrigger>
                  <TabsTrigger value="runrate">Run-rate</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <Label htmlFor="growth-pct" className="text-xs whitespace-nowrap">
                  Рост, %/мес
                </Label>
                <Input
                  id="growth-pct"
                  type="number"
                  step="0.5"
                  value={growthPct}
                  onChange={(e) => persistGrowth(Number(e.target.value) || 0)}
                  className="h-9 w-20"
                />
              </div>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {view === "forecast" ? (
          <>
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

            {/* Основной график */}
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
                        row.type === "fact"
                          ? "Факт"
                          : row.type === "current"
                          ? `Run-rate · ${row.daysPassed}/${row.daysInMonth} дн.`
                          : "Прогноз";
                      return `${label} · ${tag}`;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  <Bar dataKey="revenue" name="Выручка" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="expenses"
                    name="Расходы"
                    fill="hsl(var(--destructive))"
                    radius={[4, 4, 0, 0]}
                    opacity={0.7}
                  />
                  <Line
                    type="monotone"
                    dataKey="netBase"
                    name="Прибыль (база)"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name={growthPct !== 0 ? `Прибыль (с ростом ${growthPct >= 0 ? "+" : ""}${growthPct}%/мес)` : "Чистая прибыль"}
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
                      <td className="px-3 py-2 capitalize">{format(r.date, "LLLL", { locale: ru })}</td>
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
                        {r.type === "current" && (
                          <Badge>
                            Run-rate · {r.daysPassed}/{r.daysInMonth}
                          </Badge>
                        )}
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
              База прогноза: <b>Тренд</b> — линейная регрессия по последним месяцам, <b>Средн. 3/6 мес.</b> — среднее за период,
              <b> Run-rate</b> — экстраполяция текущего месяца. Поверх базы применяется ручной рост {growthPct}%/мес
              (компаудинг). Переводы и выводы исключены.
            </p>
          </>
        ) : (
          <>
            {/* Управление сценариями */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Сценарии прогноза</h3>
                <p className="text-xs text-muted-foreground">
                  Коэффициенты применяются только к будущим месяцам (факт и run-rate сохраняются)
                </p>
              </div>
              <Button size="sm" onClick={openNewScenario}>
                <Plus className="h-4 w-4 mr-1" /> Добавить сценарий
              </Button>
            </div>

            {/* Карточки сценариев */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scenarioTotals.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-lg border p-4 space-y-2 transition-opacity",
                    !s.visible && "opacity-50"
                  )}
                  style={{ borderLeftWidth: 4, borderLeftColor: s.color }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleVisible(s.id)}
                        title={s.visible ? "Скрыть на графике" : "Показать на графике"}
                      >
                        {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openEditScenario(s)}
                      >
                        Изм.
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteScenario(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Выручка {s.revenuePct >= 0 ? "+" : ""}
                      {s.revenuePct}%
                    </Badge>
                    <Badge variant="outline">
                      Расходы {s.expensesPct >= 0 ? "+" : ""}
                      {s.expensesPct}%
                    </Badge>
                    <Badge variant="outline">
                      Рост {s.growthPct >= 0 ? "+" : ""}
                      {s.growthPct}%/мес
                    </Badge>
                  </div>
                  <div className="pt-1 border-t">
                    <div className="text-xs text-muted-foreground">Прибыль за год</div>
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        s.total >= 0 ? "text-green-600" : "text-destructive"
                      )}
                    >
                      {fmtMoney(s.total)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Осталось: {fmtMoney(s.remaining)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Сравнение сценариев на одном графике */}
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scenarioChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                  {scenarios
                    .filter((s) => s.visible)
                    .map((s) => (
                      <Line
                        key={s.id}
                        type="monotone"
                        dataKey={s.id}
                        name={s.name}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs text-muted-foreground">
              Сценарии сохраняются локально в браузере для каждой компании отдельно.
            </p>
          </>
        )}
      </CardContent>

      {/* Диалог редактирования сценария */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing && scenarios.some((s) => s.id === editing.id) ? "Редактировать сценарий" : "Новый сценарий"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Выручка, %</Label>
                  <Input
                    type="number"
                    value={editing.revenuePct}
                    onChange={(e) => setEditing({ ...editing, revenuePct: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Расходы, %</Label>
                  <Input
                    type="number"
                    value={editing.expensesPct}
                    onChange={(e) => setEditing({ ...editing, expensesPct: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Рост, %/мес</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editing.growthPct}
                    onChange={(e) => setEditing({ ...editing, growthPct: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Сдвиг применяется один раз ко всем прогнозным месяцам, рост — компаундингом
                (1+rate)^k от первого прогнозного месяца.
              </p>
              <div className="space-y-2">
                <Label>Цвет линии</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hslToHex(editing.color) || "#3b82f6"}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                    className="h-9 w-14 rounded border cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">{editing.color}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveScenario}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

// Конвертер HSL → HEX, чтобы input[type=color] корректно отображал текущий цвет.
// Если строка не в формате hsl() — возвращаем пусто, и input берёт дефолт.
function hslToHex(input: string): string {
  if (input.startsWith("#")) return input;
  const m = input.match(/hsl\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)%\s*\)/i);
  if (!m) return "";
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + mm) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
