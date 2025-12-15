import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL приложения bankrot-helper
const BANKROT_HELPER_API_URL = 'https://cpxxrjspmxmkzedlalxj.supabase.co/functions/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-bankrot-clients');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const bankrotApiKey = Deno.env.get('BANKROT_HELPER_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let month: string | undefined;
    try {
      const body = await req.json();
      month = body.month;
    } catch {
      // No body, use current month
    }

    const now = new Date();
    const targetMonth = month ? new Date(month) : now;
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    const startDateStr = monthStart.toISOString().split('T')[0];
    const endDateStr = monthEnd.toISOString().split('T')[0];

    console.log(`Syncing clients for period: ${startDateStr} to ${endDateStr}`);

    // Вызываем edge function get-clients на bankrot-helper
    let bankrotClients: any[] = [];
    
    // Формат месяца YYYY-MM для API bankrot-helper
    const monthParam = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`;
    
    try {
      const apiUrl = `${BANKROT_HELPER_API_URL}/get-clients`;
      console.log(`Fetching from: ${apiUrl} with month=${monthParam}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bankrotApiKey}`,
          'apikey': bankrotApiKey || '',
        },
        body: JSON.stringify({ 
          month: monthParam,
          include_terminated: false,
          include_suspended: false
        })
      });

      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      bankrotClients = data.clients || data.data || data || [];
      console.log(`Fetched ${bankrotClients.length} clients from bankrot-helper`);
      
    } catch (fetchError) {
      console.error('Error fetching from bankrot-helper API:', fetchError);
      
      // Если не удалось получить данные через API, возвращаем информацию
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Не удалось подключиться к bankrot-helper',
          details: (fetchError as Error).message,
          note: 'Данные синхронизируются автоматически через webhook при изменении клиентов в bankrot-helper. Попробуйте сохранить клиента в bankrot-helper заново.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    if (!bankrotClients || bankrotClients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Нет клиентов за выбранный период в bankrot-helper',
          synced: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get user_id from existing records
    const { data: existingRecord } = await supabase
      .from('bankrot_clients')
      .select('user_id')
      .limit(1)
      .single();

    const defaultUserId = existingRecord?.user_id || '00000000-0000-0000-0000-000000000000';

    let syncedCount = 0;
    let updatedCount = 0;

    for (const client of bankrotClients) {
      const { data: existing } = await supabase
        .from('bankrot_clients')
        .select('id')
        .eq('full_name', client.full_name || '')
        .eq('contract_date', client.contract_date || startDateStr)
        .maybeSingle();

      const clientData = {
        full_name: client.full_name || 'Без имени',
        contract_amount: client.contract_amount || 0,
        first_payment: client.first_payment || 0,
        installment_period: client.installment_period || 1,
        monthly_payment: client.monthly_payment || 0,
        contract_date: client.contract_date || startDateStr,
        source: client.source || null,
        city: client.city || null,
        manager: client.manager || null,
        total_paid: client.total_paid || 0,
        deposit_paid: client.deposit_paid || 0,
        deposit_target: client.deposit_target || 70000,
        remaining_amount: client.remaining_amount || 0,
        payment_day: client.payment_day || 1,
        user_id: defaultUserId,
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from('bankrot_clients')
          .update(clientData)
          .eq('id', existing.id);

        if (!updateError) updatedCount++;
      } else {
        const { error: insertError } = await supabase
          .from('bankrot_clients')
          .insert(clientData);

        if (!insertError) syncedCount++;
      }
    }

    console.log(`Synced ${syncedCount} new, updated ${updatedCount} existing`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Синхронизировано: ${syncedCount} новых, ${updatedCount} обновлено`,
        synced: syncedCount,
        updated: updatedCount,
        total: bankrotClients.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in sync-bankrot-clients:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Ошибка синхронизации',
        details: (error as Error).message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
