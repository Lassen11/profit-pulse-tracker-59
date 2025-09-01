import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
}

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  onCopy?: (transaction: Transaction) => void;
}

export function TransactionTable({ transactions, onEdit, onDelete, onCopy }: TransactionTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = transactions.filter(transaction =>
    (transaction.description && transaction.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (transaction.category && transaction.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (transaction.subcategory && transaction.subcategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (transaction.client_name && transaction.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-20">Действия</TableHead>
            </TableRow>
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
                <TableCell className={cn(
                  "text-right font-semibold",
                  transaction.type === 'income' ? 'amount-positive' : 'amount-negative'
                )}>
                  {formatAmount(transaction.amount, transaction.type)}
                </TableCell>
                <TableCell className="max-w-xs truncate">{transaction.description || '-'}</TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit?.(transaction)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopy?.(transaction)}
                      className="h-8 w-8 p-0"
                      title="Копировать операцию"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete?.(transaction.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
              
              {transaction.description && (
                <div className="pt-1">
                  <span className="text-sm text-muted-foreground">Описание:</span>
                  <p className="text-sm mt-1">{transaction.description}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(transaction)}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 mr-1" />
                Изменить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy?.(transaction)}
                className="h-9 px-3"
                title="Копировать операцию"
              >
                <Copy className="h-4 w-4 mr-1" />
                Копировать
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(transaction.id)}
                className="h-9 px-3 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}