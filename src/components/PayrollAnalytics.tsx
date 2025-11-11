import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  employee_name: string;
  department_name: string;
}

export function PayrollAnalytics() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      
      const { data: paymentsData, error } = await supabase
        .from('payroll_payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_type,
          department_employees!inner(
            id,
            employee_id,
            department_id,
            departments!inner(name)
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const { data: employeesData } = await supabase
        .from('department_employees')
        .select('id, employee_id');

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name');

      const employeeMap = new Map(
        employeesData?.map(e => [e.id, e.employee_id]) || []
      );

      const profileMap = new Map(
        profilesData?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []
      );

      const formattedPayments: PaymentRecord[] = paymentsData?.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_type: payment.payment_type,
        employee_name: profileMap.get(employeeMap.get(payment.department_employees.id) || '') || 'Неизвестный',
        department_name: payment.department_employees.departments?.name || 'Неизвестный отдел'
      })) || [];

      setPayments(formattedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const matchesEmployee = selectedEmployee === "all" || payment.employee_name === selectedEmployee;
      const matchesStartDate = !startDate || payment.payment_date >= startDate;
      const matchesEndDate = !endDate || payment.payment_date <= endDate;
      return matchesEmployee && matchesStartDate && matchesEndDate;
    });
  }, [payments, selectedEmployee, startDate, endDate]);

  const uniqueEmployees = useMemo(() => {
    return Array.from(new Set(payments.map(p => p.employee_name)));
  }, [payments]);

  const totalPaid = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      white_salary: 'Белая ЗП',
      gray_salary: 'Серая ЗП',
      bonus: 'Премия',
      advance: 'Аванс'
    };
    return labels[type] || type;
  };

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
        <h2 className="text-2xl font-bold mb-6">Аналитика выплат</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label>Сотрудник</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Все сотрудники" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {uniqueEmployees.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Дата начала</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Дата окончания</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-6 p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Всего выплачено</div>
          <div className="text-3xl font-bold">{formatCurrency(totalPaid)}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Количество выплат: {filteredPayments.length}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Отдел</TableHead>
              <TableHead>Тип выплаты</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map(payment => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: ru })}
                  </TableCell>
                  <TableCell>{payment.employee_name}</TableCell>
                  <TableCell>{payment.department_name}</TableCell>
                  <TableCell>{getPaymentTypeLabel(payment.payment_type)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}