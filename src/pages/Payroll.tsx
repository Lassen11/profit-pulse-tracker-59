import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBanner } from "@/components/DemoBanner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedDialog } from "@/hooks/useDialogPersistence";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, RefreshCw, FileDown } from "lucide-react";
import { DepartmentDialog } from "@/components/DepartmentDialog";
import { DepartmentCard } from "@/components/DepartmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollAnalytics } from "@/components/PayrollAnalytics";
import { PayrollSales } from "@/components/PayrollSales";
import { DepartmentBonuses } from "@/components/DepartmentBonuses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { exportPayrollToPdf } from "@/lib/exportPayrollPdf";

// Helper function to calculate manager bonuses from bankrot_clients
const calculateManagerBonuses = async (previousMonthStr: string) => {
  // Источники, для которых начисляется премия 4.5%
  const percentBonusSources = ['Авито', 'Сайт', 'Квиз', 'С улицы', 'Рекомендация менеджера', 'Рекомендация клиента'];
  // Источники с фиксированной премией (1000 или 2000 если 6+ рекомендаций у менеджера)
  const fixedBonusSources = ['Рекомендация Руководителя', 'Рекомендация ОЗ'];

  // Get start and end dates for the previous month
  const monthStart = new Date(previousMonthStr);
  const monthEnd = new Date(previousMonthStr);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);

  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(monthEnd, 'yyyy-MM-dd');

  // Fetch clients for the previous month
  const { data: clients, error } = await supabase
    .from('bankrot_clients')
    .select('*')
    .gte('contract_date', startDateStr)
    .lte('contract_date', endDateStr);

  if (error || !clients) {
    console.error('Error fetching bankrot_clients for bonuses:', error);
    return new Map<string, number>();
  }

  // Count fixed recommendations per manager
  const managerFixedRecommendationsCount = clients.reduce((acc, client) => {
    if (client.manager && client.source && fixedBonusSources.includes(client.source)) {
      acc[client.manager] = (acc[client.manager] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate bonuses per manager - only if manager is specified
  const managerBonuses = new Map<string, number>();

  clients.forEach(client => {
    // Если менеджер не указан или премия не подтверждена, пропускаем
    if (!client.manager || !client.bonus_confirmed) return;

    let bonus = 0;

    // Если задана ручная премия, используем её
    if (client.manual_bonus !== null && client.manual_bonus !== undefined) {
      bonus = client.manual_bonus;
    }
    // Премия 4.5% для процентных источников
    else if (client.source && percentBonusSources.includes(client.source)) {
      bonus = client.contract_amount * 0.045;
    }
    // Фиксированная премия для рекомендаций
    else if (client.source && fixedBonusSources.includes(client.source)) {
      const managerCount = managerFixedRecommendationsCount[client.manager] || 0;
      bonus = managerCount >= 6 ? 2000 : 1000;
    }

    if (bonus > 0) {
      const currentBonus = managerBonuses.get(client.manager) || 0;
      managerBonuses.set(client.manager, currentBonus + bonus);
    }
  });

  return managerBonuses;
};

// Helper function to calculate sales bonuses (from `sales.manager_bonus`) by employee_id
const calculateSalesBonuses = async (monthStr: string) => {
  const monthStart = new Date(monthStr);
  const monthEnd = new Date(monthStr);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);

  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(monthEnd, 'yyyy-MM-dd');

  const { data: sales, error } = await supabase
    .from('sales')
    .select('employee_id, manager_bonus, payment_date')
    .gte('payment_date', startDateStr)
    .lte('payment_date', endDateStr);

  if (error || !sales) {
    console.error('Error fetching sales for bonuses:', error);
    return new Map<string, number>();
  }

  const bonusesByEmployee = new Map<string, number>();
  sales.forEach(sale => {
    const bonus = Number(sale.manager_bonus || 0);
    if (!sale.employee_id || bonus <= 0) return;
    bonusesByEmployee.set(sale.employee_id, (bonusesByEmployee.get(sale.employee_id) || 0) + bonus);
  });

  return bonusesByEmployee;
};

// Helper to match manager name to employee profile
const findEmployeeByManagerName = (managerName: string, profiles: any[]) => {
  // Manager name format could be "Фамилия Имя Отчество" or "Имя Фамилия"
  const normalizedManagerName = managerName.toLowerCase().trim();

  for (const profile of profiles) {
    const fullName1 = `${profile.last_name} ${profile.first_name} ${profile.middle_name || ''}`.toLowerCase().trim();
    const fullName2 = `${profile.first_name} ${profile.last_name}`.toLowerCase().trim();
    const fullName3 = `${profile.last_name} ${profile.first_name}`.toLowerCase().trim();

    if (
      normalizedManagerName === fullName1 ||
      normalizedManagerName === fullName2 ||
      normalizedManagerName === fullName3 ||
      normalizedManagerName.includes(profile.last_name.toLowerCase())
    ) {
      return profile;
    }
  }
  return null;
};

export interface Department {
  id: string;
  name: string;
  project_name: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function Payroll() {
  const currentDate = new Date();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [nextMonthBonuses, setNextMonthBonuses] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [selectedMonthNum, setSelectedMonthNum] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckComplete, setAdminCheckComplete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [recalculatingBonuses, setRecalculatingBonuses] = useState(false);
  const { toast } = useToast();
  const { user, isDemo, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Update selectedMonth when month or year changes
  useEffect(() => {
    const newMonth = new Date(selectedYear, selectedMonthNum, 1);
    setSelectedMonth(format(startOfMonth(newMonth), 'yyyy-MM-dd'));
  }, [selectedMonthNum, selectedYear]);

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Generate last 5 years
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i + 1);

  // Sync salary data from previous month to current month
  const handleSyncFromPreviousMonth = async () => {
    if (!user || isDemo) return;
    
    setSyncing(true);
    try {
      const currentMonthDate = new Date(selectedMonth);
      const previousMonthDate = subMonths(currentMonthDate, 1);
      const previousMonth = format(startOfMonth(previousMonthDate), 'yyyy-MM-dd');

      // Get all employees from previous month
      const { data: sourceEmployees, error: sourceError } = await supabase
        .from('department_employees')
        .select('*')
        .eq('month', previousMonth);

      if (sourceError) throw sourceError;

      if (!sourceEmployees || sourceEmployees.length === 0) {
        toast({
          title: "Нет данных",
          description: `В ${format(previousMonthDate, 'LLLL yyyy', { locale: ru })} нет данных для копирования`,
          variant: "destructive"
        });
        setSyncing(false);
        return;
      }

      // Get all profiles for matching manager names
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true);

      // Calculate manager bonuses from previous month's sales
      const managerBonuses = await calculateManagerBonuses(previousMonth);
      
      // Create a map of employee_id to bonus amount
      const employeeBonusMap = new Map<string, number>();
      for (const [managerName, bonus] of managerBonuses) {
        const employee = findEmployeeByManagerName(managerName, allProfiles || []);
        if (employee) {
          employeeBonusMap.set(employee.id, bonus);
        }
      }

      let updatedCount = 0;
      let insertedCount = 0;

      for (const emp of sourceEmployees) {
        // Get bonus from manager sales in previous month
        const salesBonus = employeeBonusMap.get(emp.employee_id) || 0;
        
        // Check if record exists for target month
        const { data: existingRecord } = await supabase
          .from('department_employees')
          .select('id, bonus')
          .eq('department_id', emp.department_id)
          .eq('employee_id', emp.employee_id)
          .eq('month', selectedMonth)
          .maybeSingle();

        if (existingRecord) {
          // Update existing record, adding sales bonus to existing bonus
          const { error: updateError } = await supabase
            .from('department_employees')
            .update({
              white_salary: emp.white_salary,
              gray_salary: emp.gray_salary,
              ndfl: emp.ndfl,
              contributions: emp.contributions,
              bonus: (existingRecord.bonus || 0) + salesBonus
            })
            .eq('id', existingRecord.id);

          if (!updateError) updatedCount++;
        } else {
          // Insert new record with fresh net_salary calculation including bonus
          const whiteSalary = emp.white_salary || 0;
          const graySalary = emp.gray_salary || 0;
          const ndfl = emp.ndfl || 0;
          const freshNetSalary = whiteSalary - ndfl + graySalary + salesBonus;
          
          const { error: insertError } = await supabase
            .from('department_employees')
            .insert({
              department_id: emp.department_id,
              employee_id: emp.employee_id,
              company: emp.company,
              white_salary: emp.white_salary,
              gray_salary: emp.gray_salary,
              ndfl: emp.ndfl,
              contributions: emp.contributions,
              advance: 0,
              bonus: salesBonus,
              next_month_bonus: 0,
              cost: emp.cost,
              net_salary: freshNetSalary,
              total_amount: emp.total_amount,
              month: selectedMonth,
              user_id: user.id
            });

          if (!insertError) insertedCount++;
        }
      }

      toast({
        title: "Синхронизация завершена",
        description: `Обновлено: ${updatedCount}, создано: ${insertedCount} записей`
      });

      fetchAllEmployees();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось синхронизировать данные",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // Recalculate bonuses from bankrot_clients for the current month
  const handleRecalculateBonuses = async () => {
    if (!user || isDemo) return;
    
    setRecalculatingBonuses(true);
    try {
      // Get previous month to calculate bonuses from
      const currentMonthDate = new Date(selectedMonth);
      const previousMonthDate = subMonths(currentMonthDate, 1);
      const previousMonth = format(startOfMonth(previousMonthDate), 'yyyy-MM-dd');

      // Get all profiles for matching manager names
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true);

      if (!allProfiles) {
        throw new Error('Не удалось загрузить профили сотрудников');
      }

      // Calculate manager bonuses from previous month's sales
      const managerBonuses = await calculateManagerBonuses(previousMonth);
      
      // Also get sales bonuses from the sales table
      const salesBonuses = await calculateSalesBonuses(previousMonth);
      
      // Merge bonuses: map manager names to employee IDs
      const employeeBonusMap = new Map<string, number>();
      
      // Add bonuses from bankrot_clients (by manager name)
      for (const [managerName, bonus] of managerBonuses) {
        const employee = findEmployeeByManagerName(managerName, allProfiles);
        if (employee) {
          employeeBonusMap.set(employee.id, (employeeBonusMap.get(employee.id) || 0) + bonus);
        }
      }
      
      // Add bonuses from sales table (by employee_id)
      for (const [employeeId, bonus] of salesBonuses) {
        employeeBonusMap.set(employeeId, (employeeBonusMap.get(employeeId) || 0) + bonus);
      }

      // Get existing department_employees for the current month
      const { data: currentMonthEmployees, error: fetchError } = await supabase
        .from('department_employees')
        .select('*')
        .eq('month', selectedMonth);

      if (fetchError) throw fetchError;

      let updatedCount = 0;

      // Update each employee's bonus
      for (const emp of currentMonthEmployees || []) {
        const newBonus = employeeBonusMap.get(emp.employee_id) || 0;
        
        // Calculate new net_salary
        const whiteSalary = emp.white_salary || 0;
        const graySalary = emp.gray_salary || 0;
        const ndfl = emp.ndfl || 0;
        const advance = emp.advance || 0;
        const newNetSalary = whiteSalary - ndfl + graySalary + newBonus - advance;

        const { error: updateError } = await supabase
          .from('department_employees')
          .update({
            bonus: newBonus,
            net_salary: newNetSalary
          })
          .eq('id', emp.id);

        if (!updateError) {
          updatedCount++;
        } else {
          console.error('Error updating bonus:', updateError);
        }
      }

      toast({
        title: "Премии пересчитаны",
        description: `Обновлено ${updatedCount} записей на основе продаж за ${format(previousMonthDate, 'LLLL yyyy', { locale: ru })}`
      });

      fetchAllEmployees(true);
    } catch (error: any) {
      console.error('Recalculate bonuses error:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось пересчитать премии",
        variant: "destructive"
      });
    } finally {
      setRecalculatingBonuses(false);
    }
  };

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setAdminCheckComplete(true);
        return;
      }
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!data && !error);
      setAdminCheckComplete(true);
    };
    
    checkAdminStatus();
  }, [user]);
  

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
    // Wait for admin check to complete before fetching data
    if (user && adminCheckComplete) {
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
  }, [user, isDemo, selectedMonth, isAdmin, adminCheckComplete]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // For admins, subscribe to all departments changes; for regular users, filter by user_id
    const departmentSubscriptionConfig = isAdmin 
      ? { event: '*' as const, schema: 'public', table: 'departments' }
      : { event: '*' as const, schema: 'public', table: 'departments', filter: `user_id=eq.${user.id}` };

    const departmentsChannel = supabase
      .channel('payroll-departments-changes')
      .on(
        'postgres_changes',
        departmentSubscriptionConfig,
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
  }, [user, selectedMonth, isAdmin]);


  const fetchAllEmployees = async (skipAutoSync = false) => {
    try {
      if (!user) return;

      // Fetch all active employees first (админ видит всех активных сотрудников, RLS контролирует доступ)
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
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
        .eq('month', selectedMonth);

      if (deptError) throw deptError;

      // Fetch previous month records to carry forward white_salary, gray_salary, ndfl, contributions
      const previousMonth = new Date(selectedMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);
      const previousMonthStr = format(previousMonth, 'yyyy-MM-dd');

      const { data: previousMonthData, error: prevError } = await supabase
        .from('department_employees')
        .select('*')
        .eq('month', previousMonthStr);

      if (prevError) throw prevError;

      // Auto-sync: if no records for selected month but previous month has data, create records
      if (!skipAutoSync && (!departmentEmployeesData || departmentEmployeesData.length === 0) && previousMonthData && previousMonthData.length > 0) {
        console.log('Auto-syncing salary data from previous month...');
        
        // Calculate manager bonuses from previous month's sales (to be added to this month)
        const managerBonuses = await calculateManagerBonuses(previousMonthStr);
        console.log('Manager bonuses from previous month:', Object.fromEntries(managerBonuses));
        
        // Create a map of employee_id to bonus amount
        const employeeBonusMap = new Map<string, number>();
        for (const [managerName, bonus] of managerBonuses) {
          const employee = findEmployeeByManagerName(managerName, allProfiles);
          if (employee) {
            employeeBonusMap.set(employee.id, bonus);
            console.log(`Matched manager "${managerName}" to employee ${employee.last_name} ${employee.first_name}, bonus: ${bonus}`);
          } else {
            console.log(`Could not match manager "${managerName}" to any employee`);
          }
        }
        
        const recordsToInsert = previousMonthData.map(emp => {
          // Calculate fresh net_salary based on white + gray salary for new month
          const whiteSalary = emp.white_salary || 0;
          const graySalary = emp.gray_salary || 0;
          const ndfl = emp.ndfl || 0;
          
          // Get bonus from manager sales in previous month
          const salesBonus = employeeBonusMap.get(emp.employee_id) || 0;
          
          const freshNetSalary = whiteSalary - ndfl + graySalary + salesBonus;
          
          return {
            department_id: emp.department_id,
            employee_id: emp.employee_id,
            company: emp.company,
            white_salary: emp.white_salary,
            gray_salary: emp.gray_salary,
            ndfl: emp.ndfl,
            contributions: emp.contributions,
            advance: 0,
            bonus: salesBonus,
            next_month_bonus: 0,
            cost: emp.cost,
            net_salary: freshNetSalary,
            total_amount: emp.total_amount,
            month: selectedMonth,
            user_id: user.id
          };
        });

        const { error: insertError } = await supabase
          .from('department_employees')
          .insert(recordsToInsert);

        if (insertError) {
          console.error('Auto-sync error:', insertError);
        } else {
          // Re-fetch after auto-sync
          fetchAllEmployees(true);
          return;
        }
      }

      // Create a map of previous month data by employee_id
      const previousMonthMap = new Map(
        (previousMonthData || []).map(record => [
          record.employee_id,
          {
            white_salary: record.white_salary || 0,
            gray_salary: record.gray_salary || 0,
            ndfl: record.ndfl || 0,
            contributions: record.contributions || 0
          }
        ])
      );

      // Calculate "next month bonus" for current payroll month:
      // - bonuses from bankrot_clients ("Спасение" sales bonuses 4.5%)
      // - bonuses from sales.manager_bonus ("Дело Бизнеса" sales)
      const salesBonusesByEmployee = await calculateSalesBonuses(selectedMonth);
      const bankrotManagerBonuses = await calculateManagerBonuses(selectedMonth);

      // Start with direct bonuses keyed by employee_id
      const nextMonthBonusMap = new Map<string, number>(salesBonusesByEmployee);

      // Add bonuses keyed by manager full name (bankrot_clients.manager)
      for (const [managerName, bonus] of bankrotManagerBonuses) {
        const employee = findEmployeeByManagerName(managerName, allProfiles);
        if (employee) {
          nextMonthBonusMap.set(employee.id, (nextMonthBonusMap.get(employee.id) || 0) + bonus);
        }
      }

      // Keep a plain object version for components that rely on DB rows (DepartmentCard)
      setNextMonthBonuses(Object.fromEntries(nextMonthBonusMap));

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
        const previousData = previousMonthMap.get(profile.id);

        return {
          id: deptRecord?.id || `temp-${profile.id}`,
          employee_id: profile.id,
          department_id: deptRecord?.department_id || null,
          user_id: user.id,
          month: selectedMonth,
          company: deptRecord?.company || 'Спасение',
          white_salary: deptRecord?.white_salary || previousData?.white_salary || 0,
          gray_salary: deptRecord?.gray_salary || previousData?.gray_salary || 0,
          advance: deptRecord?.advance || 0,
          bonus: deptRecord?.bonus || 0,
          next_month_bonus: nextMonthBonusMap.get(profile.id) || 0,
          ndfl: deptRecord?.ndfl || previousData?.ndfl || 0,
          contributions: deptRecord?.contributions || previousData?.contributions || 0,
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
      if (!user) return;
      
      setLoading(true);
      // Admins see all departments, regular users see only their own
      let query = supabase
        .from('departments')
        .select('*');
      
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query.order('name', { ascending: true });

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

  if (loading || authLoading || (!isDemo && user && !adminCheckComplete)) {
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
            <Select value={selectedMonthNum.toString()} onValueChange={(val) => setSelectedMonthNum(parseInt(val))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">Год:</span>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isDemo && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const monthLabel = `${monthNames[selectedMonthNum]} ${selectedYear}`;
                    const deptData = departments.map((dept) => {
                      const deptEmployees = allEmployees.filter(
                        (e: any) => e.department_id === dept.id
                      );
                      return {
                        name: dept.name,
                        employees: deptEmployees.map((e: any) => ({
                          name: `${e.profiles?.last_name || ""} ${e.profiles?.first_name || ""}`.trim(),
                          position: e.profiles?.position || "",
                          company: e.company || "",
                          total_amount: e.total_amount || 0,
                          white_salary: e.white_salary || 0,
                          gray_salary: e.gray_salary || 0,
                          advance: e.advance || 0,
                          ndfl: e.ndfl || 0,
                          contributions: e.contributions || 0,
                          bonus: e.bonus || 0,
                          next_month_bonus: e.next_month_bonus || 0,
                          cost: e.cost || 0,
                          net_salary: e.net_salary || 0,
                          paid_total:
                            (e.paid_white || 0) +
                            (e.paid_gray || 0) +
                            (e.paid_advance || 0) +
                            (e.paid_bonus || 0) +
                            (e.paid_net_salary || 0),
                        })),
                      };
                    });
                    await exportPayrollToPdf(deptData, monthLabel);
                  }}
                  title="Экспорт в PDF"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateBonuses}
                  disabled={recalculatingBonuses}
                  title="Пересчитать премии на основе продаж за предыдущий месяц"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculatingBonuses ? 'animate-spin' : ''}`} />
                  Пересчитать премии
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFromPreviousMonth}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Синхр. зарплат
                </Button>
              </>
            )}
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
                    nextMonthBonuses={nextMonthBonuses}
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
