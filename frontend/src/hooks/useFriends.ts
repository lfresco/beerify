import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { Database, Profile } from '@/types/database'

export interface FriendRow {
  membership_id: string
  role: 'owner' | 'member'
  profile: Profile
}

interface FriendRequestsResponse {
  incoming: Array<{
    id: string
    requester_id: string
    recipient_id: string
    status: 'pending' | 'accepted' | 'rejected'
    created_at: string
    responded_at: string | null
    profiles: Profile
  }>
  outgoing: Array<{
    id: string
    requester_id: string
    recipient_id: string
    status: 'pending' | 'accepted' | 'rejected'
    created_at: string
    responded_at: string | null
    profiles: Profile
  }>
}

export interface OwnedGroup {
  id: string
  name: string
  description: string | null
  group_image_url: string | null
  created_at: string
}

/**
 * Manages the current user's friends network:
 *   - Loads owned groups and resolves the personal "Friends" group
 *   - Lists members (with profile data) excluding self
 *   - Searches other users by username or display name
 *   - Handles friend requests
 *   - Creates and updates groups
 */
export function useFriends() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      throw new Error('Your session expired. Please sign in again.')
    }

    const expiresAtMs = (data.session.expires_at ?? 0) * 1000
    const needsRefresh = expiresAtMs > 0 && expiresAtMs <= Date.now() + 30_000

    if (needsRefresh) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed.session?.access_token) {
        throw new Error('Your session expired. Please sign in again.')
      }
      return refreshed.session.access_token
    }

    return data.session.access_token
  }

  async function withFreshAuth<T>(
    op: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = await getAccessToken()
    try {
      return await op(token)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      const shouldRetry = /invalid or expired token|401/i.test(message)
      if (!shouldRetry) throw err

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed.session?.access_token) {
        throw new Error('Your session expired. Please sign in again.')
      }

      return op(refreshed.session.access_token)
    }
  }

  const groups = useQuery({
    queryKey: ['friends', 'groups', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_groups')
        .select('id, name, description, group_image_url, created_at')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as OwnedGroup[]
    },
  })

  const personalGroup = groups.data?.find((g) => g.name === 'Friends') ?? groups.data?.[0] ?? null
  const groupId = personalGroup?.id

  const friends = useQuery({
    queryKey: ['friends', 'members', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<FriendRow[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('id, role, user_id, profiles(*)')
        .eq('group_id', groupId!)
      if (error) throw error
      return (data ?? [])
        .filter((m: any) => m.user_id !== user!.id)
        .map((m: any) => ({
          membership_id: m.id,
          role: m.role,
          profile: m.profiles as Profile,
        }))
    },
  })

  const requests = useQuery({
    queryKey: ['friends', 'requests', user?.id],
    enabled: !!user,
    staleTime: 1000 * 30,
    queryFn: async () => {
      return withFreshAuth((token) => apiRequest<FriendRequestsResponse>('/friends/requests', {}, token))
    },
  })

  const sendRequest = useMutation({
    mutationFn: async (profileId: string) => {
      if (profileId === user!.id) throw new Error("You can't add yourself")
      await withFreshAuth((token) => apiRequest('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: profileId }),
      }, token))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
    },
  })

  const acceptRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await withFreshAuth((token) => apiRequest(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
      }, token))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
      qc.invalidateQueries({ queryKey: ['friends', 'members'] })
    },
  })

  const declineRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await withFreshAuth((token) => apiRequest(`/friends/requests/${requestId}/decline`, {
        method: 'POST',
      }, token))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'requests'] }),
  })

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await withFreshAuth((token) => apiRequest(`/friends/requests/${requestId}`, {
        method: 'DELETE',
      }, token))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'requests'] }),
  })

  const removeFriend = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', membershipId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'members'] }),
  })

  const createGroup = useMutation({
    mutationFn: async (payload: { name: string; description?: string; group_image_url?: string }) => {
      const cleanName = payload.name.trim()
      if (!cleanName) throw new Error('Group name is required')

      const insertData: Database['public']['Tables']['friend_groups']['Insert'] = {
        name: cleanName,
        owner_id: user!.id,
        description: payload.description?.trim() || null,
        group_image_url: payload.group_image_url?.trim() || null,
        invite_code: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      }

      const { error } = await supabase.from('friend_groups').insert(insertData)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'groups'] }),
  })

  const updateGroup = useMutation({
    mutationFn: async (payload: {
      id: string
      name: string
      description?: string
      group_image_url?: string
    }) => {
      const cleanName = payload.name.trim()
      if (!cleanName) throw new Error('Group name is required')

      const { error } = await supabase
        .from('friend_groups')
        .update({
          name: cleanName,
          description: payload.description?.trim() || null,
          group_image_url: payload.group_image_url?.trim() || null,
        })
        .eq('id', payload.id)
        .eq('owner_id', user!.id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'groups'] }),
  })

  return {
    group: personalGroup,
    groups,
    friends,
    requests,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    createGroup,
    updateGroup,
  }
}

export function useUserSearch(query: string) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['user-search', query],
    enabled: query.trim().length >= 2 && !!user,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<Profile[]> => {
      const q = query.trim()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', user!.id)
        .limit(15)
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}
