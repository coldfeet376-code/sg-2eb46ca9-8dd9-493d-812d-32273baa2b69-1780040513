/* eslint-disable @typescript-eslint/no-empty-object-type */
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          created_at: string | null
          date: string
          id: string
          shift_pattern: string | null
          staff_id: string | null
          staff_name: string
          task: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          shift_pattern?: string | null
          staff_id?: string | null
          staff_name: string
          task: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          shift_pattern?: string | null
          staff_id?: string | null
          staff_name?: string
          task?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          staff_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          staff_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          staff_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_availability: {
        Row: {
          created_at: string | null
          date: string
          id: string
          manager_id: string
          notes: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          manager_id: string
          notes?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          manager_id?: string
          notes?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_availability_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          can_admin: boolean
          can_floor: boolean
          can_intake: boolean
          can_out_loading: boolean
          created_at: string | null
          id: string
          name: string
          preferred_shift: string | null
          updated_at: string | null
        }
        Insert: {
          can_admin?: boolean
          can_floor?: boolean
          can_intake?: boolean
          can_out_loading?: boolean
          created_at?: string | null
          id?: string
          name: string
          preferred_shift?: string | null
          updated_at?: string | null
        }
        Update: {
          can_admin?: boolean
          can_floor?: boolean
          can_intake?: boolean
          can_out_loading?: boolean
          created_at?: string | null
          id?: string
          name?: string
          preferred_shift?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rota_backups: {
        Row: {
          assignments: Json
          created_at: string | null
          created_by: string | null
          id: string
          locked_assignments: Json
          week_start: string
        }
        Insert: {
          assignments: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          locked_assignments: Json
          week_start: string
        }
        Update: {
          assignments?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          locked_assignments?: Json
          week_start?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string | null
          id: string
          name: string
          shift_pattern: string | null
          shift_start: string
          trained_tasks: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          shift_pattern?: string | null
          shift_start?: string
          trained_tasks?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          shift_pattern?: string | null
          shift_start?: string
          trained_tasks?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      task_config: {
        Row: {
          created_at: string | null
          friday: number
          id: string
          monday: number
          saturday: number
          sunday: number
          task: string
          thursday: number
          tuesday: number
          updated_at: string | null
          wednesday: number
        }
        Insert: {
          created_at?: string | null
          friday?: number
          id?: string
          monday?: number
          saturday?: number
          sunday?: number
          task: string
          thursday?: number
          tuesday?: number
          updated_at?: string | null
          wednesday?: number
        }
        Update: {
          created_at?: string | null
          friday?: number
          id?: string
          monday?: number
          saturday?: number
          sunday?: number
          task?: string
          thursday?: number
          tuesday?: number
          updated_at?: string | null
          wednesday?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
