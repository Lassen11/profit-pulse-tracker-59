import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  description?: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ title, value, description, delta, deltaType = 'neutral', icon, className }: KPICardProps) {
  return (
    <div className={cn("kpi-card", className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="kpi-label">{title}</p>
          <p className="kpi-value mt-2">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
          {delta && (
            <p
              className={cn("kpi-delta mt-1", {
                positive: deltaType === 'positive',
                negative: deltaType === 'negative',
              })}
            >
              {delta}
            </p>
          )}
        </div>
        {icon && <div className="text-muted-foreground opacity-70">{icon}</div>}
      </div>
    </div>
  );
}