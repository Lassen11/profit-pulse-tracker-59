import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

interface ClientMetricsChartProps {
  userId: string | undefined;
}

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  remainingPayments: number;
  terminationsCount: number;
  terminationsContractSum: number;
  terminationsMonthlySum: number;
  suspensionsCount: number;
  suspensionsContractSum: number;
  suspensionsMonthlySum: number;
}

export function ClientMetricsChart({ userId }: ClientMetricsChartProps) {
  const [period, setPeriod] = useState<string>("3");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChartData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const months = parseInt(period);
      const data: ChartDataPoint[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthStartStr = format(monthStart, 'yyyy-MM-dd');
        const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
        const monthLabel = format(monthDate, 'LLL yyyy', { locale: ru });

        // Fetch all KPIs for this month in parallel
        const [
          remainingRes,
          termCountRes,
          termContractRes,
          termMonthlyRes,
          suspCountRes,
          suspContractRes,
          suspMonthlyRes
        ] = await Promise.all([
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'remaining_payments').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle(),
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'terminations_count').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle(),
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'terminations_contract_sum').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle(),
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'terminations_monthly_sum').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle(),
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'suspensions_count').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle(),
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'suspensions_contract_sum').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle(),
          supabase.from('kpi_targets').select('target_value').eq('company', 'Спасение').eq('kpi_name', 'suspensions_monthly_sum').gte('month', monthStartStr).lte('month', monthEndStr).maybeSingle()
        ]);

        data.push({
          month: monthStartStr,
          monthLabel,
          remainingPayments: remainingRes.data?.target_value || 0,
          terminationsCount: termCountRes.data?.target_value || 0,
          terminationsContractSum: termContractRes.data?.target_value || 0,
          terminationsMonthlySum: termMonthlyRes.data?.target_value || 0,
          suspensionsCount: suspCountRes.data?.target_value || 0,
          suspensionsContractSum: suspContractRes.data?.target_value || 0,
          suspensionsMonthlySum: suspMonthlyRes.data?.target_value || 0
        });
      }

      setChartData(data);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.name.includes('Кол-во') ? entry.value : formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="shadow-kpi">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Динамика метрик клиентов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-kpi">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Динамика метрик клиентов</CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 месяца</SelectItem>
            <SelectItem value="3">3 месяца</SelectItem>
            <SelectItem value="6">6 месяцев</SelectItem>
            <SelectItem value="12">12 месяцев</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthLabel" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="remainingPayments"
                name="Остаток платежей"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
              />
              <Line
                type="monotone"
                dataKey="terminationsContractSum"
                name="Расторжения (договоры)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444' }}
              />
              <Line
                type="monotone"
                dataKey="terminationsMonthlySum"
                name="Расторжения (платежи)"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316' }}
              />
              <Line
                type="monotone"
                dataKey="suspensionsContractSum"
                name="Приостановки (договоры)"
                stroke="#eab308"
                strokeWidth={2}
                dot={{ fill: '#eab308' }}
              />
              <Line
                type="monotone"
                dataKey="suspensionsMonthlySum"
                name="Приостановки (платежи)"
                stroke="#84cc16"
                strokeWidth={2}
                dot={{ fill: '#84cc16' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}