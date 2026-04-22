import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Save, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  company: string;
  monthKey: string; // yyyy-MM
  onScenarioChange?: (s: PnL) => void;
}

type MetricKey = "revenue" | "fot" | "marketing" | "opex" | "taxes";

const METRICS: Array<{ key: MetricKey; label: string; nonNegative: boolean }> = [
  { key: "revenue", label: "Выручка", nonNegative: true },
  { key: "fot", label: "ФОТ", nonNegative: true },
  { key: "marketing", label: "Маркетинг", nonNegative: true },
  { key: "opex", label: "Операционные расходы", nonNegative: true },
  { key: "taxes", label: "Налоги", nonNegative: true },
];

interface SavedScenario {
  name: string;
  deltas: ScenarioDeltas;
}

const storageKey = (company: string, monthKey: string) =>
  `fm_scenarios:${company}:${monthKey}`;

function loadScenarios(company: string, monthKey: string): SavedScenario[] {
  try {
    const raw = localStorage.getItem(storageKey(company, monthKey));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function persistScenarios(company: string, monthKey: string, list: SavedScenario[]) {
  localStorage.setItem(storageKey(company, monthKey), JSON.stringify(list));
}

export function ScenarioSimulator({ basePnl, company, monthKey, onScenarioChange }: Props) {
  const { toast } = useToast();
  const [d, setD] = useState<ScenarioDeltas>(emptyScenario);
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [activeName, setActiveName] = useState<string>("");
  const [newName, setNewName] = useState("");

  // Reload scenarios on company/month change and reset deltas
  useEffect(() => {
    setSaved(loadScenarios(company, monthKey));
    setD(emptyScenario);
    setActiveName("");
    setNewName("");
  }, [company, monthKey]);

  const next = useMemo(() => applyScenario(basePnl, d), [basePnl, d]);

  useEffect(() => {
    onScenarioChange?.(next);
  }, [next, onScenarioChange]);

  const setPct = (k: MetricKey, v: number) =>
    setD((cur) => ({ ...cur, [`${k}Pct`]: v } as ScenarioDeltas));
  const setAbs = (k: MetricKey, v: number) =>
    setD((cur) => ({ ...cur, [`${k}Abs`]: v } as ScenarioDeltas));

  // Validation: absolute delta must not push base value below 0
  const absWarnings = useMemo(() => {
    const w: Partial<Record<MetricKey, string>> = {};
    METRICS.forEach((m) => {
      const abs = d[`${m.key}Abs` as keyof ScenarioDeltas] as number;
      const base = basePnl[m.key];
      if (m.nonNegative && base + abs < 0) {
        w[m.key] = `Значение не может быть ниже 0. Минимально допустимое изменение: ${fmtMoney(-base)}.`;
      }
    });
    return w;
  }, [d, basePnl]);

  const hasWarnings = Object.keys(absWarnings).length > 0;
  const deltaNet = next.net - basePnl.net;
  const deltaEbitda = next.ebitda - basePnl.ebitda;

  const handleSave = () => {
    const name = (newName || activeName || "").trim();
    if (!name) {
      toast({ title: "Введите название сценария", variant: "destructive" });
      return;
    }
    if (hasWarnings) {
      toast({ title: "Исправьте предупреждения перед сохранением", variant: "destructive" });
      return;
    }
    const list = [...saved];
    const idx = list.findIndex((s) => s.name === name);
    if (idx >= 0) list[idx] = { name, deltas: d };
    else list.push({ name, deltas: d });
    persistScenarios(company, monthKey, list);
    setSaved(list);
    setActiveName(name);
    setNewName("");
    toast({ title: `Сценарий «${name}» сохранён` });
  };

  const handleLoad = (name: string) => {
    const found = saved.find((s) => s.name === name);
    if (!found) return;
    setD({ ...emptyScenario, ...found.deltas });
    setActiveName(name);
  };

  const handleDelete = () => {
    if (!activeName) return;
    const list = saved.filter((s) => s.name !== activeName);
    persistScenarios(company, monthKey, list);
    setSaved(list);
    setActiveName("");
    toast({ title: `Сценарий удалён` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span>Сценарий «что-если»</span>
          <span className="text-xs font-normal text-muted-foreground">{monthKey}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Saved scenarios */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <Select value={activeName || undefined} onValueChange={handleLoad}>
            <SelectTrigger>
              <SelectValue placeholder={saved.length ? "Выбрать сохранённый сценарий" : "Сохранённых сценариев нет"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]" position="popper">
              {saved.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={!activeName}
            title="Удалить активный сценарий"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setD(emptyScenario); setActiveName(""); }}>
            Сброс
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="Название нового сценария"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button variant="default" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" /> Сохранить
          </Button>
        </div>

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
                        v > 0 ? "text-green-600" : v < 0 ? "text-destructive" : "text-muted-foreground"
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
              Положительные числа увеличивают значение, отрицательные — уменьшают. Итог не может быть ниже нуля.
            </p>
            {METRICS.map((m) => {
              const v = d[`${m.key}Abs` as keyof ScenarioDeltas] as number;
              const baseVal = basePnl[m.key];
              const warn = absWarnings[m.key];
              return (
                <div key={m.key} className="space-y-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <Label className="text-sm">{m.label}</Label>
                    <Input
                      type="number"
                      value={v === 0 ? "" : v}
                      placeholder="0"
                      onChange={(e) => setAbs(m.key, Number(e.target.value) || 0)}
                      className={warn ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    <div className="text-xs text-muted-foreground">
                      База: {fmtMoney(baseVal)} → {fmtMoney(Math.max(0, baseVal + v))}
                    </div>
                  </div>
                  {warn && (
                    <div className="flex items-center gap-1 text-xs text-destructive pl-1">
                      <AlertTriangle className="h-3 w-3" />
                      {warn}
                    </div>
                  )}
                </div>
              );
            })}
            {hasWarnings && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  В расчёте применено ограничение: значения, уходящие в минус, обнуляются. Скорректируйте дельты.
                </AlertDescription>
              </Alert>
            )}
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
