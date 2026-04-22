import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  applyScenario,
  emptyScenario,
  fmtMoney,
  fmtPct,
  PnL,
  ScenarioDeltas,
} from "@/lib/financialModel";

interface Props {
  basePnl: PnL;
}

type MetricKey = "revenue" | "fot" | "marketing" | "opex" | "taxes";

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "revenue", label: "Выручка" },
  { key: "fot", label: "ФОТ" },
  { key: "marketing", label: "Маркетинг" },
  { key: "opex", label: "Операционные расходы" },
  { key: "taxes", label: "Налоги" },
];

export function ScenarioSimulator({ basePnl }: Props) {
  const [d, setD] = useState<ScenarioDeltas>(emptyScenario);
  const next = useMemo(() => applyScenario(basePnl, d), [basePnl, d]);

  const setPct = (k: MetricKey, v: number) =>
    setD((cur) => ({ ...cur, [`${k}Pct`]: v } as ScenarioDeltas));
  const setAbs = (k: MetricKey, v: number) =>
    setD((cur) => ({ ...cur, [`${k}Abs`]: v } as ScenarioDeltas));

  const deltaNet = next.net - basePnl.net;
  const deltaEbitda = next.ebitda - basePnl.ebitda;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Сценарий «что-если»</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs defaultValue="pct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pct">В процентах</TabsTrigger>
            <TabsTrigger value="abs">В рублях</TabsTrigger>
          </TabsList>

          <TabsContent value="pct" className="space-y-4 pt-4">
            {METRICS.map((m) => {
              const v = d[`${m.key}Pct` as keyof ScenarioDeltas] as number;
              return (
                <div key={m.key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{m.label}</span>
                    <span
                      className={
                        v > 0
                          ? "text-green-600"
                          : v < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {v > 0 ? "+" : ""}
                      {v}%
                    </span>
                  </div>
                  <Slider
                    value={[v]}
                    min={-50}
                    max={100}
                    step={1}
                    onValueChange={(val) => setPct(m.key, val[0])}
                  />
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="abs" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Положительные числа увеличивают значение, отрицательные — уменьшают.
            </p>
            {METRICS.map((m) => {
              const v = d[`${m.key}Abs` as keyof ScenarioDeltas] as number;
              const baseVal = basePnl[m.key];
              return (
                <div key={m.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <Label className="text-sm">{m.label}</Label>
                  <Input
                    type="number"
                    value={v === 0 ? "" : v}
                    placeholder="0"
                    onChange={(e) => setAbs(m.key, Number(e.target.value) || 0)}
                  />
                  <div className="text-xs text-muted-foreground">
                    База: {fmtMoney(baseVal)} → {fmtMoney(baseVal + v)}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
          <Stat label="Выручка" value={fmtMoney(next.revenue)} />
          <Stat
            label="EBITDA"
            value={fmtMoney(next.ebitda)}
            sub={fmtDelta(deltaEbitda)}
            subAccent={deltaEbitda >= 0 ? "text-green-600" : "text-destructive"}
          />
          <Stat
            label="Чистая прибыль"
            value={fmtMoney(next.net)}
            accent={next.net >= 0 ? "text-green-600" : "text-destructive"}
            sub={fmtDelta(deltaNet)}
            subAccent={deltaNet >= 0 ? "text-green-600" : "text-destructive"}
          />
          <Stat label="Маржа" value={fmtPct(next.margin)} />
        </div>

        <Button variant="outline" size="sm" onClick={() => setD(emptyScenario)}>
          Сбросить сценарий
        </Button>
      </CardContent>
    </Card>
  );
}

function fmtDelta(v: number): string {
  if (Math.round(v) === 0) return "без изменений";
  const sign = v > 0 ? "+" : "−";
  return `${sign}${fmtMoney(Math.abs(v))}`;
}

function Stat({
  label,
  value,
  accent,
  sub,
  subAccent,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
  subAccent?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${accent ?? ""}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${subAccent ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}
