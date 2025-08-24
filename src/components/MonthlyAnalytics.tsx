import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Transaction } from "./TransactionTable";

interface MonthlyAnalyticsProps {
  transactions: Transaction[];
}

interface MonthlyData {
  month: string;
  monthKey: string;
  income: number;
  expenses: number;
  profit: number;
  margin: number;
  incomeChange?: number;
  expenseChange?: number;
  profitChange?: number;
}

export function MonthlyAnalytics({ transactions }: MonthlyAnalyticsProps) {
  const monthlyData = useMemo(() => {
    const monthlyStats: Record<string, { income: number; expenses: number }> = {};
    
    // Группируем транзакции по месяцам
    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (transaction.type === 'income') {
        monthlyStats[monthKey].income += transaction.amount;
      } else {
        monthlyStats[monthKey].expenses += transaction.amount;
      }
    });

    // Преобразуем в массив с вычисленными метриками
    const data: MonthlyData[] = Object.entries(monthlyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, stats]) => {
        const profit = stats.income - stats.expenses;
        const margin = stats.income > 0 ? (profit / stats.income) * 100 : 0;
        
        const [year, month] = monthKey.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('ru-RU', { 
          month: 'short', 
          year: 'numeric' 
        });

        return {
          month: monthName,
          monthKey,
          income: stats.income,
          expenses: stats.expenses,
          profit,
          margin
        };
      });

    // Добавляем изменения по сравнению с предыдущим месяцем
    return data.map((item, index) => {
      if (index === 0) return item;
      
      const prev = data[index - 1];
      return {
        ...item,
        incomeChange: prev.income > 0 ? ((item.income - prev.income) / prev.income) * 100 : 0,
        expenseChange: prev.expenses > 0 ? ((item.expenses - prev.expenses) / prev.expenses) * 100 : 0,
        profitChange: prev.profit !== 0 ? ((item.profit - prev.profit) / Math.abs(prev.profit)) * 100 : 0
      };
    });
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatChange = (change?: number) => {
    if (change === undefined) return null;
    
    const isPositive = change > 0;
    const isNegative = change < 0;
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
    
    return (
      <Badge
        variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"}
        className="ml-2"
      >
        <Icon className="w-3 h-3 mr-1" />
        {Math.abs(change).toFixed(1)}%
      </Badge>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Месячная аналитика</CardTitle>
          <CardDescription>Нет данных для отображения</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Месячная аналитика</CardTitle>
          <CardDescription>Сравнение показателей по месяцам</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chart">Графики</TabsTrigger>
              <TabsTrigger value="table">Таблица</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chart" className="space-y-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="income" 
                      name="Доходы" 
                      fill="hsl(var(--profit))" 
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="expenses" 
                      name="Расходы" 
                      fill="hsl(var(--loss))" 
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      name="Прибыль"
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
            
            <TabsContent value="table">
              <div className="space-y-4">
                {monthlyData.map((data, index) => (
                  <Card key={data.monthKey}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{data.month}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Доходы</p>
                          <p className="text-lg font-semibold amount-positive">
                            {formatCurrency(data.income)}
                            {formatChange(data.incomeChange)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Расходы</p>
                          <p className="text-lg font-semibold amount-negative">
                            {formatCurrency(data.expenses)}
                            {formatChange(data.expenseChange)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Прибыль</p>
                          <p className={`text-lg font-semibold ${data.profit >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                            {formatCurrency(data.profit)}
                            {formatChange(data.profitChange)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Маржа</p>
                          <p className={`text-lg font-semibold ${data.margin >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                            {data.margin.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}