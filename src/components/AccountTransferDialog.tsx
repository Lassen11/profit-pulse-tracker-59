import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AccountTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: string[];
  selectedAccount?: string;
  onSave: (transfer: AccountTransfer) => void;
}

export interface AccountTransfer {
  fromAccount: string;
  toAccount: string;
  amount: number;
  date: string;
  description: string;
}

export function AccountTransferDialog({
  open,
  onOpenChange,
  accounts,
  selectedAccount,
  onSave,
}: AccountTransferDialogProps) {
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      if (selectedAccount) {
        setFromAccount(selectedAccount);
      } else {
        setFromAccount("");
      }
      setToAccount("");
      setAmount("");
      setDate(new Date().toISOString().split('T')[0]);
      setDescription("");
    }
  }, [open, selectedAccount]);

  const handleSubmit = () => {
    if (!fromAccount || !toAccount || !amount || fromAccount === toAccount) {
      return;
    }

    onSave({
      fromAccount,
      toAccount,
      amount: parseFloat(amount),
      date,
      description,
    });

    onOpenChange(false);
  };

  const filteredToAccounts = accounts.filter(acc => acc !== fromAccount);
  const filteredFromAccounts = accounts.filter(acc => acc !== toAccount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Транзакция между счетами</DialogTitle>
          <DialogDescription>
            Перевод денег между счетами компании
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="from-account">Со счета</Label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger id="from-account">
                <SelectValue placeholder="Выберите счет списания" />
              </SelectTrigger>
              <SelectContent>
                {filteredFromAccounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="to-account">На счет</Label>
            <Select value={toAccount} onValueChange={setToAccount}>
              <SelectTrigger id="to-account">
                <SelectValue placeholder="Выберите счет зачисления" />
              </SelectTrigger>
              <SelectContent>
                {filteredToAccounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Сумма</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Введите сумму"
              min="0"
              step="0.01"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Комментарий к переводу"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!fromAccount || !toAccount || !amount || fromAccount === toAccount || parseFloat(amount) <= 0}
          >
            Выполнить перевод
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
