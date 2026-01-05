import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

interface ClientsSaldoChartProps {
  selectedMonth: Date;
  userId?: string;
}

interface MonthData {
  month: string;
  monthLabel: string;
  newClients: number;
  completedCases: number;
  saldo: number;
  newClientsSum: number;
  completedCasesSum: number;
  saldoSum: number;
}

type PeriodType = "2" | "3" | "6" | "12";

export function ClientsSaldoChart({ selectedMonth, userId }: ClientsSaldoChartProps) {
  const [chartData, setChartData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("2");

  const fetchMonthData = useCallback(async (date: Date): Promise<MonthData | null> => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

    try {
      const { data: kpiData, error } = await supabase
        .from('kpi_targets')
        .select('kpi_name, target_value')
        .eq('company', 'Спасение')
        .gte('month', monthStartStr)
        .lte('month', monthEndStr)
        .in('kpi_name', [
          'new_clients_count',
          'new_clients_monthly_payment_sum',
          'completed_cases_count',
          'completed_cases_monthly_payment_sum'
        ]);

      if (error) {
        console.error('Error fetching KPI data:', error);
        return null;
      }

      const getValue = (name: string) => 
        kpiData?.find(k => k.kpi_name === name)?.target_value || 0;

      const newClients = getValue('new_clients_count');
      const completedCases = getValue('completed_cases_count');
      const newClientsSum = getValue('new_clients_monthly_payment_sum');
      const completedCasesSum = getValue('completed_cases_monthly_payment_sum');

      return {
        month: format(date, 'yyyy-MM'),
        monthLabel: format(date, 'LLL yy', { locale: ru }),
        newClients,
        completedCases,
        saldo: newClients - completedCases,
        newClientsSum,
        completedCasesSum,
        saldoSum: newClientsSum - completedCasesSum
      };
    } catch (error) {
      console.error('Error in fetchMonthData:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      const monthsCount = parseInt(period);
      const monthPromises: Promise<MonthData | null>[] = [];
      
      // Generate dates for each month in the period (from oldest to newest)
      for (let i = monthsCount - 1; i >= 0; i--) {
        const monthDate = subMonths(selectedMonth, i);
        monthPromises.push(fetchMonthData(monthDate));
      }

      const results = await Promise.all(monthPromises);
      const data = results.filter((d): d is MonthData => d !== null);

      setChartData(data);
      setLoading(false);
    };

    loadData();
  }, [selectedMonth, period, fetchMonthData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(value) + ' ₽';
  };

  const periodOptions = [
    { value: "2", label: "2 месяца" },
    { value: "3", label: "3 месяца" },
    { value: "6", label: "6 месяцев" },
    { value: "12", label: "12 месяцев" },
  ];

  if (loading) {
    return (
      <Card className="shadow-kpi">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Динамика сальдо клиентов</CardTitle>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Загрузка...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="shadow-kpi">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Динамика сальдо клиентов</CardTitle>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Нет данных
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-kpi">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Динамика сальдо клиентов</CardTitle>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                interval={0}
                angle={chartData.length > 6 ? -45 : 0}
                textAnchor={chartData.length > 6 ? "end" : "middle"}
                height={chartData.length > 6 ? 60 : 30}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    newClients: 'Новых клиентов',
                    completedCases: 'Завершенных дел',
                    saldo: 'Сальдо (кол-во)'
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Legend 
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    newClients: 'Новых',
                    completedCases: 'Заверш.',
                    saldo: 'Сальдо'
                  };
                  return labels[value] || value;
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <Bar 
                dataKey="newClients" 
                fill="hsl(142, 76%, 36%)" 
                name="newClients"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="completedCases" 
                fill="hsl(0, 84%, 60%)" 
                name="completedCases"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="saldo" 
                fill="hsl(221, 83%, 53%)" 
                name="saldo"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-muted-foreground">Месяц</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Новых</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Заверш.</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Сальдо</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Сальдо (₽)</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.month} className="border-b">
                  <td className="py-2 capitalize">{row.monthLabel}</td>
                  <td className="text-right py-2 text-green-600">{row.newClients}</td>
                  <td className="text-right py-2 text-red-600">{row.completedCases}</td>
                  <td className={`text-right py-2 font-medium ${row.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.saldo > 0 ? '+' : ''}{row.saldo}
                  </td>
                  <td className={`text-right py-2 font-medium ${row.saldoSum >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {row.saldoSum > 0 ? '+' : ''}{formatCurrency(row.saldoSum)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="py-2">Итого</td>
                <td className="text-right py-2 text-green-600">
                  {chartData.reduce((sum, row) => sum + row.newClients, 0)}
                </td>
                <td className="text-right py-2 text-red-600">
                  {chartData.reduce((sum, row) => sum + row.completedCases, 0)}
                </td>
                <td className={`text-right py-2 ${chartData.reduce((sum, row) => sum + row.saldo, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {chartData.reduce((sum, row) => sum + row.saldo, 0) > 0 ? '+' : ''}
                  {chartData.reduce((sum, row) => sum + row.saldo, 0)}
                </td>
                <td className={`text-right py-2 ${chartData.reduce((sum, row) => sum + row.saldoSum, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {chartData.reduce((sum, row) => sum + row.saldoSum, 0) > 0 ? '+' : ''}
                  {formatCurrency(chartData.reduce((sum, row) => sum + row.saldoSum, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
