import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, ChevronRight } from "lucide-react";
import { fmtMoney, fmtPct, PnL } from "@/lib/financialModel";
import { cn } from "@/lib/utils";
import { Transaction } from "@/components/TransactionTable";
import { format } from "date-fns";

export interface PlanValues {
  revenue: number;
  fot: number;
  marketing: number;
  opex: number;
  net: number;
  revenueDebitorPlan?: number;
  revenueSalesPlan?: number;
}

interface Props {
  pnl: PnL;
  plan: PlanValues;
  canEdit: boolean;
  onSavePlan: (key: keyof PlanValues, value: number) => Promise<void> | void;
  showRevenueBreakdown?: boolean;
  /** Выручка-план рассчитывается автоматически и недоступна для редактирования */
  revenuePlanReadOnly?: boolean;
  /** Транзакции выбранного месяца — нужны для детализации OpEx по категориям */
  monthTransactions?: Transaction[];
}

// Должно совпадать с исключениями в buildPnl (src/lib/financialModel.ts)
const OPEX_EXCLUDED = new Set([
  "Перевод между счетами",
  "Вывод средств",
  "Налог УСН",
  "Налог НДФЛ и Взносы",
  "Зарплата",
  "Аванс",
  "Премия",
  "Авитолог",
  "Реклама Авито",
]);

const ROWS: Array<{ key: keyof PlanValues | "ebitda" | "margin" | "taxes"; label: string; planKey?: keyof PlanValues; emphasis?: "good" | "bad" | "bold"; planReadOnly?: boolean }> = [
  { key: "revenue", label: "Выручка", planKey: "revenue", emphasis: "good" },
  { key: "fot", label: "ФОТ (себестоимость)", planKey: "fot" },
  { key: "marketing", label: "Маркетинг / Лидген", planKey: "marketing" },
  { key: "opex", label: "Операционные расходы", planKey: "opex" },
  { key: "ebitda", label: "EBITDA", emphasis: "bold" },
  { key: "taxes", label: "Налоги" },
  { key: "net", label: "Чистая прибыль", planKey: "net", emphasis: "bold", planReadOnly: true },
  { key: "margin", label: "Маржа, %" },
];

