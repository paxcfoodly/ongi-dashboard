// AUTO-GENERATED — 재생성: pnpm types:gen
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alarm_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          message_template: string
          metric: string
          name: string
          operator: string
          severity: Database["public"]["Enums"]["severity_level"]
          threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          message_template: string
          metric: string
          name: string
          operator: string
          severity?: Database["public"]["Enums"]["severity_level"]
          threshold: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          message_template?: string
          metric?: string
          name?: string
          operator?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      alarms: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          device_id: string | null
          id: string
          message: string
          metadata: Json
          rule_id: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          source: Database["public"]["Enums"]["alarm_source"]
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          message: string
          metadata?: Json
          rule_id?: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          source: Database["public"]["Enums"]["alarm_source"]
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          message?: string
          metadata?: Json
          rule_id?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          source?: Database["public"]["Enums"]["alarm_source"]
        }
        Relationships: [
          {
            foreignKeyName: "alarms_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alarms_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alarm_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          defect_type: string | null
          description: string | null
          id: string
          lot_id: string | null
          quantity: number | null
          received_at: string
          response_report_url: string | null
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          defect_type?: string | null
          description?: string | null
          id?: string
          lot_id?: string | null
          quantity?: number | null
          received_at: string
          response_report_url?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          defect_type?: string | null
          description?: string | null
          id?: string
          lot_id?: string | null
          quantity?: number | null
          received_at?: string
          response_report_url?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_info: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact_info?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact_info?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          active: boolean
          api_key_hash: string
          code: string
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          process_order: number
          role: string | null
          type: Database["public"]["Enums"]["device_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_key_hash: string
          code: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name: string
          process_order: number
          role?: string | null
          type: Database["public"]["Enums"]["device_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_key_hash?: string
          code?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          process_order?: number
          role?: string | null
          type?: Database["public"]["Enums"]["device_type"]
          updated_at?: string
        }
        Relationships: []
      }
      equipment_metrics: {
        Row: {
          bucket_at: string
          created_at: string
          device_id: string
          extras: Json
          id: number
          output_count: number
          runtime_seconds: number
        }
        Insert: {
          bucket_at: string
          created_at?: string
          device_id: string
          extras?: Json
          id?: number
          output_count: number
          runtime_seconds: number
        }
        Update: {
          bucket_at?: string
          created_at?: string
          device_id?: string
          extras?: Json
          id?: number
          output_count?: number
          runtime_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_logs: {
        Row: {
          device_code: string | null
          error_message: string | null
          id: number
          raw_payload: Json | null
          received_at: string
          status: string
        }
        Insert: {
          device_code?: string | null
          error_message?: string | null
          id?: number
          raw_payload?: Json | null
          received_at?: string
          status: string
        }
        Update: {
          device_code?: string | null
          error_message?: string | null
          id?: number
          raw_payload?: Json | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      lots: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          lot_no: string
          notes: string | null
          product_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["lot_status"]
          target_quantity: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          lot_no: string
          notes?: string | null
          product_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          target_quantity?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          lot_no?: string
          notes?: string | null
          product_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["lot_status"]
          target_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      targets: {
        Row: {
          description: string | null
          key: string
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          unit?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      vision_inspector_metrics: {
        Row: {
          bucket_at: string
          created_at: string
          defect_count: number
          device_id: string
          good_count: number
          id: number
          inspection_time_seconds: number
          total_inspected: number
          unknown_count: number
        }
        Insert: {
          bucket_at: string
          created_at?: string
          defect_count: number
          device_id: string
          good_count: number
          id?: number
          inspection_time_seconds: number
          total_inspected: number
          unknown_count: number
        }
        Update: {
          bucket_at?: string
          created_at?: string
          defect_count?: number
          device_id?: string
          good_count?: number
          id?: number
          inspection_time_seconds?: number
          total_inspected?: number
          unknown_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "vision_inspector_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      alarm_source: "auto" | "manual" | "system"
      claim_status: "open" | "investigating" | "resolved"
      device_type: "vision_inspector" | "equipment"
      lot_status: "planned" | "running" | "completed" | "paused"
      severity_level: "info" | "warning" | "danger"
      user_role: "admin" | "viewer"
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
      alarm_source: ["auto", "manual", "system"],
      claim_status: ["open", "investigating", "resolved"],
      device_type: ["vision_inspector", "equipment"],
      lot_status: ["planned", "running", "completed", "paused"],
      severity_level: ["info", "warning", "danger"],
      user_role: ["admin", "viewer"],
    },
  },
} as const

