import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { SalesDialog } from "./SalesDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Sale {
  id: string;
  employee_id: string;
  client_name: string;
  payment_amount: number;
  contract_amount: number;
  city: string;
  lead_source: string;
  manager_bonus: number;
  payment_date: string;
  employee_name?: string;
}

export function PayrollSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      
      const { data: salesData, error } = await supabase
        .from('sales')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const { data: employeesData } = await supabase
        .from('department_employees')
        .select(`
          id,
          employee_id,
          departments!inner(name)
        `)
        .eq('departments.name', 'Отдел Продаж');

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name');

      const profileMap = new Map(
        profilesData?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []
      );

      const employeeMap = new Map(
        employeesData?.map(e => [e.id, profileMap.get(e.employee_id) || 'Неизвестный']) || []
      );

      const formattedSales: Sale[] = salesData?.map(sale => ({
        ...sale,
        employee_name: employeeMap.get(sale.employee_id) || 'Неизвестный'
      })) || [];

      setSales(formattedSales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные о продажах",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSale = async (saleData: Omit<Sale, 'id' | 'employee_name'> & { id?: string }) => {
    if (!user) return;

    try {
      if (saleData.id) {
        const { error } = await supabase
          .from('sales')
          .update({
            employee_id: saleData.employee_id,
            client_name: saleData.client_name,
            payment_amount: saleData.payment_amount,
            contract_amount: saleData.contract_amount,
            city: saleData.city,
            lead_source: saleData.lead_source,
            manager_bonus: saleData.manager_bonus,
            payment_date: saleData.payment_date
          })
          .eq('id', saleData.id);

        if (error) throw error;

        toast({
          title: "Продажа обновлена",
          description: "Изменения успешно сохранены"
        });
      } else {
        const { error } = await supabase
          .from('sales')
          .insert({
            user_id: user.id,
            employee_id: saleData.employee_id,
            client_name: saleData.client_name,
            payment_amount: saleData.payment_amount,
            contract_amount: saleData.contract_amount,
            city: saleData.city,
            lead_source: saleData.lead_source,
            manager_bonus: saleData.manager_bonus,
            payment_date: saleData.payment_date
          });

        if (error) throw error;

        toast({
          title: "Продажа добавлена",
          description: "Новая продажа успешно добавлена"
        });
      }

      fetchSales();
      setDialogOpen(false);
      setEditSale(null);
    } catch (error) {
      console.error('Error saving sale:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить продажу",
        variant: "destructive"
      });
    }
  };

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;

    try {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleToDelete);

      if (error) throw error;

      toast({
        title: "Продажа удалена",
        description: "Запись успешно удалена"
      });

      fetchSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить продажу",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const totalPayments = sales.reduce((sum, s) => sum + s.payment_amount, 0);
  const totalContracts = sales.reduce((sum, s) => sum + s.contract_amount, 0);
  const totalBonuses = sales.reduce((sum, s) => sum + s.manager_bonus, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Отчетность по продажам</h2>
          <Button onClick={() => {
            setEditSale(null);
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить продажу
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Сумма платежей</div>
            <div className="text-2xl font-bold">{formatCurrency(totalPayments)}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Сумма договоров</div>
            <div className="text-2xl font-bold">{formatCurrency(totalContracts)}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Премии менеджерам</div>
            <div className="text-2xl font-bold">{formatCurrency(totalBonuses)}</div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Менеджер</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Город</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead className="text-right">Платеж</TableHead>
              <TableHead className="text-right">Договор</TableHead>
              <TableHead className="text-right">Премия</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              sales.map(sale => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {format(new Date(sale.payment_date), 'dd MMM yyyy', { locale: ru })}
                  </TableCell>
                  <TableCell>{sale.employee_name}</TableCell>
                  <TableCell>{sale.client_name}</TableCell>
                  <TableCell>{sale.city}</TableCell>
                  <TableCell>{sale.lead_source}</TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.payment_amount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.contract_amount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.manager_bonus)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditSale(sale);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSaleToDelete(sale.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <SalesDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditSale(null);
        }}
        onSave={handleSaveSale}
        sale={editSale}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить продажу?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Запись о продаже будет удалена навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSale}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}