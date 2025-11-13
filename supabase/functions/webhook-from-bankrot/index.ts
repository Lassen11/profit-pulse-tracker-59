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

type WebhookPayload = NewClientPayload | NewPaymentPayload;

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
