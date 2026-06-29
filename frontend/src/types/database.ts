// Auto-generated types matching the Supabase schema.
// Re-generate with: npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          bio: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      beer_styles: {
        Row: {
          id: number
          name: string
          category: string | null
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['beer_styles']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['beer_styles']['Insert']>
      }
      beer_brands: {
        Row: {
          id: number
          name: string
          brewery: string | null
          country: string | null
          style_id: number | null
          abv: number | null
          description: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['beer_brands']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['beer_brands']['Insert']>
      }
      beer_entries: {
        Row: {
          id: string
          user_id: string
          beer_brand_id: number | null
          name: string
          brewery: string | null
          style_id: number | null
          abv: number | null
          rating: number
          notes: string | null
          tasted_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['beer_entries']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['beer_entries']['Insert']>
      }
      photos: {
        Row: {
          id: string
          beer_entry_id: string
          user_id: string
          storage_path: string
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['photos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['photos']['Insert']>
      }
      friend_groups: {
        Row: {
          id: string
          name: string
          owner_id: string
          description: string | null
          invite_code: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['friend_groups']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['friend_groups']['Insert']>
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['group_members']['Insert']>
      }
      invites: {
        Row: {
          id: string
          referrer_id: string
          invite_token: string
          email: string | null
          group_id: string | null
          used_by: string | null
          created_at: string
          expires_at: string
          used_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['invites']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invites']['Insert']>
      }
      likes: {
        Row: {
          id: string
          beer_entry_id: string
          user_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['likes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      comments: {
        Row: {
          id: string
          beer_entry_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type BeerStyle = Database['public']['Tables']['beer_styles']['Row']
export type BeerBrand = Database['public']['Tables']['beer_brands']['Row']
export type BeerEntry = Database['public']['Tables']['beer_entries']['Row']
export type Photo = Database['public']['Tables']['photos']['Row']
export type FriendGroup = Database['public']['Tables']['friend_groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type Invite = Database['public']['Tables']['invites']['Row']
export type Like = Database['public']['Tables']['likes']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']

// Feed item: beer entry enriched with related data
export interface FeedEntry {
  entry: BeerEntry
  profile: Profile
  style: BeerStyle | null
  brand: BeerBrand | null
  photos: Photo[]
  likes: Like[]
  comments: Comment[]
  userHasLiked: boolean
}
