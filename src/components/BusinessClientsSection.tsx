import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Pencil, Trash2, X, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { BusinessClientDialog, BusinessClientWithPayments } from "./BusinessClientDialog";
import { PaymentReceiveDialog } from "./PaymentReceiveDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  userId: string;
  canEdit: boolean;
}

interface Payment {
  id: string;
  client_id: string;
  service: string;
  amount: number;
  payment_date: string;
  is_paid: boolean;
  paid_account: string | null;
  paid_at: string | null;
  transaction_id: string | null;
}

interface Client {
  id: string;
  name: string;
  inn: string | null;
  contact: string | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);

export function BusinessClientsSection({ userId, canEdit }: Props) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<BusinessClientWithPayments | null>(null);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [activePayment, setActivePayment] = useState<{ payment: Payment; client: Client } | null>(null);

  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [unmarkPayment, setUnmarkPayment] = useState<Payment | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cData, error: cErr }, { data: pData, error: pErr }] = await Promise.all([
      supabase.from("business_clients").select("*").order("created_at", { ascending: false }),
      supabase.from("business_client_payments").select("*").order("payment_date", { ascending: true }),
    ]);
    if (cErr || pErr) {
      console.error(cErr || pErr);
      toast({ title: "Ошибка загрузки клиентов", variant: "destructive" });
    } else {
      setClients(cData ?? []);
      setPayments(pData ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("business-clients-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "business_clients" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_client_payments" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const openNew = () => {
    setEditClient(null);
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    const clientPayments = payments
      .filter((p) => p.client_id === client.id)
      .map((p) => ({
        id: p.id,
        service: p.service,
        amount: p.amount,
        payment_date: p.payment_date,
        is_paid: p.is_paid,
      }));
    setEditClient({ ...client, payments: clientPayments });
    setDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!deleteClientId) return;
    // Remove linked transactions first
    const linkedTxIds = payments
      .filter((p) => p.client_id === deleteClientId && p.transaction_id)
      .map((p) => p.transaction_id!) as string[];
    if (linkedTxIds.length) {
      await supabase.from("transactions").delete().in("id", linkedTxIds);
    }
    const { error } = await supabase.from("business_clients").delete().eq("id", deleteClientId);
    if (error) {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Клиент удалён" });
    }
    setDeleteClientId(null);
  };

  const handleTogglePaid = (payment: Payment, client: Client) => {
    if (!payment.is_paid) {
      setActivePayment({ payment, client });
      setReceiveOpen(true);
    } else {
      setUnmarkPayment(payment);
    }
  };

  const unmarkPaid = async (payment: Payment) => {
    try {
      if (payment.transaction_id) {
        await supabase.from("transactions").delete().eq("id", payment.transaction_id);
      }
      const { error } = await supabase
        .from("business_client_payments")
        .update({ is_paid: false, paid_account: null, paid_at: null, transaction_id: null })
        .eq("id", payment.id);
      if (error) throw error;
      toast({ title: "Отметка снята", description: "Транзакция удалена, баланс восстановлен" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const createNextMonthPayment = async (payment: Payment) => {
    try {
      const nextDate = format(addMonths(parseISO(payment.payment_date), 1), "yyyy-MM-dd");
      // Avoid duplicating if a payment already exists with the same service+date
      const exists = payments.some(
        (p) =>
          p.client_id === payment.client_id &&
          p.service === payment.service &&
          p.payment_date === nextDate
      );
      if (exists) {
        toast({ title: "Платёж на этот месяц уже существует" });
        return;
      }
      const { error } = await supabase.from("business_client_payments").insert({
        client_id: payment.client_id,
        user_id: userId,
        service: payment.service,
        amount: payment.amount,
        payment_date: nextDate,
      });
      if (error) throw error;
      toast({
        title: "Платёж создан",
        description: `${payment.service} — ${format(parseISO(nextDate), "d MMM yyyy", { locale: ru })}`,
      });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const confirmReceive = async (account: string, paidAt: string) => {
    if (!activePayment) return;
    const { payment, client } = activePayment;
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        company: "Дело Бизнеса",
        type: "income",
        category: "Продажи",
        amount: payment.amount,
        date: paidAt,
        income_account: account,
        organization_name: client.name,
        client_name: client.name,
        description: payment.service,
      })
      .select()
      .single();
    if (txErr || !tx) {
      toast({ title: "Не удалось создать транзакцию", description: txErr?.message, variant: "destructive" });
      throw txErr;
    }
    const { error: updErr } = await supabase
      .from("business_client_payments")
      .update({ is_paid: true, paid_account: account, paid_at: paidAt, transaction_id: tx.id })
      .eq("id", payment.id);
    if (updErr) {
      // rollback transaction
      await supabase.from("transactions").delete().eq("id", tx.id);
      toast({ title: "Ошибка", description: updErr.message, variant: "destructive" });
      throw updErr;
    }
    toast({ title: "Платёж зачислен", description: `${client.name} — ${formatCurrency(payment.amount)}` });
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter === "paid" && !p.is_paid) return false;
      if (statusFilter === "unpaid" && p.is_paid) return false;
      if (dateFrom && p.payment_date < dateFrom) return false;
      if (dateTo && p.payment_date > dateTo) return false;
      return true;
    });
  }, [payments, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = statusFilter !== "all" || !!dateFrom || !!dateTo;

  const totals = useMemo(() => {
    const paid = filteredPayments.filter((p) => p.is_paid).reduce((s, p) => s + Number(p.amount), 0);
    const unpaid = filteredPayments.filter((p) => !p.is_paid).reduce((s, p) => s + Number(p.amount), 0);
    return { paid, unpaid, count: filteredPayments.length };
  }, [filteredPayments]);

  const rows = clients.flatMap((client) => {
    const list = filteredPayments.filter((p) => p.client_id === client.id);
    if (list.length === 0) {
      // hide empty clients when any filter is active
      if (hasActiveFilters) return [];
      return [{ key: client.id + "-empty", client, payment: null as Payment | null, isFirst: true, rowSpan: 1 }];
    }
    return list.map((p, idx) => ({
      key: p.id,
      client,
      payment: p,
      isFirst: idx === 0,
      rowSpan: list.length,
    }));
  });

  const resetFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="kpi-card">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-card-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Клиенты (юр. лица)
          </h2>
          <p className="text-muted-foreground text-sm">Услуги и платежи по компании Дело Бизнеса</p>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Добавить клиента
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-[200px_180px_180px_auto_1fr] gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Статус оплаты</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="unpaid">Не оплачено</SelectItem>
              <SelectItem value="paid">Оплачено</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Дата платежа с</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">по</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="w-4 h-4 mr-1" /> Сбросить
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          Платежей: <span className="font-medium text-foreground">{totals.count}</span>
          {" • "}Не оплачено:{" "}
          <span className="font-medium text-destructive">{formatCurrency(totals.unpaid)}</span>
          {" • "}Оплачено:{" "}
          <span className="font-medium text-primary">
            {formatCurrency(totals.paid)}
          </span>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Юр. лицо</TableHead>
              <TableHead>Услуга</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Дата платежа</TableHead>
              <TableHead>Статус</TableHead>
              {canEdit && <TableHead className="w-[120px] text-right">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground py-8">
                  Клиенты не добавлены
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  {row.isFirst && (
                    <TableCell rowSpan={row.rowSpan} className="align-top font-medium">
                      <div>{row.client.name}</div>
                      {row.client.inn && (
                        <div className="text-xs text-muted-foreground">ИНН: {row.client.inn}</div>
                      )}
                      {row.client.contact && (
                        <div className="text-xs text-muted-foreground">{row.client.contact}</div>
                      )}
                    </TableCell>
                  )}
                  {row.payment ? (
                    <>
                      <TableCell>{row.payment.service}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.payment.amount)}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(row.payment.payment_date), "d MMM yyyy", { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={row.payment.is_paid}
                            onCheckedChange={() => canEdit && handleTogglePaid(row.payment!, row.client)}
                            disabled={!canEdit}
                          />
                          {row.payment.is_paid ? (
                            <div className="flex flex-col">
                              <Badge variant="default" className="w-fit">Оплачено</Badge>
                              {row.payment.paid_at && (
                                <span className="text-xs text-muted-foreground mt-1">
                                  {format(parseISO(row.payment.paid_at), "d MMM yyyy", { locale: ru })}
                                  {row.payment.paid_account && ` • ${row.payment.paid_account}`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary">Не оплачено</Badge>
                          )}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={4} className="text-muted-foreground italic">
                      Нет платежей
                    </TableCell>
                  )}
                  {canEdit && row.isFirst && (
                    <TableCell rowSpan={row.rowSpan} className="align-top text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row.client)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteClientId(row.client.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <BusinessClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editClient}
        onSaved={load}
        userId={userId}
      />

      {activePayment && (
        <PaymentReceiveDialog
          open={receiveOpen}
          onOpenChange={(open) => {
            setReceiveOpen(open);
            if (!open) setActivePayment(null);
          }}
          amount={activePayment.payment.amount}
          service={activePayment.payment.service}
          clientName={activePayment.client.name}
          onConfirm={confirmReceive}
        />
      )}

      <AlertDialog open={!!deleteClientId} onOpenChange={(o) => !o && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены все платежи клиента и связанные с оплаченными платежами транзакции
              (балансы счетов восстановятся).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unmarkPayment} onOpenChange={(o) => !o && setUnmarkPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Снять отметку «Оплачено»?</AlertDialogTitle>
            <AlertDialogDescription>
              {unmarkPayment && (
                <>
                  Будет удалена связанная транзакция на сумму{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(unmarkPayment.amount)}
                  </span>
                  {unmarkPayment.paid_account && (
                    <> со счёта <span className="font-medium text-foreground">{unmarkPayment.paid_account}</span></>
                  )}
                  . Баланс счёта будет пересчитан автоматически.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (unmarkPayment) await unmarkPaid(unmarkPayment);
                setUnmarkPayment(null);
              }}
            >
              Снять отметку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
