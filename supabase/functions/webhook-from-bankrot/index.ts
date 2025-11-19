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

type WebhookPayload = NewClientPayload | NewPaymentPayload | UpdateClientPayload | SyncSummaryPayload;

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

      // Сохраняем клиента в таблицу bankrot_clients
      const monthlyPayment = payload.monthly_payment || 
        (payload.installment_period ? (payload.contract_amount - payload.first_payment) / payload.installment_period : 0);
      
      const { error: clientError } = await supabase
        .from('bankrot_clients')
        .insert({
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
          contract_date: payload.contract_date || payload.date,
          city: payload.city,
          source: payload.source,
          manager: payload.manager,
          user_id: payload.user_id
        });

      if (clientError) {
        console.error('Error saving client to bankrot_clients:', clientError);
      } else {
        console.log('Client saved to bankrot_clients successfully');
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
        
        // Получаем только активных клиентов с оставшимся долгом из bankrot_clients
        const { data: clients, error: clientsError } = await supabase
          .from('bankrot_clients')
          .select('monthly_payment, user_id, remaining_amount')
          .gt('remaining_amount', 0);

        if (clientsError) {
          console.error('Error fetching clients:', clientsError);
          return new Response(
            JSON.stringify({ success: false, error: 'Error fetching clients', details: clientsError }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        // Пересчитываем total_payments на основе активных клиентов
        const totalPayments = clients?.reduce((sum, client) => sum + (Number(client.monthly_payment) || 0), 0) || 0;
        
        console.log(`Updating debitorka_plan for company: ${company}, month: ${monthStr}, recalculated value: ${totalPayments} (was ${p.total_payments})`);

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
