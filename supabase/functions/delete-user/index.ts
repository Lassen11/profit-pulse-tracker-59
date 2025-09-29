import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Client for checking current user permissions
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Check if the requesting user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify admin role
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !userRole) {
      throw new Error("Access denied - admin role required");
    }

    // Parse request body
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Prevent deleting own account
    if (userId === user.id) {
      throw new Error("Cannot delete your own account");
    }

    // Delete user from auth system (this will cascade delete from profiles and user_roles due to foreign key constraints)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    console.log(`User ${userId} deleted successfully by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        success: false 
      }),
      {
        status: error.message.includes("Unauthorized") || error.message.includes("Access denied") || error.message.includes("Cannot delete") ? 403 : 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);