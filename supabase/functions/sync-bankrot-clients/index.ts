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

    // Call bankrot-helper API to get clients
    const bankrotHelperUrl = 'https://bankrot-helper.lovable.app';
    
    const response = await fetch(`${bankrotHelperUrl}/api/clients?start_date=${startDateStr}&end_date=${endDateStr}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bankrotApiKey}`,
      },
    });

    if (!response.ok) {
      console.log('Bankrot-helper API response not OK, trying edge function approach');
      
      // Alternative: Call the get-clients edge function directly
      const edgeFunctionResponse = await fetch(`${bankrotHelperUrl}/functions/v1/get-clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bankrotApiKey}`,
        },
        body: JSON.stringify({
          start_date: startDateStr,
          end_date: endDateStr,
        }),
      });

      if (!edgeFunctionResponse.ok) {
        const errorText = await edgeFunctionResponse.text();
        console.error('Edge function error:', errorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to fetch clients from bankrot-helper',
            details: errorText 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        );
      }

      const clientsData = await edgeFunctionResponse.json();
      console.log(`Received ${clientsData.clients?.length || 0} clients from edge function`);

      if (clientsData.clients && clientsData.clients.length > 0) {
        let upsertedCount = 0;
        
        for (const client of clientsData.clients) {
          // Check if client exists
          const { data: existing } = await supabase
            .from('bankrot_clients')
            .select('id')
            .eq('full_name', client.full_name)
            .eq('contract_date', client.contract_date)
            .maybeSingle();

          const clientData = {
            full_name: client.full_name,
            contract_amount: client.contract_amount || 0,
            installment_period: client.installment_period || 0,
            first_payment: client.first_payment || 0,
            monthly_payment: client.monthly_payment || 0,
            remaining_amount: client.remaining_amount || 0,
            total_paid: client.total_paid || 0,
            deposit_paid: client.deposit_paid || 0,
            deposit_target: client.deposit_target || 70000,
            payment_day: client.payment_day || 1,
            contract_date: client.contract_date,
            city: client.city,
            source: client.source,
            manager: client.manager,
            user_id: client.user_id,
            employee_id: client.employee_id || client.user_id,
          };

          if (existing) {
            await supabase
              .from('bankrot_clients')
              .update({ ...clientData, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase.from('bankrot_clients').insert(clientData);
          }
          upsertedCount++;
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Синхронизировано ${upsertedCount} клиентов`,
            count: upsertedCount
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
    }

    // Process direct API response if available
    const clientsData = await response.json();
    console.log(`Received ${clientsData.length || 0} clients from API`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Синхронизация завершена',
        count: clientsData.length || 0
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
