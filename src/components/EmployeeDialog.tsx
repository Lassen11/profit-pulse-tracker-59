import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DepartmentEmployee } from "@/components/DepartmentCard";

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  employee: DepartmentEmployee | null;
  onSave: () => void;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
}

export function EmployeeDialog({ open, onOpenChange, departmentId, employee, onSave }: EmployeeDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
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

  useEffect(() => {
    if (open) {
      fetchProfiles();
      if (employee) {
        setSelectedEmployeeId(employee.employee_id);
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
        resetForm();
      }
    }
  }, [open, employee]);

  const resetForm = () => {
    setSelectedEmployeeId("");
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
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, position')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список сотрудников",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const employeeData = {
        department_id: departmentId,
        employee_id: selectedEmployeeId,
        white_salary: parseFloat(whiteSalary) || 0,
        gray_salary: parseFloat(graySalary) || 0,
        advance: parseFloat(advance) || 0,
        ndfl: parseFloat(ndfl) || 0,
        contributions: parseFloat(contributions) || 0,
        bonus: parseFloat(bonus) || 0,
        next_month_bonus: parseFloat(nextMonthBonus) || 0,
        cost: parseFloat(cost) || 0,
        net_salary: parseFloat(netSalary) || 0,
        total_amount: parseFloat(totalAmount) || 0,
        user_id: user.id
      };

      if (employee) {
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
        const { error } = await supabase
          .from('department_employees')
          .insert(employeeData);

        if (error) throw error;

        toast({
          title: "Сотрудник добавлен",
          description: "Сотрудник успешно добавлен в отдел"
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить данные сотрудника",
        variant: "destructive"
      });
    }
  };

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
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={!!employee}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.first_name} {profile.last_name}
                      {profile.position && ` - ${profile.position}`}
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
