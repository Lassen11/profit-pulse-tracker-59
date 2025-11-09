import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface EditableKPICardProps {
  title: string;
  value: string;
  calculatedValue: number;
  company: string;
  icon?: React.ReactNode;
  className?: string;
  onUpdate: () => void;
}

export function EditableKPICard({ 
  title, 
  value, 
  calculatedValue, 
  company, 
  icon, 
  className,
  onUpdate 
}: EditableKPICardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleEdit = () => {
    setEditValue(calculatedValue.toString());
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const newBalance = parseFloat(editValue);

      if (isNaN(newBalance)) {
        toast({
          title: "Ошибка",
          description: "Введите корректное число",
          variant: "destructive"
        });
        return;
      }

      // Check if adjustment already exists
      const { data: existing } = await supabase
        .from('company_balance_adjustments')
        .select('id')
        .eq('company', company)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('company_balance_adjustments')
          .update({
            adjusted_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('company', company);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('company_balance_adjustments')
          .insert({
            user_id: user.id,
            company,
            adjusted_balance: newBalance
          });

        if (error) throw error;
      }

      toast({
        title: "Сохранено",
        description: "Баланс успешно обновлен"
      });

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving balance:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить баланс",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("kpi-card", className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="kpi-label">{title}</p>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-10"
                disabled={saving}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSave}
                disabled={saving}
                className="h-10 w-10"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={saving}
                className="h-10 w-10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <p className="kpi-value">{value}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleEdit}
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {icon && !isEditing && (
          <div className="text-muted-foreground opacity-70">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
