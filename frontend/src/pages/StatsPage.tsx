import { StatsPanel } from '@/components/stats/StatsPanel'

export default function StatsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-100 mb-6">Group Stats</h1>
      <StatsPanel />
    </div>
  )
}
