import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

interface PersonalStats {
  totalBeers: number
  avgRating: number
  stylesTried: number
  monthlyTrend: Array<{ month: string; count: number }>
  groupsJoined: number
  groupsOwned: number
}

export function useStats() {
  const user = useAuthStore((s) => s.user)

  const overall = useQuery({
    queryKey: ['stats', 'overall'],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beer_entries')
        .select('rating, tasted_at, style_id, user_id, beer_styles(name)')
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries = (data ?? []) as any[]
      const totalBeers = entries.length
      const avgRating = totalBeers
        ? entries.reduce((s, e) => s + (e.rating ?? 0), 0) / totalBeers
        : 0

      const uniqueUsers = new Set(entries.map((e) => e.user_id)).size

      // Monthly counts
      const byMonth: Record<string, number> = {}
      entries.forEach((e) => {
        const month = e.tasted_at.slice(0, 7)
        byMonth[month] = (byMonth[month] ?? 0) + 1
      })
      const monthlyTrend = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }))

      // Style distribution
      const styleMap: Record<string, number> = {}
      entries.forEach((e) => {
        const bs = e.beer_styles
        const name = bs ? (Array.isArray(bs) ? bs[0]?.name : bs.name) ?? 'Unknown' : 'Unknown'
        styleMap[name] = (styleMap[name] ?? 0) + 1
      })
      const styleDistribution = Object.entries(styleMap)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => ({ name, count }))

      // Rating distribution
      const ratingDist = [1, 2, 3, 4, 5].map((r) => ({
        rating: r,
        count: entries.filter((e) => e.rating === r).length,
      }))

      return { totalBeers, avgRating, uniqueUsers, monthlyTrend, styleDistribution, ratingDist }
    },
  })

  const leaderboard = useQuery({
    queryKey: ['stats', 'leaderboard'],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, display_name, username, avatar_url,
          beer_entries(rating, style_id)
        `)
      if (error) throw error
      return (data as any[] ?? [])
        .map((p: any) => {
          const entries = p.beer_entries ?? []
          const total = entries.length
          const avg = total
            ? entries.reduce((s: number, e: any) => s + (e.rating ?? 0), 0) / total
            : 0
          const styles = new Set(entries.map((e: any) => e.style_id).filter(Boolean)).size
          return {
            id: p.id,
            display_name: p.display_name ?? p.username,
            avatar_url: p.avatar_url,
            total,
            avg: Math.round(avg * 10) / 10,
            styles,
          }
        })
        .sort((a: any, b: any) => b.total - a.total)
    },
  })

  return { overall, leaderboard }
}

export function useMyStats() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['stats', 'me', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<PersonalStats> => {
      const [{ data: entries, error: entriesError }, { data: memberships, error: membershipsError }, { count: ownedCount, error: ownedError }] = await Promise.all([
        supabase
          .from('beer_entries')
          .select('rating, style_id, created_at')
          .eq('user_id', user!.id),
        supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user!.id),
        supabase
          .from('friend_groups')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user!.id),
      ])

      if (entriesError) throw entriesError
      if (membershipsError) throw membershipsError
      if (ownedError) throw ownedError

      const safeEntries = entries ?? []
      const totalBeers = safeEntries.length
      const avgRating = totalBeers
        ? safeEntries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / totalBeers
        : 0
      const stylesTried = new Set(safeEntries.map((entry) => entry.style_id).filter(Boolean)).size

      const byMonth: Record<string, number> = {}
      safeEntries.forEach((entry) => {
        const month = entry.created_at.slice(0, 7)
        byMonth[month] = (byMonth[month] ?? 0) + 1
      })

      const monthlyTrend = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }))

      const groupsJoined = new Set((memberships ?? []).map((membership) => membership.group_id)).size

      return {
        totalBeers,
        avgRating,
        stylesTried,
        monthlyTrend,
        groupsJoined,
        groupsOwned: ownedCount ?? 0,
      }
    },
  })
}
