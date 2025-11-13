import { useState } from "react";
import { Search, UserPlus, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  created_at: string;
  updated_at: string;
  nextPayment?: {
    due_date: string;
    amount: number;
  };
}

interface ClientsListProps {
  clients: Client[];
  employeesMap: Record<string, string>;
  onClientSelect?: (clientId: string) => void;
}

export const ClientsList = ({ clients, employeesMap, onClientSelect }: ClientsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const getPaymentStatus = (client: Client) => {
    const totalPaid = client.total_paid || 0;
    const total = client.contract_amount;
    const percentage = (totalPaid / total) * 100;
    
    const today = new Date();
    const clientCreatedDate = new Date(client.created_at);
    
    const monthsPassed = (today.getFullYear() - clientCreatedDate.getFullYear()) * 12 + 
                        (today.getMonth() - clientCreatedDate.getMonth());
    
    let isOverdue = false;
    if (monthsPassed > 0) {
      const currentDay = today.getDate();
      const hasCurrentMonthPaymentPassed = currentDay > client.payment_day;
      
      if ((hasCurrentMonthPaymentPassed || monthsPassed > 1) && percentage < 100) {
        const expectedPaid = client.first_payment + (Math.min(monthsPassed, client.installment_period) * client.monthly_payment);
        isOverdue = totalPaid < expectedPaid;
      }
    }
    
    if (isOverdue) {
      return { text: "Просрочен", variant: "destructive" as const, color: "bg-red-500" };
    }
    
    if (percentage >= 100) return { text: "Оплачено", variant: "default" as const, color: "bg-green-500" };
    if (percentage >= 50) return { text: "Почти готово", variant: "secondary" as const, color: "bg-yellow-500" };
    if (percentage > 0) return { text: "В процессе", variant: "outline" as const, color: "bg-blue-500" };
    return { text: "Не начато", variant: "destructive" as const, color: "bg-red-500" };
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Поиск по ФИО клиента..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет клиентов</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "По вашему запросу ничего не найдено" : "Нет данных для отображения"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => {
            const status = getPaymentStatus(client);
            const isOverdue = status.text === "Просрочен";
            return (
              <Card key={client.id} className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className={`text-lg ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}>
                        {client.full_name}
                      </CardTitle>
                      {employeesMap[client.employee_id] && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Сотрудник: {employeesMap[client.employee_id]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>
                        <div className={`w-2 h-2 rounded-full ${status.color} mr-2`}></div>
                        {status.text}
                      </Badge>
                      {onClientSelect && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onClientSelect(client.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Просмотр
                        </Button>
                      )}
                    </div>
                  </div>
                  {isOverdue && (
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                      Платеж должен был быть внесен до {client.payment_day} числа
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Сумма договора</p>
                      <p className="text-lg font-semibold text-primary">
                        {formatAmount(client.contract_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Внесено</p>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {formatAmount(client.total_paid || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Остаток</p>
                      <p className="text-lg font-semibold text-accent">
                        {formatAmount(client.remaining_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Рассрочка</p>
                      <p className="text-lg font-semibold">
                        {client.installment_period} мес.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Ежемесячно</p>
                      <p className="text-lg font-semibold">
                        {formatAmount(client.monthly_payment)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">День платежа</p>
                      <p className="text-lg font-semibold">
                        {client.payment_day} число
                      </p>
                    </div>
                    {client.nextPayment && (
                      <>
                        <div>
                          <p className="font-medium text-muted-foreground">Дата след. платежа</p>
                          <p className={`text-lg font-semibold ${
                            new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0])
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {new Date(client.nextPayment.due_date).toLocaleDateString('ru-RU')}
                            {new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0]) && (
                              <span className="ml-1 text-xs">(просрочен)</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Сумма след. платежа</p>
                          <p className={`text-lg font-semibold ${
                            new Date(client.nextPayment.due_date) < new Date(new Date().toISOString().split('T')[0])
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            {formatAmount(client.nextPayment.amount)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};