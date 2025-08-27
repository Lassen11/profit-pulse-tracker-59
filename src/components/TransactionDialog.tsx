
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Transaction } from "./TransactionTable";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSave: (transaction: Omit<Transaction, 'id'> & { id?: string }, taxTransaction?: Omit<Transaction, 'id'>) => void;
}

const incomeCategories = [
  "Продажи",
  "Услуги", 
  "Инвестиции",
  "Прочие доходы"
];

const expenseCategories = [
  "Зарплата Генерального Директора",
  "Зарплата наличкой", 
  "Зарплата официальная часть",
  "Программист",
  "Дизайнер и Копирайтер",
  "Бухгалтерия",
  "Аренда офиса",
  "Аренда",
  "Коммунальные платежи",
  "Интернет",
  "Связь мегафон",
  "Мастер чистоты",
  "Программное обеспечение",
  "Реклама Авито",
  "Авитолог",
  "Печатная продукция",
  "Агенты",
  "HH",
  "Налог УСН",
  "Налог НДФЛ и Взносы",
  "Банковские расходы",
  "СРО",
  "Транспортные расходы",
  "Представительские Расходы(встречи)",
  "Лизинг",
  "Командировочные",
  "Письма Клиенты",
  "АУ Марианна",
  "Публикации",
  "ТС",
  "Прочие расходы АУ",
  "Вывод средств",
  "Прочие расходы"
];

export function TransactionDialog({ open, onOpenChange, transaction, onSave }: TransactionDialogProps) {
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    subcategory: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    taxPercent: '',
    clientName: '',
    contractAmount: '',
    firstPayment: '',
    installmentPeriod: ''
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        category: transaction.category,
        subcategory: transaction.subcategory || '',
        amount: transaction.amount.toString(),
        description: transaction.description,
        date: transaction.date,
        taxPercent: '',
        clientName: transaction.client_name || '',
        contractAmount: transaction.contract_amount?.toString() || '',
        firstPayment: transaction.first_payment?.toString() || '',
        installmentPeriod: transaction.installment_period?.toString() || ''
      });
    } else {
      setFormData({
        type: 'income',
        category: '',
        subcategory: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        taxPercent: '',
        clientName: '',
        contractAmount: '',
        firstPayment: '',
        installmentPeriod: ''
      });
    }
  }, [transaction, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.amount || !formData.date) {
      return;
    }

    const mainTransaction = {
      ...(transaction && { id: transaction.id }),
      type: formData.type,
      category: formData.category,
      subcategory: formData.subcategory,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      ...(formData.type === 'income' && formData.clientName && { client_name: formData.clientName }),
      ...(formData.type === 'income' && formData.category === 'Продажи' && {
        contract_amount: formData.contractAmount ? parseFloat(formData.contractAmount) : undefined,
        first_payment: formData.firstPayment ? parseFloat(formData.firstPayment) : undefined,
        installment_period: formData.installmentPeriod ? parseInt(formData.installmentPeriod) : undefined
      })
    };

    let taxTransaction = undefined;

    // Создаем налоговую операцию только для новых доходных операций с указанным процентом налогов
    if (formData.type === 'income' && formData.taxPercent && parseFloat(formData.taxPercent) > 0 && !transaction) {
      const taxAmount = parseFloat(formData.amount) * (parseFloat(formData.taxPercent) / 100);
      taxTransaction = {
        type: 'expense' as const,
        category: 'Налог УСН',
        subcategory: 'Налоги',
        amount: taxAmount,
        description: `Налог ${formData.taxPercent}% с операции: ${formData.description}`,
        date: formData.date
      };
    }

    onSave(mainTransaction, taxTransaction);
    onOpenChange(false);
  };

  const categories = formData.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Редактировать операцию' : 'Добавить операцию'}
          </DialogTitle>
          <DialogDescription>
            Заполните данные для финансовой операции
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Тип операции</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: 'income' | 'expense') => {
                  const newCategories = value === 'income' ? incomeCategories : expenseCategories;
                  const currentCategoryExists = newCategories.includes(formData.category);
                  
                  setFormData({ 
                    ...formData, 
                    type: value, 
                    category: currentCategoryExists ? formData.category : '', 
                    subcategory: currentCategoryExists ? formData.subcategory : '',
                    taxPercent: value === 'expense' ? '' : formData.taxPercent
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subcategory">Подкатегория</Label>
              <Input
                id="subcategory"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="Введите подкатегорию..."
              />
            </div>

            {formData.type === 'income' && (
              <div className="space-y-2">
                <Label htmlFor="clientName">ФИО Клиента</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Введите ФИО клиента..."
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Сумма (₽)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Дата</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          {formData.type === 'income' && !transaction && (
            <div className="space-y-2">
              <Label htmlFor="taxPercent">Налоги (%)</Label>
              <Input
                id="taxPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.taxPercent}
                onChange={(e) => setFormData({ ...formData, taxPercent: e.target.value })}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Укажите процент налогов. Сумма будет рассчитана автоматически и создана операция расхода в категории "Налог УСН"
                {formData.taxPercent && formData.amount && (
                  <span className="block font-medium">
                    Налоги: {((parseFloat(formData.amount) || 0) * (parseFloat(formData.taxPercent) || 0) / 100).toFixed(2)} ₽
                  </span>
                )}
              </p>
            </div>
          )}

          {formData.type === 'income' && formData.category === 'Продажи' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Параметры рассрочки</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractAmount">Стоимость договора (₽)</Label>
                  <Input
                    id="contractAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.contractAmount}
                    onChange={(e) => setFormData({ ...formData, contractAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstPayment">Первый платеж (₽)</Label>
                  <Input
                    id="firstPayment"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.firstPayment}
                    onChange={(e) => setFormData({ ...formData, firstPayment: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="installmentPeriod">Срок рассрочки (мес.)</Label>
                  <Input
                    id="installmentPeriod"
                    type="number"
                    min="1"
                    value={formData.installmentPeriod}
                    onChange={(e) => setFormData({ ...formData, installmentPeriod: e.target.value })}
                    placeholder="6"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Дополнительная информация об операции..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">
              {transaction ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
