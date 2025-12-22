import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
import { Department } from "@/pages/Payroll";
import { EmployeeDialog } from "@/components/EmployeeDialog";
import { PayrollTable } from "@/components/PayrollTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  selectedMonth: string;
  nextMonthBonuses?: Record<string, number>;
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

export function DepartmentCard({ department, onEdit, onDelete, selectedMonth, nextMonthBonuses }: DepartmentCardProps) {
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<DepartmentEmployee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchEmployees();
  }, [department.id, department.name, selectedMonth, user?.id]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      // 1. Получаем всех активных сотрудников этого отдела (статично, не зависит от месяца)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('department', department.name)
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      if (profilesError) throw profilesError;

      if (!profilesData || profilesData.length === 0) {
        setEmployees([]);
        return;
      }

      // 2. Получаем записи department_employees для выбранного месяца
      const { data: deptData, error: deptError } = await supabase
        .from('department_employees')
        .select('*')
        .eq('department_id', department.id)
        .eq('month', selectedMonth);

      if (deptError) throw deptError;

      const deptByEmployeeId = new Map(
        (deptData || []).map((de: any) => [de.employee_id, de])
      );

      // 3. Загружаем выплаты для всех найденных записей department_employees
      const deptEmployeeIds = (deptData || []).map((de: any) => de.id);

      let paymentsByEmployee: Record<string, any> = {};
      if (deptEmployeeIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payroll_payments')
          .select('department_employee_id, amount, payment_type')
          .in('department_employee_id', deptEmployeeIds)
          .eq('month', selectedMonth);

        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError);
        } else if (paymentsData) {
          paymentsByEmployee = paymentsData.reduce((acc: Record<string, any>, payment: any) => {
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
          }, {} as Record<string, any>);
        }
      }

      // 4. Объединяем данные: статичный список сотрудников + данные по месяцу
      const combinedEmployees: DepartmentEmployee[] = profilesData.map((profile: any) => {
        const deptRecord = deptByEmployeeId.get(profile.id);
        const payments = deptRecord ? paymentsByEmployee[deptRecord.id] || {} : {};

        return {
          id: deptRecord?.id || `temp-${profile.id}`,
          department_id: department.id,
          employee_id: profile.id,
          white_salary: deptRecord?.white_salary || 0,
          gray_salary: deptRecord?.gray_salary || 0,
          advance: deptRecord?.advance || 0,
          ndfl: deptRecord?.ndfl || 0,
          contributions: deptRecord?.contributions || 0,
          bonus: deptRecord?.bonus || 0,
          next_month_bonus: nextMonthBonuses?.[profile.id] ?? deptRecord?.next_month_bonus ?? 0,
          cost: deptRecord?.cost || 0,
          net_salary: deptRecord?.net_salary || 0,
          total_amount: deptRecord?.total_amount || 0,
          company: deptRecord?.company || (department.project_name || "Спасение"),
          created_at: deptRecord?.created_at || new Date().toISOString(),
          updated_at: deptRecord?.updated_at || new Date().toISOString(),
          user_id: deptRecord?.user_id || (user?.id || ""),
          profiles: {
            first_name: profile.first_name,
            last_name: profile.last_name,
            position: profile.position,
          },
          paid_white: payments.paid_white || 0,
          paid_gray: payments.paid_gray || 0,
          paid_advance: payments.paid_advance || 0,
          paid_bonus: payments.paid_bonus || 0,
          paid_net_salary: payments.paid_net_salary || 0,
        };
      });

      setEmployees(combinedEmployees);
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
              selectedMonth={selectedMonth}
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
        selectedMonth={selectedMonth}
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
