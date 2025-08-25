import { Transaction } from "@/components/TransactionTable";

export const calculateKPIs = (transactions: Transaction[]) => {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const withdrawals = transactions
    .filter(t => t.type === 'expense' && t.category === 'Вывод средств')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'expense' && t.category !== 'Вывод средств')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const profit = income - expenses;
  const moneyInProject = profit - withdrawals;
  const margin = income > 0 ? (profit / income) * 100 : 0;
  
  return {
    income,
    expenses,
    profit,
    margin,
    withdrawals,
    moneyInProject
  };
};