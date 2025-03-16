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
      customers: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          address: string
          created_at: string | null
          barangay: string | null
          town: string | null
          province: string | null
          contact_person: string | null
          contact_number: string | null
        }
        Insert: {
          id: string
          name: string
          email: string
          phone: string
          address: string
          created_at?: string | null
          barangay?: string | null
          town?: string | null
          province?: string | null
          contact_person?: string | null
          contact_number?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          address?: string
          created_at?: string | null
          barangay?: string | null
          town?: string | null
          province?: string | null
          contact_person?: string | null
          contact_number?: string | null
        }
      }
      admin_invitations: {
        Row: {
          id: string
          email: string
          token: string
          created_by: string
          created_at: string
          expires_at: string
          used: boolean
        }
        Insert: {
          id?: string
          email: string
          token: string
          created_by: string
          created_at?: string
          expires_at: string
          used?: boolean
        }
        Update: {
          id?: string
          email?: string
          token?: string
          created_by?: string
          created_at?: string
          expires_at?: string
          used?: boolean
        }
      }
      items: {
        Row: {
          id: string
          code: string
          name: string
          price: number
          category: string | null
          description: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          price: number
          category?: string | null
          description?: string | null
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          price?: number
          category?: string | null
          description?: string | null
          image_url?: string | null
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_id: string
          total_amount: number
          status: string
          delivery_option: string | null
          delivery_fee: number | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          total_amount: number
          status?: string
          delivery_option?: string | null
          delivery_fee?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          total_amount?: number
          status?: string
          delivery_option?: string | null
          delivery_fee?: number | null
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          item_id: string
          quantity: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          item_id: string
          quantity: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          item_id?: string
          quantity?: number
          price?: number
          created_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          role: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          role: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          role?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      visit_log: {
        Row: {
          id: string
          customer_id: string
          admin_id: string
          visit_date: string
          travel_time: string  // Will be handled as interval in the database
          fare_amount: number
          remarks: string | null
          transport_mode: string | null
          to_next_time: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          admin_id: string
          visit_date?: string
          travel_time: string
          fare_amount: number
          remarks?: string | null
          transport_mode?: string | null
          to_next_time?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          admin_id?: string
          visit_date?: string
          travel_time?: string
          fare_amount?: number
          remarks?: string | null
          transport_mode?: string | null
          to_next_time?: string | null
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