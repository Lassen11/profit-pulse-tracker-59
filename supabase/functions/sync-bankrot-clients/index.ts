import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-bankrot-clients');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional month filter
    let month: string | undefined;
    try {
      const body = await req.json();
      month = body.month;
    } catch {
      // No body or invalid JSON, use current month
    }

    // Calculate month dates
    const now = new Date();
    const targetMonth = month ? new Date(month) : now;
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    const startDateStr = monthStart.toISOString().split('T')[0];
    const endDateStr = monthEnd.toISOString().split('T')[0];

    console.log(`Checking clients for period: ${startDateStr} to ${endDateStr}`);

    // Count existing clients for the selected month
    const { data: clients, error } = await supabase
      .from('bankrot_clients')
      .select('id, full_name, contract_date')
      .gte('contract_date', startDateStr)
      .lte('contract_date', endDateStr);

    if (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }

    const count = clients?.length || 0;
    console.log(`Found ${count} clients for the period`);

    // Note: Actual sync happens via webhook from bankrot-helper when clients are created there
    // This function just confirms the data is accessible and returns count

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Найдено ${count} клиентов за выбранный период`,
        count,
        note: 'Данные синхронизируются автоматически через webhook при создании клиентов в bankrot-helper'
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
        error: 'Internal server error',
        details: (error as Error).message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
