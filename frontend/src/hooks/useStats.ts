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

export interface StatsFilters {
  period: 'all' | '30d' | '90d' | 'year' | 'custom'
  startDate?: string
  endDate?: string
}

function toIsoDateBoundary(dateOnly: string, endOfDay = false): string | undefined {
  if (!dateOnly) return undefined
  const date = new Date(`${dateOnly}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function getRangeForFilters(filters?: StatsFilters): { start?: string; end?: string } {
  if (!filters || filters.period === 'all') return {}

  if (filters.period === 'custom') {
    return {
      start: filters.startDate ? toIsoDateBoundary(filters.startDate) : undefined,
      end: filters.endDate ? toIsoDateBoundary(filters.endDate, true) : undefined,
    }
  }

  const end = new Date()
  const start = new Date(end)

  if (filters.period === '30d') start.setDate(end.getDate() - 30)
  if (filters.period === '90d') start.setDate(end.getDate() - 90)
  if (filters.period === 'year') start.setFullYear(end.getFullYear() - 1)

  start.setHours(0, 0, 0, 0)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function useStats(filters?: StatsFilters) {
  const user = useAuthStore((s) => s.user)

  const range = getRangeForFilters(filters)

  const overall = useQuery({
    queryKey: ['stats', 'overall', range.start ?? null, range.end ?? null],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,  // 10 min - stats don't change often
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      let query = supabase
        .from('beer_entries')
        .select('rating, tasted_at, style_id, user_id, beer_styles(name)')

      if (range.start) query = query.gte('tasted_at', range.start)
      if (range.end) query = query.lte('tasted_at', range.end)

      const { data, error } = await query
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
    queryKey: ['stats', 'leaderboard', range.start ?? null, range.end ?? null],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,  // 10 min
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, display_name, username, avatar_url,
          beer_entries(rating, style_id, tasted_at)
        `)
      if (error) throw error
      const startMs = range.start ? Date.parse(range.start) : null
      const endMs = range.end ? Date.parse(range.end) : null
      return (data as any[] ?? [])
        .map((p: any) => {
          const entries = (p.beer_entries ?? []).filter((e: any) => {
            const tastedAtMs = Date.parse(e.tasted_at)
            if (Number.isNaN(tastedAtMs)) return false
            if (startMs !== null && tastedAtMs < startMs) return false
            if (endMs !== null && tastedAtMs > endMs) return false
            return true
          })
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
