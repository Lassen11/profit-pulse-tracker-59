import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Save, Archive, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  position: string | null;
  is_active: boolean;
}

interface BonusPoints {
  employee_id: string;
  case_category: number;
  urgency: number;
  assistance: number;
  qualification: number;
  marketing: number;
  crm: number;
  improvements: number;
  overtime: number;
  leadership_bonus: number;
  minus_points: number;
}

export function DepartmentBonuses() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bonusData, setBonusData] = useState<Record<string, BonusPoints>>({});
  const [previousMonthData, setPreviousMonthData] = useState<Record<string, BonusPoints>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [showArchived, setShowArchived] = useState(false);
  const [pointValue, setPointValue] = useState<number>(() => {
    const stored = localStorage.getItem('bonus-point-value');
    return stored ? Number(stored) : 1000;
  });
  const { toast } = useToast();
  const { user } = useAuth();

  // Generate last 12 months for month filter
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return format(startOfMonth(date), 'yyyy-MM-dd');
  });

  useEffect(() => {
    fetchLegalDepartmentEmployees();
  }, [showArchived]);

  useEffect(() => {
    fetchBonusData();
    fetchPreviousMonthData();
  }, [selectedMonth]);

  useEffect(() => {
    localStorage.setItem('bonus-point-value', pointValue.toString());
  }, [pointValue]);

  const fetchLegalDepartmentEmployees = async () => {
    try {
      setLoading(true);
      
      // Find Legal Department
      const { data: departments, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .eq('name', 'Юридический департамент')
        .maybeSingle();

      if (deptError) throw deptError;
      
      if (!departments) {
        setEmployees([]);
        return;
      }

      // Get all unique employees from this department (across all months)
      const { data: deptEmployees, error: empError } = await supabase
        .from('department_employees')
        .select('employee_id')
        .eq('department_id', departments.id);

      if (empError) throw empError;

      // Get unique employee IDs
      const uniqueEmployeeIds = Array.from(new Set(deptEmployees?.map(de => de.employee_id) || []));

      if (uniqueEmployeeIds.length === 0) {
        setEmployees([]);
        return;
      }

      // Get employee profiles - filter by is_active based on showArchived state
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name, position, is_active')
        .in('id', uniqueEmployeeIds);

      // If not showing archived, only get active employees
      if (!showArchived) {
        query = query.eq('is_active', true);
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) throw profilesError;

      setEmployees(profiles || []);
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

  const fetchBonusData = async () => {
    try {
      const { data, error } = await supabase
        .from('department_bonus_points')
        .select('*')
        .eq('month', selectedMonth);

      if (error) throw error;

      const bonusMap: Record<string, BonusPoints> = {};
      data?.forEach(record => {
        bonusMap[record.employee_id] = {
          employee_id: record.employee_id,
          case_category: record.case_category || 0,
          urgency: record.urgency || 0,
          assistance: record.assistance || 0,
          qualification: record.qualification || 0,
          marketing: record.marketing || 0,
          crm: record.crm || 0,
          improvements: record.improvements || 0,
          overtime: record.overtime || 0,
          leadership_bonus: record.leadership_bonus || 0,
          minus_points: record.minus_points || 0,
        };
      });

      setBonusData(bonusMap);
    } catch (error) {
      console.error('Error fetching bonus data:', error);
    }
  };

  const fetchPreviousMonthData = async () => {
    try {
      const currentDate = new Date(selectedMonth);
      currentDate.setMonth(currentDate.getMonth() - 1);
      const previousMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('department_bonus_points')
        .select('*')
        .eq('month', previousMonth);

      if (error) throw error;

      const bonusMap: Record<string, BonusPoints> = {};
      data?.forEach(record => {
        bonusMap[record.employee_id] = {
          employee_id: record.employee_id,
          case_category: record.case_category || 0,
          urgency: record.urgency || 0,
          assistance: record.assistance || 0,
          qualification: record.qualification || 0,
          marketing: record.marketing || 0,
          crm: record.crm || 0,
          improvements: record.improvements || 0,
          overtime: record.overtime || 0,
          leadership_bonus: record.leadership_bonus || 0,
          minus_points: record.minus_points || 0,
        };
      });

      setPreviousMonthData(bonusMap);
    } catch (error) {
      console.error('Error fetching previous month data:', error);
    }
  };

  const updateBonusPoints = (employeeId: string, field: keyof BonusPoints, value: number) => {
    setBonusData(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        employee_id: employeeId,
        case_category: prev[employeeId]?.case_category || 0,
        urgency: prev[employeeId]?.urgency || 0,
        assistance: prev[employeeId]?.assistance || 0,
        qualification: prev[employeeId]?.qualification || 0,
        marketing: prev[employeeId]?.marketing || 0,
        crm: prev[employeeId]?.crm || 0,
        improvements: prev[employeeId]?.improvements || 0,
        overtime: prev[employeeId]?.overtime || 0,
        leadership_bonus: prev[employeeId]?.leadership_bonus || 0,
        minus_points: prev[employeeId]?.minus_points || 0,
        [field]: value,
      }
    }));
  };

  const calculateTotalPoints = (employeeId: string): number => {
    const bonus = bonusData[employeeId];
    if (!bonus) return 0;
    
    return (
      bonus.case_category +
      bonus.urgency +
      bonus.assistance +
      bonus.qualification +
      bonus.marketing +
      bonus.crm +
      bonus.improvements +
      bonus.overtime +
      bonus.leadership_bonus -
      bonus.minus_points
    );
  };

  const calculatePreviousPoints = (employeeId: string): number => {
    const bonus = previousMonthData[employeeId];
    if (!bonus) return 0;
    
    return (
      bonus.case_category +
      bonus.urgency +
      bonus.assistance +
      bonus.qualification +
      bonus.marketing +
      bonus.crm +
      bonus.improvements +
      bonus.overtime +
      bonus.leadership_bonus -
      bonus.minus_points
    );
  };

  const getPointsChange = (employeeId: string) => {
    const current = calculateTotalPoints(employeeId);
    const previous = calculatePreviousPoints(employeeId);
    
    if (previous === 0) return null;
    
    const change = current - previous;
    const percentChange = ((change / previous) * 100).toFixed(1);
    
    return {
      change,
      percentChange: parseFloat(percentChange),
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatistics = () => {
    const totalPointsByCategory = {
      case_category: 0,
      urgency: 0,
      assistance: 0,
      qualification: 0,
      marketing: 0,
      crm: 0,
      improvements: 0,
      overtime: 0,
      leadership_bonus: 0,
      minus_points: 0,
    };

    const employeePoints: Array<{ id: string; name: string; points: number; isActive: boolean }> = [];

    employees.forEach(employee => {
      const bonus = bonusData[employee.id];
      if (bonus) {
        totalPointsByCategory.case_category += bonus.case_category;
        totalPointsByCategory.urgency += bonus.urgency;
        totalPointsByCategory.assistance += bonus.assistance;
        totalPointsByCategory.qualification += bonus.qualification;
        totalPointsByCategory.marketing += bonus.marketing;
        totalPointsByCategory.crm += bonus.crm;
        totalPointsByCategory.improvements += bonus.improvements;
        totalPointsByCategory.overtime += bonus.overtime;
        totalPointsByCategory.leadership_bonus += bonus.leadership_bonus;
        totalPointsByCategory.minus_points += bonus.minus_points;
      }
      
      const totalPoints = calculateTotalPoints(employee.id);
      employeePoints.push({
        id: employee.id,
        name: `${employee.last_name} ${employee.first_name}`,
        points: totalPoints,
        isActive: employee.is_active
      });
    });

    // Sort by points and get top 3
    const topEmployees = [...employeePoints]
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    // Calculate average points (only for employees with data)
    const employeesWithPoints = employeePoints.filter(emp => emp.points > 0);
    const averagePoints = employeesWithPoints.length > 0
      ? employeesWithPoints.reduce((sum, emp) => sum + emp.points, 0) / employeesWithPoints.length
      : 0;

    // Calculate total points across all categories
    const totalPoints = Object.values(totalPointsByCategory).reduce((sum, val) => sum + val, 0) - totalPointsByCategory.minus_points;

    return {
      totalPointsByCategory,
      topEmployees,
      averagePoints,
      totalPoints,
    };
  };

  const statistics = getStatistics();

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setSaving(true);

      const records = Object.values(bonusData).map(bonus => ({
        employee_id: bonus.employee_id,
        month: selectedMonth,
        case_category: bonus.case_category,
        urgency: bonus.urgency,
        assistance: bonus.assistance,
        qualification: bonus.qualification,
        marketing: bonus.marketing,
        crm: bonus.crm,
        improvements: bonus.improvements,
        overtime: bonus.overtime,
        leadership_bonus: bonus.leadership_bonus,
        minus_points: bonus.minus_points,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('department_bonus_points')
        .upsert(records, {
          onConflict: 'employee_id,month'
        });

      if (error) throw error;

      toast({
        title: "Данные сохранены",
        description: "Баллы премий успешно сохранены"
      });
    } catch (error) {
      console.error('Error saving bonus data:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить данные",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          Нет сотрудников в Юридическом департаменте за выбранный месяц
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Премии Юридического департамента</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="point-value" className="text-sm whitespace-nowrap">
              Стоимость балла:
            </Label>
            <Input
              id="point-value"
              type="number"
              min="0"
              step="100"
              value={pointValue}
              onChange={(e) => setPointValue(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">₽</span>
          </div>
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="show-archived" className="text-sm cursor-pointer">
              Показать архивных
            </Label>
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
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
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>

      {employees.length > 0 && (
        <Card className="p-6 mb-4 bg-primary/5">
          <h3 className="text-lg font-semibold mb-4">Статистика по премиям за {format(new Date(selectedMonth), 'LLLL yyyy', { locale: ru })}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Points */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Общая сумма баллов</div>
              <div className="text-3xl font-bold text-primary">{statistics.totalPoints}</div>
              <div className="text-xs text-muted-foreground">
                по всем категориям (минус штрафные)
              </div>
            </div>

            {/* Average Points */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Средний балл по отделу</div>
              <div className="text-3xl font-bold text-primary">
                {statistics.averagePoints.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">
                среди сотрудников с баллами
              </div>
            </div>

            {/* Top Employees */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-2">Топ-3 сотрудника</div>
              <div className="space-y-1">
                {statistics.topEmployees.map((emp, index) => (
                  <div key={emp.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{index + 1}.</span>
                      <span className={!emp.isActive ? "opacity-60" : ""}>
                        {emp.name}
                        {!emp.isActive && <span className="ml-1 text-xs">(Архив)</span>}
                      </span>
                    </div>
                    <span className="font-semibold">{emp.points} б.</span>
                  </div>
                ))}
                {statistics.topEmployees.length === 0 && (
                  <div className="text-xs text-muted-foreground">Нет данных</div>
                )}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold mb-3">Распределение по категориям:</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Категория дела:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.case_category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Срочность:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.urgency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Содействие:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.assistance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Повышение квал:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.qualification}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Маркетинг:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.marketing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CRM:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.crm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Улучшения:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.improvements}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сверхнорма:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.overtime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Бонус руководства:</span>
                <span className="font-medium">{statistics.totalPointsByCategory.leadership_bonus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-destructive">Минус баллы:</span>
                <span className="font-medium text-destructive">-{statistics.totalPointsByCategory.minus_points}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">Сотрудник</TableHead>
                <TableHead className="text-center min-w-[120px]">Категория дела</TableHead>
                <TableHead className="text-center min-w-[120px]">Срочность (A-1/A-3)</TableHead>
                <TableHead className="text-center min-w-[120px]">Содействие</TableHead>
                <TableHead className="text-center min-w-[120px]">Повышение квал</TableHead>
                <TableHead className="text-center min-w-[120px]">Маркетинг</TableHead>
                <TableHead className="text-center min-w-[120px]">CRM</TableHead>
                <TableHead className="text-center min-w-[120px]">Улучшения</TableHead>
                <TableHead className="text-center min-w-[120px]">Сверхнорма</TableHead>
                <TableHead className="text-center min-w-[150px]">Бонус от Руководства</TableHead>
                <TableHead className="text-center min-w-[120px]">Минус баллы</TableHead>
                <TableHead className="text-center min-w-[120px] font-bold">Итого баллов</TableHead>
                <TableHead className="text-center min-w-[150px] font-bold">Изменение</TableHead>
                <TableHead className="text-right min-w-[150px] font-bold">Премия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} className={!employee.is_active ? "opacity-60" : ""}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    <div>
                      <div className="flex items-center gap-2">
                        {employee.last_name} {employee.first_name} {employee.middle_name}
                        {!employee.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-muted rounded">Архив</span>
                        )}
                      </div>
                      {employee.position && (
                        <div className="text-xs text-muted-foreground">{employee.position}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.case_category || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'case_category', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.urgency || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'urgency', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.assistance || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'assistance', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.qualification || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'qualification', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.marketing || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'marketing', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.crm || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'crm', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.improvements || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'improvements', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.overtime || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'overtime', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.leadership_bonus || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'leadership_bonus', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={bonusData[employee.id]?.minus_points || 0}
                      onChange={(e) => updateBonusPoints(employee.id, 'minus_points', Number(e.target.value))}
                      className="w-20 text-center"
                    />
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg">
                    {calculateTotalPoints(employee.id)}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const change = getPointsChange(employee.id);
                      if (!change) return <span className="text-xs text-muted-foreground">Нет данных</span>;
                      
                      return (
                        <div className="flex items-center justify-center gap-1">
                          {change.change > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              <span className="text-green-500 font-medium">
                                +{change.percentChange}%
                              </span>
                            </>
                          ) : change.change < 0 ? (
                            <>
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              <span className="text-red-500 font-medium">
                                {change.percentChange}%
                              </span>
                            </>
                          ) : (
                            <>
                              <Minus className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">0%</span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">
                    {formatCurrency(calculateTotalPoints(employee.id) * pointValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}