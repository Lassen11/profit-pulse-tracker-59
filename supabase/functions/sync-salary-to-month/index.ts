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

    // Also get all active employee profiles to ensure we don't miss anyone
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, department, first_name, last_name')
      .eq('is_active', true);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Get all departments
    const { data: allDepartments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, project_name, user_id');

    if (deptError) {
      console.error('Error fetching departments:', deptError);
    }

    // Create a map of department name to department
    const deptByName = new Map(
      (allDepartments || []).map(d => [d.name, d])
    );

    // Create a map of employee_id to source data
    const sourceByEmployeeId = new Map(
      (sourceEmployees || []).map(e => [e.employee_id, e])
    );

    let updatedCount = 0;
    let insertedCount = 0;

    // Process employees that have source month data
    for (const emp of sourceEmployees || []) {
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
        // Insert new record for target month with fresh net_salary calculation
        const whiteSalary = emp.white_salary || 0;
        const graySalary = emp.gray_salary || 0;
        const ndfl = emp.ndfl || 0;
        const freshNetSalary = whiteSalary - ndfl + graySalary;
        
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
            net_salary: freshNetSalary,
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

    // Also check for profiles that are in a department but don't have source month data
    // This handles employees who were added after the source month was created
    for (const profile of allProfiles || []) {
      if (!profile.department) continue;
      
      // Skip if already processed from source month
      if (sourceByEmployeeId.has(profile.id)) continue;
      
      const dept = deptByName.get(profile.department);
      if (!dept) continue;
      
      // Check if record exists for target month
      const { data: existingRecord } = await supabase
        .from('department_employees')
        .select('id')
        .eq('department_id', dept.id)
        .eq('employee_id', profile.id)
        .eq('month', targetMonth)
        .maybeSingle();
      
      if (!existingRecord) {
        // Create new record with default values
        const { error: insertError } = await supabase
          .from('department_employees')
          .insert({
            department_id: dept.id,
            employee_id: profile.id,
            company: dept.project_name || 'Спасение',
            white_salary: 0,
            gray_salary: 0,
            ndfl: 0,
            contributions: 0,
            advance: 0,
            bonus: 0,
            next_month_bonus: 0,
            cost: 0,
            net_salary: 0,
            total_amount: 0,
            month: targetMonth,
            user_id: dept.user_id
          });
        
        if (insertError) {
          console.error('Insert error for new employee:', insertError);
        } else {
          insertedCount++;
          console.log(`Created new record for employee ${profile.first_name} ${profile.last_name} in department ${profile.department}`);
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
