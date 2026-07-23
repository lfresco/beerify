import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { Profile } from '@/types/database'

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

/**
 * Manages the current user's personal "Friends" group:
 *   - Loads the group id
 *   - Lists members (with profile data) excluding self
 *   - Searches other users by username or display name
 *   - Adds / removes members
 */
export function useFriends() {
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const qc = useQueryClient()

  const group = useQuery({
    queryKey: ['friends', 'group', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_groups')
        .select('id, name')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; name: string } | null
    },
  })

  const groupId = group.data?.id

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
    enabled: !!user && !!session,
    staleTime: 1000 * 30,
    queryFn: async () => {
      return apiRequest<FriendRequestsResponse>('/friends/requests', {}, session!.access_token)
    },
  })

  const sendRequest = useMutation({
    mutationFn: async (profileId: string) => {
      if (profileId === user!.id) throw new Error("You can't add yourself")
      await apiRequest('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: profileId }),
      }, session!.access_token)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
    },
  })

  const acceptRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
      }, session!.access_token)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
      qc.invalidateQueries({ queryKey: ['friends', 'members'] })
    },
  })

  const declineRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest(`/friends/requests/${requestId}/decline`, {
        method: 'POST',
      }, session!.access_token)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends', 'requests'] }),
  })

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest(`/friends/requests/${requestId}`, {
        method: 'DELETE',
      }, session!.access_token)
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

  return {
    group,
    friends,
    requests,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
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
