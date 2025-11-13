import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientsList } from "@/components/ClientsList";
import { ClientDetailView } from "@/components/ClientDetailView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  full_name: string;
  contract_amount: number;
  installment_period: number;
  first_payment: number;
  monthly_payment: number;
  remaining_amount: number;
  total_paid: number;
  deposit_paid: number;
  deposit_target: number;
  payment_day: number;
  employee_id: string;
  contract_date: string;
  created_at: string;
  updated_at: string;
}

export default function Clients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);

      // Получаем клиентов
      const { data: clientsData, error: clientsError } = await supabase
        .from('bankrot_clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Получаем информацию о сотрудниках
      const employeeIds = [...new Set(clientsData?.map(c => c.employee_id).filter(Boolean) || [])];
      
      if (employeeIds.length > 0) {
        const { data: employees } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', employeeIds);

        const empMap = (employees || []).reduce((acc, emp) => {
          const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Без имени';
          acc[emp.user_id] = fullName;
          return acc;
        }, {} as Record<string, string>);

        setEmployeesMap(empMap);
      }

      setClients(clientsData || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      toast({
        variant: "destructive",
        title: "Ошибка загрузки",
        description: error.message || "Не удалось загрузить данные клиентов"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = selectedClientId 
    ? clients.find(c => c.id === selectedClientId) 
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (selectedClient) {
    return (
      <ClientDetailView 
        client={selectedClient} 
        onBack={() => setSelectedClientId(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden xs:inline">Назад к панели</span>
            <span className="xs:hidden">Назад</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Клиенты</h1>
            <p className="text-muted-foreground mt-1">
              Все клиенты из приложения Bankrot Helper
            </p>
          </div>
        </div>

        <ClientsList 
          clients={clients}
          employeesMap={employeesMap}
          onClientSelect={setSelectedClientId}
        />
      </div>
    </div>
  );
}