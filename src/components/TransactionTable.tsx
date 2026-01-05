import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Edit, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  subcategory?: string | null;
  amount: number;
  description?: string | null;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  client_name?: string | null;
  contract_amount?: number | null;
  first_payment?: number | null;
  installment_period?: number | null;
  lump_sum?: number | null;
  company: string;
  income_account?: string | null;
  expense_account?: string | null;
  au_department_bonus?: number | null;
  legal_department_bonus?: number | null;
}

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  onCopy?: (transaction: Transaction) => void;
  showFilters?: boolean;
}

export function TransactionTable({ transactions, onEdit, onDelete, onCopy, showFilters = false }: TransactionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      (transaction.description && transaction.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (transaction.category && transaction.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (transaction.subcategory && transaction.subcategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (transaction.client_name && transaction.client_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDate = !dateFilter || transaction.date.includes(dateFilter);
    const matchesType = !typeFilter || typeFilter === 'all' || transaction.type === typeFilter;
    const matchesCategory = !categoryFilter || transaction.category.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchesSubcategory = !subcategoryFilter || (transaction.subcategory && transaction.subcategory.toLowerCase().includes(subcategoryFilter.toLowerCase()));
    const matchesClient = !clientFilter || (transaction.client_name && transaction.client_name.toLowerCase().includes(clientFilter.toLowerCase()));
    
    const transactionAccount = transaction.type === 'income' ? transaction.income_account : transaction.expense_account;
    const matchesAccount = !accountFilter || (transactionAccount && transactionAccount.toLowerCase().includes(accountFilter.toLowerCase()));

    return matchesSearch && matchesDate && matchesType && matchesCategory && matchesSubcategory && matchesClient && matchesAccount;
  });

  const formatAmount = (amount: number, type: 'income' | 'expense') => {
    const formatted = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(Math.abs(amount));
    
    return type === 'income' ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Поиск операций..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Подкатегория</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Счет</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Описание</TableHead>
              {(onEdit || onDelete || onCopy) && <TableHead className="w-20">Действия</TableHead>}
            </TableRow>
            {showFilters && (
              <TableRow>
                <TableHead>
                  <Input
                    placeholder="Фильтр..."
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="h-8"
                  />
                </TableHead>
                <TableHead>
                  <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Все" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="income">Доход</SelectItem>
                      <SelectItem value="expense">Расход</SelectItem>
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead>
                  <Input
                    placeholder="Фильтр..."
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-8"
                  />
                </TableHead>
                <TableHead>
                  <Input
                    placeholder="Фильтр..."
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    className="h-8"
                  />
                </TableHead>
                <TableHead>
                  <Input
                    placeholder="Фильтр..."
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="h-8"
                  />
                </TableHead>
                <TableHead>
                  <Input
                    placeholder="Фильтр..."
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="h-8"
                  />
                </TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
                {(onEdit || onDelete || onCopy) && <TableHead></TableHead>}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  {new Date(transaction.date).toLocaleDateString('ru-RU')}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={transaction.type === 'income' ? 'default' : 'destructive'}
                    className={cn(
                      transaction.type === 'income' 
                        ? 'bg-profit text-white' 
                        : 'bg-loss text-white'
                    )}
                  >
                    {transaction.type === 'income' ? 'Доход' : 'Расход'}
                  </Badge>
                </TableCell>
                <TableCell>{transaction.category}</TableCell>
                <TableCell>{transaction.subcategory || '-'}</TableCell>
                <TableCell>{transaction.client_name || '-'}</TableCell>
                <TableCell>{(transaction.type === 'income' ? transaction.income_account : transaction.expense_account) || '-'}</TableCell>
                <TableCell className={cn(
                  "text-right font-semibold",
                  transaction.type === 'income' ? 'amount-positive' : 'amount-negative'
                )}>
                  {formatAmount(transaction.amount, transaction.type)}
                </TableCell>
                <TableCell className="max-w-xs truncate">{transaction.description || '-'}</TableCell>
                {(onEdit || onDelete || onCopy) && (
                  <TableCell>
                    <div className="flex space-x-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onCopy && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCopy(transaction)}
                          className="h-8 w-8 p-0"
                          title="Копировать операцию"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(transaction.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {/* Итоговая строка */}
            {filteredTransactions.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell colSpan={6} className="text-right">
                  Итого:
                </TableCell>
                <TableCell className="text-right">
                  <div className="space-y-1">
                    <div className="amount-positive">
                      +{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
                        filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </div>
                    <div className="amount-negative">
                      -{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
                        filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                      )}
                    </div>
                    <div className={cn(
                      filteredTransactions.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0) >= 0 
                        ? 'amount-positive' 
                        : 'amount-negative'
                    )}>
                      ={new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
                        Math.abs(filteredTransactions.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0))
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell></TableCell>
                {(onEdit || onDelete || onCopy) && <TableCell></TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="block lg:hidden space-y-3">
        {filteredTransactions.map((transaction) => (
          <div key={transaction.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {new Date(transaction.date).toLocaleDateString('ru-RU')}
              </div>
              <Badge 
                variant={transaction.type === 'income' ? 'default' : 'destructive'}
                className={cn(
                  transaction.type === 'income' 
                    ? 'bg-profit text-white' 
                    : 'bg-loss text-white'
                )}
              >
                {transaction.type === 'income' ? 'Доход' : 'Расход'}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Сумма:</span>
                <span className={cn(
                  "font-semibold",
                  transaction.type === 'income' ? 'amount-positive' : 'amount-negative'
                )}>
                  {formatAmount(transaction.amount, transaction.type)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Категория:</span>
                <span className="text-sm">{transaction.category}</span>
              </div>
              
              {transaction.subcategory && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Подкатегория:</span>
                  <span className="text-sm">{transaction.subcategory}</span>
                </div>
              )}
              
              {transaction.client_name && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Клиент:</span>
                  <span className="text-sm">{transaction.client_name}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Счет:</span>
                <span className="text-sm">{(transaction.type === 'income' ? transaction.income_account : transaction.expense_account) || '-'}</span>
              </div>
              
              {transaction.description && (
                <div className="pt-1">
                  <span className="text-sm text-muted-foreground">Описание:</span>
                  <p className="text-sm mt-1">{transaction.description}</p>
                </div>
              )}
            </div>
            
            {(onEdit || onDelete || onCopy) && (
              <div className="flex justify-end space-x-2 pt-2 border-t">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(transaction)}
                    className="h-9 px-3"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Изменить
                  </Button>
                )}
                {onCopy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopy(transaction)}
                    className="h-9 px-3"
                    title="Копировать операцию"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Копировать
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(transaction.id)}
                    className="h-9 px-3 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}