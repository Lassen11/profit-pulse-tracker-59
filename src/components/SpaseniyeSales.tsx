import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { RefreshCw } from "lucide-react";

interface BankrotClient {
  id: string;
  full_name: string;
  contract_date: string | null;
  source: string | null;
  city: string | null;
  employee_id: string | null;
  manager: string | null;
  contract_amount: number;
  total_paid: number | null;
  installment_period: number;
  monthly_payment: number;
  created_at?: string;
  employee_name?: string;
}

interface SpaseniyeSalesProps {
  selectedMonth: string;
}

export function SpaseniyeSales({ selectedMonth }: SpaseniyeSalesProps) {
  const [clients, setClients] = useState<BankrotClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bankrot-clients', {
        body: { month: selectedMonth }
      });

      if (error) throw error;

      await fetchClients();
      
      toast({
        title: "Синхронизация завершена",
        description: data?.message || "Данные обновлены из bankrot-helper"
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Ошибка синхронизации",
        description: error.message || "Не удалось синхронизировать данные",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user, selectedMonth]);

  // Realtime subscription for bankrot_clients
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('spaseniye-sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bankrot_clients'
        },
        () => {
          fetchClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedMonth]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      
      // Parse selected month to get start and end dates
      const monthStart = new Date(selectedMonth);
      const monthEnd = new Date(selectedMonth);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // Last day of selected month
      
      const startDateStr = format(monthStart, 'yyyy-MM-dd');
      const endDateStr = format(monthEnd, 'yyyy-MM-dd');

      const { data: clientsData, error } = await supabase
        .from('bankrot_clients')
        .select('*')
        .gte('contract_date', startDateStr)
        .lte('contract_date', endDateStr)
        .order('contract_date', { ascending: false });

      if (error) throw error;

      // Fetch employee profiles for names
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name')
        .eq('is_active', true);

      const profileMap = new Map(
        profilesData?.map(p => [p.id, `${p.last_name} ${p.first_name} ${p.middle_name || ''}`.trim()]) || []
      );

      // Deduplicate clients by full_name and contract_date, keeping the record with most data
      const uniqueClientsMap = new Map<string, BankrotClient>();
      
      clientsData?.forEach(client => {
        const key = `${client.full_name}-${client.contract_date}`;
        const existing = uniqueClientsMap.get(key);
        
        // Keep the record with more filled fields (source, city, manager, monthly_payment)
        const existingScore = existing ? 
          (existing.source ? 1 : 0) + (existing.city ? 1 : 0) + (existing.manager ? 1 : 0) + (existing.monthly_payment > 0 ? 1 : 0) + (existing.installment_period > 0 ? 1 : 0) : 0;
        const newScore = 
          (client.source ? 1 : 0) + (client.city ? 1 : 0) + (client.manager ? 1 : 0) + (client.monthly_payment > 0 ? 1 : 0) + (client.installment_period > 0 ? 1 : 0);
        
        if (!existing || newScore > existingScore || (newScore === existingScore && new Date(client.created_at) > new Date(existing.created_at || ''))) {
          uniqueClientsMap.set(key, {
            ...client,
            employee_name: client.employee_id ? profileMap.get(client.employee_id) || '—' : '—'
          });
        }
      });

      const formattedClients = Array.from(uniqueClientsMap.values())
        .sort((a, b) => new Date(b.contract_date || '').getTime() - new Date(a.contract_date || '').getTime());

      setClients(formattedClients);
    } catch (error) {
      console.error('Error fetching bankrot clients:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные о клиентах Спасение",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Источники, для которых начисляется премия 4.5%
  const percentBonusSources = ['Авито', 'Сайт', 'Квиз', 'С улицы', 'Рекомендация менеджера', 'Рекомендация клиента'];
  // Источники с фиксированной премией (1000 или 2000 если 6+ рекомендаций у менеджера)
  const fixedBonusSources = ['Рекомендация Руководителя', 'Рекомендация ОЗ'];
  
  // Подсчитываем количество рекомендаций от фиксированных источников по менеджерам
  const managerFixedRecommendationsCount = clients.reduce((acc, client) => {
    if (client.manager && client.source && fixedBonusSources.includes(client.source)) {
      acc[client.manager] = (acc[client.manager] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const calculateBonus = (client: BankrotClient): number => {
    // Премия 4.5% для процентных источников
    if (client.source && percentBonusSources.includes(client.source)) {
      return client.contract_amount * 0.045;
    }
    // Фиксированная премия для рекомендаций
    if (client.source && fixedBonusSources.includes(client.source)) {
      const managerCount = client.manager ? managerFixedRecommendationsCount[client.manager] || 0 : 0;
      return managerCount >= 6 ? 2000 : 1000;
    }
    return 0;
  };

  const totalContractAmount = clients.reduce((sum, c) => sum + c.contract_amount, 0);
  const totalPaid = clients.reduce((sum, c) => sum + (c.total_paid || 0), 0);
  const totalMonthlyPayments = clients.reduce((sum, c) => sum + c.monthly_payment, 0);
  const totalBonuses = clients.reduce((sum, c) => sum + calculateBonus(c), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Продажи Спасение</h2>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронизация...' : 'Обновить из bankrot-helper'}
            </Button>
            <span className="text-muted-foreground">
              {format(new Date(selectedMonth), 'LLLL yyyy', { locale: ru })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Количество клиентов</div>
            <div className="text-2xl font-bold">{clients.length}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Сумма договоров</div>
            <div className="text-2xl font-bold">{formatCurrency(totalContractAmount)}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Оплачено</div>
            <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Ежемесячные платежи</div>
            <div className="text-2xl font-bold">{formatCurrency(totalMonthlyPayments)}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Премии (4.5%)</div>
            <div className="text-2xl font-bold">{formatCurrency(totalBonuses)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата договора</TableHead>
                <TableHead>ФИО клиента</TableHead>
                <TableHead>Источник</TableHead>
                <TableHead>Город</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Сотрудник ОЗ</TableHead>
                <TableHead className="text-right">Сумма договора</TableHead>
                <TableHead className="text-right">Оплачено</TableHead>
                <TableHead className="text-right">Срок рассрочки</TableHead>
                <TableHead className="text-right">Ежемес. платеж</TableHead>
                <TableHead className="text-right">Премия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                clients.map(client => (
                  <TableRow key={client.id}>
                    <TableCell>
                      {client.contract_date 
                        ? format(new Date(client.contract_date), 'dd MMM yyyy', { locale: ru })
                        : '—'
                      }
                    </TableCell>
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell>{client.source || '—'}</TableCell>
                    <TableCell>{client.city || '—'}</TableCell>
                    <TableCell>{client.manager || '—'}</TableCell>
                    <TableCell>{client.employee_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.contract_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.total_paid)}</TableCell>
                    <TableCell className="text-right">{client.installment_period} мес.</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.monthly_payment)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(calculateBonus(client))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
