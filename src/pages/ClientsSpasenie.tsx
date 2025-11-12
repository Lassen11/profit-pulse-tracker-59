import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowLeft, User, DollarSign, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface ClientData {
  clientName: string;
  organizationName?: string;
  contractAmount: number;
  totalPaid: number;
  remainingAmount: number;
  lastPaymentDate: string;
  paymentsCount: number;
  transactions: any[];
}

export default function ClientsSpasenie() {
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
      // Получаем все транзакции для клиентов Спасение
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('company', 'Спасение')
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
          // Ищем первую транзакцию с данными договора (категория "Продажа")
          const contractTransaction = transactions?.find(t => 
            t.client_name === clientName && 
            t.category === 'Продажа' &&
            t.contract_amount
          );

          clientsMap.set(clientName, {
            clientName,
            organizationName: contractTransaction?.organization_name,
            contractAmount: contractTransaction?.contract_amount || 0,
            totalPaid: 0,
            remainingAmount: 0,
            lastPaymentDate: transaction.date,
            paymentsCount: 0,
            transactions: []
          });
        }

        const clientData = clientsMap.get(clientName);
        if (clientData) {
          clientData.transactions.push(transaction);
          clientData.totalPaid += transaction.amount;
          clientData.paymentsCount++;
          
          // Обновляем дату последнего платежа
          if (new Date(transaction.date) > new Date(clientData.lastPaymentDate)) {
            clientData.lastPaymentDate = transaction.date;
          }
        }
      });

      // Рассчитываем остатки для каждого клиента
      const clientsArray = Array.from(clientsMap.values()).map(client => {
        client.remainingAmount = client.contractAmount - client.totalPaid;
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
      client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.organizationName?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0;

      let aValue = a[sortField];
      let bValue = b[sortField];

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const totalClients = clients.length;
  const totalContractAmount = clients.reduce((sum, client) => sum + client.contractAmount, 0);
  const totalPaid = clients.reduce((sum, client) => sum + client.totalPaid, 0);
  const totalRemaining = clients.reduce((sum, client) => sum + client.remainingAmount, 0);
  const totalPayments = clients.reduce((sum, client) => sum + client.paymentsCount, 0);

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
              <Button variant="outline" onClick={() => navigate("/clients")} size="sm">
                <Building2 className="w-4 h-4 mr-2" />
                <span className="hidden xs:inline">Дело бизнеса</span>
                <span className="xs:hidden">ДБ</span>
              </Button>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Клиенты Спасение</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Клиенты из приложения bankrot-helper
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего клиентов</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{totalClients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Сумма договоров</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm lg:text-base font-bold break-words" title={formatCurrency(totalContractAmount)}>
                {formatCurrency(totalContractAmount)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Оплачено</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm lg:text-base font-bold text-green-600 break-words" title={formatCurrency(totalPaid)}>
                {formatCurrency(totalPaid)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Остаток</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm lg:text-base font-bold text-orange-600 break-words" title={formatCurrency(totalRemaining)}>
                {formatCurrency(totalRemaining)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего платежей</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{totalPayments}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Список клиентов</CardTitle>
            <CardDescription>
              Подробная информация по клиентам из приложения bankrot-helper
            </CardDescription>
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени клиента или организации..."
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
                    <TableHead>Организация</TableHead>
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
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('paymentsCount')}
                        className="h-auto p-0 font-medium hover:bg-transparent"
                      >
                        Платежей
                        {getSortIcon('paymentsCount')}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "Клиенты не найдены" : "Нет клиентов"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedClients.map((client, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell>{client.organizationName || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(client.contractAmount)}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(client.totalPaid)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">
                          {formatCurrency(client.remainingAmount)}
                        </TableCell>
                        <TableCell className="text-right">{client.paymentsCount}</TableCell>
                        <TableCell>{formatDate(client.lastPaymentDate)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {filteredAndSortedClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Клиенты не найдены" : "Нет клиентов"}
                </div>
              ) : (
                filteredAndSortedClients.map((client, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-base">{client.clientName}</CardTitle>
                      {client.organizationName && (
                        <CardDescription>{client.organizationName}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Сумма договора:</span>
                        <span className="font-medium">{formatCurrency(client.contractAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Оплачено:</span>
                        <span className="font-medium text-green-600">{formatCurrency(client.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Остаток:</span>
                        <span className="font-medium text-orange-600">{formatCurrency(client.remainingAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Платежей:</span>
                        <span className="font-medium">{client.paymentsCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Последний платеж:</span>
                        <span className="font-medium">{formatDate(client.lastPaymentDate)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
