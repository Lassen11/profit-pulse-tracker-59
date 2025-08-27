import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { Transaction } from '@/components/TransactionTable';

interface ProfitForecastProps {
  transactions: Transaction[];
}

interface CategoryAverage {
  category: string;
  averageAmount: number;
  type: 'income' | 'expense';
}

const ProfitForecast: React.FC<ProfitForecastProps> = ({ transactions }) => {
  const [targetProfit, setTargetProfit] = useState<number>(0);
  const [projectionPeriod, setProjectionPeriod] = useState<number>(1); // months

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate historical averages by category
  const categoryAverages = useMemo((): CategoryAverage[] => {
    const categoryTotals = transactions.reduce((acc, transaction) => {
      const key = `${transaction.type}-${transaction.category}`;
      if (!acc[key]) {
        acc[key] = {
          total: 0,
          count: 0,
          type: transaction.type as 'income' | 'expense',
          category: transaction.category
        };
      }
      acc[key].total += transaction.amount;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number; type: 'income' | 'expense'; category: string }>);

    return Object.values(categoryTotals).map(item => ({
      category: item.category,
      averageAmount: item.total / item.count,
      type: item.type
    }));
  }, [transactions]);

  const currentAverages = useMemo(() => {
    const income = categoryAverages.filter(cat => cat.type === 'income');
    const expenses = categoryAverages.filter(cat => cat.type === 'expense');
    
    const totalIncome = income.reduce((sum, cat) => sum + cat.averageAmount, 0);
    const totalExpenses = expenses.reduce((sum, cat) => sum + cat.averageAmount, 0);
    const currentProfit = totalIncome - totalExpenses;

    return {
      income,
      expenses,
      totalIncome,
      totalExpenses,
      currentProfit
    };
  }, [categoryAverages]);

  const forecastCalculations = useMemo(() => {
    const targetProfitPerMonth = targetProfit / projectionPeriod;
    const requiredIncome = currentAverages.totalExpenses + targetProfitPerMonth;
    const incomeIncrease = requiredIncome - currentAverages.totalIncome;
    const incomeIncreasePercent = currentAverages.totalIncome > 0 ? (incomeIncrease / currentAverages.totalIncome) * 100 : 0;

    // Alternative: reduce expenses
    const requiredExpenses = currentAverages.totalIncome - targetProfitPerMonth;
    const expenseReduction = currentAverages.totalExpenses - requiredExpenses;
    const expenseReductionPercent = currentAverages.totalExpenses > 0 ? (expenseReduction / currentAverages.totalExpenses) * 100 : 0;

    // Combined approach (50/50)
    const combinedIncomeIncrease = incomeIncrease * 0.5;
    const combinedExpenseReduction = expenseReduction * 0.5;

    return {
      targetProfitPerMonth,
      requiredIncome,
      incomeIncrease,
      incomeIncreasePercent,
      requiredExpenses,
      expenseReduction,
      expenseReductionPercent,
      combinedIncomeIncrease,
      combinedExpenseReduction
    };
  }, [targetProfit, projectionPeriod, currentAverages]);

  const distributeCategoryChanges = (totalChange: number, categories: CategoryAverage[], isIncrease: boolean) => {
    const totalCurrent = categories.reduce((sum, cat) => sum + cat.averageAmount, 0);
    
    return categories.map(cat => {
      const proportion = cat.averageAmount / totalCurrent;
      const change = totalChange * proportion;
      const newAmount = isIncrease ? cat.averageAmount + change : cat.averageAmount - change;
      return {
        ...cat,
        change,
        newAmount: Math.max(0, newAmount),
        changePercent: cat.averageAmount > 0 ? (change / cat.averageAmount) * 100 : 0
      };
    });
  };

  const incomeScenario = distributeCategoryChanges(
    forecastCalculations.incomeIncrease,
    currentAverages.income,
    true
  );

  const expenseScenario = distributeCategoryChanges(
    forecastCalculations.expenseReduction,
    currentAverages.expenses,
    false
  );

  const combinedIncomeScenario = distributeCategoryChanges(
    forecastCalculations.combinedIncomeIncrease,
    currentAverages.income,
    true
  );

  const combinedExpenseScenario = distributeCategoryChanges(
    forecastCalculations.combinedExpenseReduction,
    currentAverages.expenses,
    false
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Прогноз прибыли
          </CardTitle>
          <CardDescription>
            Рассчитайте необходимые изменения в доходах и расходах для достижения целевой прибыли
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-profit">Целевая прибыль (₽)</Label>
              <Input
                id="target-profit"
                type="number"
                value={targetProfit}
                onChange={(e) => setTargetProfit(Number(e.target.value))}
                placeholder="Введите желаемую прибыль"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projection-period">Период (месяцы)</Label>
              <Input
                id="projection-period"
                type="number"
                min="1"
                value={projectionPeriod}
                onChange={(e) => setProjectionPeriod(Number(e.target.value))}
                placeholder="Количество месяцев"
              />
            </div>
          </div>

          {targetProfit > 0 && (
            <>
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(currentAverages.currentProfit)}
                    </div>
                    <div className="text-sm text-muted-foreground">Текущая прибыль/месяц</div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(forecastCalculations.targetProfitPerMonth)}
                    </div>
                    <div className="text-sm text-muted-foreground">Целевая прибыль/месяц</div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {formatCurrency(forecastCalculations.targetProfitPerMonth - currentAverages.currentProfit)}
                    </div>
                    <div className="text-sm text-muted-foreground">Увеличение прибыли</div>
                  </div>
                </Card>
              </div>

              <Tabs defaultValue="increase-income" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="increase-income">Увеличить доходы</TabsTrigger>
                  <TabsTrigger value="reduce-expenses">Сократить расходы</TabsTrigger>
                  <TabsTrigger value="combined">Комбинированный</TabsTrigger>
                </TabsList>

                <TabsContent value="increase-income" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="w-5 h-5 text-success" />
                        Сценарий: Увеличение доходов
                      </CardTitle>
                      <CardDescription>
                        Увеличить доходы на {formatCurrency(forecastCalculations.incomeIncrease)} 
                        ({forecastCalculations.incomeIncreasePercent.toFixed(1)}%)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {incomeScenario.map((cat, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <div>
                              <div className="font-medium">{cat.category}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(cat.averageAmount)} → {formatCurrency(cat.newAmount)}
                              </div>
                            </div>
                            <Badge variant="secondary">
                              +{cat.changePercent.toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reduce-expenses" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingDown className="w-5 h-5 text-destructive" />
                        Сценарий: Сокращение расходов
                      </CardTitle>
                      <CardDescription>
                        Сократить расходы на {formatCurrency(forecastCalculations.expenseReduction)} 
                        ({forecastCalculations.expenseReductionPercent.toFixed(1)}%)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {expenseScenario.map((cat, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <div>
                              <div className="font-medium">{cat.category}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(cat.averageAmount)} → {formatCurrency(cat.newAmount)}
                              </div>
                            </div>
                            <Badge variant="destructive">
                              -{Math.abs(cat.changePercent).toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="combined" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="w-5 h-5 text-success" />
                          Доходы (+50%)
                        </CardTitle>
                        <CardDescription>
                          Увеличить на {formatCurrency(forecastCalculations.combinedIncomeIncrease)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {combinedIncomeScenario.map((cat, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                              <div className="text-sm">
                                <div className="font-medium">{cat.category}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(cat.newAmount)}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                +{cat.changePercent.toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <TrendingDown className="w-5 h-5 text-destructive" />
                          Расходы (-50%)
                        </CardTitle>
                        <CardDescription>
                          Сократить на {formatCurrency(forecastCalculations.combinedExpenseReduction)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {combinedExpenseScenario.map((cat, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                              <div className="text-sm">
                                <div className="font-medium">{cat.category}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(cat.newAmount)}
                                </div>
                              </div>
                              <Badge variant="destructive" className="text-xs">
                                -{Math.abs(cat.changePercent).toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitForecast;