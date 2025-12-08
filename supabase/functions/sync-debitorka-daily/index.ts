import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting debitorka sync...');

    // Parse request body for optional month parameter
    let targetMonth: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        // Accept month in format YYYY-MM or YYYY-MM-DD
        if (body.month) {
          targetMonth = body.month;
          console.log(`Custom month requested: ${targetMonth}`);
        }
      } catch (e) {
        console.log('No body or invalid JSON, using current month');
      }
    }

    // Calculate month string for kpi_targets (last day of month)
    let monthString: string;
    let apiMonth: string;
    
    if (targetMonth) {
      // Parse the target month
      const [year, month] = targetMonth.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0); // Last day of the specified month
      monthString = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
      apiMonth = `${year}-${String(month).padStart(2, '0')}`; // Format for API: YYYY-MM
    } else {
      // Use current month
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthString = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
      apiMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    console.log(`Syncing debitorka for month: ${monthString}, API month: ${apiMonth}`);

    // Call external API to get payment summary with optional month parameter
    const apiKey = Deno.env.get('BANKROT_HELPER_API_KEY');
    const apiUrl = `https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/get-payment-summary?month=${apiMonth}`;
    
    console.log(`Calling external API: ${apiUrl}`);
    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey!,
        'Content-Type': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API call failed:', apiResponse.status, errorText);
      throw new Error(`API call failed: ${apiResponse.status} - ${errorText}`);
    }

    const paymentData = await apiResponse.json();
    console.log('Payment data received from API:', paymentData);

    const totalPayments = paymentData.data?.total_payments_sum || 0;

    // Get user_id from bankrot_clients table
    const { data: clients, error: clientsError } = await supabase
      .from('bankrot_clients')
      .select('user_id')
      .limit(1);

    if (clientsError) {
      console.error('Error fetching user_id:', clientsError);
      throw clientsError;
    }

    const userId = clients?.[0]?.user_id;

    if (!userId) {
      throw new Error('No user_id found in bankrot_clients');
    }

    console.log(`Total payments from API: ${totalPayments}, user_id: ${userId}, month: ${monthString}`);

    // Call webhook-from-bankrot with sync_summary event
    const { data, error } = await supabase.functions.invoke('webhook-from-bankrot', {
      body: {
        event_type: 'sync_summary',
        total_payments: totalPayments,
        company: 'Спасение',
        user_id: userId,
        date: new Date().toISOString(),
        month: monthString
      }
    });

    if (error) {
      console.error('Error calling webhook:', error);
      throw error;
    }

    console.log('Debitorka synced successfully:', { totalPayments, userId, month: monthString });

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_payments: totalPayments,
        month: monthString,
        api_month: apiMonth,
        updated_kpi: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error syncing debitorka:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
