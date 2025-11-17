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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { event_type } = body || {};

    console.log('send-to-pnltracker received event:', event_type, 'payload:', body);

    // Normalize month for sync_summary to always use end-of-month (aligns with Dashboard and kpi_targets queries)
    if (event_type === 'sync_summary') {
      try {
        let normalizedMonth: string | undefined = undefined;
        if (body?.month) {
          const d = new Date(body.month);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          normalizedMonth = end.toISOString().split('T')[0];
        } else if (body?.date) {
          const d = new Date(body.date);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          normalizedMonth = end.toISOString().split('T')[0];
        } else {
          const now = new Date();
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          normalizedMonth = end.toISOString().split('T')[0];
        }
        body.month = normalizedMonth;
        console.log('Normalized month to end-of-month:', normalizedMonth);
      } catch (e) {
        console.warn('Failed to normalize month, proceeding as-is:', e);
      }
    }

    // Forward to existing handler to avoid code duplication
    const { data, error } = await supabase.functions.invoke('webhook-from-bankrot', {
      body,
    });

    if (error) {
      console.error('Error forwarding to webhook-from-bankrot:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message || error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('send-to-pnltracker error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
