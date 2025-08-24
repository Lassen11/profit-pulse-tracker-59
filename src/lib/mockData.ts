import { Transaction } from "@/components/TransactionTable";

export const mockTransactions: Transaction[] = [
  {
    id: 1,
    date: "2024-01-15",
    type: "income",
    category: "Продажи",
    amount: 150000,
    description: "Продажа продукции клиенту ООО Альфа"
  },
  {
    id: 2,
    date: "2024-01-14",
    type: "expense",
    category: "Зарплаты",
    amount: 80000,
    description: "Выплата заработной платы за декабрь"
  },
  {
    id: 3,
    date: "2024-01-13",
    type: "income",
    category: "Услуги",
    amount: 45000,
    description: "Консультационные услуги"
  },
  {
    id: 4,
    date: "2024-01-12",
    type: "expense",
    category: "Аренда",
    amount: 25000,
    description: "Аренда офиса за январь"
  },
  {
    id: 5,
    date: "2024-01-11",
    type: "expense",
    category: "Реклама",
    amount: 12000,
    description: "Контекстная реклама Яндекс.Директ"
  },
  {
    id: 6,
    date: "2024-01-10",
    type: "income",
    category: "Продажи",
    amount: 89000,
    description: "Продажа товаров через интернет-магазин"
  },
  {
    id: 7,
    date: "2024-01-09",
    type: "expense",
    category: "Сырье",
    amount: 35000,
    description: "Закупка материалов у поставщика"
  },
  {
    id: 8,
    date: "2024-01-08",
    type: "income",
    category: "Инвестиции",
    amount: 200000,
    description: "Инвестиции от партнера"
  }
];

export const calculateKPIs = (transactions: Transaction[]) => {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const profit = income - expenses;
  const margin = income > 0 ? (profit / income) * 100 : 0;

  return {
    income,
    expenses,
    profit,
    margin
  };
};