import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KPICard } from "@/components/KPICard";
import { TransactionTable, Transaction } from "@/components/TransactionTable";
import { TransactionDialog } from "@/components/TransactionDialog";
import { MonthlyAnalytics } from "@/components/MonthlyAnalytics";
import { mockTransactions, calculateKPIs } from "@/lib/mockData";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [periodFilter, setPeriodFilter] = useState("month");
  const { toast } = useToast();

  const kpis = calculateKPIs(transactions);

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
    margin: 48.6
  };

  const handleSaveTransaction = (transactionData: Omit<Transaction, 'id'> & { id?: number }) => {
    if (transactionData.id) {
      // Edit existing transaction
      setTransactions(prev => 
        prev.map(t => t.id === transactionData.id ? { ...transactionData, id: transactionData.id } as Transaction : t)
      );
      toast({
        title: "Операция обновлена",
        description: "Данные успешно сохранены",
      });
    } else {
      // Add new transaction
      const newTransaction: Transaction = {
        ...transactionData,
        id: Math.max(...transactions.map(t => t.id)) + 1
      };
      setTransactions(prev => [newTransaction, ...prev]);
      toast({
        title: "Операция добавлена",
        description: "Новая транзакция успешно создана",
      });
    }
    setEditTransaction(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setDialogOpen(true);
  };

  const handleDeleteTransaction = (id: number) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить операцию "${transaction.description}" на сумму ${new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
      }).format(Math.abs(transaction.amount))}?`
    );

    if (confirmed) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      toast({
        title: "Операция удалена",
        description: "Транзакция была успешно удалена",
        variant: "destructive"
      });
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
              </SelectContent>
            </Select>
            <Button onClick={handleAddNew} className="shadow-kpi">
              <Plus className="w-4 h-4 mr-2" />
              Добавить операцию
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Analytics Section */}
          <div className="lg:col-span-1">
            <MonthlyAnalytics transactions={transactions} />
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
                transactions={transactions}
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