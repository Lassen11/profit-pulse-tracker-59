import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { MonthlyAnalytics } from "@/components/MonthlyAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionTable } from "@/components/TransactionTable";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { calculateKPIs } from "@/lib/supabaseData";
import { TrendingUp, TrendingDown, DollarSign, Target, ArrowUpFromLine, Wallet, ArrowLeft, Building2, CalendarIcon, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Transaction } from "@/components/TransactionTable";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const companies = ["Спасение", "Дело Бизнеса", "Кебаб Босс"] as const;

export default function AllProjects() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([...companies]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
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

  // Filtered transactions based on company and date filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesCompany = selectedCompanies.includes(t.company);
      const transactionDate = new Date(t.date);
      const matchesDateFrom = !dateFrom || transactionDate >= dateFrom;
      const matchesDateTo = !dateTo || transactionDate <= dateTo;
      return matchesCompany && matchesDateFrom && matchesDateTo;
    });
  }, [transactions, selectedCompanies, dateFrom, dateTo]);

  // Calculate KPIs for all companies combined
  const allKpis = useMemo(() => calculateKPIs(filteredTransactions), [filteredTransactions]);

  // Calculate KPIs by company
  const companiesKpis = useMemo(() => {
    return companies.map(company => {
      const companyTransactions = filteredTransactions.filter(t => t.company === company);
      return {
        company,
        kpis: calculateKPIs(companyTransactions),
        transactionsCount: companyTransactions.length
      };
    });
  }, [filteredTransactions]);

  const toggleCompany = (company: string) => {
    setSelectedCompanies(prev =>
      prev.includes(company)
        ? prev.filter(c => c !== company)
        : [...prev, company]
    );
  };

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

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Фильтры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Company Filters */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Компании</Label>
                <div className="space-y-2">
                  {companies.map((company) => (
                    <div key={company} className="flex items-center space-x-2">
                      <Checkbox
                        id={company}
                        checked={selectedCompanies.includes(company)}
                        onCheckedChange={() => toggleCompany(company)}
                      />
                      <Label htmlFor={company} className="cursor-pointer">
                        {company}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Filters */}
              <div className="flex-1 space-y-3">
                <Label className="text-sm font-medium">Период</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-48 justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "От"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-48 justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd.MM.yyyy") : "До"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    Сбросить
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <MonthlyAnalytics transactions={filteredTransactions} />
              </CardContent>
            </Card>

            {/* All Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle>Все операции ({filteredTransactions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionTable transactions={filteredTransactions} showFilters={true} />
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