export function PnlTable({ pnl, plan, canEdit, onSavePlan, showRevenueBreakdown = false, revenuePlanReadOnly = false, monthTransactions = [] }: Props) {
  const [editing, setEditing] = useState<keyof PlanValues | null>(null);
  const [draft, setDraft] = useState("");
  const [opexOpen, setOpexOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const factOf = (k: typeof ROWS[number]["key"]) => {
    if (k === "margin") return pnl.margin;
    return pnl[k as keyof PnL];
  };
  const planOf = (k?: keyof PlanValues) => (k ? plan[k] : 0);

  const startEdit = (k: keyof PlanValues) => {
    setEditing(k);
    setDraft(String(plan[k] || 0));
  };

  const save = async () => {
    if (!editing) return;
    const val = parseFloat(draft) || 0;
    await onSavePlan(editing, val);
    setEditing(null);
  };

  const opexBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; items: Transaction[] }>();
    for (const t of monthTransactions) {
      if (t.type !== "expense") continue;
      if (OPEX_EXCLUDED.has(t.category)) continue;
      const entry = map.get(t.category) ?? { total: 0, items: [] };
      entry.total += Number(t.amount || 0);
      entry.items.push(t);
      map.set(t.category, entry);
    }
    return Array.from(map.entries())
      .map(([category, { total, items }]) => ({
        category,
        total,
        items: [...items].sort((a, b) => (a.date < b.date ? 1 : -1)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthTransactions]);

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L месяца — план / факт</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Показатель</TableHead>
              <TableHead className="text-right">План</TableHead>
              <TableHead className="text-right">Факт</TableHead>
              <TableHead className="text-right">Отклонение</TableHead>
              <TableHead className="text-right">% выполнения</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => {
              const fact = factOf(row.key);
              const planVal = planOf(row.planKey);
              const isPct = row.key === "margin";
              const diff = fact - planVal;
              const pct = planVal !== 0 ? (fact / planVal) * 100 : 0;
              const isEditing = editing === row.planKey && row.planKey;

              return (
                <Fragment key={row.key}>
                <TableRow className={cn(row.emphasis === "bold" && "font-semibold bg-muted/40")}>
                  <TableCell>
                    {row.key === "opex" && opexBreakdown.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setOpexOpen((v) => !v)}
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            opexOpen && "rotate-90"
                          )}
                        />
                        {row.label}
                      </button>
                    ) : (
                      row.label
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.planKey ? (
                      row.planReadOnly || (row.planKey === "revenue" && revenuePlanReadOnly) ? (
                        <span
                          title={
                            row.planKey === "revenue"
                              ? "Рассчитывается автоматически: Дебиторка + Новые продажи (с дашборда)"
                              : "Рассчитывается автоматически: Выручка − ФОТ − Маркетинг − OpEx − Налоги"
                          }
                        >
                          {fmtMoney(planVal)}
                        </span>
                      ) : isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="h-8 w-32 text-right"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => canEdit && startEdit(row.planKey!)}
                          className={cn(
                            "inline-flex items-center gap-1",
                            canEdit && "hover:text-primary cursor-pointer"
                          )}
                        >
                          {fmtMoney(planVal)}
                          {canEdit && <Pencil className="h-3 w-3 opacity-50" />}
                        </button>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isPct ? fmtPct(fact) : fmtMoney(fact)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      row.planKey && diff > 0 && row.key !== "fot" && row.key !== "marketing" && row.key !== "opex" && "text-green-600",
                      row.planKey && diff < 0 && (row.key === "revenue" || row.key === "net") && "text-destructive",
                      row.planKey && diff > 0 && (row.key === "fot" || row.key === "marketing" || row.key === "opex") && "text-destructive"
                    )}
                  >
                    {row.planKey ? (isPct ? fmtPct(diff) : fmtMoney(diff)) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.planKey && planVal !== 0 ? `${pct.toFixed(0)}%` : "—"}
                  </TableCell>
                </TableRow>
                {row.key === "revenue" && showRevenueBreakdown && (
                  <>
                    <TableRow className="text-muted-foreground">
                      <TableCell className="pl-8 text-sm">↳ Дебиторка (ежем. платежи)</TableCell>
                      <TableCell className="text-right text-sm">
                        {plan.revenueDebitorPlan != null ? fmtMoney(plan.revenueDebitorPlan) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtMoney(pnl.revenueDebitor)}</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                    </TableRow>
                    <TableRow className="text-muted-foreground">
                      <TableCell className="pl-8 text-sm">↳ Продажи</TableCell>
                      <TableCell className="text-right text-sm">
                        {plan.revenueSalesPlan != null ? fmtMoney(plan.revenueSalesPlan) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtMoney(pnl.revenueSales)}</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                    </TableRow>
                  </>
                )}
                {row.key === "fot" && (
                  <>
                    <TableRow className="text-muted-foreground">
                      <TableCell className="pl-8 text-sm" title="Полная стоимость сотрудников из таблицы Зарплата (department_employees.cost)">
                        ↳ Начислено
                      </TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">{fmtMoney(pnl.fotAccrued)}</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                    </TableRow>
                    <TableRow className="text-muted-foreground">
                      <TableCell className="pl-8 text-sm" title="Фактически проведённые транзакции категорий «Зарплата / Аванс / Премия»">
                        ↳ Выплачено (касса)
                      </TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">{fmtMoney(pnl.fotPaid)}</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                    </TableRow>
                  </>
                )}
                {row.key === "opex" && opexOpen && opexBreakdown.length > 0 && (
                  <>
                    {opexBreakdown.map((b) => {
                      const isOpen = openCategories.has(b.category);
                      return (
                        <Fragment key={`opex-${b.category}`}>
                          <TableRow className="bg-muted/20">
                            <TableCell className="pl-8 text-sm">
                              <button
                                type="button"
                                onClick={() => toggleCategory(b.category)}
                                className="inline-flex items-center gap-1 hover:text-primary"
                              >
                                <ChevronRight
                                  className={cn(
                                    "h-3.5 w-3.5 transition-transform",
                                    isOpen && "rotate-90"
                                  )}
                                />
                                ↳ {b.category}
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({b.items.length})
                                </span>
                              </button>
                            </TableCell>
                            <TableCell className="text-right text-sm">—</TableCell>
                            <TableCell className="text-right text-sm">{fmtMoney(b.total)}</TableCell>
                            <TableCell className="text-right text-sm">—</TableCell>
                            <TableCell className="text-right text-sm">—</TableCell>
                          </TableRow>
                          {isOpen &&
                            b.items.map((tx) => (
                              <TableRow key={tx.id} className="text-muted-foreground">
                                <TableCell className="pl-16 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="tabular-nums">
                                      {format(new Date(tx.date), "dd.MM.yyyy")}
                                    </span>
                                    <span className="truncate max-w-[420px]">
                                      {tx.description || tx.subcategory || "—"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-xs">—</TableCell>
                                <TableCell className="text-right text-xs">{fmtMoney(Number(tx.amount || 0))}</TableCell>
                                <TableCell className="text-right text-xs">—</TableCell>
                                <TableCell className="text-right text-xs">—</TableCell>
                              </TableRow>
                            ))}
                        </Fragment>
                      );
                    })}
                  </>
                )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
