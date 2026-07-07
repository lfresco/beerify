import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { useStats } from '@/hooks/useStats'

const COLORS = ['#f59e0b', '#fb923c', '#a78bfa', '#34d399', '#60a5fa', '#f472b6']

export function StatsPanel() {
  const { overall, leaderboard } = useStats()

  if (overall.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400">
        Loading stats…
      </div>
    )
  }

  const stats = overall.data

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total beers', value: stats?.totalBeers ?? 0, icon: '🍺' },
          { label: 'Avg rating', value: stats ? (stats.avgRating.toFixed(1)) : '—', icon: '⭐' },
          { label: 'Styles tried', value: stats?.styleDistribution.length ?? 0, icon: '🎨' },
          { label: 'Members', value: stats?.uniqueUsers ?? 0, icon: '👥' },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex flex-col gap-1">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-2xl font-bold text-amber-400">{s.value}</span>
            <span className="text-xs text-slate-400">{s.label}</span>
          </Card>
        ))}
      </div>

      {/* Monthly trend */}
      {stats && stats.monthlyTrend.length > 1 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Beers per month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.monthlyTrend}>
              <defs>
                <linearGradient id="beerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#f59e0b" fill="url(#beerGrad)" strokeWidth={2} name="Beers" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Style distribution + Rating distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats && stats.styleDistribution.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Style breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stats.styleDistribution.slice(0, 6)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name }) => name}
                  labelLine={false}
                >
                  {stats.styleDistribution.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {stats && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Rating distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.ratingDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="rating" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => '⭐'.repeat(v)} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.data && leaderboard.data.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">🏆 Leaderboard</h3>
          <div className="flex flex-col gap-2">
            {leaderboard.data.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-500 w-5 text-right">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 text-xs font-bold shrink-0">
                  {u.display_name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 text-sm text-slate-200">{u.display_name}</span>
                <span className="text-sm font-bold text-amber-400">{u.total} 🍺</span>
                <span className="text-xs text-slate-400">⭐ {u.avg}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
