import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Transaction } from "./TransactionTable";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string;
  transactions: Transaction[];
}

export function AccountTransactionsDialog({
  open,
  onOpenChange,
  account,
  transactions,
}: AccountTransactionsDialogProps) {
  const [filterType, setFilterType] = useState<"range" | "month">("month");
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Reset filters when dialog opens
  useEffect(() => {
    if (open) {
      setFilterType("month");
      const today = new Date();
      setDateFrom(new Date(today.getFullYear(), today.getMonth(), 1));
      setDateTo(today);
      setSelectedMonth(today);
    }
  }, [open]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      // Filter by account
      const matchesAccount =
        (transaction.type === "income" && (transaction as any).income_account === account) ||
        (transaction.type === "expense" && (transaction as any).expense_account === account);

      if (!matchesAccount) return false;

      // Filter by date range or month
      const transactionDate = new Date(transaction.date);
      transactionDate.setHours(0, 0, 0, 0);
      
      if (filterType === "range") {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return transactionDate >= fromDate && transactionDate <= toDate;
      } else {
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        return transactionDate >= monthStart && transactionDate <= monthEnd;
      }
    });

    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, account, filterType, dateFrom, dateTo, selectedMonth]);

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Операции на счете: {account}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter controls */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Фильтр</label>
              <Select value={filterType} onValueChange={(value: "range" | "month") => setFilterType(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="range">По диапазону</SelectItem>
                  <SelectItem value="month">По месяцу</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterType === "range" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "От"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd.MM.yyyy") : "До"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {filterType === "month" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !selectedMonth && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedMonth ? format(selectedMonth, "LLLL yyyy", { locale: ru }) : "Выберите месяц"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedMonth}
                    onSelect={(date) => date && setSelectedMonth(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Доходы</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Расходы</p>
              <p className="text-lg font-semibold text-red-600">{formatCurrency(totalExpense)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Баланс</p>
              <p className={cn("text-lg font-semibold", totalIncome - totalExpense >= 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(totalIncome - totalExpense)}
              </p>
            </div>
          </div>

          {/* Transactions table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Операций не найдено
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(transaction.date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                            transaction.type === "income"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          )}
                        >
                          {transaction.type === "income" ? "Доход" : "Расход"}
                        </span>
                      </TableCell>
                      <TableCell>{transaction.category}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={transaction.description}>
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium whitespace-nowrap",
                          transaction.type === "income" ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
