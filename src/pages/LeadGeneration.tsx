import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadDialog } from "@/components/LeadDialog";
import { LeadDashboard } from "@/components/LeadDashboard";
import { CalendarIcon, Upload, Download, LogOut, TrendingUp, BarChart3, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedDialog } from "@/hooks/useDialogPersistence";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
const companies = ["Спасение", "Дело Бизнеса", "Кебаб Босс"] as const;
interface LeadData {
  id: string;
  company: string;
  date: string;
  total_leads: number;
  qualified_leads: number;
  debt_above_300k: number;
  contracts: number;
  payments: number;
  total_cost: number;
}
export default function LeadGeneration() {
  const [leadData, setLeadData] = useState<LeadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("Спасение");
  const [customDateFrom, setCustomDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [customDateTo, setCustomDateTo] = useState<Date>(endOfMonth(new Date()));
  const [editingLead, setEditingLead] = useState<LeadData | undefined>(undefined);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const {
    toast
  } = useToast();
  const {
    user,
    signOut,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();

  // Dialog persistence hook
  const leadDialogPersistence = usePersistedDialog<{ editingLead: LeadData }>({
    key: 'lead-dialog-state',
    onRestore: (data) => {
      setEditingLead(data.editingLead);
      setEditDialogOpen(true);
    }
  });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Restore dialog state from localStorage
  useEffect(() => {
    if (!user) return;
    
    leadDialogPersistence.restoreDialog();
  }, [user]);
  const fetchLeadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('lead_generation').select('*').eq('company', selectedCompany).gte('date', customDateFrom.toISOString().split('T')[0]).lte('date', customDateTo.toISOString().split('T')[0]).order('date', {
        ascending: false
      });
      if (error) throw error;
      setLeadData(data || []);
    } catch (error: any) {
      console.error('Error fetching lead data:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные лидогенерации",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, customDateFrom, customDateTo, toast]);
  useEffect(() => {
    if (user) {
      fetchLeadData();
    }
  }, [user, fetchLeadData]);
  const calculateTotals = useMemo(() => {
    const totals = leadData.reduce((acc, item) => ({
      total_leads: acc.total_leads + item.total_leads,
      qualified_leads: acc.qualified_leads + item.qualified_leads,
      debt_above_300k: acc.debt_above_300k + item.debt_above_300k,
      contracts: acc.contracts + item.contracts,
      payments: acc.payments + item.payments,
      total_cost: acc.total_cost + item.total_cost
    }), {
      total_leads: 0,
      qualified_leads: 0,
      debt_above_300k: 0,
      contracts: 0,
      payments: 0,
      total_cost: 0
    });
    const qualified_conversion = totals.total_leads > 0 ? totals.qualified_leads / totals.total_leads * 100 : 0;
    const debt_conversion_total = totals.total_leads > 0 ? totals.debt_above_300k / totals.total_leads * 100 : 0;
    const debt_conversion_qualified = totals.qualified_leads > 0 ? totals.debt_above_300k / totals.qualified_leads * 100 : 0;
    const contract_conversion = totals.total_leads > 0 ? totals.contracts / totals.total_leads * 100 : 0;
    const payment_conversion_total = totals.total_leads > 0 ? totals.payments / totals.total_leads * 100 : 0;
    const payment_conversion_quality = totals.debt_above_300k > 0 ? totals.payments / totals.debt_above_300k * 100 : 0;
    const cost_per_lead = totals.total_leads > 0 ? totals.total_cost / totals.total_leads : 0;
    const cost_per_quality_lead = totals.debt_above_300k > 0 ? totals.total_cost / totals.debt_above_300k : 0;
    const cost_per_paid_lead = totals.payments > 0 ? totals.total_cost / totals.payments : 0;
    return {
      ...totals,
      qualified_conversion,
      debt_conversion_total,
      debt_conversion_qualified,
      contract_conversion,
      payment_conversion_total,
      payment_conversion_quality,
      cost_per_lead,
      cost_per_quality_lead,
      cost_per_paid_lead
    };
  }, [leadData]);
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };
  const handleExportToExcel = () => {
    const exportData = [{
      'Показатель': 'Компания',
      'Значение': selectedCompany
    }, {
      'Показатель': 'Общее кол. лидов',
      'Значение': calculateTotals.total_leads
    }, {
      'Показатель': 'Квал. лиды',
      'Значение': calculateTotals.qualified_leads
    }, {
      'Показатель': 'Конверсия в % из квал. лидов в общее кол. лидов',
      'Значение': `${calculateTotals.qualified_conversion.toFixed(2)}%`
    }, {
      'Показатель': 'Долг выше 300к',
      'Значение': calculateTotals.debt_above_300k
    }, {
      'Показатель': 'Конверсия общая в % из долг выше 300к в общее кол. лидов',
      'Значение': `${calculateTotals.debt_conversion_total.toFixed(2)}%`
    }, {
      'Показатель': 'Конверсия квал в % из долг выше 300к в квал. лиды',
      'Значение': `${calculateTotals.debt_conversion_qualified.toFixed(2)}%`
    }, {
      'Показатель': 'Договор',
      'Значение': calculateTotals.contracts
    }, {
      'Показатель': 'Конверсия в % из договор в общее кол. лидов',
      'Значение': `${calculateTotals.contract_conversion.toFixed(2)}%`
    }, {
      'Показатель': 'Чек',
      'Значение': calculateTotals.payments
    }, {
      'Показатель': 'Конверсия общая в % из чек в общее кол. лидов',
      'Значение': `${calculateTotals.payment_conversion_total.toFixed(2)}%`
    }, {
      'Показатель': 'Конверсия качество в % из чек в Долг выше 300к',
      'Значение': `${calculateTotals.payment_conversion_quality.toFixed(2)}%`
    }, {
      'Показатель': 'Стоимость всех лидов',
      'Значение': calculateTotals.total_cost
    }, {
      'Показатель': 'Стоимость 1 лида',
      'Значение': calculateTotals.cost_per_lead.toFixed(2)
    }, {
      'Показатель': 'Стоимость качественного лида',
      'Значение': calculateTotals.cost_per_quality_lead.toFixed(2)
    }, {
      'Показатель': 'Стоимость оплаченного лида',
      'Значение': calculateTotals.cost_per_paid_lead.toFixed(2)
    }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{
      wch: 50
    }, {
      wch: 20
    }];
    XLSX.utils.book_append_sheet(wb, ws, "Лидогенерация");
    const fileName = `lead_generation_${selectedCompany}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({
      title: "Экспорт завершен",
      description: `Файл ${fileName} успешно сохранен`
    });
  };
  const handleImportFromExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: 'array'
        });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        let successCount = 0;
        let errorCount = 0;
        for (const row of jsonData) {
          try {
            const rowData = row as any;
            const date = new Date(rowData['Дата'] || rowData['date']).toISOString().split('T')[0];
            const company = rowData['Компания'] || rowData['company'] || selectedCompany;
            const total_leads = parseInt(rowData['Общее кол. лидов'] || rowData['total_leads'] || '0');
            const qualified_leads = parseInt(rowData['Квал. лиды'] || rowData['qualified_leads'] || '0');
            const debt_above_300k = parseInt(rowData['Долг выше 300к'] || rowData['debt_above_300k'] || '0');
            const contracts = parseInt(rowData['Договор'] || rowData['contracts'] || '0');
            const payments = parseInt(rowData['Чек'] || rowData['payments'] || '0');
            const total_cost = parseFloat(rowData['Стоимость всех лидов'] || rowData['total_cost'] || '0');
            const {
              error
            } = await supabase.from('lead_generation').insert({
              user_id: user.id,
              company,
              date,
              total_leads,
              qualified_leads,
              debt_above_300k,
              contracts,
              payments,
              total_cost
            });
            if (error) throw error;
            successCount++;
          } catch (error) {
            console.error('Error importing row:', error);
            errorCount++;
          }
        }
        toast({
          title: "Импорт завершен",
          description: `Успешно импортировано: ${successCount}, ошибок: ${errorCount}`
        });
        fetchLeadData();
      } catch (error) {
        toast({
          title: "Ошибка импорта",
          description: "Не удалось импортировать данные из файла",
          variant: "destructive"
        });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Лидогенерация</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => navigate("/")}>
                К транзакциям
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="flex items-center space-x-2">
                <LogOut className="h-4 w-4" />
                <span>Выйти</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-card rounded-lg p-6 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-2 block">Компания</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => <SelectItem key={company} value={company}>{company}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">От</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !customDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateFrom ? format(customDateFrom, "dd.MM.yyyy") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">До</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !customDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateTo ? format(customDateTo, "dd.MM.yyyy") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex space-x-2">
              <LeadDialog onSuccess={fetchLeadData} />
              <Button onClick={handleExportToExcel} variant="outline" className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Экспорт</span>
              </Button>
              <label htmlFor="import-excel" className="cursor-pointer">
                <Button asChild variant="outline" className="flex items-center space-x-2">
                  <span>
                    <Upload className="h-4 w-4" />
                    <span>Импорт</span>
                  </span>
                </Button>
                <Input id="import-excel" type="file" accept=".xlsx,.xls" onChange={handleImportFromExcel} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Сводная таблица</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center space-x-2">
              <Edit className="h-4 w-4" />
              <span>Детали</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Дашборд</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">Сводная таблица по лидогенерации</h2>
                <p className="text-muted-foreground mt-1">
                  {selectedCompany} | {format(customDateFrom, 'dd.MM.yyyy')} - {format(customDateTo, 'dd.MM.yyyy')}
                </p>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">Показатель</TableHead>
                    <TableHead className="text-right">Значение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Общее кол. лидов</TableCell>
                    <TableCell className="text-right">{calculateTotals.total_leads}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Квал. лиды</TableCell>
                    <TableCell className="text-right">{calculateTotals.qualified_leads}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Конверсия </TableCell>
                    <TableCell className="text-right">{calculateTotals.qualified_conversion.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Долг выше 300к</TableCell>
                    <TableCell className="text-right">{calculateTotals.debt_above_300k}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Конверсия общая </TableCell>
                    <TableCell className="text-right">{calculateTotals.debt_conversion_total.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Конверсия квал </TableCell>
                    <TableCell className="text-right">{calculateTotals.debt_conversion_qualified.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Договор</TableCell>
                    <TableCell className="text-right">{calculateTotals.contracts}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Конверсия </TableCell>
                    <TableCell className="text-right">{calculateTotals.contract_conversion.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Чек</TableCell>
                    <TableCell className="text-right">{calculateTotals.payments}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Конверсия общая</TableCell>
                    <TableCell className="text-right">{calculateTotals.payment_conversion_total.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Конверсия качество </TableCell>
                    <TableCell className="text-right">{calculateTotals.payment_conversion_quality.toFixed(2)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Стоимость всех лидов</TableCell>
                    <TableCell className="text-right">{formatCurrency(calculateTotals.total_cost)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Стоимость 1 лида</TableCell>
                    <TableCell className="text-right">{formatCurrency(calculateTotals.cost_per_lead)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Стоимость качественного лида</TableCell>
                    <TableCell className="text-right">{formatCurrency(calculateTotals.cost_per_quality_lead)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Стоимость оплаченного лида</TableCell>
                    <TableCell className="text-right">{formatCurrency(calculateTotals.cost_per_paid_lead)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="details">
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">Детальные записи по лидогенерации</h2>
                <p className="text-muted-foreground mt-1">
                  {selectedCompany} | {format(customDateFrom, 'dd.MM.yyyy')} - {format(customDateTo, 'dd.MM.yyyy')}
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-right">Всего лидов</TableHead>
                      <TableHead className="text-right">Квал. лиды</TableHead>
                      <TableHead className="text-right">Долг &gt;300к</TableHead>
                      <TableHead className="text-right">Договор</TableHead>
                      <TableHead className="text-right">Чек</TableHead>
                      <TableHead className="text-right">Стоимость</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadData.length === 0 ? <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Нет данных для отображения
                        </TableCell>
                      </TableRow> : leadData.map(lead => <TableRow key={lead.id}>
                          <TableCell>{format(new Date(lead.date), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="text-right">{lead.total_leads}</TableCell>
                          <TableCell className="text-right">{lead.qualified_leads}</TableCell>
                          <TableCell className="text-right">{lead.debt_above_300k}</TableCell>
                          <TableCell className="text-right">{lead.contracts}</TableCell>
                          <TableCell className="text-right">{lead.payments}</TableCell>
                          <TableCell className="text-right">{formatCurrency(lead.total_cost)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => {
                        setEditingLead(lead);
                        setEditDialogOpen(true);
                        leadDialogPersistence.openDialog({ editingLead: lead });
                      }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dashboard">
            <LeadDashboard leadData={leadData} selectedCompany={selectedCompany} />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        {editingLead && <LeadDialog editData={editingLead} onSuccess={() => {
        fetchLeadData();
        setEditDialogOpen(false);
        setEditingLead(undefined);
        leadDialogPersistence.closeDialog();
      }} />}
      </div>
    </div>;
}