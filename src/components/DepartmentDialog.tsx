import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Department } from "@/pages/Payroll";
import { useFormPersistence } from "@/hooks/useFormPersistence";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (department: Omit<Department, 'id' | 'created_at' | 'updated_at' | 'user_id'> & { id?: string }) => void;
  department: Department | null;
}

export function DepartmentDialog({ open, onOpenChange, onSave, department }: DepartmentDialogProps) {
  const [name, setName] = useState("");
  const [projectName, setProjectName] = useState("");

  const formKey = `department-dialog-${department?.id || 'new'}`;
  const { restoreValues, clearStoredValues } = useFormPersistence({
    key: formKey,
    values: {
      name,
      projectName
    },
    enabled: open && !department
  });

  useEffect(() => {
    if (department) {
      setName(department.name);
      setProjectName(department.project_name || "");
    } else {
      const restored = restoreValues();
      if (restored) {
        setName(restored.name || "");
        setProjectName(restored.projectName || "");
      } else {
        setName("");
        setProjectName("");
      }
    }
  }, [department, open, restoreValues]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: department?.id,
      name,
      project_name: projectName || null
    });
    clearStoredValues();
  }, [department, name, projectName, onSave, clearStoredValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Редактировать отдел" : "Добавить отдел"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название отдела</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Отдел продаж"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Проект</Label>
              <Input
                id="project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Название проекта (необязательно)"
              />
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
