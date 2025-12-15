import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BANKROT_HELPER_URL = 'https://bankrot-helper.lovable.app';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-bankrot-clients');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const bankrotApiKey = Deno.env.get('BANKROT_HELPER_API_KEY');
    
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

    console.log(`Syncing clients for period: ${startDateStr} to ${endDateStr}`);

    // Try to fetch clients from bankrot-helper's Supabase directly
    // Using their project URL and the service role key if available
    const bankrotSupabaseUrl = 'https://cpxxrjspmxmkzedlalxj.supabase.co';
    
    // Create a client for bankrot-helper's Supabase
    const bankrotSupabase = createClient(bankrotSupabaseUrl, bankrotApiKey || '');
    
    // Fetch clients from bankrot-helper
    const { data: bankrotClients, error: fetchError } = await bankrotSupabase
      .from('clients')
      .select('*')
      .gte('contract_date', startDateStr)
      .lte('contract_date', endDateStr);

    if (fetchError) {
      console.error('Error fetching from bankrot-helper:', fetchError);
      throw new Error(`Failed to fetch from bankrot-helper: ${fetchError.message}`);
    }

    console.log(`Fetched ${bankrotClients?.length || 0} clients from bankrot-helper`);

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

    // Get current user_id from existing records or use a default
    const { data: existingRecord } = await supabase
      .from('bankrot_clients')
      .select('user_id')
      .limit(1)
      .single();

    const defaultUserId = existingRecord?.user_id || '00000000-0000-0000-0000-000000000000';

    // Sync each client
    let syncedCount = 0;
    let updatedCount = 0;

    for (const client of bankrotClients) {
      // Check if client already exists
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
        // Update existing client
        const { error: updateError } = await supabase
          .from('bankrot_clients')
          .update(clientData)
          .eq('id', existing.id);

        if (updateError) {
          console.error(`Error updating client ${client.full_name}:`, updateError);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new client
        const { error: insertError } = await supabase
          .from('bankrot_clients')
          .insert(clientData);

        if (insertError) {
          console.error(`Error inserting client ${client.full_name}:`, insertError);
        } else {
          syncedCount++;
        }
      }
    }

    console.log(`Synced ${syncedCount} new clients, updated ${updatedCount} existing clients`);

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
