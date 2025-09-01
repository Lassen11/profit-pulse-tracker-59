import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KPICard } from "@/components/KPICard";
import { TransactionTable, Transaction } from "@/components/TransactionTable";
import { TransactionDialog } from "@/components/TransactionDialog";
import { MonthlyAnalytics } from "@/components/MonthlyAnalytics";
import { calculateKPIs } from "@/lib/supabaseData";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, ArrowUpFromLine, Wallet, LogOut, CalendarIcon, Users, Upload, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

const companies = ["Спасение", "Дело Бизнеса", "Кебаб Босс"] as const;

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [copyMode, setCopyMode] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [importMonth, setImportMonth] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] = useState<string>("Спасение");
  const { toast } = useToast();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Optimized fetch with caching and debouncing
  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Cache check - don't refetch if data is fresh (less than 30 seconds old) AND we have data for current company
    const now = Date.now();
    const hasDataForCompany = transactions.length > 0 && transactions[0]?.company === selectedCompany;
    if (hasDataForCompany && (now - lastFetchTime) < 30000) {
      console.log('Using cached data for company:', selectedCompany);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Load all transactions for the user and selected company
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('company', selectedCompany)
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
      setLastFetchTime(now);

    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      
      if (error.message?.includes('Failed to fetch') || error.code === '') {
        setError("Проблема с подключением к интернету");
        toast({
          title: "Ошибка подключения", 
          description: "Проверьте интернет-соединение",
          variant: "destructive"
        });
      } else {
        setError("Ошибка загрузки данных");
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить транзакции",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, toast]);

  // Load older transactions in background
  const loadOlderTransactions = useCallback(async () => {
    if (!user) return;
    
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('company', selectedCompany)
        .lt('date', threeMonthsAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (data && data.length > 0) {
        const olderTransactions = data.map(t => ({
          ...t,
          type: t.type as 'income' | 'expense'
        }));
        
        setTransactions(prev => [...prev, ...olderTransactions]);
      }
    } catch (error) {
      console.error('Error loading older transactions:', error);
    }
  }, [user, selectedCompany]);

  // Fetch transactions from Supabase
  useEffect(() => {
    if (user) {
      fetchTransactions();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchTransactions]);

  // Refetch when company changes
  useEffect(() => {
    if (user && selectedCompany) {
      setLastFetchTime(0); // Force refresh when company changes
      setTransactions([]); // Clear current transactions
      fetchTransactions();
    }
  }, [selectedCompany, user, fetchTransactions]);

  const handleRetry = () => {
    setLastFetchTime(0); // Force refresh
    fetchTransactions();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Memoized filtered transactions for better performance
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (periodFilter) {
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "specific-month":
        startDate = startOfMonth(selectedMonth);
        endDate = endOfMonth(selectedMonth);
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
  }, [transactions, periodFilter, customDateFrom, customDateTo, selectedMonth]);

  const kpis = useMemo(() => calculateKPIs(filteredTransactions), [filteredTransactions]);

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
            client_name: transactionData.client_name,
            contract_amount: transactionData.contract_amount,
            first_payment: transactionData.first_payment,
            installment_period: transactionData.installment_period,
            lump_sum: transactionData.lump_sum,
            company: selectedCompany
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
            client_name: transactionData.client_name,
            contract_amount: transactionData.contract_amount,
            first_payment: transactionData.first_payment,
            installment_period: transactionData.installment_period,
            lump_sum: transactionData.lump_sum,
            company: selectedCompany
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
              description: taxTransaction.description,
              company: selectedCompany
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
    setCopyMode(false);
    setDialogOpen(true);
  };

  const handleCopyTransaction = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setCopyMode(true);
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
    setCopyMode(false);
    setDialogOpen(true);
  };

  const handleExportToExcel = () => {
    
    // Преобразуем данные для экспорта
    const exportData = filteredTransactions.map(transaction => ({
      'Дата': format(new Date(transaction.date), 'dd.MM.yyyy'),
      'Тип': transaction.type === 'income' ? 'Доход' : 'Расход',
      'Категория': transaction.category,
      'Подкатегория': transaction.subcategory || '',
      'Клиент': transaction.client_name || '',
      'Сумма': transaction.amount,
      'Описание': transaction.description || '',
      'Период рассрочки': transaction.installment_period || '',
      'Сумма договора': transaction.contract_amount || '',
      'Первый взнос': transaction.first_payment || ''
    }));

    // Создаем workbook и worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Настраиваем ширину колонок
    const colWidths = [
      { wch: 12 }, // Дата
      { wch: 8 },  // Тип
      { wch: 20 }, // Категория
      { wch: 20 }, // Подкатегория
      { wch: 25 }, // Клиент
      { wch: 15 }, // Сумма
      { wch: 30 }, // Описание
      { wch: 15 }, // Период рассрочки
      { wch: 15 }, // Сумма договора
      { wch: 15 }  // Первый взнос
    ];
    ws['!cols'] = colWidths;

    // Добавляем worksheet в workbook
    XLSX.utils.book_append_sheet(wb, ws, "Транзакции");

    // Генерируем имя файла с текущей датой
    const fileName = `transactions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    // Сохраняем файл
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Экспорт завершен",
      description: `Файл ${fileName} успешно сохранен`,
    });
  };

  const handleImportFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            const rowData = row as any;
            
            // Парсим данные из Excel
            const date = parseExcelDate(rowData['Дата'] || rowData['date']);
            const type = parseTransactionType(rowData['Тип'] || rowData['type']);
            const category = rowData['Категория'] || rowData['category'] || '';
            const subcategory = rowData['Подкатегория'] || rowData['subcategory'] || null;
            const amount = parseFloat(rowData['Сумма'] || rowData['amount'] || '0');
            const description = rowData['Описание'] || rowData['description'] || null;
            const clientName = rowData['Клиент'] || rowData['client_name'] || null;
            const contractAmount = parseFloat(rowData['Сумма договора'] || rowData['contract_amount'] || '0') || null;
            const firstPayment = parseFloat(rowData['Первый взнос'] || rowData['first_payment'] || '0') || null;
            const installmentPeriod = parseInt(rowData['Период рассрочки'] || rowData['installment_period'] || '0') || null;

            if (!date || !type || !category || amount === 0) {
              errorCount++;
              continue;
            }

            // Устанавливаем дату на выбранный месяц, сохраняя день
            const importDate = new Date(importMonth);
            importDate.setDate(date.getDate());
            // Убеждаемся, что дата корректная (если день больше количества дней в месяце)
            if (importDate.getMonth() !== importMonth.getMonth()) {
              importDate.setDate(1);
            }
            
            // Создаем транзакцию в базе данных
            const { error } = await supabase
              .from('transactions')
              .insert({
                user_id: user.id,
                date: format(importDate, 'yyyy-MM-dd'),
                type,
                category,
                subcategory,
                amount,
                description,
                client_name: clientName,
                contract_amount: contractAmount,
                first_payment: firstPayment,
                installment_period: installmentPeriod
              });

            if (error) {
              errorCount++;
            } else {
              successCount++;
            }
          } catch (error) {
            errorCount++;
          }
        }

        // Обновляем список транзакций
        await fetchTransactions();

        // Автоматически переключаемся на просмотр импортированного месяца
        setPeriodFilter("specific-month");
        setSelectedMonth(importMonth);

        toast({
          title: "Импорт завершен",
          description: `Успешно импортировано: ${successCount}, ошибок: ${errorCount}`,
        });

        // Очищаем input
        event.target.value = '';
      } catch (error) {
        toast({
          title: "Ошибка импорта",
          description: "Не удалось прочитать файл Excel",
          variant: "destructive"
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Вспомогательные функции для парсинга данных
  const parseExcelDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    // Если это Excel серийный номер даты
    if (typeof dateValue === 'number') {
      return new Date((dateValue - 25569) * 86400 * 1000);
    }
    
    // Если это строка в формате DD.MM.YYYY
    if (typeof dateValue === 'string') {
      const parts = dateValue.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // месяцы в JS начинаются с 0
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    
    // Пытаемся парсить как обычную дату
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseTransactionType = (typeValue: any): 'income' | 'expense' | null => {
    if (!typeValue) return null;
    
    const type = typeValue.toString().toLowerCase();
    if (type.includes('доход') || type.includes('income')) return 'income';
    if (type.includes('расход') || type.includes('expense')) return 'expense';
    
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm sm:text-base">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-4 text-sm sm:text-base">{error}</p>
          <Button onClick={handleRetry} className="w-full sm:w-auto">
            Повторить попытку
          </Button>
        </div>
      </div>
    );
  }

  try {
    return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">P&L Tracker</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Система отслеживания бизнес-метрик
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Выберите компанию" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddNew} className="shadow-kpi">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Добавить операцию</span>
              <span className="xs:hidden">Добавить</span>
            </Button>
            <Button variant="outline" onClick={() => navigate("/clients")}>
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Клиенты</span>
              <span className="xs:hidden">Клиенты</span>
            </Button>
            <Button variant="outline" onClick={() => navigate("/all-projects")}>
              <Building2 className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Все проекты</span>
              <span className="xs:hidden">Проекты</span>
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Выйти</span>
              <span className="xs:hidden">Выйти</span>
            </Button>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-4">
          <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value)}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue placeholder="Выберите период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Текущий месяц</SelectItem>
              <SelectItem value="specific-month">Конкретный месяц</SelectItem>
              <SelectItem value="quarter">Текущий квартал</SelectItem>
              <SelectItem value="year">Текущий год</SelectItem>
              <SelectItem value="custom">Произвольный период</SelectItem>
            </SelectContent>
          </Select>

          {periodFilter === "specific-month" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full lg:w-64 justify-start text-left font-normal",
                    !selectedMonth && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedMonth ? format(selectedMonth, "MMMM yyyy") : <span>Выберите месяц</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          {periodFilter === "custom" && (
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-40 justify-start text-left font-normal",
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
                      "w-full sm:w-40 justify-start text-left font-normal",
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

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Upload className="w-4 h-4 mr-2" />
                    <span className="hidden xs:inline">Импорт из Excel</span>
                    <span className="xs:hidden">Импорт</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Выберите месяц для импорта</h4>
                      <p className="text-sm text-muted-foreground">
                        Данные будут импортированы в выбранный месяц
                      </p>
                    </div>
                    <Calendar
                      mode="single"
                      selected={importMonth}
                      onSelect={(date) => date && setImportMonth(date)}
                      className="rounded-md border"
                    />
                    <div>
                      <label htmlFor="excel-import" className="text-sm font-medium">
                        Выберите Excel файл
                      </label>
                      <input
                        id="excel-import"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportFromExcel}
                        className="mt-2 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <Button variant="outline" onClick={handleExportToExcel} className="flex-1 sm:flex-none">
              <TrendingUp className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Экспорт в Excel</span>
              <span className="xs:hidden">Экспорт</span>
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
          <KPICard
            title="Выручка"
            value={formatCurrency(kpis.income)}
            delta={calculateDelta(kpis.income, previousKpis.income)}
            deltaType={getDeltaType(kpis.income, previousKpis.income)}
            icon={<TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Расходы"
            value={formatCurrency(kpis.expenses)}
            delta={calculateDelta(kpis.expenses, previousKpis.expenses)}
            deltaType={getDeltaType(previousKpis.expenses, kpis.expenses)} // Reversed for expenses
            icon={<TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Прибыль"
            value={formatCurrency(kpis.profit)}
            delta={calculateDelta(kpis.profit, previousKpis.profit)}
            deltaType={getDeltaType(kpis.profit, previousKpis.profit)}
            icon={<DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Маржа"
            value={`${kpis.margin.toFixed(1)}%`}
            delta={calculateDelta(kpis.margin, previousKpis.margin)}
            deltaType={getDeltaType(kpis.margin, previousKpis.margin)}
            icon={<Target className="w-5 h-5 sm:w-6 sm:h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Вывод средств"
            value={formatCurrency(kpis.withdrawals)}
            delta={calculateDelta(kpis.withdrawals, previousKpis.withdrawals)}
            deltaType={getDeltaType(previousKpis.withdrawals, kpis.withdrawals)} // Reversed for withdrawals
            icon={<ArrowUpFromLine className="w-5 h-5 sm:w-6 sm:h-6" />}
            className="shadow-kpi"
          />
          <KPICard
            title="Деньги в проекте"
            value={formatCurrency(kpis.moneyInProject)}
            delta={calculateDelta(kpis.moneyInProject, previousKpis.moneyInProject)}
            deltaType={getDeltaType(kpis.moneyInProject, previousKpis.moneyInProject)}
            icon={<Wallet className="w-5 h-5 sm:w-6 sm:h-6" />}
            className="shadow-kpi"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          {/* Analytics Section */}
          <div className="xl:col-span-1 order-2 xl:order-1">
            <MonthlyAnalytics transactions={filteredTransactions} />
          </div>

          {/* Transaction Table */}
          <div className="xl:col-span-2 order-1 xl:order-2">
            <div className="kpi-card">
              <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-card-foreground">
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
                onCopy={handleCopyTransaction}
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
          copyMode={copyMode}
        />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Dashboard render error:', error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Произошла ошибка при отображении данных</p>
          <Button onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </Button>
        </div>
      </div>
    );
  }
}
