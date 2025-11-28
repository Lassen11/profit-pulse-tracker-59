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
import { Save } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  position: string | null;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
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
    fetchBonusData();
  }, [selectedMonth]);

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

      // Get employees from this department
      const { data: deptEmployees, error: empError } = await supabase
        .from('department_employees')
        .select('employee_id')
        .eq('department_id', departments.id)
        .eq('month', selectedMonth);

      if (empError) throw empError;

      const employeeIds = deptEmployees?.map(de => de.employee_id) || [];

      if (employeeIds.length === 0) {
        setEmployees([]);
        return;
      }

      // Get employee profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name, position')
        .in('id', employeeIds)
        .eq('is_active', true);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    <div>
                      <div>{employee.last_name} {employee.first_name} {employee.middle_name}</div>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}