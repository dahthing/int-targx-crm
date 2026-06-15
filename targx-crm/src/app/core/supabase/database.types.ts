// Generated types from Supabase schema
// Run `supabase gen types typescript --local` to regenerate after schema changes

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: 'admin' | 'partner' | 'tech';
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      leads: {
        Row: {
          id: string;
          client_id: string | null;
          partner_id: string;
          title: string;
          description: string | null;
          status: 'nova' | 'contactada' | 'proposta_enviada' | 'negociacao' | 'fechada_ganha' | 'fechada_perdida';
          estimated_value: number | null;
          lost_reason: string | null;
          source: string | null;
          next_action: string | null;
          next_action_date: string | null;
          last_activity_at: string | null;
          silence_alerted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['leads']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['leads']['Insert']>;
      };
      project_tranches: {
        Row: {
          id: string;
          project_id: string;
          description: string;
          amount: number;
          due_date: string | null;
          received: boolean;
          received_date: string | null;
          commission_paid: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['project_tranches']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_tranches']['Insert']>;
      };
      commissions: {
        Row: {
          id: string;
          tranche_id: string;
          partner_id: string;
          project_id: string;
          year: number;
          tranche_amount: number;
          rate_percent: number;
          commission_amount: number;
          tier_label: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['commissions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['commissions']['Insert']>;
      };
    };
  };
};
