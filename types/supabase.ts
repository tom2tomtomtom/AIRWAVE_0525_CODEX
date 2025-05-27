// types/supabase.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      analytics: {
        Row: {
          id: string
          campaign_id: string
          variation_id: string | null
          metrics: Json | null
          insights: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          variation_id?: string | null
          metrics?: Json | null
          insights?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          variation_id?: string | null
          metrics?: Json | null
          insights?: Json | null
          created_at?: string | null
        }
      }
      approval_comments: {
        Row: {
          id: string
          workflow_id: string | null
          asset_id: string | null
          comment: string
          comment_type: string | null
          position_data: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          workflow_id?: string | null
          asset_id?: string | null
          comment: string
          comment_type?: string | null
          position_data?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          workflow_id?: string | null
          asset_id?: string | null
          comment?: string
          comment_type?: string | null
          position_data?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      assets: {
        Row: {
          id: string
          client_id: string | null
          name: string
          type: string
          url: string
          thumbnail_url: string | null
          size_bytes: number | null
          mime_type: string | null
          duration_seconds: number | null
          width: number | null
          height: number | null
          tags: string[] | null
          metadata: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          name: string
          type: string
          url: string
          thumbnail_url?: string | null
          size_bytes?: number | null
          mime_type?: string | null
          duration_seconds?: number | null
          width?: number | null
          height?: number | null
          tags?: string[] | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          name?: string
          type?: string
          url?: string
          thumbnail_url?: string | null
          size_bytes?: number | null
          mime_type?: string | null
          duration_seconds?: number | null
          width?: number | null
          height?: number | null
          tags?: string[] | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      briefs: {
        Row: {
          id: string
          client_id: string | null
          name: string
          description: string | null
          document_url: string | null
          document_type: string | null
          raw_content: string | null
          parsed_at: string | null
          parsing_status: string | null
          target_audience: string | null
          objectives: Json | null
          key_messaging: Json | null
          brand_guidelines: Json | null
          platforms: string[] | null
          budget: number | null
          timeline: Json | null
          confidence_scores: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          name: string
          description?: string | null
          document_url?: string | null
          document_type?: string | null
          raw_content?: string | null
          parsed_at?: string | null
          parsing_status?: string | null
          target_audience?: string | null
          objectives?: Json | null
          key_messaging?: Json | null
          brand_guidelines?: Json | null
          platforms?: string[] | null
          budget?: number | null
          timeline?: Json | null
          confidence_scores?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          name?: string
          description?: string | null
          document_url?: string | null
          document_type?: string | null
          raw_content?: string | null
          parsed_at?: string | null
          parsing_status?: string | null
          target_audience?: string | null
          objectives?: Json | null
          key_messaging?: Json | null
          brand_guidelines?: Json | null
          platforms?: string[] | null
          budget?: number | null
          timeline?: Json | null
          confidence_scores?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          description: string | null
          logo_url: string | null
          industry: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          logo_url?: string | null
          industry?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          logo_url?: string | null
          industry?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      executions: {
        Row: {
          id: string
          matrix_id: string | null
          client_id: string | null
          name: string
          description: string | null
          status: string
          output_url: string | null
          metadata: Json | null
          created_by: string | null
          approved_by: string | null
          created_at: string | null
          updated_at: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          matrix_id?: string | null
          client_id?: string | null
          name: string
          description?: string | null
          status: string
          output_url?: string | null
          metadata?: Json | null
          created_by?: string | null
          approved_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          matrix_id?: string | null
          client_id?: string | null
          name?: string
          description?: string | null
          status?: string
          output_url?: string | null
          metadata?: Json | null
          created_by?: string | null
          approved_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          approved_at?: string | null
        }
      }
      matrices: {
        Row: {
          id: string
          client_id: string | null
          template_id: string | null
          name: string
          description: string | null
          structure: Json
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          template_id?: string | null
          name: string
          description?: string | null
          structure: Json
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          template_id?: string | null
          name?: string
          description?: string | null
          structure?: Json
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      motivations: {
        Row: {
          id: string
          client_id: string | null
          brief_id: string | null
          title: string
          description: string | null
          category: string | null
          relevance_score: number | null
          is_ai_generated: boolean | null
          generation_context: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          brief_id?: string | null
          title: string
          description?: string | null
          category?: string | null
          relevance_score?: number | null
          is_ai_generated?: boolean | null
          generation_context?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          brief_id?: string | null
          title?: string
          description?: string | null
          category?: string | null
          relevance_score?: number | null
          is_ai_generated?: boolean | null
          generation_context?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          role: string
          permissions: Json | null
          preferences: Json | null
          metadata: Json | null
          tenant_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          role?: string
          permissions?: Json | null
          preferences?: Json | null
          metadata?: Json | null
          tenant_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          role?: string
          permissions?: Json | null
          preferences?: Json | null
          metadata?: Json | null
          tenant_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      templates: {
        Row: {
          id: string
          client_id: string | null
          name: string
          description: string | null
          platform: string
          aspect_ratio: string
          width: number
          height: number
          thumbnail_url: string | null
          structure: Json
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          name: string
          description?: string | null
          platform: string
          aspect_ratio: string
          width: number
          height: number
          thumbnail_url?: string | null
          structure: Json
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          name?: string
          description?: string | null
          platform?: string
          aspect_ratio?: string
          width?: number
          height?: number
          thumbnail_url?: string | null
          structure?: Json
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
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
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Commonly used types
export type Asset = Tables<'assets'>
export type Client = Tables<'clients'>
export type Brief = Tables<'briefs'>
export type Matrix = Tables<'matrices'>
export type Execution = Tables<'executions'>
export type Template = Tables<'templates'>
export type Profile = Tables<'profiles'>
export type Motivation = Tables<'motivations'>