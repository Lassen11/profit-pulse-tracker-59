import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DepartmentEmployee } from "@/components/DepartmentCard";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Trash2 } from "lucide-react";

interface PaymentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: DepartmentEmployee | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  notes: string | null;
  created_at: string;
  transaction_id: string | null;
}

export function PaymentHistoryDialog({ open, onOpenChange, employee }: PaymentHistoryDialogProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && employee) {
      fetchPayments();
    }
  }, [open, employee]);

  const fetchPayments = async () => {
    if (!employee) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payroll_payments')
        .select('*')
        .eq('department_employee_id', employee.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить историю выплат",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getPaymentTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      white: "Белая зарплата",
      gray: "Серая зарплата",
      advance: "Аванс",
      bonus: "Премия"
    };
    return types[type] || type;
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;

    const payment = payments.find(p => p.id === deletePaymentId);
    if (!payment) return;

    try {
      setDeleting(true);

      // Сначала удаляем связанную транзакцию, если она есть
      if (payment.transaction_id) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', payment.transaction_id);

        if (transactionError) {
          console.error('Error deleting transaction:', transactionError);
          throw new Error('Не удалось удалить связанную транзакцию');
        }
      }

      // Затем удаляем саму выплату
      const { error: paymentError } = await supabase
        .from('payroll_payments')
        .delete()
        .eq('id', deletePaymentId);

      if (paymentError) throw paymentError;

      toast({
        title: "Выплата удалена",
        description: "Выплата и связанная транзакция успешно удалены"
      });

      // Обновляем список выплат
      await fetchPayments();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить выплату",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setDeletePaymentId(null);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            История выплат: {employee.profiles.first_name} {employee.profiles.last_name}
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>История выплат пуста</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата выплаты</TableHead>
                  <TableHead>Тип выплаты</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Примечания</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {format(new Date(payment.payment_date), 'dd MMMM yyyy', { locale: ru })}
                    </TableCell>
                    <TableCell>{getPaymentTypeLabel(payment.payment_type)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {payment.notes || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePaymentId(payment.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Всего выплат: {payments.length}</span>
            <span className="font-semibold">
              Итого: {formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
            </span>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={deletePaymentId !== null} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выплату?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Выплата и связанная с ней транзакция будут удалены навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
