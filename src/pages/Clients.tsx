import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, ArrowLeft, User, DollarSign, Calendar, Clock, XCircle, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, Activity, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@/components/TransactionTable";

interface ClientData {
  clientName: string;
  contractAmount: number;
  firstPayment: number;
  lumpSum: number;
  installmentPeriod: number;
  totalPaid: number;
  remainingAmount: number;
  lastPaymentDate: string;
  status: 'active' | 'completed' | 'overdue' | 'terminated';
  contractStatus: 'active' | 'terminated';
  terminationDate?: string;
  transactions: Transaction[];
}

export default function Clients() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof ClientData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchClientsData();
    } else {
      // If there's no user, we don't need to keep loading
      setLoading(false);
    }
  }, [user]);

  const fetchClientsData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('category', 'Продажи')
        .not('client_name', 'is', null)
        .order('date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        toast({
          title: "Ошибка загрузки",
          description: "Не удалось загрузить данные клиентов",
          variant: "destructive"
        });
        return;
      }

      // Группируем транзакции по клиентам
      const clientsMap = new Map<string, ClientData>();

      transactions?.forEach((transaction) => {
        const clientName = transaction.client_name!;
        
        if (!clientsMap.has(clientName)) {
          // Ищем первую транзакцию с данными договора для этого клиента
          const contractTransaction = transactions?.find(t => 
            t.client_name === clientName && 
            t.contract_amount && 
            t.first_payment !== undefined && 
            t.installment_period
          );

          if (contractTransaction) {
            clientsMap.set(clientName, {
              clientName,
              contractAmount: contractTransaction.contract_amount || 0,
              firstPayment: contractTransaction.first_payment || 0,
              lumpSum: (contractTransaction as any).lump_sum || 0,
              installmentPeriod: contractTransaction.installment_period || 0,
              totalPaid: 0,
              remainingAmount: 0,
              lastPaymentDate: transaction.date,
              status: 'active',
              contractStatus: (contractTransaction.contract_status as 'active' | 'terminated') || 'active',
              terminationDate: contractTransaction.termination_date || undefined,
              transactions: []
            });
          }
        }

        const clientData = clientsMap.get(clientName);
        if (clientData) {
          clientData.transactions.push(transaction as Transaction);
          clientData.totalPaid += transaction.amount;
          
          // Обновляем дату последнего платежа
          if (new Date(transaction.date) > new Date(clientData.lastPaymentDate)) {
            clientData.lastPaymentDate = transaction.date;
          }
        }
      });

      // Рассчитываем остатки и статусы для каждого клиента
      const clientsArray = Array.from(clientsMap.values()).map(client => {
        client.remainingAmount = client.contractAmount - client.totalPaid;
        
        // Определяем статус
        if (client.contractStatus === 'terminated') {
          client.status = 'terminated';
        } else if (client.remainingAmount <= 0) {
          client.status = 'completed';
        } else {
          // Проверяем, не просрочена ли рассрочка
          const lastPayment = new Date(client.lastPaymentDate);
          const monthsSinceLastPayment = Math.floor((Date.now() - lastPayment.getTime()) / (1000 * 60 * 60 * 24 * 30));
          
          if (monthsSinceLastPayment > client.installmentPeriod) {
            client.status = 'overdue';
          } else {
            client.status = 'active';
          }
        }

        return client;
      });

      setClients(clientsArray);
    } catch (error) {
      console.error('Error fetching clients data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof ClientData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof ClientData) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const filteredAndSortedClients = clients
    .filter(client =>
      client.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0;

      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: ClientData['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Оплачен</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Просрочен</Badge>;
      case 'terminated':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Расторгнут</Badge>;
      case 'active':
      default:
        return <Badge variant="secondary">Активен</Badge>;
    }
  };

  const handleTerminateContract = async (clientName: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ 
          contract_status: 'terminated',
          termination_date: new Date().toISOString().split('T')[0]
        })
        .eq('user_id', user?.id)
        .eq('client_name', clientName);

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось расторгнуть договор",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Договор расторгнут",
        description: `Договор с ${clientName} успешно расторгнут`,
      });

      // Обновляем данные
      fetchClientsData();
    } catch (error) {
      console.error('Error terminating contract:', error);
    }
  };

  const handleReactivateContract = async (clientName: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ 
          contract_status: 'active',
          termination_date: null
        })
        .eq('user_id', user?.id)
        .eq('client_name', clientName);

      if (error) {
        toast({
          title: "Ошибка",
          description: "Не удалось восстановить договор",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Договор восстановлен",
        description: `Договор с ${clientName} успешно восстановлен`,
      });

      // Обновляем данные
      fetchClientsData();
    } catch (error) {
      console.error('Error reactivating contract:', error);
    }
  };

  const totalContracts = clients.length;
  const totalContractAmount = clients.reduce((sum, client) => sum + client.contractAmount, 0);
  const totalPaid = clients.reduce((sum, client) => sum + client.totalPaid, 0);
  // Исключаем расторгнутые договоры из расчета суммы к доплате
  const totalRemaining = clients
    .filter(client => client.contractStatus !== 'terminated')
    .reduce((sum, client) => sum + client.remainingAmount, 0);
  
  // Новые показатели
  const totalTerminated = clients.filter(client => client.contractStatus === 'terminated').length;
  const totalCompleted = clients.filter(client => client.status === 'completed').length;
  const totalInProgress = clients.filter(client => client.contractStatus !== 'terminated' && client.status !== 'completed').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm sm:text-base">Загрузка данных клиентов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={() => navigate("/")} size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden xs:inline">Назад к панели</span>
                <span className="xs:hidden">Назад</span>
              </Button>
              <Button variant="outline" onClick={() => navigate("/all-projects")} size="sm">
                <Building2 className="w-4 h-4 mr-2" />
                <span className="hidden xs:inline">Все проекты</span>
                <span className="xs:hidden">Проекты</span>
              </Button>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Клиенты и рассрочки</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Управление клиентскими договорами и отслеживание платежей
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего договоров</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{totalContracts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Сумма договоров</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm lg:text-base font-bold break-words" title={formatCurrency(totalContractAmount)}>{formatCurrency(totalContractAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Уже оплачено</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm lg:text-base font-bold text-green-600 break-words" title={formatCurrency(totalPaid)}>{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">К доплате</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm lg:text-base font-bold text-orange-600 break-words" title={formatCurrency(totalRemaining)}>{formatCurrency(totalRemaining)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">В Работе</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">{totalInProgress}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Расторги</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">{totalTerminated}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Завершенные</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">{totalCompleted}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Список клиентов</CardTitle>
            <CardDescription>
              Подробная информация по всем клиентам и их рассрочкам
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени клиента..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('clientName')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        ФИО Клиента
                        {getSortIcon('clientName')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('contractAmount')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Сумма договора
                        {getSortIcon('contractAmount')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('firstPayment')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Первый платеж
                        {getSortIcon('firstPayment')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">ЕП</TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('installmentPeriod')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Срок (мес.)
                        {getSortIcon('installmentPeriod')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('totalPaid')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Оплачено
                        {getSortIcon('totalPaid')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('remainingAmount')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Остаток
                        {getSortIcon('remainingAmount')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('lastPaymentDate')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Последний платеж
                        {getSortIcon('lastPaymentDate')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('status')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Статус
                        {getSortIcon('status')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedClients.map((client, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(client.contractAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(client.firstPayment)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(client.lumpSum)}</TableCell>
                      <TableCell className="text-center">{client.installmentPeriod}</TableCell>
                      <TableCell className="text-right text-green-600 font-semibold">
                        {formatCurrency(client.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600 font-semibold">
                        {formatCurrency(client.remainingAmount)}
                      </TableCell>
                      <TableCell>
                        {new Date(client.lastPaymentDate).toLocaleDateString('ru-RU')}
                        {client.terminationDate && (
                          <div className="text-xs text-red-600">
                            Расторгнут: {new Date(client.terminationDate).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(client.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {client.contractStatus === 'active' ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <XCircle className="w-4 h-4 mr-1" />
                                Расторгнуть
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Расторжение договора</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Вы уверены, что хотите расторгнуть договор с {client.clientName}? 
                                  Это действие можно будет отменить позже.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleTerminateContract(client.clientName)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Расторгнуть договор
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Восстановить
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Восстановление договора</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Вы уверены, что хотите восстановить договор с {client.clientName}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleReactivateContract(client.clientName)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Восстановить договор
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="block lg:hidden space-y-4">
              {filteredAndSortedClients.map((client, index) => (
                <div key={index} className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{client.clientName}</h3>
                    {getStatusBadge(client.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Сумма договора:</span>
                        <span className="font-medium">{formatCurrency(client.contractAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Первый платеж:</span>
                        <span className="font-medium">{formatCurrency(client.firstPayment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ЕП:</span>
                        <span className="font-medium">{formatCurrency(client.lumpSum)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Срок:</span>
                        <span className="font-medium">{client.installmentPeriod} мес.</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Оплачено:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(client.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Остаток:</span>
                        <span className="font-semibold text-orange-600">{formatCurrency(client.remainingAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Последний платеж:</span>
                        <span className="font-medium text-xs">{new Date(client.lastPaymentDate).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {client.terminationDate && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      Расторгнут: {new Date(client.terminationDate).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                  
                  <div className="flex justify-end pt-2 border-t">
                    {client.contractStatus === 'active' ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <XCircle className="w-4 h-4 mr-2" />
                            Расторгнуть
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Расторжение договора</AlertDialogTitle>
                            <AlertDialogDescription>
                              Вы уверены, что хотите расторгнуть договор с {client.clientName}? 
                              Это действие можно будет отменить позже.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleTerminateContract(client.clientName)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Расторгнуть договор
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Восстановить
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Восстановление договора</AlertDialogTitle>
                            <AlertDialogDescription>
                              Вы уверены, что хотите восстановить договор с {client.clientName}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleReactivateContract(client.clientName)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Восстановить договор
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredAndSortedClients.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Клиенты не найдены" : "Нет данных о клиентах с рассрочкой"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}