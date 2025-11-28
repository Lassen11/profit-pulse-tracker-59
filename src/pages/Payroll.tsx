import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/DemoBanner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedDialog } from "@/hooks/useDialogPersistence";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Wallet, Edit2 } from "lucide-react";
import { DepartmentDialog } from "@/components/DepartmentDialog";
import { DepartmentCard } from "@/components/DepartmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollAnalytics } from "@/components/PayrollAnalytics";
import { PayrollSales } from "@/components/PayrollSales";
import { DepartmentBonuses } from "@/components/DepartmentBonuses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  const [bonusBudgets, setBonusBudgets] = useState<Record<string, number>>({});
  const [editBudgetDepartment, setEditBudgetDepartment] = useState<Department | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<string>('');
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
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
      fetchBonusBudgets();
    } else if (isDemo) {
      // Load demo data
      import('@/lib/demoData').then(({ demoDepartments }) => {
        setDepartments(demoDepartments as any);
        setLoading(false);
      });
    }
  }, [user, isDemo, selectedMonth]);


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
        `)
        .eq('month', selectedMonth);

      if (error) throw error;

      // Загружаем выплаты для всех сотрудников
      const employeeIds = data?.map(emp => emp.id) || [];
      
      if (employeeIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payroll_payments')
          .select('department_employee_id, amount, payment_type')
          .in('department_employee_id', employeeIds)
          .eq('month', selectedMonth);

        if (!paymentsError && paymentsData) {
          // Агрегируем выплаты по типу для каждого сотрудника
          const paymentsByEmployee = paymentsData.reduce((acc, payment) => {
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

          // Объединяем данные сотрудников с выплатами
          const employeesWithPayments = (data || []).map(emp => ({
            ...emp,
            paid_white: paymentsByEmployee[emp.id]?.paid_white || 0,
            paid_gray: paymentsByEmployee[emp.id]?.paid_gray || 0,
            paid_advance: paymentsByEmployee[emp.id]?.paid_advance || 0,
            paid_bonus: paymentsByEmployee[emp.id]?.paid_bonus || 0,
            paid_net_salary: paymentsByEmployee[emp.id]?.paid_net_salary || 0
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

  const fetchBonusBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('department_bonus_budget')
        .select('department_id, total_budget')
        .eq('month', selectedMonth);

      if (error) throw error;

      const budgets: Record<string, number> = {};
      data?.forEach(item => {
        budgets[item.department_id] = item.total_budget;
      });
      setBonusBudgets(budgets);
    } catch (error) {
      console.error('Error fetching bonus budgets:', error);
    }
  };

  const handleEditBudget = (department: Department) => {
    setEditBudgetDepartment(department);
    setEditBudgetValue((bonusBudgets[department.id] || 0).toString());
    setBudgetDialogOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!user || !editBudgetDepartment) return;

    try {
      const budgetValue = parseFloat(editBudgetValue) || 0;

      const { error } = await supabase
        .from('department_bonus_budget')
        .upsert({
          department_id: editBudgetDepartment.id,
          month: selectedMonth,
          total_budget: budgetValue,
          user_id: user.id
        }, {
          onConflict: 'department_id,month'
        });

      if (error) throw error;

      toast({
        title: "Бюджет сохранен",
        description: `Бюджет премий для отдела "${editBudgetDepartment.name}" обновлен`
      });

      fetchBonusBudgets();
      setBudgetDialogOpen(false);
      setEditBudgetDepartment(null);
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить бюджет премий",
        variant: "destructive"
      });
    }
  };

  const totalBonusBudget = Object.values(bonusBudgets).reduce((sum, budget) => sum + budget, 0);

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
            {/* Bonus Budget Card */}
            <Card className="p-6 mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Общий фонд премий за месяц</div>
                    <div className="text-3xl font-bold text-primary">
                      {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(totalBonusBudget)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-2">Бюджет по отделам:</div>
                  <div className="space-y-1">
                    {departments.map(dept => (
                      <div key={dept.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{dept.name}:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(bonusBudgets[dept.id] || 0)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEditBudget(dept)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {allEmployees.length > 0 && (
              <Card className="p-6 mb-6 bg-primary/5">
                <div className="grid grid-cols-12 gap-4 text-sm font-semibold">
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
                      allEmployees.reduce((s, e: any) => s + (e.white_salary || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Серая</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.gray_salary || 0), 0)
                    )}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Аванс</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + (e.advance || 0), 0)
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
                      allEmployees.reduce((s, e: any) => s + (e.bonus || 0), 0)
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
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">Выплачено</div>
                    <div>{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(
                      allEmployees.reduce((s, e: any) => s + ((e.paid_white || 0) + (e.paid_gray || 0) + (e.paid_advance || 0) + (e.paid_bonus || 0) + (e.paid_net_salary || 0)), 0)
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

          <TabsContent value="bonuses">
            <DepartmentBonuses />
          </TabsContent>

          <TabsContent value="sales">
            <PayrollSales />
          </TabsContent>
        </Tabs>

        {/* Budget Edit Dialog */}
        <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Редактировать бюджет премий</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Отдел</label>
                <div className="text-lg font-semibold text-primary mt-1">
                  {editBudgetDepartment?.name}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Общая сумма премий (₽)</label>
                <Input
                  type="number"
                  value={editBudgetValue}
                  onChange={(e) => setEditBudgetValue(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Эта сумма будет распределена между сотрудниками на основе их баллов
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveBudget}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
