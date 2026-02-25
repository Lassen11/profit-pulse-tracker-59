export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          company: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bankrot_clients: {
        Row: {
          bonus_confirmed: boolean
          city: string | null
          contract_amount: number
          contract_date: string | null
          created_at: string | null
          deposit_paid: number | null
          deposit_target: number | null
          employee_id: string | null
          first_payment: number
          full_name: string
          id: string
          installment_period: number
          manager: string | null
          monthly_payment: number
          payment_day: number | null
          remaining_amount: number | null
          source: string | null
          total_paid: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bonus_confirmed?: boolean
          city?: string | null
          contract_amount: number
          contract_date?: string | null
          created_at?: string | null
          deposit_paid?: number | null
          deposit_target?: number | null
          employee_id?: string | null
          first_payment: number
          full_name: string
          id?: string
          installment_period: number
          manager?: string | null
          monthly_payment: number
          payment_day?: number | null
          remaining_amount?: number | null
          source?: string | null
          total_paid?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bonus_confirmed?: boolean
          city?: string | null
          contract_amount?: number
          contract_date?: string | null
          created_at?: string | null
          deposit_paid?: number | null
          deposit_target?: number | null
          employee_id?: string | null
          first_payment?: number
          full_name?: string
          id?: string
          installment_period?: number
          manager?: string | null
          monthly_payment?: number
          payment_day?: number | null
          remaining_amount?: number | null
          source?: string | null
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_balance_adjustments: {
        Row: {
          adjusted_balance: number
          company: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjusted_balance?: number
          company: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjusted_balance?: number
          company?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      department_bonus_budget: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          month: string
          total_budget: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          month: string
          total_budget?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          month?: string
          total_budget?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_bonus_budget_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      department_bonus_points: {
        Row: {
          assistance: number
          case_category: number
          created_at: string
          crm: number
          employee_id: string
          id: string
          improvements: number
          leadership_bonus: number
          marketing: number
          minus_points: number
          month: string
          overtime: number
          qualification: number
          updated_at: string
          urgency: number
          user_id: string
        }
        Insert: {
          assistance?: number
          case_category?: number
          created_at?: string
          crm?: number
          employee_id: string
          id?: string
          improvements?: number
          leadership_bonus?: number
          marketing?: number
          minus_points?: number
          month: string
          overtime?: number
          qualification?: number
          updated_at?: string
          urgency?: number
          user_id: string
        }
        Update: {
          assistance?: number
          case_category?: number
          created_at?: string
          crm?: number
          employee_id?: string
          id?: string
          improvements?: number
          leadership_bonus?: number
          marketing?: number
          minus_points?: number
          month?: string
          overtime?: number
          qualification?: number
          updated_at?: string
          urgency?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_bonus_points_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      department_employees: {
        Row: {
          advance: number | null
          bonus: number | null
          company: string
          contributions: number | null
          cost: number | null
          created_at: string
          department_id: string
          employee_id: string
          gray_salary: number | null
          id: string
          month: string
          ndfl: number | null
          net_salary: number | null
          next_month_bonus: number | null
          total_amount: number | null
          updated_at: string
          user_id: string
          white_salary: number | null
        }
        Insert: {
          advance?: number | null
          bonus?: number | null
          company?: string
          contributions?: number | null
          cost?: number | null
          created_at?: string
          department_id: string
          employee_id: string
          gray_salary?: number | null
          id?: string
          month: string
          ndfl?: number | null
          net_salary?: number | null
          next_month_bonus?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
          white_salary?: number | null
        }
        Update: {
          advance?: number | null
          bonus?: number | null
          company?: string
          contributions?: number | null
          cost?: number | null
          created_at?: string
          department_id?: string
          employee_id?: string
          gray_salary?: number | null
          id?: string
          month?: string
          ndfl?: number | null
          net_salary?: number | null
          next_month_bonus?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          white_salary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "department_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          project_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kpi_targets: {
        Row: {
          company: string
          created_at: string
          id: string
          kpi_name: string
          month: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string
          created_at?: string
          id?: string
          kpi_name: string
          month?: string
          target_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          id?: string
          kpi_name?: string
          month?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_generation: {
        Row: {
          company: string
          contracts: number
          created_at: string
          date: string
          debt_above_300k: number
          id: string
          payments: number
          qualified_leads: number
          total_cost: number
          total_leads: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string
          contracts?: number
          created_at?: string
          date?: string
          debt_above_300k?: number
          id?: string
          payments?: number
          qualified_leads?: number
          total_cost?: number
          total_leads?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          contracts?: number
          created_at?: string
          date?: string
          debt_above_300k?: number
          id?: string
          payments?: number
          qualified_leads?: number
          total_cost?: number
          total_leads?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_payments: {
        Row: {
          amount: number
          created_at: string
          department_employee_id: string
          id: string
          month: string
          notes: string | null
          payment_date: string
          payment_type: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          department_employee_id: string
          id?: string
          month: string
          notes?: string | null
          payment_date: string
          payment_type: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          department_employee_id?: string
          id?: string
          month?: string
          notes?: string | null
          payment_date?: string
          payment_type?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payments_department_employee_id_fkey"
            columns: ["department_employee_id"]
            isOneToOne: false
            referencedRelation: "department_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          middle_name: string | null
          phone: string | null
          position: string | null
          termination_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          middle_name?: string | null
          phone?: string | null
          position?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          middle_name?: string | null
          phone?: string | null
          position?: string | null
          termination_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          city: string
          client_name: string
          company: string
          contract_amount: number
          created_at: string
          employee_id: string
          id: string
          lead_source: string
          manager_bonus: number
          payment_amount: number
          payment_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          client_name: string
          company?: string
          contract_amount?: number
          created_at?: string
          employee_id: string
          id?: string
          lead_source: string
          manager_bonus?: number
          payment_amount?: number
          payment_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          client_name?: string
          company?: string
          contract_amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          lead_source?: string
          manager_bonus?: number
          payment_amount?: number
          payment_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          au_department_bonus: number | null
          category: string
          city: string | null
          client_name: string | null
          company: string
          contract_amount: number | null
          contract_date: string | null
          contract_status: string | null
          created_at: string
          date: string
          description: string | null
          expense_account: string | null
          first_payment: number | null
          id: string
          income_account: string | null
          installment_period: number | null
          lead_source: string | null
          legal_department_bonus: number | null
          lump_sum: number | null
          manager: string | null
          organization_name: string | null
          payment_day: number | null
          subcategory: string | null
          termination_date: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          au_department_bonus?: number | null
          category: string
          city?: string | null
          client_name?: string | null
          company?: string
          contract_amount?: number | null
          contract_date?: string | null
          contract_status?: string | null
          created_at?: string
          date: string
          description?: string | null
          expense_account?: string | null
          first_payment?: number | null
          id?: string
          income_account?: string | null
          installment_period?: number | null
          lead_source?: string | null
          legal_department_bonus?: number | null
          lump_sum?: number | null
          manager?: string | null
          organization_name?: string | null
          payment_day?: number | null
          subcategory?: string | null
          termination_date?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          au_department_bonus?: number | null
          category?: string
          city?: string | null
          client_name?: string | null
          company?: string
          contract_amount?: number | null
          contract_date?: string | null
          contract_status?: string | null
          created_at?: string
          date?: string
          description?: string | null
          expense_account?: string | null
          first_payment?: number | null
          id?: string
          income_account?: string | null
          installment_period?: number | null
          lead_source?: string | null
          legal_department_bonus?: number | null
          lump_sum?: number | null
          manager?: string | null
          organization_name?: string | null
          payment_day?: number | null
          subcategory?: string | null
          termination_date?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
