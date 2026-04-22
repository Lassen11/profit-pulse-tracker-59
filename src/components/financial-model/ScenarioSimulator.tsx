import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { applyScenario, fmtMoney, fmtPct, PnL, ScenarioDeltas } from "@/lib/financialModel";

interface Props {
  basePnl: PnL;
}

export function ScenarioSimulator({ basePnl }: Props) {
  const [d, setD] = useState<ScenarioDeltas>({ revenuePct: 0, fotPct: 0, marketingPct: 0 });
  const next = useMemo(() => applyScenario(basePnl, d), [basePnl, d]);

  const sliders: Array<{ key: keyof ScenarioDeltas; label: string }> = [
    { key: "revenuePct", label: "Изменение выручки" },
    { key: "fotPct", label: "Изменение ФОТ" },
    { key: "marketingPct", label: "Изменение маркетинга" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сценарий «что-если»</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sliders.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-sm mb-2">
              <span>{s.label}</span>
              <span className={d[s.key] > 0 ? "text-green-600" : d[s.key] < 0 ? "text-destructive" : "text-muted-foreground"}>
                {d[s.key] > 0 ? "+" : ""}
                {d[s.key]}%
              </span>
            </div>
            <Slider
              value={[d[s.key]]}
              min={-50}
              max={100}
              step={1}
              onValueChange={(v) => setD((cur) => ({ ...cur, [s.key]: v[0] }))}
            />
          </div>
        ))}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
          <Stat label="Выручка" value={fmtMoney(next.revenue)} />
          <Stat label="EBITDA" value={fmtMoney(next.ebitda)} />
          <Stat label="Чистая прибыль" value={fmtMoney(next.net)} accent={next.net >= 0 ? "text-green-600" : "text-destructive"} />
          <Stat label="Маржа" value={fmtPct(next.margin)} />
        </div>

        <Button variant="outline" size="sm" onClick={() => setD({ revenuePct: 0, fotPct: 0, marketingPct: 0 })}>
          Сбросить сценарий
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
