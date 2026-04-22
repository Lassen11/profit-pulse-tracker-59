import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface BusinessClientPaymentDraft {
  id?: string;
  service: string;
  amount: number;
  payment_date: string;
  is_paid?: boolean;
}

export interface BusinessClientWithPayments {
  id: string;
  name: string;
  inn: string | null;
  contact: string | null;
  payments: BusinessClientPaymentDraft[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: BusinessClientWithPayments | null;
  onSaved: () => void;
  userId: string;
}

export function BusinessClientDialog({ open, onOpenChange, client, onSaved, userId }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [inn, setInn] = useState("");
  const [contact, setContact] = useState("");
  const [payments, setPayments] = useState<BusinessClientPaymentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setName(client.name);
      setInn(client.inn ?? "");
      setContact(client.contact ?? "");
      setPayments(client.payments.length ? client.payments : [emptyPayment()]);
    } else {
      setName("");
      setInn("");
      setContact("");
      setPayments([emptyPayment()]);
    }
  }, [open, client]);

  const emptyPayment = (): BusinessClientPaymentDraft => ({
    service: "",
    amount: 0,
    payment_date: format(new Date(), "yyyy-MM-dd"),
    is_paid: false,
  });

  const updatePayment = (index: number, patch: Partial<BusinessClientPaymentDraft>) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const addPayment = () => setPayments((prev) => [...prev, emptyPayment()]);
  const removePayment = (index: number) =>
    setPayments((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Укажите название юр. лица", variant: "destructive" });
      return;
    }
    const validPayments = payments.filter((p) => p.service.trim() && p.amount > 0);
    setSaving(true);
    try {
      let clientId = client?.id;
      if (clientId) {
        const { error } = await supabase
          .from("business_clients")
          .update({ name, inn: inn || null, contact: contact || null })
          .eq("id", clientId);
        if (error) throw error;

        const existingIds = (client?.payments ?? [])
          .map((p) => p.id)
          .filter((x): x is string => !!x);
        const keptIds = validPayments.map((p) => p.id).filter((x): x is string => !!x);
        const toDelete = existingIds.filter((id) => !keptIds.includes(id));

        if (toDelete.length) {
          const { data: paid } = await supabase
            .from("business_client_payments")
            .select("transaction_id")
            .in("id", toDelete);
          const txIds = (paid ?? []).map((p) => p.transaction_id).filter(Boolean) as string[];
          if (txIds.length) {
            await supabase.from("transactions").delete().in("id", txIds);
          }
          await supabase.from("business_client_payments").delete().in("id", toDelete);
        }

        for (const p of validPayments) {
          if (p.id) {
            await supabase
              .from("business_client_payments")
              .update({
                service: p.service,
                amount: p.amount,
                payment_date: p.payment_date,
              })
              .eq("id", p.id);
          } else {
            await supabase.from("business_client_payments").insert({
              client_id: clientId,
              user_id: userId,
              service: p.service,
              amount: p.amount,
              payment_date: p.payment_date,
            });
          }
        }
      } else {
        const { data: newClient, error } = await supabase
          .from("business_clients")
          .insert({ user_id: userId, name, inn: inn || null, contact: contact || null })
          .select()
          .single();
        if (error) throw error;
        clientId = newClient.id;

        if (validPayments.length) {
          const rows = validPayments.map((p) => ({
            client_id: clientId!,
            user_id: userId,
            service: p.service,
            amount: p.amount,
            payment_date: p.payment_date,
          }));
          const { error: pErr } = await supabase.from("business_client_payments").insert(rows);
          if (pErr) throw pErr;
        }
      }
      toast({ title: client ? "Клиент обновлён" : "Клиент добавлен" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Редактировать клиента" : "Новый клиент"}</DialogTitle>
          <DialogDescription>Юридическое лицо и список платежей по услугам</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Название юр. лица *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО «...»" />
            </div>
            <div className="space-y-2">
              <Label>ИНН</Label>
              <Input value={inn} onChange={(e) => setInn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Контакт</Label>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон / e-mail" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Платежи (услуги)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPayment}>
                <Plus className="w-4 h-4 mr-1" /> Добавить платёж
              </Button>
            </div>
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_auto] gap-2 items-end p-3 rounded-md border bg-muted/30"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Услуга</Label>
                    <Input
                      value={p.service}
                      onChange={(e) => updatePayment(i, { service: e.target.value })}
                      placeholder="Название услуги"
                      disabled={p.is_paid}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Сумма ₽</Label>
                    <Input
                      type="number"
                      value={p.amount || ""}
                      onChange={(e) => updatePayment(i, { amount: Number(e.target.value) })}
                      disabled={p.is_paid}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Дата платежа</Label>
                    <Input
                      type="date"
                      value={p.payment_date}
                      onChange={(e) => updatePayment(i, { payment_date: e.target.value })}
                      disabled={p.is_paid}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePayment(i)}
                    disabled={p.is_paid}
                    title={p.is_paid ? "Сначала снимите отметку «Оплачено»" : "Удалить"}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет платежей. Добавьте хотя бы один.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
