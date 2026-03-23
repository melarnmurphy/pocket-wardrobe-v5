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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      colour_relationships: {
        Row: {
          colour_id_a: string
          colour_id_b: string
          created_at: string
          id: string
          relationship_type: string
          score: number
        }
        Insert: {
          colour_id_a: string
          colour_id_b: string
          created_at?: string
          id?: string
          relationship_type: string
          score: number
        }
        Update: {
          colour_id_a?: string
          colour_id_b?: string
          created_at?: string
          id?: string
          relationship_type?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "colour_relationships_colour_id_a_fkey"
            columns: ["colour_id_a"]
            isOneToOne: false
            referencedRelation: "colours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colour_relationships_colour_id_b_fkey"
            columns: ["colour_id_b"]
            isOneToOne: false
            referencedRelation: "colours"
            referencedColumns: ["id"]
          },
        ]
      }
      colours: {
        Row: {
          created_at: string
          family: string
          hex: string
          id: string
          lab_a: number | null
          lab_b: number | null
          lab_l: number | null
          lch_c: number | null
          lch_h: number | null
          lch_l: number | null
          lightness_band: string | null
          neutral_flag: boolean
          rgb_b: number
          rgb_g: number
          rgb_r: number
          saturation_band: string | null
          undertone: string | null
        }
        Insert: {
          created_at?: string
          family: string
          hex: string
          id?: string
          lab_a?: number | null
          lab_b?: number | null
          lab_l?: number | null
          lch_c?: number | null
          lch_h?: number | null
          lch_l?: number | null
          lightness_band?: string | null
          neutral_flag?: boolean
          rgb_b: number
          rgb_g: number
          rgb_r: number
          saturation_band?: string | null
          undertone?: string | null
        }
        Update: {
          created_at?: string
          family?: string
          hex?: string
          id?: string
          lab_a?: number | null
          lab_b?: number | null
          lab_l?: number | null
          lch_c?: number | null
          lch_h?: number | null
          lch_l?: number | null
          lightness_band?: string | null
          neutral_flag?: boolean
          rgb_b?: number
          rgb_g?: number
          rgb_r?: number
          saturation_band?: string | null
          undertone?: string | null
        }
        Relationships: []
      }
      garment_colours: {
        Row: {
          colour_id: string
          created_at: string
          dominance: number
          garment_id: string
          id: string
          is_primary: boolean
        }
        Insert: {
          colour_id: string
          created_at?: string
          dominance: number
          garment_id: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          colour_id?: string
          created_at?: string
          dominance?: number
          garment_id?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "garment_colours_colour_id_fkey"
            columns: ["colour_id"]
            isOneToOne: false
            referencedRelation: "colours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garment_colours_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_drafts: {
        Row: {
          confidence: number | null
          created_at: string
          draft_payload_json: Json
          id: string
          source_id: string
          status: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          draft_payload_json: Json
          id?: string
          source_id: string
          status?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          draft_payload_json?: Json
          id?: string
          source_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garment_drafts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "garment_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_images: {
        Row: {
          created_at: string
          garment_id: string
          height: number | null
          id: string
          image_type: string
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          garment_id: string
          height?: number | null
          id?: string
          image_type: string
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          garment_id?: string
          height?: number | null
          id?: string
          image_type?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garment_images_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_sources: {
        Row: {
          confidence: number | null
          created_at: string
          garment_id: string | null
          id: string
          original_url: string | null
          parse_status: string
          raw_text: string | null
          source_metadata_json: Json
          source_type: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          garment_id?: string | null
          id?: string
          original_url?: string | null
          parse_status?: string
          raw_text?: string | null
          source_metadata_json?: Json
          source_type: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          garment_id?: string | null
          id?: string
          original_url?: string | null
          parse_status?: string
          raw_text?: string | null
          source_metadata_json?: Json
          source_type?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garment_sources_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
        ]
      }
      garments: {
        Row: {
          brand: string | null
          category: string
          cost_per_wear: number | null
          created_at: string
          description: string | null
          embedding: string | null
          extraction_metadata_json: Json
          favourite_score: number | null
          fit: string | null
          formality_level: string | null
          id: string
          last_worn_at: string | null
          material: string | null
          pattern: string | null
          purchase_currency: string | null
          purchase_date: string | null
          purchase_price: number | null
          retailer: string | null
          seasonality: string[]
          size: string | null
          subcategory: string | null
          title: string | null
          updated_at: string
          user_id: string
          versatility_score: number | null
          wardrobe_status: string
          wear_count: number
        }
        Insert: {
          brand?: string | null
          category: string
          cost_per_wear?: number | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          extraction_metadata_json?: Json
          favourite_score?: number | null
          fit?: string | null
          formality_level?: string | null
          id?: string
          last_worn_at?: string | null
          material?: string | null
          pattern?: string | null
          purchase_currency?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          retailer?: string | null
          seasonality?: string[]
          size?: string | null
          subcategory?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          versatility_score?: number | null
          wardrobe_status?: string
          wear_count?: number
        }
        Update: {
          brand?: string | null
          category?: string
          cost_per_wear?: number | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          extraction_metadata_json?: Json
          favourite_score?: number | null
          fit?: string | null
          formality_level?: string | null
          id?: string
          last_worn_at?: string | null
          material?: string | null
          pattern?: string | null
          purchase_currency?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          retailer?: string | null
          seasonality?: string[]
          size?: string | null
          subcategory?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          versatility_score?: number | null
          wardrobe_status?: string
          wear_count?: number
        }
        Relationships: []
      }
      lookbook_entries: {
        Row: {
          aesthetic_tags: string[]
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          occasion_tags: string[]
          source_type: string
          source_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          aesthetic_tags?: string[]
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          occasion_tags?: string[]
          source_type: string
          source_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          aesthetic_tags?: string[]
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          occasion_tags?: string[]
          source_type?: string
          source_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lookbook_items: {
        Row: {
          created_at: string
          desired_item_json: Json | null
          garment_id: string | null
          id: string
          lookbook_entry_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          desired_item_json?: Json | null
          garment_id?: string | null
          id?: string
          lookbook_entry_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          desired_item_json?: Json | null
          garment_id?: string | null
          id?: string
          lookbook_entry_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lookbook_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookbook_items_lookbook_entry_id_fkey"
            columns: ["lookbook_entry_id"]
            isOneToOne: false
            referencedRelation: "lookbook_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      occasion_profiles: {
        Row: {
          constraints_json: Json
          created_at: string
          id: string
          label: string
          user_id: string | null
        }
        Insert: {
          constraints_json?: Json
          created_at?: string
          id?: string
          label: string
          user_id?: string | null
        }
        Update: {
          constraints_json?: Json
          created_at?: string
          id?: string
          label?: string
          user_id?: string | null
        }
        Relationships: []
      }
      outfit_items: {
        Row: {
          created_at: string
          garment_id: string
          id: string
          outfit_id: string
          role: string
        }
        Insert: {
          created_at?: string
          garment_id: string
          id?: string
          outfit_id: string
          role: string
        }
        Update: {
          created_at?: string
          garment_id?: string
          id?: string
          outfit_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          created_at: string
          dress_code: string | null
          explanation: string | null
          explanation_json: Json
          id: string
          occasion: string | null
          source_type: string
          title: string | null
          user_id: string
          weather_context_json: Json
        }
        Insert: {
          created_at?: string
          dress_code?: string | null
          explanation?: string | null
          explanation_json?: Json
          id?: string
          occasion?: string | null
          source_type?: string
          title?: string | null
          user_id: string
          weather_context_json?: Json
        }
        Update: {
          created_at?: string
          dress_code?: string | null
          explanation?: string | null
          explanation_json?: Json
          id?: string
          occasion?: string | null
          source_type?: string
          title?: string | null
          user_id?: string
          weather_context_json?: Json
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          input_payload_json: Json
          job_type: string
          result_payload_json: Json
          status: string
          target_id: string | null
          target_table: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_payload_json?: Json
          job_type: string
          result_payload_json?: Json
          status: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_payload_json?: Json
          job_type?: string
          result_payload_json?: Json
          status?: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      style_rules: {
        Row: {
          active: boolean
          created_at: string
          explanation: string | null
          id: string
          object_type: string
          object_value: string
          predicate: string
          rule_scope: string
          rule_type: string
          subject_type: string
          subject_value: string
          user_id: string | null
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          explanation?: string | null
          id?: string
          object_type: string
          object_value: string
          predicate: string
          rule_scope?: string
          rule_type: string
          subject_type: string
          subject_value: string
          user_id?: string | null
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          explanation?: string | null
          id?: string
          object_type?: string
          object_value?: string
          predicate?: string
          rule_scope?: string
          rule_type?: string
          subject_type?: string
          subject_value?: string
          user_id?: string | null
          weight?: number
        }
        Relationships: []
      }
      trend_colours: {
        Row: {
          canonical_hex: string
          canonical_lab: Json | null
          canonical_lch: Json | null
          canonical_rgb: Json
          colour_id: string | null
          created_at: string
          family: string | null
          id: string
          importance_score: number | null
          lightness_band: string | null
          observed_at: string | null
          saturation_band: string | null
          source_label: string | null
          source_name: string
          source_url: string | null
          trend_signal_id: string
          undertone: string | null
        }
        Insert: {
          canonical_hex: string
          canonical_lab?: Json | null
          canonical_lch?: Json | null
          canonical_rgb: Json
          colour_id?: string | null
          created_at?: string
          family?: string | null
          id?: string
          importance_score?: number | null
          lightness_band?: string | null
          observed_at?: string | null
          saturation_band?: string | null
          source_label?: string | null
          source_name: string
          source_url?: string | null
          trend_signal_id: string
          undertone?: string | null
        }
        Update: {
          canonical_hex?: string
          canonical_lab?: Json | null
          canonical_lch?: Json | null
          canonical_rgb?: Json
          colour_id?: string | null
          created_at?: string
          family?: string | null
          id?: string
          importance_score?: number | null
          lightness_band?: string | null
          observed_at?: string | null
          saturation_band?: string | null
          source_label?: string | null
          source_name?: string
          source_url?: string | null
          trend_signal_id?: string
          undertone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_colours_colour_id_fkey"
            columns: ["colour_id"]
            isOneToOne: false
            referencedRelation: "colours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_colours_trend_signal_id_fkey"
            columns: ["trend_signal_id"]
            isOneToOne: false
            referencedRelation: "trend_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_ingestion_jobs: {
        Row: {
          completed_at: string | null
          id: string
          job_type: string
          metadata_json: Json
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          job_type: string
          metadata_json?: Json
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          job_type?: string
          metadata_json?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      trend_signal_sources: {
        Row: {
          created_at: string
          evidence_json: Json
          id: string
          trend_signal_id: string
          trend_source_id: string
        }
        Insert: {
          created_at?: string
          evidence_json?: Json
          id?: string
          trend_signal_id: string
          trend_source_id: string
        }
        Update: {
          created_at?: string
          evidence_json?: Json
          id?: string
          trend_signal_id?: string
          trend_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_signal_sources_trend_signal_id_fkey"
            columns: ["trend_signal_id"]
            isOneToOne: false
            referencedRelation: "trend_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_signal_sources_trend_source_id_fkey"
            columns: ["trend_source_id"]
            isOneToOne: false
            referencedRelation: "trend_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_signals: {
        Row: {
          authority_score: number | null
          confidence_score: number | null
          created_at: string
          first_seen_at: string | null
          id: string
          label: string
          last_seen_at: string | null
          normalized_attributes_json: Json
          recency_score: number | null
          region: string | null
          season: string | null
          source_count: number
          trend_type: string
          year: number | null
        }
        Insert: {
          authority_score?: number | null
          confidence_score?: number | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          label: string
          last_seen_at?: string | null
          normalized_attributes_json?: Json
          recency_score?: number | null
          region?: string | null
          season?: string | null
          source_count?: number
          trend_type: string
          year?: number | null
        }
        Update: {
          authority_score?: number | null
          confidence_score?: number | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          label?: string
          last_seen_at?: string | null
          normalized_attributes_json?: Json
          recency_score?: number | null
          region?: string | null
          season?: string | null
          source_count?: number
          trend_type?: string
          year?: number | null
        }
        Relationships: []
      }
      trend_sources: {
        Row: {
          author: string | null
          id: string
          ingestion_timestamp: string
          publish_date: string | null
          raw_text_excerpt: string | null
          region: string | null
          season: string | null
          source_name: string
          source_type: string
          source_url: string
          title: string
        }
        Insert: {
          author?: string | null
          id?: string
          ingestion_timestamp?: string
          publish_date?: string | null
          raw_text_excerpt?: string | null
          region?: string | null
          season?: string | null
          source_name: string
          source_type: string
          source_url: string
          title: string
        }
        Update: {
          author?: string | null
          id?: string
          ingestion_timestamp?: string
          publish_date?: string | null
          raw_text_excerpt?: string | null
          region?: string | null
          season?: string | null
          source_name?: string
          source_type?: string
          source_url?: string
          title?: string
        }
        Relationships: []
      }
      user_trend_matches: {
        Row: {
          created_at: string
          id: string
          match_type: string
          reasoning_json: Json
          score: number
          trend_signal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_type: string
          reasoning_json?: Json
          score: number
          trend_signal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_type?: string
          reasoning_json?: Json
          score?: number
          trend_signal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trend_matches_trend_signal_id_fkey"
            columns: ["trend_signal_id"]
            isOneToOne: false
            referencedRelation: "trend_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      wear_events: {
        Row: {
          created_at: string
          garment_id: string
          id: string
          notes: string | null
          occasion: string | null
          outfit_id: string | null
          user_id: string
          worn_at: string
        }
        Insert: {
          created_at?: string
          garment_id: string
          id?: string
          notes?: string | null
          occasion?: string | null
          outfit_id?: string | null
          user_id: string
          worn_at?: string
        }
        Update: {
          created_at?: string
          garment_id?: string
          id?: string
          notes?: string | null
          occasion?: string | null
          outfit_id?: string | null
          user_id?: string
          worn_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wear_events_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wear_events_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_snapshots: {
        Row: {
          conditions: string | null
          created_at: string
          id: string
          location_key: string
          precipitation_chance: number | null
          temp_max: number | null
          temp_min: number | null
          user_id: string | null
          weather_date: string
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          id?: string
          location_key: string
          precipitation_chance?: number | null
          temp_max?: number | null
          temp_min?: number | null
          user_id?: string | null
          weather_date: string
        }
        Update: {
          conditions?: string | null
          created_at?: string
          id?: string
          location_key?: string
          precipitation_chance?: number | null
          temp_max?: number | null
          temp_min?: number | null
          user_id?: string | null
          weather_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_global_rule: { Args: { rule_scope: string }; Returns: boolean }
      recalculate_garment_cost_per_wear: {
        Args: { p_garment_id: string }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
