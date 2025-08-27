import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Transaction } from "./TransactionTable";
import ProfitForecast from "./ProfitForecast";

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

  // Аналитика по категориям
  const categoryData = useMemo(() => {
    const incomeCategories: Record<string, number> = {};
    const expenseCategories: Record<string, number> = {};
    
    transactions.forEach((transaction) => {
      const key = transaction.subcategory ? 
        `${transaction.category} / ${transaction.subcategory}` : 
        transaction.category;
      
      if (transaction.type === 'income') {
        incomeCategories[key] = (incomeCategories[key] || 0) + transaction.amount;
      } else {
        expenseCategories[key] = (expenseCategories[key] || 0) + transaction.amount;
      }
    });

    const incomeData = Object.entries(incomeCategories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    const expenseData = Object.entries(expenseCategories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { incomeData, expenseData };
  }, [transactions]);

  // Цвета для круговых диаграмм
  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--accent))',
    'hsl(var(--muted))',
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300',
    '#8dd1e1',
    '#d084d0',
    '#ffb347',
    '#87d068'
  ];

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
        className="text-xs shrink-0"
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

  const CategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-sm" style={{ color: data.color }}>
            Сумма: {formatCurrency(data.value)}
          </p>
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="chart">Графики</TabsTrigger>
              <TabsTrigger value="categories">Категории</TabsTrigger>
              <TabsTrigger value="table">Таблица</TabsTrigger>
              <TabsTrigger value="forecast">Прогноз</TabsTrigger>
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
            
            <TabsContent value="categories" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Доходы по категориям */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Доходы по категориям</CardTitle>
                    <CardDescription>Распределение доходов</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {categoryData.incomeData.length > 0 ? (
                      <>
                        <div className="h-64 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categoryData.incomeData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={false}
                              >
                                {categoryData.incomeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CategoryTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {categoryData.incomeData.map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="truncate max-w-[150px]">{item.name}</span>
                              </div>
                              <span className="font-medium amount-positive">
                                {formatCurrency(item.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">Нет данных о доходах</p>
                    )}
                  </CardContent>
                </Card>

                {/* Расходы по категориям */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Расходы по категориям</CardTitle>
                    <CardDescription>Распределение расходов</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {categoryData.expenseData.length > 0 ? (
                      <>
                        <div className="h-64 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categoryData.expenseData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={false}
                              >
                                {categoryData.expenseData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CategoryTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {categoryData.expenseData.map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="truncate max-w-[150px]">{item.name}</span>
                              </div>
                              <span className="font-medium amount-negative">
                                {formatCurrency(item.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">Нет данных о расходах</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="table">
              <div className="space-y-4">
                {monthlyData.map((data, index) => (
                  <Card key={data.monthKey}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{data.month}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Доходы</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold amount-positive">
                              {formatCurrency(data.income)}
                            </span>
                            {formatChange(data.incomeChange)}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Расходы</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold amount-negative">
                              {formatCurrency(data.expenses)}
                            </span>
                            {formatChange(data.expenseChange)}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Прибыль</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-semibold ${data.profit >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                              {formatCurrency(data.profit)}
                            </span>
                            {formatChange(data.profitChange)}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Маржа</span>
                          <span className={`text-lg font-semibold ${data.margin >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                            {data.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="forecast">
              <ProfitForecast transactions={transactions} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}