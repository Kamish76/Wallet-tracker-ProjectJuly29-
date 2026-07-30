export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          is_wallet?: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          is_wallet?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          is_wallet?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      wallet_accounts: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          starting_value: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          starting_value?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          starting_value?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          type: string;
          amount: number;
          account_id: string;
          transfer_to_account_id: string | null;
          category_id: string | null;
          category: string | null;
          description: string | null;
          created_at: string;
          occurred_at: string;
          is_initial: boolean;
          funded_by_type: string | null;
          funded_by_user_id: string | null;
          updated_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          type: string;
          amount: number;
          account_id: string;
          transfer_to_account_id?: string | null;
          category_id?: string | null;
          category?: string | null;
          description?: string | null;
          created_at?: string;
          occurred_at?: string;
          is_initial?: boolean;
          funded_by_type?: string | null;
          funded_by_user_id?: string | null;
          updated_by_user_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          type?: string;
          amount?: number;
          account_id?: string;
          transfer_to_account_id?: string | null;
          category_id?: string | null;
          category?: string | null;
          description?: string | null;
          created_at?: string;
          occurred_at?: string;
          is_initial?: boolean;
          funded_by_type?: string | null;
          funded_by_user_id?: string | null;
          updated_by_user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
