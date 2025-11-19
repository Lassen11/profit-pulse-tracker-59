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

    // Get only active clients with remaining debt from bankrot_clients
    const { data: clients, error: clientsError } = await supabase
      .from('bankrot_clients')
      .select('monthly_payment, user_id, remaining_amount')
      .gt('remaining_amount', 0);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    // Calculate total payments (sum of monthly_payment for active clients only)
    const totalPayments = clients?.reduce((sum, client) => sum + (Number(client.monthly_payment) || 0), 0) || 0;
    
    // Get user_id (use first client's user_id)
    const userId = clients?.[0]?.user_id;

    if (!userId) {
      throw new Error('No user_id found in bankrot_clients');
    }

    console.log(`Calculated total payments: ${totalPayments}, user_id: ${userId}, month: ${monthString}`);

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
