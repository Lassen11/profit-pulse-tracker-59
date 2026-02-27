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
import { Edit, Trash2, Wallet, History, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

// Helper component for table header with tooltip
function ColumnHeader({ children, tooltip, className }: { children: React.ReactNode; tooltip: string; className?: string }) {
  return (
    <TableHead className={`text-right ${className || ""}`}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 cursor-help">
              {children}
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </TableHead>
  );
}

interface PayrollTableProps {
  employees: DepartmentEmployee[];
  departmentId: string;
  onRefresh: () => void;
  defaultCompany?: string;
  selectedMonth: string;
}

export function PayrollTable({ employees, departmentId, onRefresh, defaultCompany = "Спасение", selectedMonth }: PayrollTableProps) {
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
              <ColumnHeader className="min-w-[120px]" tooltip="Белая + Серая + Взносы + Премия + Премия сл. мес">Общая сумма</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Официальная часть зарплаты до вычета НДФЛ">Белая</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Неофициальная часть зарплаты">Серая</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Предоплата, вычитается из суммы «На руки»">Аванс</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="13% от белой зарплаты">НДФЛ</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="30% от белой зарплаты (страховые взносы)">Взносы</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Премия за текущий месяц">Премия</ColumnHeader>
              <ColumnHeader className="min-w-[120px]" tooltip="Премия, начисляемая в следующем месяце">Премия сл. мес</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Полная стоимость сотрудника для компании">Стоимость</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Белая − НДФЛ + Серая. Уменьшается при выплатах">На руки</ColumnHeader>
              <ColumnHeader className="min-w-[100px]" tooltip="Сумма всех произведённых выплат">Выплачено</ColumnHeader>
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
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.white_salary || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.gray_salary || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.advance || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.ndfl || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.contributions || 0), 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + (emp.bonus || 0), 0))}
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
              <TableCell className="text-right">
                {formatCurrency(employees.reduce((sum, emp) => sum + ((emp.paid_white || 0) + (emp.paid_gray || 0) + (emp.paid_advance || 0) + (emp.paid_bonus || 0) + (emp.paid_net_salary || 0)), 0))}
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
                <TableCell className="text-right">{formatCurrency(employee.white_salary || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.gray_salary || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.advance || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.ndfl)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.contributions)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.bonus || 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.next_month_bonus)}</TableCell>
                <TableCell className="text-right">{formatCurrency(employee.cost)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(employee.net_salary || 0)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency((employee.paid_white || 0) + (employee.paid_gray || 0) + (employee.paid_advance || 0) + (employee.paid_bonus || 0) + (employee.paid_net_salary || 0))}
                </TableCell>
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
        selectedMonth={selectedMonth}
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
