import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, ArrowLeft, User, DollarSign, Calendar, Clock, XCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@/components/TransactionTable";

interface ClientData {
  clientName: string;
  contractAmount: number;
  firstPayment: number;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchClientsData();
    }
  }, [user]);

  const fetchClientsData = async () => {
    if (!user) return;

    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('category', 'Продажи')
        .not('client_name', 'is', null)
        .order('date', { ascending: false });

      if (error) {
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

  const filteredClients = clients.filter(client =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
  const totalRemaining = clients.reduce((sum, client) => sum + client.remainingAmount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка данных клиентов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к панели
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Клиенты и рассрочки</h1>
              <p className="text-muted-foreground mt-1">
                Управление клиентскими договорами и отслеживание платежей
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего договоров</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContracts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Сумма договоров</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalContractAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Уже оплачено</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">К доплате</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalRemaining)}</div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО Клиента</TableHead>
                  <TableHead className="text-right">Сумма договора</TableHead>
                  <TableHead className="text-right">Первый платеж</TableHead>
                  <TableHead className="text-center">Срок (мес.)</TableHead>
                  <TableHead className="text-right">Оплачено</TableHead>
                  <TableHead className="text-right">Остаток</TableHead>
                  <TableHead>Последний платеж</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="text-center">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{client.clientName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.contractAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.firstPayment)}</TableCell>
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

            {filteredClients.length === 0 && (
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