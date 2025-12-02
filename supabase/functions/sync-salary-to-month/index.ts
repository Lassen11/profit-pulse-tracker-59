import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sourceMonth, targetMonth } = await req.json();

    if (!sourceMonth || !targetMonth) {
      return new Response(
        JSON.stringify({ error: 'sourceMonth and targetMonth are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all employees from source month
    const { data: sourceEmployees, error: sourceError } = await supabase
      .from('department_employees')
      .select('*')
      .eq('month', sourceMonth);

    if (sourceError) throw sourceError;

    if (!sourceEmployees || sourceEmployees.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No employees found in source month', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedCount = 0;
    let insertedCount = 0;

    for (const emp of sourceEmployees) {
      // Check if record exists for target month
      const { data: existingRecord } = await supabase
        .from('department_employees')
        .select('id')
        .eq('department_id', emp.department_id)
        .eq('employee_id', emp.employee_id)
        .eq('month', targetMonth)
        .maybeSingle();

      if (existingRecord) {
        // Update existing record with white_salary, gray_salary, ndfl, contributions
        const { error: updateError } = await supabase
          .from('department_employees')
          .update({
            white_salary: emp.white_salary,
            gray_salary: emp.gray_salary,
            ndfl: emp.ndfl,
            contributions: emp.contributions
          })
          .eq('id', existingRecord.id);

        if (updateError) {
          console.error('Update error:', updateError);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new record for target month
        const { error: insertError } = await supabase
          .from('department_employees')
          .insert({
            department_id: emp.department_id,
            employee_id: emp.employee_id,
            company: emp.company,
            white_salary: emp.white_salary,
            gray_salary: emp.gray_salary,
            ndfl: emp.ndfl,
            contributions: emp.contributions,
            advance: 0,
            bonus: 0,
            next_month_bonus: 0,
            cost: emp.cost,
            net_salary: emp.net_salary,
            total_amount: emp.total_amount,
            month: targetMonth,
            user_id: emp.user_id
          });

        if (insertError) {
          console.error('Insert error:', insertError);
        } else {
          insertedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Sync completed', 
        updated: updatedCount, 
        inserted: insertedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
