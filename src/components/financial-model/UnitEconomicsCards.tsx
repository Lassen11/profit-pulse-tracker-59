import { Card, CardContent } from "@/components/ui/card";
import { fmtMoney, fmtPct, UnitEconomics } from "@/lib/financialModel";
import { Users, TrendingUp, Repeat, Wallet } from "lucide-react";

interface Props {
  unit: UnitEconomics;
  isSpasenie: boolean;
}

export function UnitEconomicsCards({ unit, isSpasenie }: Props) {
  const items = [
    { label: "CAC (стоимость привлечения)", value: fmtMoney(unit.cac), icon: Users, accent: "text-blue-600" },
    { label: "Конверсия лид → договор", value: fmtPct(unit.conversion), icon: TrendingUp, accent: "text-emerald-600" },
    { label: "Средний чек договора", value: fmtMoney(unit.avgCheck), icon: Wallet, accent: "text-violet-600" },
    ...(isSpasenie
      ? [{ label: "Средний ежем. платёж", value: fmtMoney(unit.avgMonthly), icon: Repeat, accent: "text-cyan-600" }]
      : []),
    { label: "LTV", value: fmtMoney(unit.ltv), icon: Target, accent: "text-amber-600" },
    {
      label: "LTV / CAC",
      value: unit.ltvCac > 0 ? unit.ltvCac.toFixed(2).replace(".", ",") : "—",
      icon: Calculator,
      accent: unit.ltvCac >= 3 ? "text-green-600" : unit.ltvCac >= 1 ? "text-amber-600" : "text-destructive",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <it.icon className={`h-8 w-8 ${it.accent}`} />
            <div>
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="text-lg font-semibold">{it.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
