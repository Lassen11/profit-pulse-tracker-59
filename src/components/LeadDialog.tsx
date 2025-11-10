import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const companies = ["Спасение", "Дело Бизнеса", "Кебаб Босс"] as const;

interface LeadDialogProps {
  onSuccess: () => void;
  editData?: {
    id: string;
    company: string;
    date: string;
    total_leads: number;
    qualified_leads: number;
    debt_above_300k: number;
    contracts: number;
    payments: number;
    total_cost: number;
  };
}

export function LeadDialog({ onSuccess, editData }: LeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company: editData?.company || "Спасение",
    date: editData?.date ? new Date(editData.date) : new Date(),
    total_leads: editData?.total_leads || 0,
    qualified_leads: editData?.qualified_leads || 0,
    debt_above_300k: editData?.debt_above_300k || 0,
    contracts: editData?.contracts || 0,
    payments: editData?.payments || 0,
    total_cost: editData?.total_cost || 0
  });
  const { toast } = useToast();
  const { user } = useAuth();

  // Update form data when editData changes
  useEffect(() => {
    if (editData) {
      setFormData({
        company: editData.company,
        date: new Date(editData.date),
        total_leads: editData.total_leads,
        qualified_leads: editData.qualified_leads,
        debt_above_300k: editData.debt_above_300k,
        contracts: editData.contracts,
        payments: editData.payments,
        total_cost: editData.total_cost
      });
      setOpen(true);
    }
  }, [editData]);

  const formatDateForDB = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const formattedDate = formatDateForDB(formData.date);
      
      if (editData) {
        // Update existing record
        const { error } = await supabase
          .from('lead_generation')
          .update({
            company: formData.company,
            date: formattedDate,
            total_leads: formData.total_leads,
            qualified_leads: formData.qualified_leads,
            debt_above_300k: formData.debt_above_300k,
            contracts: formData.contracts,
            payments: formData.payments,
            total_cost: formData.total_cost
          })
          .eq('id', editData.id);

        if (error) throw error;

        toast({
          title: "Данные обновлены",
          description: "Информация о лидогенерации успешно обновлена",
        });
      } else {
        // Insert new record
        const { error } = await supabase
          .from('lead_generation')
          .insert({
            user_id: user.id,
            company: formData.company,
            date: formattedDate,
            total_leads: formData.total_leads,
            qualified_leads: formData.qualified_leads,
            debt_above_300k: formData.debt_above_300k,
            contracts: formData.contracts,
            payments: formData.payments,
            total_cost: formData.total_cost
          });

        if (error) throw error;

        toast({
          title: "Данные добавлены",
          description: "Информация о лидогенерации успешно сохранена",
        });
      }

      setOpen(false);
      setFormData({
        company: "Спасение",
        date: new Date(),
        total_leads: 0,
        qualified_leads: 0,
        debt_above_300k: 0,
        contracts: 0,
        payments: 0,
        total_cost: 0
      });
      onSuccess();
    } catch (error: any) {
      console.error('Error saving lead data:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить данные",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!editData && (
        <DialogTrigger asChild>
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Добавить данные</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editData ? "Редактировать данные лидогенерации" : "Добавить данные лидогенерации"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Компания</Label>
              <Select value={formData.company} onValueChange={(value) => setFormData({...formData, company: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company} value={company}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Дата</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !formData.date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, "dd.MM.yyyy") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={formData.date} onSelect={(date) => date && setFormData({...formData, date})} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_leads">Общее кол. лидов</Label>
              <Input
                id="total_leads"
                type="number"
                min="0"
                value={formData.total_leads}
                onChange={(e) => setFormData({...formData, total_leads: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualified_leads">Квал. лиды</Label>
              <Input
                id="qualified_leads"
                type="number"
                min="0"
                value={formData.qualified_leads}
                onChange={(e) => setFormData({...formData, qualified_leads: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="debt_above_300k">Долг выше 300к</Label>
              <Input
                id="debt_above_300k"
                type="number"
                min="0"
                value={formData.debt_above_300k}
                onChange={(e) => setFormData({...formData, debt_above_300k: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contracts">Договор</Label>
              <Input
                id="contracts"
                type="number"
                min="0"
                value={formData.contracts}
                onChange={(e) => setFormData({...formData, contracts: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payments">Чек</Label>
              <Input
                id="payments"
                type="number"
                min="0"
                value={formData.payments}
                onChange={(e) => setFormData({...formData, payments: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_cost">Стоимость всех лидов</Label>
              <Input
                id="total_cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.total_cost}
                onChange={(e) => setFormData({...formData, total_cost: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}