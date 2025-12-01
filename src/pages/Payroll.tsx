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
import { DepartmentBonuses } from "@/components/DepartmentBonuses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

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
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const { toast } = useToast();
  const { user, isDemo, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Generate last 12 months for month filter
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return format(startOfMonth(date), 'yyyy-MM-dd');
  });

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
      import('@/lib/demoData').then(({ demoDepartments, demoDepartmentEmployees }) => {
        setDepartments(demoDepartments as any);
        setAllEmployees(demoDepartmentEmployees as any);
        setLoading(false);
      });
    }
  }, [user, isDemo, selectedMonth]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const departmentsChannel = supabase
      .channel('payroll-departments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'departments',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchDepartments();
        }
      )
      .subscribe();

    const departmentEmployeesChannel = supabase
      .channel('department-employees-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_employees',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchAllEmployees();
        }
      )
      .subscribe();

    const payrollPaymentsChannel = supabase
      .channel('payroll-payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_payments',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchAllEmployees();
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel('payroll-profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchAllEmployees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(departmentsChannel);
      supabase.removeChannel(departmentEmployeesChannel);
      supabase.removeChannel(payrollPaymentsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [user, selectedMonth]);


  const fetchAllEmployees = async () => {
    try {
      if (!user) return;

      // Fetch all active employees first
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      if (profilesError) throw profilesError;

      if (!allProfiles || allProfiles.length === 0) {
        setAllEmployees([]);
        return;
      }

      // Fetch department_employees records for the selected month
      const { data: departmentEmployeesData, error: deptError } = await supabase
        .from('department_employees')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', selectedMonth);

      if (deptError) throw deptError;

      // Create a map of employee records by employee_id
      const deptEmployeesMap = new Map(
        (departmentEmployeesData || []).map(de => [de.employee_id, de])
      );

      // Fetch payments for existing department_employee records
      const deptEmployeeIds = (departmentEmployeesData || []).map(de => de.id);
      
      let paymentsByEmployee: Record<string, any> = {};
      if (deptEmployeeIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payroll_payments')
          .select('department_employee_id, amount, payment_type')
          .in('department_employee_id', deptEmployeeIds)
          .eq('month', selectedMonth);

        if (!paymentsError && paymentsData) {
          paymentsByEmployee = paymentsData.reduce((acc, payment) => {
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

      // Combine all data: all employees with their department data for selected month
      const combinedData = allProfiles.map(profile => {
        const deptRecord = deptEmployeesMap.get(profile.id);
        const payments = deptRecord ? paymentsByEmployee[deptRecord.id] || {} : {};

        return {
          id: deptRecord?.id || `temp-${profile.id}`,
          employee_id: profile.id,
          department_id: deptRecord?.department_id || null,
          user_id: user.id,
          month: selectedMonth,
          company: deptRecord?.company || 'Спасение',
          white_salary: deptRecord?.white_salary || 0,
          gray_salary: deptRecord?.gray_salary || 0,
          advance: deptRecord?.advance || 0,
          bonus: deptRecord?.bonus || 0,
          next_month_bonus: deptRecord?.next_month_bonus || 0,
          ndfl: deptRecord?.ndfl || 0,
          contributions: deptRecord?.contributions || 0,
          net_salary: deptRecord?.net_salary || 0,
          total_amount: deptRecord?.total_amount || 0,
          cost: deptRecord?.cost || 0,
          profiles: {
            first_name: profile.first_name,
            last_name: profile.last_name,
            middle_name: profile.middle_name,
            position: profile.position
          },
          paid_white: payments.paid_white || 0,
          paid_gray: payments.paid_gray || 0,
          paid_advance: payments.paid_advance || 0,
          paid_bonus: payments.paid_bonus || 0,
          paid_net_salary: payments.paid_net_salary || 0,
          created_at: deptRecord?.created_at || new Date().toISOString(),
          updated_at: deptRecord?.updated_at || new Date().toISOString()
        };
      });

      setAllEmployees(combinedData);
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
      
      // Sort departments to put "Управление" first
      const sortedDepartments = (data || []).sort((a, b) => {
        if (a.name === 'Управление') return -1;
        if (b.name === 'Управление') return 1;
        return a.name.localeCompare(b.name);
      });
      
      setDepartments(sortedDepartments);
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
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-4xl font-bold">ФОТ (Фонд оплаты труда)</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Месяц:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {format(new Date(month), 'LLLL yyyy', { locale: ru })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="departments">ФОТ</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
            <TabsTrigger value="bonuses">Премии отделов</TabsTrigger>
            <TabsTrigger value="sales">Продажи</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <Card className="p-6 mb-6 bg-primary/5">
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold">
                <div className="col-span-2 text-lg">Итого по всем отделам:</div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Общая сумма</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.total_amount || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Белая</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.white_salary || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Серая</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.gray_salary || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Аванс</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.advance || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">НДФЛ</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.ndfl || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Взносы</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.contributions || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Премия</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.bonus || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Премия сл. мес</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.next_month_bonus || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Стоимость</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.cost || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">На руки</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + (e.net_salary || 0), 0)
                  )}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Выплачено</div>
                  <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                    allEmployees.filter((e: any) => e.department_id).reduce((s, e: any) => s + ((e.paid_white || 0) + (e.paid_gray || 0) + (e.paid_advance || 0) + (e.paid_bonus || 0) + (e.paid_net_salary || 0)), 0)
                  )}</div>
                </div>
              </div>
            </Card>
            
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
                    selectedMonth={selectedMonth}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <PayrollAnalytics />
          </TabsContent>

          <TabsContent value="bonuses">
            <DepartmentBonuses />
          </TabsContent>

          <TabsContent value="sales">
            <PayrollSales />
          </TabsContent>
        </Tabs>

        <DepartmentDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditDepartment(null);
              departmentDialogPersistence.closeDialog();
            }
          }}
          onSave={handleSaveDepartment}
          department={editDepartment}
        />
      </div>
    </div>
  );
}
