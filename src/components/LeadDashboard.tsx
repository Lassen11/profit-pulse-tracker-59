import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface LeadData {
  id: string;
  company: string;
  date: string;
  total_leads: number;
  qualified_leads: number;
  debt_above_300k: number;
  contracts: number;
  payments: number;
  total_cost: number;
}

interface LeadDashboardProps {
  leadData: LeadData[];
  selectedCompany: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export function LeadDashboard({ leadData, selectedCompany }: LeadDashboardProps) {
  const chartData = useMemo(() => {
    // Группируем данные по месяцам
    const monthlyData = leadData.reduce((acc, item) => {
      // Извлекаем год-месяц напрямую из строки без конвертации временных зон
      const monthKey = item.date.substring(0, 7); // "2024-07"
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 15); // 15 число для избежания проблем с временными зонами
      const monthLabel = format(date, 'LLLL yyyy', { locale: ru });
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthLabel,
          total_leads: 0,
          qualified_leads: 0,
          debt_above_300k: 0,
          contracts: 0,
          payments: 0,
          total_cost: 0,
          qualified_conversion: 0,
          debt_conversion: 0,
          contract_conversion: 0,
          payment_conversion: 0,
          cost_per_lead: 0
        };
      }
      
      acc[monthKey].total_leads += item.total_leads;
      acc[monthKey].qualified_leads += item.qualified_leads;
      acc[monthKey].debt_above_300k += item.debt_above_300k;
      acc[monthKey].contracts += item.contracts;
      acc[monthKey].payments += item.payments;
      acc[monthKey].total_cost += item.total_cost;
      
      return acc;
    }, {} as Record<string, any>);

    // Вычисляем конверсии для каждого месяца
    return Object.values(monthlyData).map((month: any) => ({
      ...month,
      qualified_conversion: month.total_leads > 0 ? (month.qualified_leads / month.total_leads * 100) : 0,
      debt_conversion: month.total_leads > 0 ? (month.debt_above_300k / month.total_leads * 100) : 0,
      contract_conversion: month.total_leads > 0 ? (month.contracts / month.total_leads * 100) : 0,
      payment_conversion: month.total_leads > 0 ? (month.payments / month.total_leads * 100) : 0,
      cost_per_lead: month.total_leads > 0 ? (month.total_cost / month.total_leads) : 0
    })).sort((a, b) => a.month.localeCompare(b.month));
  }, [leadData]);

  const pieData = useMemo(() => {
    const totals = leadData.reduce((acc, item) => ({
      total_leads: acc.total_leads + item.total_leads,
      qualified_leads: acc.qualified_leads + item.qualified_leads,
      debt_above_300k: acc.debt_above_300k + item.debt_above_300k,
      contracts: acc.contracts + item.contracts,
      payments: acc.payments + item.payments
    }), { total_leads: 0, qualified_leads: 0, debt_above_300k: 0, contracts: 0, payments: 0 });

    return [
      { name: 'Квал. лиды', value: totals.qualified_leads },
      { name: 'Долг > 300к', value: totals.debt_above_300k },
      { name: 'Договоры', value: totals.contracts },
      { name: 'Оплаты', value: totals.payments },
      { name: 'Остальные', value: Math.max(0, totals.total_leads - totals.qualified_leads) }
    ].filter(item => item.value > 0);
  }, [leadData]);

  if (chartData.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Нет данных для отображения дашборда</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Дашборд лидогенерации</h2>
        <p className="text-muted-foreground">{selectedCompany}</p>
      </div>

      {/* Основные метрики по месяцам */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Лиды по месяцам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_leads" stroke="#8884d8" strokeWidth={2} name="Общее кол. лидов" />
              <Line type="monotone" dataKey="qualified_leads" stroke="#82ca9d" strokeWidth={2} name="Квал. лиды" />
              <Line type="monotone" dataKey="debt_above_300k" stroke="#ffc658" strokeWidth={2} name="Долг > 300к" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Конверсии по месяцам (%)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: any) => [`${value.toFixed(2)}%`, '']} />
              <Legend />
              <Line type="monotone" dataKey="qualified_conversion" stroke="#8884d8" strokeWidth={2} name="Квал. конверсия" />
              <Line type="monotone" dataKey="debt_conversion" stroke="#82ca9d" strokeWidth={2} name="Долг > 300к" />
              <Line type="monotone" dataKey="contract_conversion" stroke="#ffc658" strokeWidth={2} name="Договоры" />
              <Line type="monotone" dataKey="payment_conversion" stroke="#ff7c7c" strokeWidth={2} name="Оплаты" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Результаты и затраты */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Результаты по месяцам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="contracts" fill="#8884d8" name="Договоры" />
              <Bar dataKey="payments" fill="#82ca9d" name="Оплаты" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Стоимость лида по месяцам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: any) => [`${value.toFixed(0)} ₽`, '']} />
              <Legend />
              <Line type="monotone" dataKey="cost_per_lead" stroke="#8884d8" strokeWidth={2} name="Стоимость за лид" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Общее распределение */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Общее распределение лидов</h3>
        <div className="flex justify-center">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Сводка по месяцам */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Затраты по месяцам</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: any) => [`${value.toLocaleString('ru-RU')} ₽`, '']} />
            <Legend />
            <Bar dataKey="total_cost" fill="#8884d8" name="Общие затраты" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}