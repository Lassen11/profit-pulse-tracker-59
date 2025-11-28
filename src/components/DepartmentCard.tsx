import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
import { Department } from "@/pages/Payroll";
import { EmployeeDialog } from "@/components/EmployeeDialog";
import { PayrollTable } from "@/components/PayrollTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";
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

interface DepartmentCardProps {
  department: Department;
  onEdit: (department: Department) => void;
  onDelete: (id: string) => void;
}

export interface DepartmentEmployee {
  id: string;
  department_id: string;
  employee_id: string;
  white_salary: number;
  gray_salary: number;
  advance: number;
  ndfl: number;
  contributions: number;
  bonus: number;
  next_month_bonus: number;
  cost: number;
  net_salary: number;
  total_amount: number;
  company: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
    position: string | null;
  };
  // Фактические выплаты
  paid_white?: number;
  paid_gray?: number;
  paid_advance?: number;
  paid_bonus?: number;
  paid_net_salary?: number;
}

export function DepartmentCard({ department, onEdit, onDelete }: DepartmentCardProps) {
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<DepartmentEmployee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, [department.id]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      // Get current month
      const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('department_employees')
        .select(`
          *,
          profiles:employee_id (
            first_name,
            last_name,
            position
          )
        `)
        .eq('department_id', department.id)
        .eq('month', currentMonth);

      if (error) throw error;

      // Загружаем выплаты для всех сотрудников
      const employeeIds = data?.map(emp => emp.id) || [];
      
      if (employeeIds.length > 0) {
        const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payroll_payments')
          .select('department_employee_id, amount, payment_type')
          .in('department_employee_id', employeeIds)
          .eq('month', currentMonth);

        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError);
        } else {
          // Агрегируем выплаты по типу для каждого сотрудника
          const paymentsByEmployee = (paymentsData || []).reduce((acc, payment) => {
            if (!acc[payment.department_employee_id]) {
              acc[payment.department_employee_id] = {
                paid_white: 0,
                paid_gray: 0,
                paid_advance: 0,
                paid_bonus: 0,
                paid_net_salary: 0
              };
            }
            
            switch (payment.payment_type) {
              case 'white':
                acc[payment.department_employee_id].paid_white += payment.amount;
                break;
              case 'gray':
                acc[payment.department_employee_id].paid_gray += payment.amount;
                break;
              case 'advance':
                acc[payment.department_employee_id].paid_advance += payment.amount;
                break;
              case 'bonus':
                acc[payment.department_employee_id].paid_bonus += payment.amount;
                break;
              case 'net_salary':
                acc[payment.department_employee_id].paid_net_salary += payment.amount;
                break;
            }
            
            return acc;
          }, {} as Record<string, { paid_white: number; paid_gray: number; paid_advance: number; paid_bonus: number; paid_net_salary: number }>);

          // Объединяем данные сотрудников с выплатами
          const employeesWithPayments = (data || []).map(emp => ({
            ...emp,
            paid_white: paymentsByEmployee[emp.id]?.paid_white || 0,
            paid_gray: paymentsByEmployee[emp.id]?.paid_gray || 0,
            paid_advance: paymentsByEmployee[emp.id]?.paid_advance || 0,
            paid_bonus: paymentsByEmployee[emp.id]?.paid_bonus || 0,
            paid_net_salary: paymentsByEmployee[emp.id]?.paid_net_salary || 0
          }));

          setEmployees(employeesWithPayments);
          return;
        }
      }

      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить сотрудников",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = () => {
    onDelete(department.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{department.name}</CardTitle>
              {department.project_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  Проект: {department.project_name}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditEmployee(null);
                  setEmployeeDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить сотрудника
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(department)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет добавленных сотрудников</p>
              <Button
                variant="link"
                onClick={() => setEmployeeDialogOpen(true)}
                className="mt-2"
              >
                Добавить первого сотрудника
              </Button>
            </div>
          ) : (
            <PayrollTable
              employees={employees}
              departmentId={department.id}
              defaultCompany={department.project_name || "Спасение"}
              onRefresh={fetchEmployees}
            />
          )}
        </CardContent>
      </Card>

      <EmployeeDialog
        open={employeeDialogOpen}
        onOpenChange={(open) => {
          setEmployeeDialogOpen(open);
          if (!open) setEditEmployee(null);
        }}
        departmentId={department.id}
        employee={editEmployee}
        defaultCompany={department.project_name || "Спасение"}
        onSave={() => {
          fetchEmployees();
          setEmployeeDialogOpen(false);
          setEditEmployee(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отдел?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Все сотрудники и данные о зарплатах в этом отделе будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDepartment}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
