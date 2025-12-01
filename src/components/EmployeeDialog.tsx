import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DepartmentEmployee } from "@/components/DepartmentCard";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { format } from "date-fns";

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  employee: DepartmentEmployee | null;
  onSave: () => void;
  defaultCompany?: string;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  position: string | null;
}

const companies = ["Спасение", "Дело Бизнеса", "Кебаб Босс"] as const;

export function EmployeeDialog({ open, onOpenChange, departmentId, employee, onSave, defaultCompany = "Спасение" }: EmployeeDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(defaultCompany);
  const [whiteSalary, setWhiteSalary] = useState("0");
  const [graySalary, setGraySalary] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [ndfl, setNdfl] = useState("0");
  const [contributions, setContributions] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [nextMonthBonus, setNextMonthBonus] = useState("0");
  const [cost, setCost] = useState("0");
  const [netSalary, setNetSalary] = useState("0");
  const [totalAmount, setTotalAmount] = useState("0");
  const { toast } = useToast();
  const { user } = useAuth();

  const formKey = `employee-dialog-${departmentId}-${employee?.id || 'new'}`;
  const { restoreValues, clearStoredValues } = useFormPersistence({
    key: formKey,
    values: {
      selectedEmployeeId,
      selectedCompany,
      whiteSalary,
      graySalary,
      advance,
      ndfl,
      contributions,
      bonus,
      nextMonthBonus,
      cost,
      netSalary,
      totalAmount
    },
    enabled: open && !employee
  });

  const resetForm = useCallback(() => {
    setSelectedEmployeeId("");
    setSelectedCompany(defaultCompany);
    setWhiteSalary("0");
    setGraySalary("0");
    setAdvance("0");
    setNdfl("0");
    setContributions("0");
    setBonus("0");
    setNextMonthBonus("0");
    setCost("0");
    setNetSalary("0");
    setTotalAmount("0");
  }, [defaultCompany]);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name, position')
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      if (error) throw error;
      
      let profilesList = data || [];
      
      // Если редактируем сотрудника и его профиля нет в списке (например, он неактивен),
      // добавляем его в список, чтобы он был доступен для выбора
      if (employee && employee.employee_id) {
        const existsInList = profilesList.some(p => p.id === employee.employee_id);
        if (!existsInList) {
          // Загружаем профиль редактируемого сотрудника
          const { data: employeeProfile, error: empError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, middle_name, position')
            .eq('id', employee.employee_id)
            .single();
          
          if (!empError && employeeProfile) {
            profilesList = [employeeProfile, ...profilesList];
          }
        }
      }
      
      setProfiles(profilesList);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список сотрудников",
        variant: "destructive"
      });
    }
  }, [employee, toast]);

  // Загружаем профили при открытии диалога ДО установки значений
  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open, fetchProfiles]);

  // Устанавливаем значения формы после загрузки профилей
  useEffect(() => {
    if (open && profiles.length > 0) {
      if (employee) {
        // Устанавливаем данные редактируемого сотрудника
        setSelectedEmployeeId(employee.employee_id);
        setSelectedCompany(employee.company || defaultCompany);
        setWhiteSalary(employee.white_salary.toString());
        setGraySalary(employee.gray_salary.toString());
        setAdvance(employee.advance.toString());
        setNdfl(employee.ndfl.toString());
        setContributions(employee.contributions.toString());
        setBonus(employee.bonus.toString());
        setNextMonthBonus(employee.next_month_bonus.toString());
        setCost(employee.cost.toString());
        setNetSalary(employee.net_salary.toString());
        setTotalAmount(employee.total_amount.toString());
      } else {
        // Пытаемся восстановить сохраненные значения
        const restored = restoreValues();
        if (restored) {
          setSelectedEmployeeId(restored.selectedEmployeeId || "");
          setSelectedCompany(restored.selectedCompany || defaultCompany);
          setWhiteSalary(restored.whiteSalary || "0");
          setGraySalary(restored.graySalary || "0");
          setAdvance(restored.advance || "0");
          setNdfl(restored.ndfl || "0");
          setContributions(restored.contributions || "0");
          setBonus(restored.bonus || "0");
          setNextMonthBonus(restored.nextMonthBonus || "0");
          setCost(restored.cost || "0");
          setNetSalary(restored.netSalary || "0");
          setTotalAmount(restored.totalAmount || "0");
        } else {
          resetForm();
        }
      }
    }
  }, [open, profiles, employee, defaultCompany, resetForm, restoreValues]);

  // Автоматический расчет НДФЛ (13%) и Взносов (30%) при изменении белой зарплаты
  useEffect(() => {
    const white = parseFloat(whiteSalary) || 0;
    const calculatedNdfl = white * 0.13;
    const calculatedContributions = white * 0.30;
    
    setNdfl(calculatedNdfl.toFixed(2));
    setContributions(calculatedContributions.toFixed(2));
  }, [whiteSalary]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedEmployeeId) {
      toast({
        title: "Ошибка",
        description: "Выберите сотрудника",
        variant: "destructive"
      });
      return;
    }

    try {
      const white = parseFloat(whiteSalary) || 0;
      const gray = parseFloat(graySalary) || 0;
      const adv = parseFloat(advance) || 0;
      const ndflVal = parseFloat(ndfl) || 0;
      const contrib = parseFloat(contributions) || 0;
      const bon = parseFloat(bonus) || 0;
      
      // Автоматические расчеты
      const calculatedTotal = white + gray;
      const calculatedCost = white + gray + ndflVal + contrib + bon;
      const calculatedNetSalary = calculatedTotal + bon - adv - ndflVal;
      
      const employeeData = {
        department_id: departmentId,
        employee_id: selectedEmployeeId,
        company: selectedCompany,
        white_salary: white,
        gray_salary: gray,
        advance: adv,
        ndfl: ndflVal,
        contributions: contrib,
        bonus: bon,
        next_month_bonus: parseFloat(nextMonthBonus) || 0,
        cost: calculatedCost,
        net_salary: calculatedNetSalary,
        total_amount: calculatedTotal,
        user_id: user.id
      };

      // Проверяем, является ли ID временным (начинается с "temp-")
      const isTemporaryId = employee && employee.id.startsWith('temp-');

      if (employee && !isTemporaryId) {
        // UPDATE существующей записи с реальным ID
        const { error } = await supabase
          .from('department_employees')
          .update(employeeData)
          .eq('id', employee.id);

        if (error) throw error;

        toast({
          title: "Данные обновлены",
          description: "Информация о сотруднике успешно обновлена"
        });
      } else {
        // INSERT новой записи (для временных ID или новых сотрудников)
        const { error } = await supabase
          .from('department_employees')
          .insert({
            ...employeeData,
            month: format(new Date(), 'yyyy-MM-01')
          });

        if (error) throw error;

        toast({
          title: "Сотрудник добавлен",
          description: "Сотрудник успешно добавлен в отдел"
        });
      }

      clearStoredValues();
      onSave();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить данные сотрудника",
        variant: "destructive"
      });
    }
  }, [
    user, departmentId, selectedEmployeeId, selectedCompany, 
    whiteSalary, graySalary, advance, ndfl, contributions, 
    bonus, nextMonthBonus, employee, toast, clearStoredValues, onSave
  ]);

  const memoizedProfiles = useMemo(() => profiles, [profiles]);
  const memoizedCompanies = useMemo(() => companies, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Редактировать сотрудника" : "Добавить сотрудника"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Сотрудник</Label>
              <Select
                key={`employee-select-${employee?.id || 'new'}-${selectedEmployeeId}`}
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {memoizedProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.last_name} {profile.first_name} {profile.middle_name || ''}
                      {profile.position && ` - ${profile.position}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Компания</Label>
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите компанию" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {memoizedCompanies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="white_salary">Белая</Label>
                <Input
                  id="white_salary"
                  type="number"
                  step="0.01"
                  value={whiteSalary}
                  onChange={(e) => setWhiteSalary(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gray_salary">Серая</Label>
                <Input
                  id="gray_salary"
                  type="number"
                  step="0.01"
                  value={graySalary}
                  onChange={(e) => setGraySalary(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="advance">Аванс</Label>
                <Input
                  id="advance"
                  type="number"
                  step="0.01"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ndfl">НДФЛ</Label>
                <Input
                  id="ndfl"
                  type="number"
                  step="0.01"
                  value={ndfl}
                  onChange={(e) => setNdfl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contributions">Взносы</Label>
                <Input
                  id="contributions"
                  type="number"
                  step="0.01"
                  value={contributions}
                  onChange={(e) => setContributions(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonus">Премия</Label>
                <Input
                  id="bonus"
                  type="number"
                  step="0.01"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="next_month_bonus">Премия сл. мес</Label>
                <Input
                  id="next_month_bonus"
                  type="number"
                  step="0.01"
                  value={nextMonthBonus}
                  onChange={(e) => setNextMonthBonus(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Стоимость</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="net_salary">На руки</Label>
                <Input
                  id="net_salary"
                  type="number"
                  step="0.01"
                  value={netSalary}
                  onChange={(e) => setNetSalary(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_amount">Общая сумма</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">Сохранить</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
