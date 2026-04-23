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
  revenueDebitor: number;
  revenueSales: number;
  fot: number;
  fotAccrued: number;
  fotPaid: number;
  marketing: number;
  opex: number;
  taxes: number;
  ebitda: number;
  net: number;
  margin: number;
}

const TRANSFER = "Перевод между счетами";
const SALES_CATEGORIES = ["Продажи", "Продажа"];
const WITHDRAWAL = "Вывод средств";
const TAX_USN = "Налог УСН";
const TAX_NDFL = "Налог НДФЛ и Взносы";
const SALARY_CATEGORIES = ["Зарплата", "Аванс", "Премия"];
// Категории, по которым считается ФАКТ маркетинга из транзакций.
// План маркетинга считается отдельно из lead_generation.total_cost.
const MARKETING_CATEGORIES = [
  "Авитолог",
  "Реклама Авито",
];

export function buildPnl(
  transactions: Transaction[],
  employees: DepartmentEmployeeRow[],
  leadGen: LeadGenRow[]
): PnL {
  const incomeTx = transactions.filter(
    (t) => t.type === "income" && t.category !== TRANSFER
  );
  const revenue = incomeTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const revenueSales = incomeTx
    .filter((t) => SALES_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const revenueDebitor = revenue - revenueSales;

  // ФОТ — приоритет department_employees.cost; если 0 — берём из transactions Зарплата/Аванс/Премия
  const fotFromEmployees = employees.reduce((s, e) => s + Number(e.cost || 0), 0);
  // ФОТ:
  // - Начислено: department_employees.cost (полная стоимость сотрудника для компании)
  // - Выплачено: фактические транзакции категорий «Зарплата / Аванс / Премия»
  // По умолчанию в P&L используется «Выплачено» (кассовый факт).
  const fotAccrued = employees.reduce((s, e) => s + Number(e.cost || 0), 0);
  const fotPaid = transactions
    .filter((t) => t.type === "expense" && SALARY_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const fot = fotPaid;

  // Маркетинг (факт): транзакции категорий «Авитолог» и «Реклама Авито» за месяц.
  // Бюджет лидогенерации (lead_generation.total_cost) используется отдельно для плана.
  const marketing = transactions
    .filter((t) => t.type === "expense" && MARKETING_CATEGORIES.includes(t.category))
    .reduce((s, t) => s + Number(t.amount || 0), 0);

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
        !SALARY_CATEGORIES.includes(t.category)
        // Маркетинговые категории включены в OpEx, т.к. строка «Маркетинг»
        // считается отдельно из lead_generation.total_cost
    )
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const ebitda = revenue - fot - marketing - opex;
  const net = ebitda - taxes;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;

  return { revenue, revenueDebitor, revenueSales, fot, fotAccrued, fotPaid, marketing, opex, taxes, ebitda, net, margin };
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
  revenuePct: number;
  fotPct: number;
  marketingPct: number;
  opexPct: number;
  taxesPct: number;
  revenueAbs: number; // в рублях, +/-
  fotAbs: number;
  marketingAbs: number;
  opexAbs: number;
  taxesAbs: number;
}

export const emptyScenario: ScenarioDeltas = {
  revenuePct: 0,
  fotPct: 0,
  marketingPct: 0,
  opexPct: 0,
  taxesPct: 0,
  revenueAbs: 0,
  fotAbs: 0,
  marketingAbs: 0,
  opexAbs: 0,
  taxesAbs: 0,
};

export function applyScenario(pnl: PnL, d: ScenarioDeltas): PnL {
  const revenue = Math.max(0, pnl.revenue * (1 + d.revenuePct / 100) + d.revenueAbs);
  const fot = Math.max(0, pnl.fot * (1 + d.fotPct / 100) + d.fotAbs);
  const fotRatio = pnl.fot > 0 ? fot / pnl.fot : 0;
  const fotAccrued = pnl.fotAccrued * fotRatio;
  const fotPaid = pnl.fotPaid * fotRatio;
  const marketing = Math.max(0, pnl.marketing * (1 + d.marketingPct / 100) + d.marketingAbs);
  const opex = Math.max(0, pnl.opex * (1 + d.opexPct / 100) + d.opexAbs);
  const taxes = Math.max(0, pnl.taxes * (1 + d.taxesPct / 100) + d.taxesAbs);
  const ebitda = revenue - fot - marketing - opex;
  const net = ebitda - taxes;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  const ratio = pnl.revenue > 0 ? revenue / pnl.revenue : 0;
  const revenueDebitor = pnl.revenueDebitor * ratio;
  const revenueSales = pnl.revenueSales * ratio;
  return { revenue, revenueDebitor, revenueSales, fot, fotAccrued, fotPaid, marketing, opex, taxes, ebitda, net, margin };
}

export const fmtMoney = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.round(v || 0));

export const fmtPct = (v: number) =>
  `${(v || 0).toFixed(1).replace(".", ",")}%`;
