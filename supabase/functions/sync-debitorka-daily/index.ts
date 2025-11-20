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

    console.log('Starting daily debitorka sync...');

    // Get current month (last day of current month for kpi_targets format)
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthString = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`; // YYYY-MM-DD format (last day)

    console.log(`Syncing debitorka for month: ${monthString}`);

    // Call external API to get payment summary
    const apiKey = Deno.env.get('BANKROT_HELPER_API_KEY');
    const apiUrl = 'https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/get-payment-summary';
    
    console.log('Calling external API for payment summary...');
    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

    const totalPayments = paymentData.total_payments || 0;
    const userId = paymentData.user_id;

    if (!userId) {
      throw new Error('No user_id found in API response');
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

    console.log('Debitorka synced successfully:', { totalPayments, userId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_payments: totalPayments,
        clients_count: clients?.length || 0,
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
