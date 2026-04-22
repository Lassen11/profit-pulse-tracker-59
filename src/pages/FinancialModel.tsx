import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subMonths, getDaysInMonth, getDate } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@/components/TransactionTable";
import {
  buildPnl,
  buildSpasenieUnit,
  buildBusinessUnit,
  buildRunRate,
  PnL,
  UnitEconomics,
  DepartmentEmployeeRow,
  LeadGenRow,
  SpasenieClient,
  BizSale,
} from "@/lib/financialModel";
import { PnlTable, PlanValues } from "@/components/financial-model/PnlTable";
import { UnitEconomicsCards } from "@/components/financial-model/UnitEconomicsCards";
import { ForecastBlock } from "@/components/financial-model/ForecastBlock";
import { CashFlowBlock } from "@/components/financial-model/CashFlowBlock";
import { ScenarioSimulator } from "@/components/financial-model/ScenarioSimulator";
import { MonthlyTrendChart, TrendPoint } from "@/components/financial-model/MonthlyTrendChart";
import { PlanFactScenarioChart } from "@/components/financial-model/PlanFactScenarioChart";

const COMPANIES = ["Спасение", "Дело Бизнеса"] as const;

const PLAN_KEYS: Record<keyof PlanValues, string> = {
  revenue: "fm_revenue_plan",
  fot: "fm_fot_plan",
  marketing: "fm_marketing_plan",
  opex: "fm_opex_plan",
  net: "fm_net_plan",
};

