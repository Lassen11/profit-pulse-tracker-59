import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PaymentReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  service: string;
  clientName: string;
  onConfirm: (account: string, paidAt: string) => Promise<void>;
}

export function PaymentReceiveDialog({
  open,
  onOpenChange,
  amount,
  service,
  clientName,
  onConfirm,
}: PaymentReceiveDialogProps) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<string[]>([]);
  const [account, setAccount] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loadAccounts = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("name, company")
        .eq("is_active", true)
        .or("company.eq.Дело Бизнеса,company.is.null")
        .order("display_order");
      if (error) {
        console.error("Error loading accounts:", error);
        return;
      }
      const names = (data ?? []).map((a) => a.name);
      setAccounts(names);
      if (names.length && !account) setAccount(names[0]);
    };
    loadAccounts();
    setPaidAt(format(new Date(), "yyyy-MM-dd"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = async () => {
    if (!account) {
      toast({ title: "Выберите счёт", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await onConfirm(account, paidAt);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Зачислить платёж</DialogTitle>
          <DialogDescription>
            {clientName} — {service}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Сумма</Label>
            <Input value={new Intl.NumberFormat("ru-RU").format(amount) + " ₽"} disabled />
          </div>
          <div className="space-y-2">
            <Label>Счёт зачисления</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите счёт" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Дата зачисления</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !account}>
            {loading ? "Зачисление..." : "Зачислить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
