import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function syncMonth(supabase: any, year: number, month: number, apiKey: string) {
  const lastDayOfMonth = new Date(year, month, 0);
  const monthString = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;
  const apiMonth = `${year}-${String(month).padStart(2, '0')}`;

  console.log(`Syncing month: ${apiMonth}`);

  const apiUrl = `https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/get-payment-summary?month=${apiMonth}`;
  
  const apiResponse = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!apiResponse.ok) {
    console.error(`API call failed for ${apiMonth}:`, apiResponse.status);
    return { month: apiMonth, success: false, error: `API error: ${apiResponse.status}` };
  }

  const paymentData = await apiResponse.json();
  const totalPayments = paymentData.data?.total_payments_sum || 0;

  // Get user_id from bankrot_clients table
  const { data: clients, error: clientsError } = await supabase
    .from('bankrot_clients')
    .select('user_id')
    .limit(1);

  if (clientsError || !clients?.[0]?.user_id) {
    console.error('Error fetching user_id:', clientsError);
    return { month: apiMonth, success: false, error: 'No user_id found' };
  }

  const userId = clients[0].user_id;

  // Call webhook-from-bankrot with sync_summary event
  const { error } = await supabase.functions.invoke('webhook-from-bankrot', {
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
    console.error(`Error syncing ${apiMonth}:`, error);
    return { month: apiMonth, success: false, error: error.message };
  }

  console.log(`Synced ${apiMonth}: ${totalPayments}`);
  return { month: apiMonth, success: true, total_payments: totalPayments };
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

    const apiKey = Deno.env.get('BANKROT_HELPER_API_KEY')!;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    console.log(`Starting debitorka sync for year ${currentYear}...`);

    // Sync all months from January to current month
    const results = [];
    for (let month = 1; month <= currentMonth; month++) {
      const result = await syncMonth(supabase, currentYear, month, apiKey);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Debitorka sync completed: ${successCount}/${results.length} months synced`);


    return new Response(
      JSON.stringify({ 
        success: true, 
        year: currentYear,
        months_synced: successCount,
        total_months: results.length,
        results
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
