import { useMemo, useState } from 'react'
import { StatsPanel } from '@/components/stats/StatsPanel'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { StatsFilters } from '@/hooks/useStats'

export default function StatsPage() {
  const [period, setPeriod] = useState<StatsFilters['period']>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filters = useMemo<StatsFilters>(() => {
    if (period !== 'custom') {
      return { period }
    }
    return {
      period,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }
  }, [period, startDate, endDate])

  function clearCustomDates() {
    setStartDate('')
    setEndDate('')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-100 mb-4">Group Stats</h1>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All time' },
            { key: '30d', label: 'Last 30d' },
            { key: '90d', label: 'Last 90d' },
            { key: 'year', label: 'Last year' },
            { key: 'custom', label: 'Custom' },
          ].map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={period === option.key ? 'primary' : 'secondary'}
              onClick={() => setPeriod(option.key as StatsFilters['period'])}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearCustomDates}>Clear dates</Button>
            </div>
          </div>
        )}
      </div>

      <StatsPanel filters={filters} />
    </div>
  )
}
