import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/components/TransactionTable";
import { fmtMoney } from "@/lib/financialModel";
import { useMemo } from "react";

interface Props {
  monthTransactions: Transaction[];
  priorTransactions: Transaction[]; // все транзакции компании ДО начала выбранного месяца
  adjustments: number; // company_balance_adjustments итого
}

export function CashFlowBlock({ monthTransactions, priorTransactions, adjustments }: Props) {
  const data = useMemo(() => {
    const sumNet = (txs: Transaction[]) =>
      txs.reduce((acc, t) => {
        if (t.category === "Перевод между счетами") return acc;
        return acc + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
      }, 0);

    const startBalance = adjustments + sumNet(priorTransactions);
    const inflow = monthTransactions
      .filter((t) => t.type === "income" && t.category !== "Перевод между счетами")
      .reduce((s, t) => s + Number(t.amount), 0);
    const outflow = monthTransactions
      .filter((t) => t.type === "expense" && t.category !== "Перевод между счетами")
      .reduce((s, t) => s + Number(t.amount), 0);
    const transfers = monthTransactions
      .filter((t) => t.category === "Перевод между счетами")
      .reduce((s, t) => s + Number(t.amount), 0);
    const netCf = inflow - outflow;
    const endBalance = startBalance + netCf;
    return { startBalance, inflow, outflow, transfers, netCf, endBalance };
  }, [monthTransactions, priorTransactions, adjustments]);

  const rows = [
    { label: "Остаток на начало месяца", value: data.startBalance },
    { label: "Поступления", value: data.inflow, accent: "text-green-600" },
    { label: "Списания", value: -data.outflow, accent: "text-destructive" },
    { label: "Переводы между счетами", value: data.transfers, muted: true },
    { label: "Чистый CF за месяц", value: data.netCf, bold: true },
    { label: "Остаток на конец месяца", value: data.endBalance, bold: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Денежный поток месяца</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex justify-between py-1 ${r.bold ? "font-semibold border-t pt-2" : ""}`}
          >
            <span className={r.muted ? "text-muted-foreground" : ""}>{r.label}</span>
            <span className={r.accent ?? ""}>{fmtMoney(r.value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
