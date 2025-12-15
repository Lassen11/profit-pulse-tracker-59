import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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

      // Создаем транзакцию для нового клиента
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: payload.user_id,
          type: 'income',
          category: 'Продажа',
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
        
        // Используем месяц из payload или вычисляем из date
        let monthStr: string;
        if (p.month) {
          monthStr = p.month;
        } else {
          const baseDate = p.date ? new Date(p.date) : new Date();
          // Используем последний день месяца для соответствия формату kpi_targets
          const endOfMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
          monthStr = endOfMonthDate.toISOString().split('T')[0];
        }
        
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
        
        // Определяем месяц
        let monthStr: string;
        if (p.month) {
          monthStr = p.month;
        } else {
          const baseDate = p.date ? new Date(p.date) : new Date();
          const endOfMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
          monthStr = endOfMonthDate.toISOString().split('T')[0];
        }
        
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
        
        // Определяем месяц из payload (формат "2025-11")
        const monthStr = p.month ? `${p.month}-30` : new Date(p.date).toISOString().split('T')[0];
        const company = p.company || 'Спасение';
        
        console.log(`Processing dashboard metrics for company: ${company}, month: ${monthStr}`);
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
        const kpiData = [
          { kpi_name: 'new_clients_count', value: p.new_clients_count },
          { kpi_name: 'new_clients_monthly_payment_sum', value: p.new_clients_monthly_payment_sum },
          { kpi_name: 'completed_cases_count', value: p.completed_clients_count },
          { kpi_name: 'completed_cases_monthly_payment_sum', value: p.completed_clients_monthly_payment_sum }
        ];

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
          // Ищем существующего клиента по имени
          const { data: existingClient } = await supabase
            .from('bankrot_clients')
            .select('id')
            .eq('full_name', client.full_name)
            .maybeSingle();

          const clientData = {
            full_name: client.full_name,
            contract_amount: client.contract_amount || 0,
            first_payment: client.first_payment || 0,
            installment_period: client.installment_period || 0,
            monthly_payment: client.monthly_payment || 0,
            contract_date: client.contract_date,
            source: client.source || null,
            city: client.city || null,
            manager: client.manager || null,
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
