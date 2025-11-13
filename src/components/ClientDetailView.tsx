import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
  contract_date: string;
  created_at: string;
}

interface ClientDetailViewProps {
  client: Client;
  onBack: () => void;
}

export const ClientDetailView = ({ client, onBack }: ClientDetailViewProps) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getPaymentStatus = (remaining: number, total: number) => {
    if (remaining <= 0) {
      return { text: "Оплачено", variant: "default" as const, color: "bg-green-500" };
    } else if (remaining < total * 0.5) {
      return { text: "Почти готово", variant: "secondary" as const, color: "bg-yellow-500" };
    } else {
      return { text: "В процессе", variant: "outline" as const, color: "bg-blue-500" };
    }
  };

  const paymentStatus = getPaymentStatus(client.remaining_amount, client.contract_amount);
  const totalPaidAmount = (client.total_paid || 0) + (client.deposit_paid || 0);
  const monthsRemaining = client.monthly_payment > 0 
    ? Math.ceil(Math.max(0, client.contract_amount - totalPaidAmount) / client.monthly_payment) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
            </div>
          </div>
          <Badge variant={paymentStatus.variant}>
            <div className={`w-2 h-2 rounded-full ${paymentStatus.color} mr-2`}></div>
            {paymentStatus.text}
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Payment Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Прогресс платежей</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Оплачено</span>
                    <span className="font-semibold">
                      {Math.round((client.total_paid / client.contract_amount) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min((client.total_paid / client.contract_amount) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Всего оплачено:</span>
                    <p className="font-semibold text-green-600 dark:text-green-400">{formatAmount(client.total_paid)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Остаток:</span>
                    <p className="font-semibold text-accent">{formatAmount(client.remaining_amount)}</p>
                  </div>
                </div>
                {client.deposit_paid > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Депозит</span>
                      <span className="font-semibold">
                        {Math.round((client.deposit_paid / client.deposit_target) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500 transition-all"
                        style={{ width: `${Math.min((client.deposit_paid / client.deposit_target) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatAmount(client.deposit_paid)} из {formatAmount(client.deposit_target)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contract Details */}
          <Card>
            <CardHeader>
              <CardTitle>Детали договора</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Сумма договора:</span>
                  <p className="font-semibold">{formatAmount(client.contract_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Первый платеж:</span>
                  <p className="font-semibold">{formatAmount(client.first_payment)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Период рассрочки:</span>
                  <p className="font-semibold">{client.installment_period} мес.</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ежемесячный платеж:</span>
                  <p className="font-semibold">{formatAmount(client.monthly_payment)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Осталось платежей:</span>
                  <p className="font-semibold">{monthsRemaining}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">День платежа:</span>
                  <p className="font-semibold">{client.payment_day} число</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Дата договора:</span>
                  <p className="font-semibold">
                    {new Date(client.contract_date).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};