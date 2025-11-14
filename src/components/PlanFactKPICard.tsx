import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PlanFactKPICardProps {
  title: string;
  planValue: number;
  factValue: number;
  icon?: React.ReactNode;
  className?: string;
  isEditable?: boolean;
  kpiName?: string;
  company?: string;
  onUpdate?: () => void;
}

export function PlanFactKPICard({ 
  title, 
  planValue, 
  factValue, 
  icon, 
  className,
  isEditable = false,
  kpiName,
  company,
  onUpdate
}: PlanFactKPICardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(planValue.toString());
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const percentage = planValue > 0 ? (factValue / planValue) * 100 : 0;
  const isOverTarget = factValue >= planValue;

  const handleSave = async () => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) {
      toast({
        title: "Ошибка",
        description: "Введите корректное число",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не авторизован");

      const month = new Date();
      month.setDate(1);
      month.setHours(0, 0, 0, 0);

      const { error } = await supabase
        .from('kpi_targets')
        .upsert({
          user_id: user.id,
          company: company || 'Спасение',
          kpi_name: kpiName || '',
          target_value: newValue,
          month: month.toISOString().split('T')[0]
        }, {
          onConflict: 'user_id,company,kpi_name,month'
        });

      if (error) throw error;

      toast({
        title: "Сохранено",
        description: "Плановое значение обновлено"
      });
      
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating target:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить плановое значение",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={cn("kpi-card", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="text-muted-foreground opacity-70">
              {icon}
            </div>
          )}
          <p className="kpi-label">{title}</p>
        </div>
        {isEditable && !isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              setEditValue(planValue.toString());
              setIsEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Plan */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">План</p>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-9"
                autoFocus
              />
              <Button size="sm" onClick={handleSave}>
                Сохранить
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsEditing(false)}
              >
                Отмена
              </Button>
            </div>
          ) : (
            <p className="text-2xl font-bold text-card-foreground">
              {formatCurrency(planValue)}
            </p>
          )}
        </div>

        {/* Fact */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Факт</p>
          <p className="text-2xl font-bold text-card-foreground">
            {formatCurrency(factValue)}
          </p>
        </div>

        {/* Progress indicator */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Выполнение</span>
            <span className={cn(
              "text-sm font-semibold",
              isOverTarget ? "text-green-600" : "text-amber-600"
            )}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                isOverTarget ? "bg-green-600" : "bg-amber-600"
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
