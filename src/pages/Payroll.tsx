import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft } from "lucide-react";
import { DepartmentDialog } from "@/components/DepartmentDialog";
import { DepartmentCard } from "@/components/DepartmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollAnalytics } from "@/components/PayrollAnalytics";
import { PayrollSales } from "@/components/PayrollSales";

export interface Department {
  id: string;
  name: string;
  project_name: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function Payroll() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDepartments();
    }
  }, [user]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить отделы",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDepartment = async (departmentData: Omit<Department, 'id' | 'created_at' | 'updated_at' | 'user_id'> & { id?: string }) => {
    if (!user) return;

    try {
      if (departmentData.id) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: departmentData.name,
            project_name: departmentData.project_name
          })
          .eq('id', departmentData.id);

        if (error) throw error;

        toast({
          title: "Отдел обновлен",
          description: "Изменения успешно сохранены"
        });
      } else {
        const { error } = await supabase
          .from('departments')
          .insert({
            user_id: user.id,
            name: departmentData.name,
            project_name: departmentData.project_name
          });

        if (error) throw error;

        toast({
          title: "Отдел создан",
          description: "Новый отдел успешно добавлен"
        });
      }

      fetchDepartments();
      setDialogOpen(false);
      setEditDepartment(null);
    } catch (error) {
      console.error('Error saving department:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить отдел",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Отдел удален",
        description: "Отдел успешно удален"
      });

      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить отдел",
        variant: "destructive"
      });
    }
  };

  const handleEditDepartment = (department: Department) => {
    setEditDepartment(department);
    setDialogOpen(true);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-4xl font-bold">ФОТ (Фонд оплаты труда)</h1>
        </div>

        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="departments">ФОТ</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
            <TabsTrigger value="sales">Продажи</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <div className="flex justify-end mb-6">
              <Button onClick={() => {
                setEditDepartment(null);
                setDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить отдел
              </Button>
            </div>

            {departments.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">Нет добавленных отделов</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать первый отдел
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {departments.map((department) => (
                  <DepartmentCard
                    key={department.id}
                    department={department}
                    onEdit={handleEditDepartment}
                    onDelete={handleDeleteDepartment}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <PayrollAnalytics />
          </TabsContent>

          <TabsContent value="sales">
            <PayrollSales />
          </TabsContent>
        </Tabs>

        <DepartmentDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditDepartment(null);
          }}
          onSave={handleSaveDepartment}
          department={editDepartment}
        />
      </div>
    </div>
  );
}