export default function FinancialModel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCompany = searchParams.get("company");
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<string>(
    initialCompany === "Дело Бизнеса" || initialCompany === "Спасение" ? initialCompany : "Спасение"
  );
  const [month, setMonth] = useState<Date>(new Date());

  const [monthTx, setMonthTx] = useState<Transaction[]>([]);
  const [priorTx, setPriorTx] = useState<Transaction[]>([]);
  const [trendTx, setTrendTx] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<DepartmentEmployeeRow[]>([]);
  const [leadGen, setLeadGen] = useState<LeadGenRow[]>([]);
  const [spasenieClients, setSpasenieClients] = useState<SpasenieClient[]>([]);
  const [bizSales, setBizSales] = useState<BizSale[]>([]);
  const [planRows, setPlanRows] = useState<Record<string, { id: string; value: number }>>({});
  const [adjustments, setAdjustments] = useState<number>(0);
  const [scenarioPnl, setScenarioPnl] = useState<PnL | null>(null);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd = useMemo(() => endOfMonth(month), [month]);
  const monthStartStr = useMemo(() => format(monthStart, "yyyy-MM-dd"), [monthStart]);
  const monthEndStr = useMemo(() => format(monthEnd, "yyyy-MM-dd"), [monthEnd]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const sixMonthsAgoStr = format(startOfMonth(subMonths(month, 5)), "yyyy-MM-dd");

      const [
        monthTxRes,
        priorTxRes,
        trendTxRes,
        empRes,
        leadRes,
        kpiRes,
        adjRes,
      ] = await Promise.all([
        supabase.from("transactions").select("*").eq("company", company).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("transactions").select("*").eq("company", company).lt("date", monthStartStr),
        supabase.from("transactions").select("*").eq("company", company).gte("date", sixMonthsAgoStr).lte("date", monthEndStr),
        supabase.from("department_employees").select("cost,company").eq("company", company).eq("month", monthStartStr),
        supabase.from("lead_generation").select("total_cost,total_leads,qualified_leads,contracts,payments").eq("company", company).gte("date", monthStartStr).lte("date", monthEndStr),
        supabase.from("kpi_targets").select("id,kpi_name,target_value").eq("company", company).eq("month", monthStartStr),
        supabase.from("company_balance_adjustments").select("adjusted_balance").eq("company", company),
      ]);

      setMonthTx((monthTxRes.data as Transaction[]) || []);
      setPriorTx((priorTxRes.data as Transaction[]) || []);
      setTrendTx((trendTxRes.data as Transaction[]) || []);
      setEmployees(empRes.data || []);
      setLeadGen(leadRes.data || []);
      const adjSum = (adjRes.data || []).reduce((s, a) => s + Number(a.adjusted_balance || 0), 0);
      setAdjustments(adjSum);

      const map: Record<string, { id: string; value: number }> = {};
      (kpiRes.data || []).forEach((r: any) => {
        map[r.kpi_name] = { id: r.id, value: Number(r.target_value) };
      });
      setPlanRows(map);

      // Юнит-экономика — клиенты/продажи за месяц
      if (company === "Спасение") {
        const { data } = await supabase
          .from("bankrot_clients")
          .select("contract_amount,first_payment,monthly_payment,installment_period,contract_date")
          .gte("contract_date", monthStartStr)
          .lte("contract_date", monthEndStr);
        setSpasenieClients((data as SpasenieClient[]) || []);
        setBizSales([]);
      } else {
        const { data } = await supabase
          .from("sales")
          .select("contract_amount,payment_amount,payment_date,company")
          .eq("company", company)
          .gte("payment_date", monthStartStr)
          .lte("payment_date", monthEndStr);
        setBizSales((data as BizSale[]) || []);
        setSpasenieClients([]);
      }
    } catch (e) {
      console.error("FinancialModel fetch error", e);
      toast({ title: "Ошибка загрузки", description: "Не удалось получить данные", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [company, month, monthStartStr, monthEndStr, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("financial-model")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "department_employees" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_generation" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_targets" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const pnl: PnL = useMemo(() => buildPnl(monthTx, employees, leadGen), [monthTx, employees, leadGen]);

  const plan: PlanValues = useMemo(
    () => ({
      revenue: planRows[PLAN_KEYS.revenue]?.value || 0,
      fot: planRows[PLAN_KEYS.fot]?.value || 0,
      marketing: planRows[PLAN_KEYS.marketing]?.value || 0,
      opex: planRows[PLAN_KEYS.opex]?.value || 0,
      net: planRows[PLAN_KEYS.net]?.value || 0,
    }),
    [planRows]
  );

  const unit: UnitEconomics = useMemo(
    () => (company === "Спасение" ? buildSpasenieUnit(spasenieClients, leadGen) : buildBusinessUnit(bizSales, leadGen)),
    [company, spasenieClients, bizSales, leadGen]
  );

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();
  const daysInMonth = getDaysInMonth(month);
  const daysPassed = isCurrentMonth ? getDate(today) : daysInMonth;
  const runRate = useMemo(() => buildRunRate(pnl, daysPassed, daysInMonth), [pnl, daysPassed, daysInMonth]);

  const trendData: TrendPoint[] = useMemo(() => {
    const buckets = new Map<string, { revenue: number; expenses: number }>();
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(month, i);
      buckets.set(format(m, "yyyy-MM"), { revenue: 0, expenses: 0 });
    }
    trendTx.forEach((t) => {
      const key = (t.date || "").slice(0, 7);
      const b = buckets.get(key);
      if (!b) return;
      if (t.category === "Перевод между счетами") return;
      if (t.type === "income") b.revenue += Number(t.amount);
      else b.expenses += Number(t.amount);
    });
    return Array.from(buckets.entries()).map(([key, v]) => ({
      month: format(new Date(key + "-01"), "LLL", { locale: ru }),
      revenue: v.revenue,
      expenses: v.expenses,
      net: v.revenue - v.expenses,
    }));
  }, [trendTx, month]);

  const handleSavePlan = async (key: keyof PlanValues, value: number) => {
    if (!user) return;
    const kpiName = PLAN_KEYS[key];
    const existing = planRows[kpiName];
    try {
      if (existing) {
        const { error } = await supabase
          .from("kpi_targets")
          .update({ target_value: value })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("kpi_targets")
          .insert({
            user_id: user.id,
            company,
            kpi_name: kpiName,
            target_value: value,
            month: monthStartStr,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setPlanRows((cur) => ({ ...cur, [kpiName]: { id: data.id, value } }));
        }
      }
      setPlanRows((cur) => ({
        ...cur,
        [kpiName]: { id: cur[kpiName]?.id ?? "", value },
      }));
      toast({ title: "План обновлён" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Финансовая модель</h1>
              <p className="text-sm text-muted-foreground">
                {company} · {format(month, "LLLL yyyy", { locale: ru })}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]" position="popper">
                {COMPANIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-56 justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(month, "LLLL yyyy", { locale: ru })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={month}
                  onSelect={(d) => d && setMonth(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-muted-foreground">Загрузка данных…</div>
        )}

        {!loading && (
          <>
            <PnlTable pnl={pnl} plan={plan} canEdit={isAdmin} onSavePlan={handleSavePlan} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ForecastBlock
                pnl={pnl}
                runRate={runRate}
                plan={plan}
                daysPassed={daysPassed}
                daysInMonth={daysInMonth}
              />
              <CashFlowBlock
                monthTransactions={monthTx}
                priorTransactions={priorTx}
                adjustments={adjustments}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Юнит-экономика</h2>
              <UnitEconomicsCards unit={unit} isSpasenie={company === "Спасение"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScenarioSimulator basePnl={pnl} />
              <MonthlyTrendChart data={trendData} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
