import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-bankrot-clients');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    console.log(`Checking clients for period: ${startDateStr} to ${endDateStr}`);

    // Получаем текущих клиентов из локальной БД за выбранный месяц
    const { data: clients, error } = await supabase
      .from('bankrot_clients')
      .select('*')
      .gte('contract_date', startDateStr)
      .lte('contract_date', endDateStr);

    if (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }

    const count = clients?.length || 0;
    console.log(`Found ${count} clients for the period`);

    // Для полной синхронизации необходимо вызвать sync_clients_full webhook из bankrot-helper
    // Это делается через UI bankrot-helper или cron job там
    // Данная функция просто обновляет отображение локальных данных

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Найдено ${count} клиентов за выбранный период. Для полной синхронизации данных нажмите "Синхронизировать клиентов" в bankrot-helper на странице Клиенты.`,
        count,
        clients: clients?.map(c => ({
          full_name: c.full_name,
          contract_date: c.contract_date,
          source: c.source,
          city: c.city,
          manager: c.manager
        }))
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
