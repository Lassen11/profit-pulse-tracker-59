
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Transaction } from "./TransactionTable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Info } from "lucide-react";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSave: (transaction: Omit<Transaction, 'id'> & { id?: string }, taxTransaction?: Omit<Transaction, 'id'>) => void;
  copyMode?: boolean;
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

export function TransactionDialog({ open, onOpenChange, transaction, onSave, copyMode = false }: TransactionDialogProps) {
  const { user } = useAuth();
  const [existingClient, setExistingClient] = useState<Transaction | null>(null);
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
    installmentPeriod: '',
    lumpSum: ''
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        category: transaction.category,
        subcategory: transaction.subcategory || '',
        amount: transaction.amount.toString(),
        description: transaction.description,
        date: copyMode ? new Date().toISOString().split('T')[0] : transaction.date,
        taxPercent: '',
        clientName: transaction.client_name || '',
        contractAmount: transaction.contract_amount?.toString() || '',
        firstPayment: transaction.first_payment?.toString() || '',
        installmentPeriod: transaction.installment_period?.toString() || '',
        lumpSum: (transaction as any).lump_sum?.toString() || ''
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
        installmentPeriod: '',
        lumpSum: ''
      });
    }
  }, [transaction, open]);

  // Проверяем существующих клиентов при изменении ФИО
  const checkExistingClient = async (clientName: string) => {
    if (!user || !clientName.trim() || formData.type !== 'income' || formData.category !== 'Продажи') {
      setExistingClient(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('category', 'Продажи')
        .eq('client_name', clientName.trim())
        .not('contract_amount', 'is', null)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking existing client:', error);
        return;
      }

      if (data) {
        setExistingClient(data as Transaction);
        // Очищаем поля рассрочки, так как клиент уже существует
        setFormData(prev => ({
          ...prev,
          contractAmount: '',
          firstPayment: '',
          installmentPeriod: '',
          lumpSum: ''
        }));
      } else {
        setExistingClient(null);
      }
    } catch (error) {
      console.error('Error checking existing client:', error);
    }
  };

  // Эффект для проверки клиентов при изменении ФИО
  useEffect(() => {
    if (!transaction) { // Только для новых операций
      const timeoutId = setTimeout(() => {
        checkExistingClient(formData.clientName);
      }, 500); // Debounce для избежания частых запросов

      return () => clearTimeout(timeoutId);
    }
  }, [formData.clientName, formData.type, formData.category, user, transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.amount || !formData.date) {
      return;
    }

    const mainTransaction = {
      ...(transaction && !copyMode && { id: transaction.id }),
      type: formData.type,
      category: formData.category,
      subcategory: formData.subcategory,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      company: transaction?.company || 'Спасение',
      ...(formData.type === 'income' && formData.clientName && { client_name: formData.clientName }),
      ...(formData.type === 'income' && formData.category === 'Продажи' && {
        contract_amount: formData.contractAmount ? parseFloat(formData.contractAmount) : undefined,
        first_payment: formData.firstPayment ? parseFloat(formData.firstPayment) : undefined,
        installment_period: formData.installmentPeriod ? parseInt(formData.installmentPeriod) : undefined,
        lump_sum: (() => {
          const contractAmount = parseFloat(formData.contractAmount) || 0;
          const firstPayment = parseFloat(formData.firstPayment) || 0;
          const installmentPeriod = parseInt(formData.installmentPeriod) || 0;
          
          if (contractAmount > 0 && installmentPeriod > 0) {
            return (contractAmount - firstPayment) / installmentPeriod;
          }
          return undefined;
        })()
      })
    };

    let taxTransaction = undefined;

    // Создаем налоговую операцию только для новых доходных операций с указанным процентом налогов
    if (formData.type === 'income' && formData.taxPercent && parseFloat(formData.taxPercent) > 0 && (!transaction || copyMode)) {
      const taxAmount = parseFloat(formData.amount) * (parseFloat(formData.taxPercent) / 100);
      taxTransaction = {
        type: 'expense' as const,
        category: 'Налог УСН',
        subcategory: 'Налоги',
        amount: taxAmount,
        description: `Налог ${formData.taxPercent}% с операции: ${formData.description}`,
        date: formData.date,
        company: transaction?.company || 'Спасение'
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
            {copyMode ? 'Копировать операцию' : transaction ? 'Редактировать операцию' : 'Добавить операцию'}
          </DialogTitle>
          <DialogDescription>
            {copyMode ? 'Создание новой операции на основе существующей' : 'Заполните данные для финансовой операции'}
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

          {formData.type === 'income' && (!transaction || copyMode) && (
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

          {/* Предупреждение о существующем клиенте */}
          {existingClient && formData.type === 'income' && formData.category === 'Продажи' && (!transaction || copyMode) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Клиент уже существует!</strong> Этот платеж будет добавлен к существующему договору клиента "{existingClient.client_name}". 
                Стоимость договора: {existingClient.contract_amount?.toLocaleString('ru-RU')} ₽,
                {existingClient.first_payment && ` первый платеж: ${existingClient.first_payment?.toLocaleString('ru-RU')} ₽,`}
                {(existingClient as any).lump_sum && ` ЕП: ${(existingClient as any).lump_sum?.toLocaleString('ru-RU')} ₽,`} 
                срок рассрочки: {existingClient.installment_period} мес.
              </AlertDescription>
            </Alert>
          )}

          {formData.type === 'income' && formData.category === 'Продажи' && !existingClient && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Параметры рассрочки</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
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
                  <Label htmlFor="lumpSum">ЕП (₽)</Label>
                  <Input
                    id="lumpSum"
                    type="number"
                    step="0.01"
                    min="0"
                    value={(() => {
                      const contractAmount = parseFloat(formData.contractAmount) || 0;
                      const firstPayment = parseFloat(formData.firstPayment) || 0;
                      const installmentPeriod = parseInt(formData.installmentPeriod) || 0;
                      
                      if (contractAmount > 0 && installmentPeriod > 0) {
                        const lumpSum = (contractAmount - firstPayment) / installmentPeriod;
                        return lumpSum.toFixed(2);
                      }
                      return '';
                    })()}
                    placeholder="0.00"
                    readOnly
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Рассчитывается автоматически по формуле: (Стоимость договора - Первый платеж) / Срок рассрочки
                  </p>
                </div>

                <div className="space-y-2 col-span-2">
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
              {copyMode ? 'Создать копию' : transaction ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
