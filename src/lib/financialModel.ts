import { Transaction } from "@/components/TransactionTable";

export interface DepartmentEmployeeRow {
  cost?: number | null;
  company?: string | null;
}

export interface LeadGenRow {
  total_cost?: number | null;
  total_leads?: number | null;
  qualified_leads?: number | null;
  contracts?: number | null;
  payments?: number | null;
}

export interface PnL {
  revenue: number;
  fot: number;
  marketing: number;
  opex: number;
  taxes: number;
  ebitda: number;
  net: number;
  margin: number;
}

const TRANSFER = "Перевод между счетами";
const WITHDRAWAL = "Вывод средств";
const TAX_USN = "Налог УСН";
const TAX_NDFL = "Налог НДФЛ и Взносы";
const SALARY_CATEGORIES = ["Зарплата", "Аванс", "Премия"];
const MARKETING_CATEGORIES = ["Маркетинг", "Реклама", "Лидогенерация"];

export function buildPnl(
  transactions: Transaction[],
  employees: DepartmentEmployeeRow[],
  leadGen: LeadGenRow[]
): PnL {
  const revenue = transactions
    .filter((t) => t.type === "income" && t.category !== TRANSFER)
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  // ФОТ — приоритет department_employees.cost; если 0 — берём из transactions Зарплата/Аванс/Премия
  const fotFromEmployees = employees.reduce((s, e) => s + Number(e.cost || 0), 0);
  const fotFromTx = transactions
    .filter((t) => t.type === "expense" && SALARY_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const fot = fotFromEmployees > 0 ? fotFromEmployees : fotFromTx;

  const marketingFromLeads = leadGen.reduce((s, l) => s + Number(l.total_cost || 0), 0);
  const marketingFromTx = transactions
    .filter((t) => t.type === "expense" && MARKETING_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const marketing = marketingFromLeads + marketingFromTx;

  const taxes = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        (t.category === TAX_USN || t.category === TAX_NDFL)
    )
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const opex = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.category !== TRANSFER &&
        t.category !== WITHDRAWAL &&
        t.category !== TAX_USN &&
        t.category !== TAX_NDFL &&
        !SALARY_CATEGORIES.includes(t.category) &&
        !MARKETING_CATEGORIES.includes(t.category)
    )
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const ebitda = revenue - fot - marketing - opex;
  const net = ebitda - taxes;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;

  return { revenue, fot, marketing, opex, taxes, ebitda, net, margin };
}

export interface UnitEconomics {
  cac: number;
  ltv: number;
  avgCheck: number;
  avgMonthly: number;
  conversion: number; // лид → договор, %
  ltvCac: number;
}

export interface SpasenieClient {
  contract_amount?: number | null;
  first_payment?: number | null;
  monthly_payment?: number | null;
  installment_period?: number | null;
}

export interface BizSale {
  contract_amount?: number | null;
  payment_amount?: number | null;
}

export function buildSpasenieUnit(
  clients: SpasenieClient[],
  leadGen: LeadGenRow[]
): UnitEconomics {
  const marketing = leadGen.reduce((s, l) => s + Number(l.total_cost || 0), 0);
  const totalLeads = leadGen.reduce((s, l) => s + Number(l.total_leads || 0), 0);
  const contracts = clients.length;
  const cac = contracts > 0 ? marketing / contracts : 0;
  const conversion = totalLeads > 0 ? (contracts / totalLeads) * 100 : 0;

  const avgCheck =
    contracts > 0
      ? clients.reduce((s, c) => s + Number(c.contract_amount || 0), 0) / contracts
      : 0;
  const avgMonthly =
    contracts > 0
      ? clients.reduce((s, c) => s + Number(c.monthly_payment || 0), 0) / contracts
      : 0;

  const ltv =
    contracts > 0
      ? clients.reduce(
          (s, c) =>
            s +
            Number(c.first_payment || 0) +
            Number(c.monthly_payment || 0) * Number(c.installment_period || 0),
          0
        ) / contracts
      : 0;

  const ltvCac = cac > 0 ? ltv / cac : 0;

  return { cac, ltv, avgCheck, avgMonthly, conversion, ltvCac };
}

export function buildBusinessUnit(
  sales: BizSale[],
  leadGen: LeadGenRow[]
): UnitEconomics {
  const marketing = leadGen.reduce((s, l) => s + Number(l.total_cost || 0), 0);
  const totalLeads = leadGen.reduce((s, l) => s + Number(l.total_leads || 0), 0);
  const contracts = sales.length;
  const cac = contracts > 0 ? marketing / contracts : 0;
  const conversion = totalLeads > 0 ? (contracts / totalLeads) * 100 : 0;
  const avgCheck =
    contracts > 0
      ? sales.reduce((s, c) => s + Number(c.contract_amount || 0), 0) / contracts
      : 0;
  const avgMonthly =
    contracts > 0
      ? sales.reduce((s, c) => s + Number(c.payment_amount || 0), 0) / contracts
      : 0;
  const ltv = avgCheck;
  const ltvCac = cac > 0 ? ltv / cac : 0;
  return { cac, ltv, avgCheck, avgMonthly, conversion, ltvCac };
}

export interface RunRate {
  revenue: number;
  expenses: number;
  net: number;
}

export function buildRunRate(
  pnl: PnL,
  daysPassed: number,
  daysInMonth: number
): RunRate {
  if (daysPassed <= 0) return { revenue: 0, expenses: 0, net: 0 };
  const factor = daysInMonth / daysPassed;
  const expenses = pnl.fot + pnl.marketing + pnl.opex + pnl.taxes;
  return {
    revenue: pnl.revenue * factor,
    expenses: expenses * factor,
    net: pnl.net * factor,
  };
}

export interface ScenarioDeltas {
  revenuePct: number; // -50..+100
  fotPct: number;
  marketingPct: number;
}

export function applyScenario(pnl: PnL, d: ScenarioDeltas): PnL {
  const revenue = pnl.revenue * (1 + d.revenuePct / 100);
  const fot = pnl.fot * (1 + d.fotPct / 100);
  const marketing = pnl.marketing * (1 + d.marketingPct / 100);
  const opex = pnl.opex;
  const taxes = pnl.taxes;
  const ebitda = revenue - fot - marketing - opex;
  const net = ebitda - taxes;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  return { revenue, fot, marketing, opex, taxes, ebitda, net, margin };
}

export const fmtMoney = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.round(v || 0));

export const fmtPct = (v: number) =>
  `${(v || 0).toFixed(1).replace(".", ",")}%`;
