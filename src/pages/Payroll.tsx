import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/DemoBanner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedDialog } from "@/hooks/useDialogPersistence";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft } from "lucide-react";
import { DepartmentDialog } from "@/components/DepartmentDialog";
import { DepartmentCard } from "@/components/DepartmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollAnalytics } from "@/components/PayrollAnalytics";
import { PayrollSales } from "@/components/PayrollSales";

export interface Department {
  id: string;
  name: string;
  project_name: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function Payroll() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const { toast } = useToast();
  const { user, isDemo, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Dialog persistence hook
  const departmentDialogPersistence = usePersistedDialog<{ editDepartment?: Department }>({
    key: 'payroll-dialog-state',
    onRestore: (data) => {
      if (data.editDepartment) {
        setEditDepartment(data.editDepartment);
      }
      setDialogOpen(true);
    }
  });

  useEffect(() => {
    if (!authLoading && !user && !isDemo) {
      navigate("/auth");
    }
  }, [user, authLoading, isDemo, navigate]);

  useEffect(() => {
    if (user) {
      fetchDepartments();
      fetchAllEmployees();
    } else if (isDemo) {
      // Load demo data
      import('@/lib/demoData').then(({ demoDepartments }) => {
        setDepartments(demoDepartments as any);
        setLoading(false);
      });
    }
  }, [user, isDemo]);

  // Restore dialog state from localStorage
  useEffect(() => {
    if (!user) return;
    
    departmentDialogPersistence.restoreDialog();
  }, [user]);

  const fetchAllEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('department_employees')
        .select(`
          *,
          profiles:employee_id (
            first_name,
            last_name,
            position
          )
        `);

      if (error) throw error;

      // Загружаем выплаты для всех сотрудников
      const employeeIds = data?.map(emp => emp.id) || [];
      
      if (employeeIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payroll_payments')
          .select('department_employee_id, amount, payment_type')
          .in('department_employee_id', employeeIds);

        if (!paymentsError && paymentsData) {
          // Агрегируем выплаты по типу для каждого сотрудника
          const paymentsByEmployee = paymentsData.reduce((acc, payment) => {
            if (!acc[payment.department_employee_id]) {
              acc[payment.department_employee_id] = {
                paid_white: 0,
                paid_gray: 0,
                paid_advance: 0,
                paid_bonus: 0
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
            }
            
            return acc;
          }, {} as Record<string, any>);

          // Объединяем данные сотрудников с выплатами
          const employeesWithPayments = (data || []).map(emp => ({
            ...emp,
            paid_white: paymentsByEmployee[emp.id]?.paid_white || 0,
            paid_gray: paymentsByEmployee[emp.id]?.paid_gray || 0,
            paid_advance: paymentsByEmployee[emp.id]?.paid_advance || 0,
            paid_bonus: paymentsByEmployee[emp.id]?.paid_bonus || 0
          }));
          
          setAllEmployees(employeesWithPayments);
        } else {
          setAllEmployees(data || []);
        }
      } else {
        setAllEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching all employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить отделы",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDepartment = async (departmentData: Omit<Department, 'id' | 'created_at' | 'updated_at' | 'user_id'> & { id?: string }) => {
    if (!user) return;

    try {
      if (departmentData.id) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: departmentData.name,
            project_name: departmentData.project_name
          })
          .eq('id', departmentData.id);

        if (error) throw error;

        toast({
          title: "Отдел обновлен",
          description: "Изменения успешно сохранены"
        });
      } else {
        const { error } = await supabase
          .from('departments')
          .insert({
            user_id: user.id,
            name: departmentData.name,
            project_name: departmentData.project_name
          });

        if (error) throw error;

        toast({
          title: "Отдел создан",
          description: "Новый отдел успешно добавлен"
        });
      }

      fetchDepartments();
      fetchAllEmployees();
      setDialogOpen(false);
      setEditDepartment(null);
      departmentDialogPersistence.closeDialog();
    } catch (error) {
      console.error('Error saving department:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить отдел",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Отдел удален",
        description: "Отдел успешно удален"
      });

      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить отдел",
        variant: "destructive"
      });
    }
  };

  const handleEditDepartment = (department: Department) => {
    setEditDepartment(department);
    setDialogOpen(true);
    departmentDialogPersistence.openDialog({ editDepartment: department });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Demo Banner */}
        {isDemo && <DemoBanner />}
        
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-4xl font-bold">ФОТ (Фонд оплаты труда)</h1>
        </div>

        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="departments">ФОТ</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
            <TabsTrigger value="sales">Продажи</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            {allEmployees.length > 0 && (
              <Card className="p-6 mb-6 bg-primary/5">
                <div className="grid grid-cols-11 gap-4 text-sm font-semibold">
                  <div className="col-span-2 text-lg">Итого по всем отделам:</div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Общая сумма</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.total_amount || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Белая</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.paid_white || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Серая</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.paid_gray || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Аванс</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.paid_advance || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">НДФЛ</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.ndfl || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Взносы</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.contributions || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Премия</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.paid_bonus || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Премия сл. мес</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.next_month_bonus || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Стоимость</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.cost || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">На руки</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.net_salary || 0), 0)
                    )}</div>
                  </div>
                </div>
              </Card>
            )}
            
            <div className="flex justify-end mb-6">
              <Button onClick={() => {
                setEditDepartment(null);
                setDialogOpen(true);
                departmentDialogPersistence.openDialog({});
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить отдел
              </Button>
            </div>

            {departments.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">Нет добавленных отделов</p>
                <Button onClick={() => {
                  setDialogOpen(true);
                  departmentDialogPersistence.openDialog({});
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать первый отдел
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {departments.map((department) => (
                  <DepartmentCard
                    key={department.id}
                    department={department}
                    onEdit={handleEditDepartment}
                    onDelete={handleDeleteDepartment}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <PayrollAnalytics />
          </TabsContent>

          <TabsContent value="sales">
            <PayrollSales />
          </TabsContent>
        </Tabs>

        <DepartmentDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditDepartment(null);
          }}
          onSave={handleSaveDepartment}
          department={editDepartment}
        />
      </div>
    </div>
  );
}
