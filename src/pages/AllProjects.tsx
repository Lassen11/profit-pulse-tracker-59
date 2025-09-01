import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { MonthlyAnalytics } from "@/components/MonthlyAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateKPIs } from "@/lib/supabaseData";
import { TrendingUp, TrendingDown, DollarSign, Target, ArrowUpFromLine, Wallet, ArrowLeft, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Transaction } from "@/components/TransactionTable";

const companies = ["Спасение", "Дело Бизнеса", "Кебаб Босс"] as const;

export default function AllProjects() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch all transactions for all companies
  useEffect(() => {
    const fetchAllTransactions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        const formattedData = data?.map(t => ({
          ...t,
          type: t.type as 'income' | 'expense'
        })) || [];

        setTransactions(formattedData);

      } catch (error: any) {
        console.error('Error fetching transactions:', error);
        setError("Ошибка загрузки данных");
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить транзакции",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchAllTransactions();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, toast]);

  // Calculate KPIs for all companies combined
  const allKpis = useMemo(() => calculateKPIs(transactions), [transactions]);

  // Calculate KPIs by company
  const companiesKpis = useMemo(() => {
    return companies.map(company => {
      const companyTransactions = transactions.filter(t => t.company === company);
      return {
        company,
        kpis: calculateKPIs(companyTransactions),
        transactionsCount: companyTransactions.length
      };
    });
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDeltaType = (current: number, previous: number): 'positive' | 'negative' | 'neutral' => {
    if (current > previous) return 'positive';
    if (current < previous) return 'negative';
    return 'neutral';
  };

  const calculateDelta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "▲ ∞%" : "—";
    const delta = ((current - previous) / Math.abs(previous)) * 100;
    const arrow = delta >= 0 ? "▲" : "▼";
    return `${arrow} ${Math.abs(delta).toFixed(1)}%`;
  };

  // Mock previous period data for delta calculation
  const previousAllKpis = {
    income: 850000,
    expenses: 430000,
    profit: 420000,
    margin: 49.4,
    withdrawals: 180000,
    moneyInProject: 240000
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-8 h-8" />
                Все проекты
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Общая аналитика по всем компаниям
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Общий обзор</TabsTrigger>
            <TabsTrigger value="companies">По компаниям</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Overall KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICard
                title="Общий доход"
                value={formatCurrency(allKpis.income)}
                delta={calculateDelta(allKpis.income, previousAllKpis.income)}
                deltaType={getDeltaType(allKpis.income, previousAllKpis.income)}
                icon={<DollarSign className="w-4 h-4" />}
              />
              <KPICard
                title="Общие расходы"
                value={formatCurrency(allKpis.expenses)}
                delta={calculateDelta(allKpis.expenses, previousAllKpis.expenses)}
                deltaType={getDeltaType(previousAllKpis.expenses, allKpis.expenses)}
                icon={<TrendingDown className="w-4 h-4" />}
              />
              <KPICard
                title="Общая прибыль"
                value={formatCurrency(allKpis.profit)}
                delta={calculateDelta(allKpis.profit, previousAllKpis.profit)}
                deltaType={getDeltaType(allKpis.profit, previousAllKpis.profit)}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <KPICard
                title="Общая маржа"
                value={`${allKpis.margin.toFixed(1)}%`}
                delta={calculateDelta(allKpis.margin, previousAllKpis.margin)}
                deltaType={getDeltaType(allKpis.margin, previousAllKpis.margin)}
                icon={<Target className="w-4 h-4" />}
              />
              <KPICard
                title="Общие выводы"
                value={formatCurrency(allKpis.withdrawals)}
                delta={calculateDelta(allKpis.withdrawals, previousAllKpis.withdrawals)}
                deltaType={getDeltaType(previousAllKpis.withdrawals, allKpis.withdrawals)}
                icon={<ArrowUpFromLine className="w-4 h-4" />}
              />
              <KPICard
                title="Деньги в проектах"
                value={formatCurrency(allKpis.moneyInProject)}
                delta={calculateDelta(allKpis.moneyInProject, previousAllKpis.moneyInProject)}
                deltaType={getDeltaType(allKpis.moneyInProject, previousAllKpis.moneyInProject)}
                icon={<Wallet className="w-4 h-4" />}
              />
            </div>

            {/* Analytics Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Общая аналитика по месяцам</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyAnalytics transactions={transactions} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies" className="space-y-6">
            <div className="grid gap-6">
              {companiesKpis.map(({ company, kpis, transactionsCount }) => (
                <Card key={company}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{company}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {transactionsCount} операций
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Доход</p>
                        <p className="text-xl font-semibold">{formatCurrency(kpis.income)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Расходы</p>
                        <p className="text-xl font-semibold">{formatCurrency(kpis.expenses)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Прибыль</p>
                        <p className="text-xl font-semibold">{formatCurrency(kpis.profit)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Маржа</p>
                        <p className="text-xl font-semibold">{kpis.margin.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Выводы</p>
                        <p className="text-xl font-semibold">{formatCurrency(kpis.withdrawals)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">В проекте</p>
                        <p className="text-xl font-semibold">{formatCurrency(kpis.moneyInProject)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}