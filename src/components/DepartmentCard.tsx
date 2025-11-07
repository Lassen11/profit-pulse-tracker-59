import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Plus } from "lucide-react";
import { Department } from "@/pages/Payroll";
import { EmployeeDialog } from "@/components/EmployeeDialog";
import { PayrollTable } from "@/components/PayrollTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DepartmentCardProps {
  department: Department;
  onEdit: (department: Department) => void;
  onDelete: (id: string) => void;
}

export interface DepartmentEmployee {
  id: string;
  department_id: string;
  employee_id: string;
  white_salary: number;
  gray_salary: number;
  advance: number;
  ndfl: number;
  contributions: number;
  bonus: number;
  next_month_bonus: number;
  cost: number;
  net_salary: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
    position: string | null;
  };
}

export function DepartmentCard({ department, onEdit, onDelete }: DepartmentCardProps) {
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<DepartmentEmployee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, [department.id]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('department_employees')
        .select(`
          *,
          profiles:employee_id (
            first_name,
            last_name,
            position
          )
        `)
        .eq('department_id', department.id);

      if (error) throw error;
      setEmployees(data || []);
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

  const handleDeleteDepartment = () => {
    onDelete(department.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{department.name}</CardTitle>
              {department.project_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  Проект: {department.project_name}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditEmployee(null);
                  setEmployeeDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить сотрудника
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(department)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Нет добавленных сотрудников</p>
              <Button
                variant="link"
                onClick={() => setEmployeeDialogOpen(true)}
                className="mt-2"
              >
                Добавить первого сотрудника
              </Button>
            </div>
          ) : (
            <PayrollTable
              employees={employees}
              departmentId={department.id}
              projectName={department.project_name}
              onRefresh={fetchEmployees}
            />
          )}
        </CardContent>
      </Card>

      <EmployeeDialog
        open={employeeDialogOpen}
        onOpenChange={(open) => {
          setEmployeeDialogOpen(open);
          if (!open) setEditEmployee(null);
        }}
        departmentId={department.id}
        employee={editEmployee}
        onSave={() => {
          fetchEmployees();
          setEmployeeDialogOpen(false);
          setEditEmployee(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отдел?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Все сотрудники и данные о зарплатах в этом отделе будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDepartment}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
