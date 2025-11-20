import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Wallet, History } from "lucide-react";
import { DepartmentEmployee } from "@/components/DepartmentCard";
import { EmployeeDialog } from "@/components/EmployeeDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { PaymentHistoryDialog } from "@/components/PaymentHistoryDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePersistedDialog } from "@/hooks/useDialogPersistence";
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

interface PayrollTableProps {
  employees: DepartmentEmployee[];
  departmentId: string;
  onRefresh: () => void;
  defaultCompany?: string;
}

export function PayrollTable({ employees, departmentId, onRefresh, defaultCompany = "Спасение" }: PayrollTableProps) {
  const [editEmployee, setEditEmployee] = useState<DepartmentEmployee | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEmployeeForPayment, setSelectedEmployeeForPayment] = useState<DepartmentEmployee | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<DepartmentEmployee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  // Dialog persistence hooks
  const paymentDialogPersistence = usePersistedDialog<{ employeeId: string }>({
    key: "payroll-last-payment",
    onRestore: (data) => {
      const employee = employees.find(e => e.id === data.employeeId);
      if (employee) {
        setSelectedEmployeeForPayment(employee);
        setPaymentDialogOpen(true);
      }
    }
  });

  const employeeDialogPersistence = usePersistedDialog<{ employeeId: string }>({
    key: "payroll-employee-dialog",
    onRestore: (data) => {
      const employee = employees.find(e => e.id === data.employeeId);
      if (employee) {
        setEditEmployee(employee);
        setEmployeeDialogOpen(true);
      }
    }
  });

  const historyDialogPersistence = usePersistedDialog<{ employeeId: string }>({
    key: "payroll-history-dialog",
    onRestore: (data) => {
      const employee = employees.find(e => e.id === data.employeeId);
      if (employee) {
        setSelectedEmployeeForHistory(employee);
        setHistoryDialogOpen(true);
      }
    }
  });

  // Restore dialog states on mount
  useEffect(() => {
    paymentDialogPersistence.restoreDialog();
    employeeDialogPersistence.restoreDialog();
    historyDialogPersistence.restoreDialog();
  }, [employees]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleEdit = (employee: DepartmentEmployee) => {
    setEditEmployee(employee);
    setEmployeeDialogOpen(true);
    employeeDialogPersistence.openDialog({ employeeId: employee.id });
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;

    try {
      const { error } = await supabase
        .from('department_employees')
        .delete()
        .eq('id', employeeToDelete);

      if (error) throw error;

      toast({
        title: "Сотрудник удален",
        description: "Сотрудник успешно удален из отдела"
      });

      onRefresh();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить сотрудника",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    }
  };

  const handlePayment = (employee: DepartmentEmployee) => {
    setSelectedEmployeeForPayment(employee);
    setPaymentDialogOpen(true);
    paymentDialogPersistence.openDialog({ employeeId: employee.id });
  };

  const handleViewHistory = (employee: DepartmentEmployee) => {
    setSelectedEmployeeForHistory(employee);
    setHistoryDialogOpen(true);
    historyDialogPersistence.openDialog({ employeeId: employee.id });
  };

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">Сотрудник</TableHead>
              <TableHead className="min-w-[120px]">Проект</TableHead>
              <TableHead className="text-right min-w-[120px]">Общая сумма</TableHead>
              <TableHead className="text-right min-w-[100px]">Белая</TableHead>
              <TableHead className="text-right min-w-[100px]">Серая</TableHead>
              <TableHead className="text-right min-w-[100px]">Аванс</TableHead>
              <TableHead className="text-right min-w-[100px]">НДФЛ</TableHead>
              <TableHead className="text-right min-w-[100px]">Взносы</TableHead>
              <TableHead className="text-right min-w-[100px]">Премия</TableHead>
              <TableHead className="text-right min-w-[120px]">Премия сл. мес</TableHead>
              <TableHead className="text-right min-w-[100px]">Стоимость</TableHead>
              <TableHead className="text-right min-w-[100px]">На руки</TableHead>
              <TableHead className="text-right min-w-[150px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={2}>Итого:</TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.total_amount || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.paid_white || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.paid_gray || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.paid_advance || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.ndfl || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.contributions || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.paid_bonus || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.next_month_bonus || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.cost || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.net_salary || 0), 0))}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">
                  <div>
                    <div>{employee.profiles.first_name} {employee.profiles.last_name}</div>
                    {employee.profiles.position && (
                      <div className="text-xs text-muted-foreground">{employee.profiles.position}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{employee.company}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(employee.total_amount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.paid_white || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.paid_gray || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.paid_advance || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.ndfl)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.contributions)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.paid_bonus || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.next_month_bonus)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.cost)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.net_salary)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePayment(employee)}
                    >
                      <Wallet className="h-4 w-4 mr-1" />
                      Выплатить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewHistory(employee)}
                      title="История выплат"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(employee)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEmployeeToDelete(employee.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeDialog
        open={employeeDialogOpen}
        onOpenChange={(open) => {
          setEmployeeDialogOpen(open);
          if (!open) {
            setEditEmployee(null);
            employeeDialogPersistence.closeDialog();
          }
        }}
        departmentId={departmentId}
        employee={editEmployee}
        defaultCompany={defaultCompany}
        onSave={() => {
          onRefresh();
          setEmployeeDialogOpen(false);
          setEditEmployee(null);
          employeeDialogPersistence.closeDialog();
        }}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            paymentDialogPersistence.closeDialog();
          }
        }}
        employee={selectedEmployeeForPayment}
        onSuccess={onRefresh}
      />

      <PaymentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open);
          if (!open) {
            historyDialogPersistence.closeDialog();
          }
        }}
        employee={selectedEmployeeForHistory}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сотрудника из отдела?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Все данные о зарплате этого сотрудника в данном отделе будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
