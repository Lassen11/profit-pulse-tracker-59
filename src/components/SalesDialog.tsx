import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFormPersistence } from "@/hooks/useFormPersistence";

interface Sale {
  id?: string;
  employee_id: string;
  client_name: string;
  payment_amount: number;
  contract_amount: number;
  city: string;
  lead_source: string;
  manager_bonus: number;
  payment_date: string;
}

interface SalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sale: Sale) => void;
  sale: Sale | null;
}

interface SalesEmployee {
  id: string;
  name: string;
}

export function SalesDialog({ open, onOpenChange, onSave, sale }: SalesDialogProps) {
  const [formData, setFormData] = useState<Sale>({
    employee_id: "",
    client_name: "",
    payment_amount: 0,
    contract_amount: 0,
    city: "",
    lead_source: "",
    manager_bonus: 0,
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [salesEmployees, setSalesEmployees] = useState<SalesEmployee[]>([]);

  const formKey = `sales-dialog-${sale?.id || 'new'}`;
  const { restoreValues, clearStoredValues } = useFormPersistence({
    key: formKey,
    values: formData,
    enabled: open && !sale
  });

  useEffect(() => {
    if (open) {
      fetchSalesEmployees();
      if (sale) {
        setFormData({
          id: sale.id,
          employee_id: sale.employee_id,
          client_name: sale.client_name,
          payment_amount: sale.payment_amount,
          contract_amount: sale.contract_amount,
          city: sale.city,
          lead_source: sale.lead_source,
          manager_bonus: sale.manager_bonus,
          payment_date: sale.payment_date
        });
      } else {
        const restored = restoreValues();
        if (restored) {
          setFormData(restored);
        } else {
          setFormData({
            employee_id: "",
            client_name: "",
            payment_amount: 0,
            contract_amount: 0,
            city: "",
            lead_source: "",
            manager_bonus: 0,
            payment_date: new Date().toISOString().split('T')[0]
          });
        }
      }
    }
  }, [open, sale, restoreValues]);

  const fetchSalesEmployees = async () => {
    try {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, department')
        .eq('department', 'Отдел продаж')
        .eq('is_active', true);

      const employees: SalesEmployee[] = profilesData?.map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`
      })) || [];

      setSalesEmployees(employees);
    } catch (error) {
      console.error('Error fetching sales employees:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    clearStoredValues();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale ? "Редактировать продажу" : "Добавить продажу"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="employee_id">Менеджер</Label>
            <Select
              value={formData.employee_id}
              onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите менеджера" />
              </SelectTrigger>
              <SelectContent>
                {salesEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="client_name">Клиент</Label>
            <Input
              id="client_name"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payment_amount">Сумма платежа</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div>
              <Label htmlFor="contract_amount">Сумма договора</Label>
              <Input
                id="contract_amount"
                type="number"
                step="0.01"
                value={formData.contract_amount}
                onChange={(e) => setFormData({ ...formData, contract_amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Город</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="lead_source">Источник</Label>
              <Select
                value={formData.lead_source}
                onValueChange={(value) => setFormData({ ...formData, lead_source: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите источник" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Авито">Авито</SelectItem>
                  <SelectItem value="Сайт">Сайт</SelectItem>
                  <SelectItem value="Квиз">Квиз</SelectItem>
                  <SelectItem value="Рекомендация Руководителя">Рекомендация Руководителя</SelectItem>
                  <SelectItem value="Рекомендация ОЗ">Рекомендация ОЗ</SelectItem>
                  <SelectItem value="Рекомендация менеджера">Рекомендация менеджера</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manager_bonus">Премия менеджера</Label>
              <Input
                id="manager_bonus"
                type="number"
                step="0.01"
                value={formData.manager_bonus}
                onChange={(e) => setFormData({ ...formData, manager_bonus: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div>
              <Label htmlFor="payment_date">Дата платежа</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">
              {sale ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}