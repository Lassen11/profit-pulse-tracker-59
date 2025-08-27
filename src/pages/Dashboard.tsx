import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KPICard } from "@/components/KPICard";
import { TransactionTable, Transaction } from "@/components/TransactionTable";
import { TransactionDialog } from "@/components/TransactionDialog";
import { MonthlyAnalytics } from "@/components/MonthlyAnalytics";
import { calculateKPIs } from "@/lib/supabaseData";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, ArrowUpFromLine, Wallet, LogOut, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [periodFilter, setPeriodFilter] = useState("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user && !loading) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch transactions from Supabase
  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        toast({
          title: "Ошибка загрузки",
          description: "Не удалось загрузить транзакции",
          variant: "destructive"
        });
        return;
      }

      setTransactions(data?.map(t => ({
        ...t,
        type: t.type as 'income' | 'expense'
      })) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Filter transactions based on selected period
  const getFilteredTransactions = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodFilter) {
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "quarter":
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case "year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "custom":
        if (!customDateFrom || !customDateTo) return transactions;
        startDate = customDateFrom;
        endDate = customDateTo;
        break;
      default:
        return transactions;
    }

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  const filteredTransactions = getFilteredTransactions();
  const kpis = calculateKPIs(filteredTransactions);

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
  const previousKpis = {
    income: 350000,
    expenses: 180000,
    profit: 170000,
    margin: 48.6,
    withdrawals: 75000,
    moneyInProject: 95000
  };

  const handleSaveTransaction = async (transactionData: Omit<Transaction, 'id'> & { id?: string }, taxTransaction?: Omit<Transaction, 'id'>) => {
    if (!user) return;

    if (transactionData.id) {
      // Update existing transaction
      try {
        const { error } = await supabase
          .from('transactions')
          .update({
            date: transactionData.date,
            type: transactionData.type,
            category: transactionData.category,
            subcategory: transactionData.subcategory,
            amount: transactionData.amount,
            description: transactionData.description,
            client_name: transactionData.client_name
          })
          .eq('id', transactionData.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setTransactions(prev => 
          prev.map(t => t.id === transactionData.id ? { ...transactionData, id: transactionData.id } as Transaction : t)
        );
        toast({
          title: "Операция обновлена",
          description: "Данные успешно сохранены",
        });
      } catch (error) {
        toast({
          title: "Ошибка обновления",
          description: "Не удалось обновить транзакцию",
          variant: "destructive"
        });
      }
    } else {
      // Create new transaction
      try {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            date: transactionData.date,
            type: transactionData.type,
            category: transactionData.category,
            subcategory: transactionData.subcategory,
            amount: transactionData.amount,
            description: transactionData.description,
            client_name: transactionData.client_name
          })
          .select()
          .single();

        if (error) throw error;

        const newTransaction: Transaction = {
          ...data,
          type: data.type as 'income' | 'expense'
        };
        
        const newTransactions = [newTransaction];

        // Создаем налоговую операцию если она указана
        if (taxTransaction) {
          const { data: taxData, error: taxError } = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              date: taxTransaction.date,
              type: taxTransaction.type,
              category: taxTransaction.category,
              subcategory: taxTransaction.subcategory,
              amount: taxTransaction.amount,
              description: taxTransaction.description
            })
            .select()
            .single();

          if (taxError) throw taxError;

          const newTaxTransaction: Transaction = {
            ...taxData,
            type: taxData.type as 'income' | 'expense'
          };
          newTransactions.push(newTaxTransaction);
        }

        setTransactions(prev => [...newTransactions, ...prev]);
        toast({
          title: taxTransaction ? "Операции добавлены" : "Операция добавлена",
          description: taxTransaction ? "Основная операция и налог успешно созданы" : "Новая транзакция успешно создана",
        });
      } catch (error) {
        toast({
          title: "Ошибка создания",
          description: "Не удалось создать транзакцию",
          variant: "destructive"
        });
      }
    }
    setEditTransaction(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить операцию "${transaction.description}" на сумму ${new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
      }).format(Math.abs(transaction.amount))}?`
    );

    if (confirmed) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;

        setTransactions(prev => prev.filter(t => t.id !== id));
        toast({
          title: "Операция удалена",
          description: "Транзакция была успешно удалена",
          variant: "destructive"
        });
      } catch (error) {
        toast({
          title: "Ошибка удаления",
          description: "Не удалось удалить транзакцию",
          variant: "destructive"
        });
      }
    }
  };

  const handleAddNew = () => {
    setEditTransaction(null);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">P&L Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Система отслеживания бизнес-метрик
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Текущий месяц</SelectItem>
                <SelectItem value="quarter">Квартал</SelectItem>
                <SelectItem value="year">Год</SelectItem>
                <SelectItem value="custom">Произвольный</SelectItem>
              </SelectContent>
            </Select>
            
            {periodFilter === "custom" && (
              <div className="flex items-center space-x-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-40 justify-start text-left font-normal",
                        !customDateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateFrom ? format(customDateFrom, "dd.MM.yyyy") : "От"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateFrom}
                      onSelect={setCustomDateFrom}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-40 justify-start text-left font-normal",
                        !customDateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateTo ? format(customDateTo, "dd.MM.yyyy") : "До"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDateTo}
                      onSelect={setCustomDateTo}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <Button onClick={handleAddNew} className="shadow-kpi">
              <Plus className="w-4 h-4 mr-2" />
              Добавить операцию
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <KPICard
            title="Выручка"
            value={formatCurrency(kpis.income)}
            delta={calculateDelta(kpis.income, previousKpis.income)}
            deltaType={getDeltaType(kpis.income, previousKpis.income)}
            icon={<TrendingUp className="w-6 h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Расходы"
            value={formatCurrency(kpis.expenses)}
            delta={calculateDelta(kpis.expenses, previousKpis.expenses)}
            deltaType={getDeltaType(previousKpis.expenses, kpis.expenses)} // Reversed for expenses
            icon={<TrendingDown className="w-6 h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Прибыль"
            value={formatCurrency(kpis.profit)}
            delta={calculateDelta(kpis.profit, previousKpis.profit)}
            deltaType={getDeltaType(kpis.profit, previousKpis.profit)}
            icon={<DollarSign className="w-6 h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Маржа"
            value={`${kpis.margin.toFixed(1)}%`}
            delta={calculateDelta(kpis.margin, previousKpis.margin)}
            deltaType={getDeltaType(kpis.margin, previousKpis.margin)}
            icon={<Target className="w-6 h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Вывод средств"
            value={formatCurrency(kpis.withdrawals)}
            delta={calculateDelta(kpis.withdrawals, previousKpis.withdrawals)}
            deltaType={getDeltaType(previousKpis.withdrawals, kpis.withdrawals)} // Reversed for withdrawals
            icon={<ArrowUpFromLine className="w-6 h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Деньги в проекте"
            value={formatCurrency(kpis.moneyInProject)}
            delta={calculateDelta(kpis.moneyInProject, previousKpis.moneyInProject)}
            deltaType={getDeltaType(kpis.moneyInProject, previousKpis.moneyInProject)}
            icon={<Wallet className="w-6 h-6" />}
            className="shadow-kpi"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Analytics Section */}
          <div className="lg:col-span-1">
            <MonthlyAnalytics transactions={filteredTransactions} />
          </div>

          {/* Transaction Table */}
          <div className="lg:col-span-2">
            <div className="kpi-card">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-card-foreground">
                  Операции
                </h2>
                <p className="text-muted-foreground text-sm">
                  Список всех финансовых операций
                </p>
              </div>
              <TransactionTable
                transactions={filteredTransactions}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
              />
            </div>
          </div>
        </div>

        {/* Transaction Dialog */}
        <TransactionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          transaction={editTransaction}
          onSave={handleSaveTransaction}
        />
      </div>
    </div>
  );
}
