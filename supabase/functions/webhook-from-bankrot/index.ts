import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

/**
 * Унифицированная функция для получения ключа месяца в формате YYYY-MM-lastDay
 * Принимает:
 * - "YYYY-MM" -> преобразует в YYYY-MM-lastDay
 * - "YYYY-MM-DD" -> преобразует в YYYY-MM-lastDay того же месяца
 * - Date объект -> преобразует в YYYY-MM-lastDay
 */
function getLastDayOfMonth(input: string | Date | undefined, fallbackDate?: Date): string {
  let year: number;
  let month: number; // 1-12

  if (!input) {
    const d = fallbackDate || new Date();
    year = d.getFullYear();
    month = d.getMonth() + 1;
  } else if (input instanceof Date) {
    year = input.getFullYear();
    month = input.getMonth() + 1;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    
    // Формат YYYY-MM-DD или YYYY-MM-DDTHH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split('-');
      year = Number(parts[0]);
      month = Number(parts[1]);
    }
    // Формат YYYY-MM
    else if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [y, m] = trimmed.split('-').map(Number);
      year = y;
      month = m;
    }
    // Иначе пытаемся распарсить как дату
    else {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth() + 1;
      } else {
        const fb = fallbackDate || new Date();
        year = fb.getFullYear();
        month = fb.getMonth() + 1;
      }
    }
  } else {
    const d = fallbackDate || new Date();
    year = d.getFullYear();
    month = d.getMonth() + 1;
  }

  // Вычисляем последний день месяца
  // new Date(year, month, 0) дает последний день предыдущего месяца,
  // поэтому new Date(year, month, 0) где month = 1-12 дает последний день этого месяца
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  
  const yStr = String(year);
  const mStr = String(month).padStart(2, '0');
  const dStr = String(lastDay).padStart(2, '0');
  
  return `${yStr}-${mStr}-${dStr}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewClientPayload {
  event_type: 'new_client';
  client_name: string;
  organization_name?: string;
  contract_amount: number;
  first_payment: number;
  date: string;
  income_account: string;
  company: string;
  user_id: string;
  description?: string;
  installment_period?: number;
  manager?: string;
  city?: string;
  source?: string;
  contract_date?: string;
  payment_day?: number;
  total_paid?: number;
  monthly_payment?: number;
}

interface NewPaymentPayload {
  event_type: 'new_payment';
  client_name: string;
  organization_name?: string;
  amount: number;
  date: string;
  income_account?: string;
  company: string;
  user_id: string;
  description?: string;
}

interface UpdateClientPayload {
  event_type: 'update_client';
  client_name: string;
  contract_amount: number;
  total_paid: number;
  remaining_amount: number;
  deposit_paid: number;
  deposit_target: number;
  monthly_payment?: number;
  company: string;
  user_id: string;
  is_suspended?: boolean;
  is_terminated?: boolean;
  suspension_reason?: string;
  termination_reason?: string;
  date: string;
  changes?: Array<{
    field: string;
    old_value: any;
    new_value: any;
  }>;
}

interface SyncSummaryPayload {
  event_type: 'sync_summary';
  company: string;
  total_payments: number; // сумма платежей с главной страницы администратора
  date?: string; // дата, чтобы определить месяц (необязательно)
  month?: string; // месяц в формате YYYY-MM-DD (первый день месяца)
  user_id?: string; // необязательно, если хотим привязать к пользователю
}

interface SyncClientsStatsPayload {
  event_type: 'sync_clients_stats';
  company: string;
  new_clients_count: number; // количество новых клиентов за месяц
  completed_cases_count: number; // количество завершенных дел за месяц
  date?: string; // дата, чтобы определить месяц
  month?: string; // месяц в формате YYYY-MM-DD
  user_id?: string;
}

interface DashboardMetricsPayload {
  event_type: 'dashboard_metrics';
  new_clients_count: number;
  new_clients_monthly_payment_sum: number;
  completed_clients_count: number;
  completed_clients_monthly_payment_sum: number;
  // Поля из bankrot-helper (разные варианты названий для совместимости)
  remaining_payments_sum?: number; // Остаток платежей (из bankrot-helper)
  remaining_payments?: number; // Остаток платежей (альтернативное название)
  // Дебиторка: План и Факт
  debitorka_plan?: number; // План по дебиторке (ожидаемые платежи)
  debitorka_fact?: number; // Факт по дебиторке (собранные платежи)
  // Расторжения
  terminated_clients_count?: number; // из bankrot-helper
  terminated_contract_amount?: number; // сумма договоров расторжений
  terminated_monthly_payment_sum?: number; // сумма ежемесячных платежей расторжений
  // Приостановки
  suspended_clients_count?: number; // из bankrot-helper
  suspended_contract_amount?: number; // сумма договоров приостановок
  suspended_monthly_payment_sum?: number; // сумма ежемесячных платежей приостановок
  // Общая сумма договоров
  total_contracts_sum?: number; // из bankrot-helper
  company: string;
  user_id: string;
  date: string;
  month: string;
}

interface SyncClientsFullPayload {
  event_type: 'sync_clients_full';
  month: string; // формат YYYY-MM
  company: string;
  user_id: string;
  clients: Array<{
    full_name: string;
    contract_amount: number;
    first_payment: number;
    installment_period: number;
    monthly_payment: number;
    contract_date: string;
    source?: string;
    city?: string;
    manager?: string;
    created_by?: string; // Имя сотрудника, создавшего сделку
    total_paid?: number;
    deposit_paid?: number;
    deposit_target?: number;
    remaining_amount?: number;
    payment_day?: number;
  }>;
}

type WebhookPayload = NewClientPayload | NewPaymentPayload | UpdateClientPayload | SyncSummaryPayload | SyncClientsStatsPayload | DashboardMetricsPayload | SyncClientsFullPayload;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook received from bankrot-helper');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: WebhookPayload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    if (payload.event_type === 'new_client') {
      // Создаем транзакцию для нового клиента
      console.log('Processing new client:', payload.client_name);

      // Проверяем существует ли уже клиент с таким именем и датой договора
      const contractDate = payload.contract_date || payload.date;
      const { data: existingClient } = await supabase
        .from('bankrot_clients')
        .select('id')
        .eq('full_name', payload.client_name)
        .eq('contract_date', contractDate)
        .maybeSingle();

      // Сохраняем клиента в таблицу bankrot_clients
      const monthlyPayment = payload.monthly_payment || 
        (payload.installment_period ? (payload.contract_amount - payload.first_payment) / payload.installment_period : 0);
      
      const clientData = {
        full_name: payload.client_name,
        contract_amount: payload.contract_amount,
        installment_period: payload.installment_period || 0,
        first_payment: payload.first_payment,
        monthly_payment: monthlyPayment,
        remaining_amount: payload.contract_amount - (payload.total_paid || payload.first_payment),
        total_paid: payload.total_paid || payload.first_payment,
        deposit_paid: 0,
        deposit_target: 70000,
        payment_day: payload.payment_day || 1,
        employee_id: payload.user_id,
        contract_date: contractDate,
        city: payload.city,
        source: payload.source,
        manager: payload.manager,
        user_id: payload.user_id
      };

      if (existingClient) {
        // Обновляем существующего клиента
        const { error: updateError } = await supabase
          .from('bankrot_clients')
          .update({
            ...clientData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingClient.id);

        if (updateError) {
          console.error('Error updating client in bankrot_clients:', updateError);
        } else {
          console.log('Client updated in bankrot_clients successfully');
        }
      } else {
        // Создаем нового клиента
        const { error: clientError } = await supabase
          .from('bankrot_clients')
          .insert(clientData);

        if (clientError) {
          console.error('Error saving client to bankrot_clients:', clientError);
        } else {
          console.log('Client saved to bankrot_clients successfully');
        }
      }

      // Проверяем существует ли уже транзакция для этого клиента с таким же первым платежом
      // Проверяем обе категории: "Продажа" (старая) и "Продажи" (новая)
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('client_name', payload.client_name)
        .in('category', ['Продажа', 'Продажи'])
        .eq('amount', payload.first_payment)
        .eq('company', payload.company)
        .maybeSingle();

      if (existingTransaction) {
        console.log('Transaction already exists for this client, skipping creation');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Транзакция уже существует для этого клиента',
            skipped: true
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Создаем транзакцию для нового клиента
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: payload.user_id,
          type: 'income',
          category: 'Продажи',
          subcategory: 'БФЛ',
          amount: payload.first_payment,
          contract_amount: payload.contract_amount,
          first_payment: payload.first_payment,
          installment_period: payload.installment_period || null,
          date: payload.date,
          company: payload.company,
          income_account: payload.income_account,
          client_name: payload.client_name,
          organization_name: payload.organization_name || null,
          description: payload.description || `Новый клиент из bankrot-helper: ${payload.client_name}`,
          manager: payload.manager || null,
          city: payload.city || null,
          lead_source: payload.source || null,
          contract_date: payload.contract_date || payload.date,
          payment_day: payload.payment_day || null,
        })
        .select()
        .single();

      if (transactionError) {
        console.error('Error creating transaction for new client:', transactionError);
        throw transactionError;
      }

      console.log('Transaction created successfully:', transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: transaction.id,
          message: 'Клиент и транзакция созданы успешно',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (payload.event_type === 'new_payment') {
      // Создаем транзакцию для нового платежа
      console.log('Processing new payment for client:', payload.client_name);

      // Обновляем данные клиента в bankrot_clients
      const { data: existingClient } = await supabase
        .from('bankrot_clients')
        .select('*')
        .eq('full_name', payload.client_name)
        .eq('user_id', payload.user_id)
        .single();

      if (existingClient) {
        const newTotalPaid = existingClient.total_paid + payload.amount;
        const newRemaining = existingClient.contract_amount - newTotalPaid;

        await supabase
          .from('bankrot_clients')
          .update({
            total_paid: newTotalPaid,
            remaining_amount: newRemaining
          })
          .eq('id', existingClient.id);

        console.log('Client payment updated in bankrot_clients');
      }

      // Создаем транзакцию для нового платежа
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: payload.user_id,
          type: 'income',
          category: 'Дебиторка',
          amount: payload.amount,
          date: payload.date,
          company: payload.company,
          income_account: payload.income_account || null,
          client_name: payload.client_name,
          organization_name: payload.organization_name || null,
          description: payload.description || `Платеж от клиента из bankrot-helper: ${payload.client_name}`,
        })
        .select()
        .single();

      if (transactionError) {
        console.error('Error creating transaction for new payment:', transactionError);
        throw transactionError;
      }

      console.log('Payment transaction created successfully:', transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: transaction.id,
          message: 'Платеж проведен успешно',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (payload.event_type === 'update_client') {
      // Обработка обновления данных клиента
      console.log('Processing client update:', payload.client_name);

      // Находим клиента по имени и обновляем данные
      const { data: existingClient, error: findError } = await supabase
        .from('bankrot_clients')
        .select('id')
        .eq('full_name', payload.client_name)
        .maybeSingle();

      if (findError) {
        console.error('Error finding client:', findError);
        return new Response(
          JSON.stringify({ error: 'Error finding client', details: findError }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      if (!existingClient) {
        console.log('Client not found, cannot update:', payload.client_name);
        return new Response(
          JSON.stringify({ error: 'Client not found', client_name: payload.client_name }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        );
      }

      // Обновляем данные клиента
      const updateData: any = {
        total_paid: payload.total_paid,
        remaining_amount: payload.remaining_amount,
        deposit_paid: payload.deposit_paid,
        deposit_target: payload.deposit_target,
        contract_amount: payload.contract_amount,
        updated_at: new Date().toISOString()
      };

      // Добавляем monthly_payment если он есть
      if (payload.monthly_payment !== undefined) {
        updateData.monthly_payment = payload.monthly_payment;
      }

      const { error: updateError } = await supabase
        .from('bankrot_clients')
        .update(updateData)
        .eq('id', existingClient.id);

      if (updateError) {
        console.error('Error updating client in bankrot_clients:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error updating client', details: updateError }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      console.log('Client updated successfully in bankrot_clients');

      return new Response(
        JSON.stringify({ 
          success: true, 
          client_id: existingClient.id,
          updated_fields: Object.keys(updateData),
          message: 'Данные клиента обновлены успешно'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else if (payload.event_type === 'sync_summary') {
      // Пересчитываем сумму платежей на основе активных клиентов и сохраняем её как План для Дебиторки
      try {
        const p = payload as SyncSummaryPayload;
        
        // Унифицированный ключ месяца: всегда последний день месяца
        const monthStr = getLastDayOfMonth(p.month || p.date);
        
        const company = p.company || 'Спасение';
        
        // Используем точное значение total_payments из bankrot-helper без пересчета
        const totalPayments = p.total_payments;
        
        console.log(`Updating debitorka_plan for company: ${company}, month: ${monthStr}, value from bankrot-helper: ${totalPayments}`);

        // Ищем существующую запись KPI
        const { data: existingTarget, error: findTargetError } = await supabase
          .from('kpi_targets')
          .select('id, user_id')
          .eq('company', company)
          .eq('kpi_name', 'debitorka_plan')
          .eq('month', monthStr)
          .maybeSingle();

        if (findTargetError) {
          console.error('Error finding debitorka_plan in kpi_targets:', findTargetError);
          return new Response(
            JSON.stringify({ success: false, error: 'Error finding KPI', details: findTargetError }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        if (existingTarget) {
          const { error: updateKpiError } = await supabase
            .from('kpi_targets')
            .update({ target_value: totalPayments, updated_at: new Date().toISOString() })
            .eq('id', existingTarget.id);

          if (updateKpiError) {
            console.error('Error updating debitorka_plan KPI:', updateKpiError);
            return new Response(
              JSON.stringify({ success: false, error: 'Error updating KPI', details: updateKpiError }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        } else {
          // Определяем user_id для вставки
          let userId: string | undefined = p.user_id as string | undefined;

          if (!userId) {
            const { data: adminUser } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();
            userId = adminUser?.user_id;
          }

          if (!userId) {
            const { data: anyProfile } = await supabase
              .from('profiles')
              .select('user_id')
              .limit(1)
              .maybeSingle();
            userId = anyProfile?.user_id as string | undefined;
          }

          if (!userId) {
            return new Response(
              JSON.stringify({ success: false, error: 'No user_id available to insert KPI' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }

          const { error: insertKpiError } = await supabase
            .from('kpi_targets')
            .insert({
              user_id: userId,
              company,
              kpi_name: 'debitorka_plan',
              target_value: totalPayments,
              month: monthStr
            });

          if (insertKpiError) {
            console.error('Error inserting debitorka_plan KPI:', insertKpiError);
            return new Response(
              JSON.stringify({ success: false, error: 'Error inserting KPI', details: insertKpiError }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'План по дебиторке обновлён', company, month: monthStr, value: p.total_payments }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (e) {
        console.error('sync_summary handler error:', e);
        return new Response(
          JSON.stringify({ success: false, error: 'sync_summary failed', details: (e as Error).message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else if (payload.event_type === 'sync_clients_stats') {
      // Синхронизация статистики клиентов из bankrot-helper
      try {
        const p = payload as SyncClientsStatsPayload;
        
        // Унифицированный ключ месяца: всегда последний день месяца
        const monthStr = getLastDayOfMonth(p.month || p.date);
        
        const company = p.company || 'Спасение';
        
        console.log(`Syncing clients stats for company: ${company}, month: ${monthStr}`);
        console.log(`New clients: ${p.new_clients_count}, Completed cases: ${p.completed_cases_count}`);

        // Определяем user_id
        let userId: string | undefined = p.user_id as string | undefined;
        if (!userId) {
          const { data: adminUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();
          userId = adminUser?.user_id;
        }
        if (!userId) {
          const { data: anyProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .limit(1)
            .maybeSingle();
          userId = anyProfile?.user_id as string | undefined;
        }
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'No user_id available' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Обновляем или создаем KPI для новых клиентов
        const { data: existingNewClients } = await supabase
          .from('kpi_targets')
          .select('id')
          .eq('company', company)
          .eq('kpi_name', 'new_clients_count')
          .eq('month', monthStr)
          .maybeSingle();

        if (existingNewClients) {
          await supabase
            .from('kpi_targets')
            .update({ target_value: p.new_clients_count, updated_at: new Date().toISOString() })
            .eq('id', existingNewClients.id);
        } else {
          await supabase
            .from('kpi_targets')
            .insert({
              user_id: userId,
              company,
              kpi_name: 'new_clients_count',
              target_value: p.new_clients_count,
              month: monthStr
            });
        }

        // Обновляем или создаем KPI для завершенных дел
        const { data: existingCompleted } = await supabase
          .from('kpi_targets')
          .select('id')
          .eq('company', company)
          .eq('kpi_name', 'completed_cases_count')
          .eq('month', monthStr)
          .maybeSingle();

        if (existingCompleted) {
          await supabase
            .from('kpi_targets')
            .update({ target_value: p.completed_cases_count, updated_at: new Date().toISOString() })
            .eq('id', existingCompleted.id);
        } else {
          await supabase
            .from('kpi_targets')
            .insert({
              user_id: userId,
              company,
              kpi_name: 'completed_cases_count',
              target_value: p.completed_cases_count,
              month: monthStr
            });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Статистика клиентов обновлена', 
            company, 
            month: monthStr, 
            new_clients: p.new_clients_count,
            completed_cases: p.completed_cases_count
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (e) {
        console.error('sync_clients_stats handler error:', e);
        return new Response(
          JSON.stringify({ success: false, error: 'sync_clients_stats failed', details: (e as Error).message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else if (payload.event_type === 'dashboard_metrics') {
      // Обработка метрик дашборда из bankrot-helper
      try {
        const p = payload as DashboardMetricsPayload;

        // Унифицированный ключ месяца: всегда последний день месяца
        const monthStr = getLastDayOfMonth(p.month || p.date);

        const company = p.company || 'Спасение';
        const rawPeriod = (p as any).period as string | undefined;
        const isAllTime = rawPeriod === 'all_time';

        console.log(
          `Processing dashboard metrics for company: ${company}, month: ${monthStr}` +
            (rawPeriod ? `, period: ${rawPeriod}` : '')
        );
        console.log(`New clients count: ${p.new_clients_count}, payment sum: ${p.new_clients_monthly_payment_sum}`);
        console.log(`Completed cases count: ${p.completed_clients_count}, payment sum: ${p.completed_clients_monthly_payment_sum}`);

        // Определяем user_id
        let userId: string | undefined = p.user_id !== 'all' ? p.user_id : undefined;
        if (!userId) {
          const { data: adminUser } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();
          userId = adminUser?.user_id;
        }
        if (!userId) {
          const { data: anyProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .limit(1)
            .maybeSingle();
          userId = anyProfile?.user_id as string | undefined;
        }
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'No user_id available' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Сохраняем метрики в kpi_targets
        // Маппинг полей из bankrot-helper на наши KPI
        const toNumber = (v: unknown) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            // Поддержка строк вида "98 236 ₽", "98\u00A0236", "98,236" и т.п.
            const raw = v.trim();
            if (!raw) return 0;

            // оставляем только цифры/знаки/разделители
            let cleaned = raw.replace(/[^0-9.,\-]/g, '');

            // если есть и "," и "." — считаем, что последний разделитель = десятичный
            const lastComma = cleaned.lastIndexOf(',');
            const lastDot = cleaned.lastIndexOf('.');
            if (lastComma !== -1 && lastDot !== -1) {
              if (lastComma > lastDot) {
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
              } else {
                cleaned = cleaned.replace(/,/g, '');
              }
            } else if (lastComma !== -1 && lastDot === -1) {
              // если только запятая — трактуем как десятичный разделитель
              cleaned = cleaned.replace(',', '.');
            }

            const n = Number(cleaned);
            return Number.isFinite(n) ? n : 0;
          }
          return 0;
        };

        const upsertKpi = async (kpiName: string, value: number) => {
          const { data: existing } = await supabase
            .from('kpi_targets')
            .select('id')
            .eq('company', company)
            .eq('kpi_name', kpiName)
            .eq('month', monthStr)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('kpi_targets')
              .update({ target_value: value, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('kpi_targets')
              .insert({
                user_id: userId,
                company,
                kpi_name: kpiName,
                target_value: value,
                month: monthStr,
              });
          }
        };

        const remainingPayments = toNumber(
          p.remaining_payments_sum ??
            p.remaining_payments ??
            (p as any).remainingPaymentsSum ??
            (p as any).remainingPayments ??
            0
        );

        // Важно: payload с period=all_time периодически перезатирает «месячные» KPI.
        // Чтобы не ломать дашборд за выбранный месяц, из all_time обновляем только общий остаток платежей.
        if (isAllTime) {
          console.log(
            'dashboard_metrics received with period=all_time — updating only remaining_payments to avoid overwriting monthly KPIs'
          );
          await upsertKpi('remaining_payments', remainingPayments);
          console.log('Dashboard metrics (all_time) saved successfully');

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Метрики (all_time) обновлены частично',
              company,
              month: monthStr,
              updated: ['remaining_payments'],
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const terminationsCount = toNumber(p.terminated_clients_count ?? (p as any).terminatedClientsCount ?? 0);
        const terminationsContractSum = toNumber(p.terminated_contract_amount ?? (p as any).terminatedContractAmount ?? 0);
        const terminationsMonthlySum = toNumber(
          p.terminated_monthly_payment_sum ??
            (p as any).terminated_monthly_sum ??
            (p as any).terminated_monthly_payment ??
            (p as any).terminated_monthly_payments_sum ??
            (p as any).terminatedMonthlyPaymentSum ??
            (p as any).terminatedMonthlySum ??
            (p as any).terminatedMonthlyPayment ??
            0
        );
        const suspensionsCount = toNumber(p.suspended_clients_count ?? (p as any).suspendedClientsCount ?? 0);
        const suspensionsContractSum = toNumber(p.suspended_contract_amount ?? (p as any).suspendedContractAmount ?? 0);
        const suspensionsMonthlySum = toNumber(
          p.suspended_monthly_payment_sum ??
            (p as any).suspended_monthly_sum ??
            (p as any).suspended_monthly_payment ??
            (p as any).suspended_monthly_payments_sum ??
            (p as any).suspendedMonthlyPaymentSum ??
            (p as any).suspendedMonthlySum ??
            (p as any).suspendedMonthlyPayment ??
            0
        );

        // Общая сумма договоров
        const totalContractsSum = toNumber(
          p.total_contracts_sum ??
            (p as any).totalContractsSum ??
            (p as any).total_contract_sum ??
            (p as any).totalContractSum ??
            0
        );

        // Дебиторка: План и Факт (из bankrot-helper)
        const debitorkaplan = toNumber(
          p.debitorka_plan ??
            (p as any).debitorkaPlan ??
            (p as any).debitorka_plan_sum ??
            0
        );
        const debitorkafact = toNumber(
          p.debitorka_fact ??
            (p as any).debitorkaFact ??
            (p as any).debitorka_fact_sum ??
            (p as any).collected_payments ??
            (p as any).collectedPayments ??
            0
        );

        console.log(`Remaining payments: ${remainingPayments}`);
        console.log(
          `Terminations: count=${terminationsCount}, contracts=${terminationsContractSum}, monthly=${terminationsMonthlySum}`
        );
        console.log(
          `Suspensions: count=${suspensionsCount}, contracts=${suspensionsContractSum}, monthly=${suspensionsMonthlySum}`
        );
        console.log(`Total contracts sum: ${totalContractsSum}`);
        console.log(`Debitorka plan: ${debitorkaplan}, fact: ${debitorkafact}`);

        const kpiData = [
          { kpi_name: 'new_clients_count', value: p.new_clients_count },
          { kpi_name: 'new_clients_monthly_payment_sum', value: p.new_clients_monthly_payment_sum },
          { kpi_name: 'completed_cases_count', value: p.completed_clients_count },
          { kpi_name: 'completed_cases_monthly_payment_sum', value: p.completed_clients_monthly_payment_sum },
          { kpi_name: 'remaining_payments', value: remainingPayments },
          // Расторжения
          { kpi_name: 'terminations_count', value: terminationsCount },
          { kpi_name: 'terminations_contract_sum', value: terminationsContractSum },
          { kpi_name: 'terminations_monthly_sum', value: terminationsMonthlySum },
          // Приостановки
          { kpi_name: 'suspensions_count', value: suspensionsCount },
          { kpi_name: 'suspensions_contract_sum', value: suspensionsContractSum },
          { kpi_name: 'suspensions_monthly_sum', value: suspensionsMonthlySum },
          // Общая сумма договоров
          { kpi_name: 'total_contracts_sum', value: totalContractsSum },
          // Дебиторка (только если значения переданы)
          ...(debitorkaplan > 0 ? [{ kpi_name: 'debitorka_plan', value: debitorkaplan }] : []),
          ...(debitorkafact > 0 ? [{ kpi_name: 'debitorka_fact', value: debitorkafact }] : []),
        ];

        for (const kpi of kpiData) {
          await upsertKpi(kpi.kpi_name, kpi.value);
        }

        console.log('Dashboard metrics saved successfully');

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Метрики дашборда обновлены',
            company,
            month: monthStr,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

        for (const kpi of kpiData) {
          const { data: existing } = await supabase
            .from('kpi_targets')
            .select('id')
            .eq('company', company)
            .eq('kpi_name', kpi.kpi_name)
            .eq('month', monthStr)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('kpi_targets')
              .update({ target_value: kpi.value, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('kpi_targets')
              .insert({
                user_id: userId,
                company,
                kpi_name: kpi.kpi_name,
                target_value: kpi.value,
                month: monthStr
              });
          }
        }

        console.log('Dashboard metrics saved successfully');

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Метрики дашборда обновлены',
            company,
            month: monthStr
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (e) {
        console.error('dashboard_metrics handler error:', e);
        return new Response(
          JSON.stringify({ success: false, error: 'dashboard_metrics failed', details: (e as Error).message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else if (payload.event_type === 'sync_clients_full') {
      // Полная синхронизация клиентов за месяц
      try {
        const p = payload as SyncClientsFullPayload;
        const company = p.company || 'Спасение';
        const month = p.month; // формат YYYY-MM
        
        console.log(`Full clients sync for month: ${month}, received ${p.clients?.length || 0} clients`);
        
        if (!p.clients || !Array.isArray(p.clients)) {
          return new Response(
            JSON.stringify({ success: false, error: 'No clients array provided' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Парсим месяц для определения диапазона дат
        const [year, monthNum] = month.split('-').map(Number);
        const monthStart = new Date(year, monthNum - 1, 1);
        const monthEnd = new Date(year, monthNum, 0);
        const startDateStr = monthStart.toISOString().split('T')[0];
        const endDateStr = monthEnd.toISOString().split('T')[0];

        console.log(`Processing clients for date range: ${startDateStr} to ${endDateStr}`);

        // Получаем существующих клиентов за этот месяц
        const { data: existingClients, error: fetchError } = await supabase
          .from('bankrot_clients')
          .select('id, full_name, contract_date')
          .gte('contract_date', startDateStr)
          .lte('contract_date', endDateStr);

        if (fetchError) {
          console.error('Error fetching existing clients:', fetchError);
          throw fetchError;
        }

        console.log(`Found ${existingClients?.length || 0} existing clients in this month`);

        // Создаем Set имен клиентов из bankrot-helper для быстрого поиска
        const bankrotClientNames = new Set(p.clients.map(c => c.full_name));

        // Удаляем клиентов, которых больше нет в bankrot-helper за этот месяц
        let deletedCount = 0;
        for (const existing of (existingClients || [])) {
          if (!bankrotClientNames.has(existing.full_name)) {
            console.log(`Deleting client no longer in bankrot-helper: ${existing.full_name}`);
            const { error: deleteError } = await supabase
              .from('bankrot_clients')
              .delete()
              .eq('id', existing.id);
            
            if (!deleteError) deletedCount++;
          }
        }

        // Обновляем/добавляем клиентов
        let syncedCount = 0;
        let updatedCount = 0;

        for (const client of p.clients) {
          const trimmedName = client.full_name.trim();
          
          // Ищем существующего клиента по имени (с trim для обоих значений)
          const { data: existingClients } = await supabase
            .from('bankrot_clients')
            .select('id, full_name')
            .or(`full_name.eq.${trimmedName},full_name.eq.${trimmedName} `);
          
          // Если есть дубликаты, удаляем лишние
          if (existingClients && existingClients.length > 1) {
            const idsToDelete = existingClients.slice(1).map(c => c.id);
            await supabase
              .from('bankrot_clients')
              .delete()
              .in('id', idsToDelete);
            console.log(`Deleted ${idsToDelete.length} duplicates for: ${trimmedName}`);
          }
          
          const existingClient = existingClients?.[0] || null;

          // Находим employee_id по имени сотрудника (created_by)
          // Формат: "Имя Фамилия" или "Фамилия Имя"
          let employeeId: string | null = null;
          if (client.created_by) {
            const nameParts = client.created_by.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              // Пробуем сначала как "Имя Фамилия"
              let { data: employee } = await supabase
                .from('profiles')
                .select('id')
                .eq('first_name', nameParts[0])
                .eq('last_name', nameParts[1])
                .maybeSingle();
              
              // Если не нашли, пробуем как "Фамилия Имя"
              if (!employee) {
                const { data: employee2 } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('last_name', nameParts[0])
                  .eq('first_name', nameParts[1])
                  .maybeSingle();
                employee = employee2;
              }
              
              employeeId = employee?.id || null;
              console.log(`Looking for employee "${client.created_by}": found ${employeeId ? 'YES' : 'NO'}`);
            }
          }

          const clientData = {
            full_name: client.full_name.trim(),
            contract_amount: client.contract_amount || 0,
            first_payment: client.first_payment || 0,
            installment_period: client.installment_period || 0,
            monthly_payment: client.monthly_payment || 0,
            contract_date: client.contract_date,
            source: client.source || null,
            city: client.city || null,
            manager: client.manager || null,
            employee_id: employeeId,
            total_paid: client.total_paid || 0,
            deposit_paid: client.deposit_paid || 0,
            deposit_target: client.deposit_target || 70000,
            remaining_amount: client.remaining_amount || 0,
            payment_day: client.payment_day || 1,
            user_id: p.user_id,
            updated_at: new Date().toISOString()
          };

          if (existingClient) {
            const { error: updateError } = await supabase
              .from('bankrot_clients')
              .update(clientData)
              .eq('id', existingClient.id);

            if (!updateError) {
              updatedCount++;
              console.log(`Updated client: ${client.full_name}`);
            }
          } else {
            const { error: insertError } = await supabase
              .from('bankrot_clients')
              .insert(clientData);

            if (!insertError) {
              syncedCount++;
              console.log(`Inserted new client: ${client.full_name}`);
            }
          }
        }

        console.log(`Sync complete: ${syncedCount} new, ${updatedCount} updated, ${deletedCount} deleted`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Синхронизировано: ${syncedCount} новых, ${updatedCount} обновлено, ${deletedCount} удалено`,
            synced: syncedCount,
            updated: updatedCount,
            deleted: deletedCount,
            total: p.clients.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (e) {
        console.error('sync_clients_full handler error:', e);
        return new Response(
          JSON.stringify({ success: false, error: 'sync_clients_full failed', details: (e as Error).message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else {
      console.error('Unknown event type:', (payload as any).event_type);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Неизвестный тип события',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Внутренняя ошибка сервера',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
