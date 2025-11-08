import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DepartmentEmployee } from "@/components/DepartmentCard";

const accountOptions = [
  "Зайнаб карта",
  "Касса офис Диана",
  "Мариана Карта - депозит",
  "Карта Visa/Т-Банк (КИ)",
  "Наличные Сейф (КИ)",
  "Расчетный счет"
];

const paymentTypes = [
  { value: "white", label: "Белая зарплата" },
  { value: "gray", label: "Серая зарплата" },
  { value: "advance", label: "Аванс" },
  { value: "bonus", label: "Премия" },
  { value: "other", label: "Другое" }
];

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: DepartmentEmployee | null;
  onSuccess: () => void;
}

export function PaymentDialog({ open, onOpenChange, employee, onSuccess }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentType, setPaymentType] = useState("white");
  const [expenseAccount, setExpenseAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && employee) {
      // Auto-fill amount based on payment type
      setAmount("");
      setPaymentDate(new Date());
      setPaymentType("white");
      setExpenseAccount("");
      setNotes("");
    }
  }, [open, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !employee) return;

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректную сумму",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create transaction in transactions table
      const employeeCompany = (employee as any).company || 'Спасение';
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          date: format(paymentDate, 'yyyy-MM-dd'),
          type: 'expense',
          category: 'Зарплата',
          subcategory: `${employee.profiles.first_name} ${employee.profiles.last_name}`,
          amount: paymentAmount,
          description: notes || `Выплата зарплаты: ${paymentTypes.find(t => t.value === paymentType)?.label}`,
          expense_account: expenseAccount,
          company: employeeCompany
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Create payroll payment record
      const { error: paymentError } = await supabase
        .from('payroll_payments')
        .insert({
          user_id: user.id,
          department_employee_id: employee.id,
          amount: paymentAmount,
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          payment_type: paymentType,
          notes: notes,
          transaction_id: transactionData.id
        });

      if (paymentError) throw paymentError;

      toast({
        title: "Выплата проведена",
        description: `Выплата в размере ${new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB',
          minimumFractionDigits: 0
        }).format(paymentAmount)} успешно проведена`
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось провести выплату",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Выплата зарплаты: {employee.profiles.first_name} {employee.profiles.last_name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment_type">Тип выплаты</Label>
              <Select value={paymentType} onValueChange={setPaymentType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип выплаты" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Сумма</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Введите сумму"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Дата выплаты</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paymentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "d MMMM yyyy", { locale: ru }) : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => date && setPaymentDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_account">Счет списания</Label>
              <Select value={expenseAccount} onValueChange={setExpenseAccount} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((account) => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Примечание</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Дополнительная информация (необязательно)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Обработка..." : "Провести выплату"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
