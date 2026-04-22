import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

export interface TrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

interface Props {
  data: TrendPoint[];
}

const config = {
  revenue: { label: "Выручка", color: "hsl(142 76% 36%)" },
  expenses: { label: "Расходы", color: "hsl(0 84% 60%)" },
  net: { label: "Чистая прибыль", color: "hsl(217 91% 60%)" },
};

export function MonthlyTrendChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика за 6 месяцев</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[300px] w-full">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} />
            <Line type="monotone" dataKey="expenses" stroke="var(--color-expenses)" strokeWidth={2} />
            <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
