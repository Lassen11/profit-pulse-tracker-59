import { Fragment, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { fmtMoney, fmtPct, PnL } from "@/lib/financialModel";
import { cn } from "@/lib/utils";

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
}

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

export function PnlTable({ pnl, plan, canEdit, onSavePlan, showRevenueBreakdown = false }: Props) {
  const [editing, setEditing] = useState<keyof PlanValues | null>(null);
  const [draft, setDraft] = useState("");

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
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">
                    {row.planKey ? (
                      row.planReadOnly ? (
                        <span title="Рассчитывается автоматически: Выручка − ФОТ − Маркетинг − OpEx − Налоги">
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
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
