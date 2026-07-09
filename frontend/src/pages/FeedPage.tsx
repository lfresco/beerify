import { useState } from 'react'
import { useFeed, useDeleteEntry } from '@/hooks/useFeed'
import { useAuthStore } from '@/store/auth'
import { FeedCard } from '@/components/feed/FeedCard'
import { BeerEntryForm } from '@/components/beer/BeerEntryForm'
import { Button } from '@/components/ui/Button'

export default function FeedPage() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading, error, refetch } = useFeed()
  const deleteEntry = useDeleteEntry()
  const [showForm, setShowForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  const editingEntry = data?.find((item) => item.entry.id === editingEntryId)?.entry ?? null

  function openCreateForm() {
    setEditingEntryId(null)
    setShowForm((prev) => !prev)
  }

  function openEditForm(entryId: string) {
    setEditingEntryId(entryId)
    setShowForm(true)
  }

  async function handleDelete(entryId: string) {
    const shouldDelete = window.confirm('Delete this post? This cannot be undone.')
    if (!shouldDelete) return
    await deleteEntry.mutateAsync(entryId)
  }

  function handleFormSuccess() {
    setEditingEntryId(null)
    setShowForm(false)
  }

  function handleFormCancel() {
    setEditingEntryId(null)
    setShowForm(false)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Feed</h1>
        <Button onClick={openCreateForm}>
          {showForm && !editingEntryId ? 'Close' : '+ Log beer'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-200 mb-4">
            {editingEntry ? 'Edit your post' : 'What are you drinking?'}
          </h2>
          <BeerEntryForm
            editingEntry={editingEntry}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {isLoading && (
        <div className="text-center text-slate-400 py-10">Loading feed…</div>
      )}

      {error && (
        <div className="text-center text-red-400 py-6">
          Failed to load feed.
          <button onClick={() => refetch()} className="ml-2 underline">Retry</button>
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <div className="text-center text-slate-400 py-16 flex flex-col items-center gap-3">
          <span className="text-5xl">🫗</span>
          <p className="font-medium">No beers logged yet!</p>
          <p className="text-sm">Be the first to log one.</p>
          <Button onClick={() => setShowForm(true)}>Log a beer</Button>
        </div>
      )}

      {data?.map((item) => (
        <FeedCard
          key={item.entry.id}
          item={item}
          currentUserId={user?.id ?? ''}
          onEdit={openEditForm}
          onDelete={(entryId) => {
            void handleDelete(entryId)
          }}
        />
      ))}
    </div>
  )
}
