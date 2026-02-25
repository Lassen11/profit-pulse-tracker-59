import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Pencil, X, CheckCheck, XCircle, Check, RotateCcw } from "lucide-react";

interface SalesManager {
  id: string;
  name: string;
}

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
  bonus_confirmed: boolean;
  manual_bonus: number | null;
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
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingManager, setEditingManager] = useState("");
  const [salesManagers, setSalesManagers] = useState<SalesManager[]>([]);
  const [editingBonusClientId, setEditingBonusClientId] = useState<string | null>(null);
  const [editingBonusValue, setEditingBonusValue] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  // Загружаем менеджеров из отдела продаж
  useEffect(() => {
    const fetchSalesManagers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('department', 'Отдел продаж')
        .eq('is_active', true);

      if (data) {
        setSalesManagers(data.map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim()
        })));
      }
    };
    fetchSalesManagers();
  }, []);

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

  const handleEditManager = (client: BankrotClient) => {
    setEditingClientId(client.id);
    setEditingManager(client.manager || "");
  };

  const handleCancelEdit = () => {
    setEditingClientId(null);
    setEditingManager("");
  };

  const handleSaveManager = async (clientId: string, managerValue?: string) => {
    const managerToSave = managerValue !== undefined ? managerValue : editingManager;
    const finalManager = managerToSave === "__clear__" ? null : (managerToSave.trim() || null);
    
    try {
      const { error } = await supabase
        .from('bankrot_clients')
        .update({ manager: finalManager })
        .eq('id', clientId);

      if (error) throw error;

      // Обновляем локальное состояние
      setClients(prev => prev.map(c => 
        c.id === clientId ? { ...c, manager: finalManager } : c
      ));

      toast({
        title: "Менеджер обновлён",
        description: "Данные успешно сохранены"
      });

      setEditingClientId(null);
      setEditingManager("");
    } catch (error) {
      console.error('Error updating manager:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить менеджера",
        variant: "destructive"
      });
    }
  };

  const handleToggleBonusConfirmed = async (clientId: string, confirmed: boolean) => {
    try {
      const { error } = await supabase
        .from('bankrot_clients')
        .update({ bonus_confirmed: confirmed } as any)
        .eq('id', clientId);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, bonus_confirmed: confirmed } : c
      ));

      toast({
        title: confirmed ? "Премия подтверждена" : "Подтверждение отменено",
        description: confirmed ? "Премия будет перенесена в ФОТ" : "Премия не будет перенесена в ФОТ"
      });
    } catch (error) {
      console.error('Error updating bonus_confirmed:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус премии",
        variant: "destructive"
      });
    }
  };

  const handleEditBonus = (client: BankrotClient) => {
    setEditingBonusClientId(client.id);
    const currentBonus = client.manual_bonus !== null ? client.manual_bonus : calculateAutoBonus(client);
    setEditingBonusValue(Math.round(currentBonus).toString());
  };

  const handleSaveBonus = async (clientId: string) => {
    const value = parseFloat(editingBonusValue);
    if (isNaN(value) || value < 0) return;

    try {
      const { error } = await supabase
        .from('bankrot_clients')
        .update({ manual_bonus: value } as any)
        .eq('id', clientId);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, manual_bonus: value } : c
      ));

      toast({ title: "Премия обновлена" });
      setEditingBonusClientId(null);
    } catch (error) {
      console.error('Error updating manual_bonus:', error);
      toast({ title: "Ошибка", description: "Не удалось обновить премию", variant: "destructive" });
    }
  };

  const handleResetBonus = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('bankrot_clients')
        .update({ manual_bonus: null } as any)
        .eq('id', clientId);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, manual_bonus: null } : c
      ));

      toast({ title: "Премия сброшена к авторасчёту" });
      setEditingBonusClientId(null);
    } catch (error) {
      console.error('Error resetting manual_bonus:', error);
      toast({ title: "Ошибка", description: "Не удалось сбросить премию", variant: "destructive" });
    }
  };



  const handleBulkBonusConfirm = async (confirmed: boolean) => {
    const idsToUpdate = clientsWithBonus
      .filter(c => c.bonus_confirmed !== confirmed)
      .map(c => c.id);

    if (idsToUpdate.length === 0) return;

    try {
      const { error } = await supabase
        .from('bankrot_clients')
        .update({ bonus_confirmed: confirmed } as any)
        .in('id', idsToUpdate);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        idsToUpdate.includes(c.id) ? { ...c, bonus_confirmed: confirmed } : c
      ));

      toast({
        title: confirmed ? "Все премии подтверждены" : "Все подтверждения отменены",
        description: `Обновлено записей: ${idsToUpdate.length}`
      });
    } catch (error) {
      console.error('Error bulk updating bonus_confirmed:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статусы премий",
        variant: "destructive"
      });
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
  
  const calculateAutoBonus = (client: BankrotClient): number => {
    if (!client.manager) return 0;
    if (client.source && percentBonusSources.includes(client.source)) {
      return client.contract_amount * 0.045;
    }
    if (client.source && fixedBonusSources.includes(client.source)) {
      const managerCount = managerFixedRecommendationsCount[client.manager] || 0;
      return managerCount >= 6 ? 2000 : 1000;
    }
    return 0;
  };

  const calculateBonus = (client: BankrotClient): number => {
    if (client.manual_bonus !== null && client.manual_bonus !== undefined) {
      return client.manual_bonus;
    }
    return calculateAutoBonus(client);
  };

  // Clients with bonuses for bulk actions
  const clientsWithBonus = clients.filter(c => calculateBonus(c) > 0);
  const allConfirmed = clientsWithBonus.length > 0 && clientsWithBonus.every(c => c.bonus_confirmed);
  const someConfirmed = clientsWithBonus.some(c => c.bonus_confirmed);

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
            {clientsWithBonus.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkBonusConfirm(true)}
                  disabled={allConfirmed}
                  className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Подтвердить все
                </Button>
                {someConfirmed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkBonusConfirm(false)}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Отменить все
                  </Button>
                )}
              </>
            )}
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
                <TableHead className="text-center">✓</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                clients.map(client => {
                  const bonus = calculateBonus(client);
                  const hasBonus = bonus > 0;
                  const rowClass = hasBonus
                    ? client.bonus_confirmed
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "bg-amber-50/50 dark:bg-amber-950/20"
                    : "";
                  return (
                  <TableRow key={client.id} className={rowClass}>
                    <TableCell>
                      {client.contract_date 
                        ? format(new Date(client.contract_date), 'dd MMM yyyy', { locale: ru })
                        : '—'
                      }
                    </TableCell>
                    <TableCell className="font-medium">{client.full_name}</TableCell>
                    <TableCell>{client.source || '—'}</TableCell>
                    <TableCell>{client.city || '—'}</TableCell>
                    <TableCell>
                      {editingClientId === client.id ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={editingManager}
                            onValueChange={(value) => {
                              setEditingManager(value);
                              // Сразу сохраняем при выборе
                              handleSaveManager(client.id, value);
                            }}
                          >
                            <SelectTrigger className="h-8 w-40">
                              <SelectValue placeholder="Выберите менеджера" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="__clear__">— Очистить —</SelectItem>
                              {salesManagers.map((manager) => (
                                <SelectItem key={manager.id} value={manager.name}>
                                  {manager.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span>{client.manager || '—'}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleEditManager(client)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{client.employee_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.contract_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.total_paid)}</TableCell>
                    <TableCell className="text-right">{client.installment_period} мес.</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.monthly_payment)}</TableCell>
                    <TableCell className="text-right">
                      {editingBonusClientId === client.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            className="h-8 w-24 text-right"
                            value={editingBonusValue}
                            onChange={(e) => setEditingBonusValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveBonus(client.id);
                              if (e.key === 'Escape') setEditingBonusClientId(null);
                            }}
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveBonus(client.id)}>
                            <Check className="h-3 w-3 text-emerald-600" />
                          </Button>
                          {client.manual_bonus !== null && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResetBonus(client.id)} title="Сбросить к авторасчёту">
                              <RotateCcw className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingBonusClientId(null)}>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 group cursor-pointer" onClick={() => handleEditBonus(client)}>
                          <span className={client.manual_bonus !== null ? "text-primary font-medium" : ""}>
                            {formatCurrency(calculateBonus(client))}
                          </span>
                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasBonus && (
                        <Checkbox
                          checked={client.bonus_confirmed}
                          onCheckedChange={(checked) => handleToggleBonusConfirmed(client.id, !!checked)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
