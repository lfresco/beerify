import { useEffect, useRef, useState } from 'react'
import { useFeed, useDeleteEntry } from '@/hooks/useFeed'
import { useAuthStore } from '@/store/auth'
import { FeedCard } from '@/components/feed/FeedCard'
import { DesktopFeaturedCard } from '@/components/feed/DesktopFeaturedCard'
import { BeerEntryForm } from '@/components/beer/BeerEntryForm'
import { Button } from '@/components/ui/Button'

export default function FeedPage() {
  const user = useAuthStore((s) => s.user)
  const {
    data,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useFeed()
  const deleteEntry = useDeleteEntry()
  const [showForm, setShowForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const editingItem = data?.find((item) => item.entry.id === editingEntryId) ?? null
  const editingEntry = editingItem?.entry ?? null

  // Featured item on desktop = most recent entry
  const featuredItem = data?.[0] ?? null

  function openCreateForm() {
    setEditingEntryId(null)
    setShowForm((prev) => !prev)
  }

  function openEditForm(entryId: string) {
    setEditingEntryId(entryId)
    dialogRef.current?.showModal()
  }

  function closeEditModal() {
    dialogRef.current?.close()
    setEditingEntryId(null)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleClose() { setEditingEntryId(null) }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [])

  async function handleDelete(entryId: string) {
    const shouldDelete = window.confirm('Delete this post? This cannot be undone.')
    if (!shouldDelete) return
    await deleteEntry.mutateAsync(entryId)
  }

  function handleFormSuccess() {
    setShowForm(false)
    closeEditModal()
  }

  function handleCreateCancel() {
    setShowForm(false)
  }

  const isEmpty = !isLoading && data?.length === 0

  function handleLoadMore() {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }

  return (
    <>
      {/* ═══════════════════════════════════════════
          MOBILE layout — single column, unchanged
      ═══════════════════════════════════════════ */}
      <div className="md:hidden max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Feed</h1>
          <Button onClick={openCreateForm} className="!bg-white !text-black hover:!bg-gray-200 !rounded-full">
            {showForm && !editingEntryId ? 'Close' : '+ Log beer'}
          </Button>
        </div>

        {showForm && (
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>What are you drinking?</h2>
            <BeerEntryForm onSuccess={handleFormSuccess} onCancel={handleCreateCancel} />
          </div>
        )}

        {isLoading && <div className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>Loading feed…</div>}
        {error && (
          <div className="text-center py-6 text-red-400">
            Failed to load feed.
            <button onClick={() => refetch()} className="ml-2 underline">Retry</button>
          </div>
        )}
        {isEmpty && (
          <div className="text-center py-16 flex flex-col items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
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
            onDelete={(id) => { void handleDelete(id) }}
          />
        ))}
        {hasNextPage && (
          <div className="pt-2 pb-4 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLoadMore}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more posts'}
            </Button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP layout — 2-column maximal-mono grid
      ═══════════════════════════════════════════ */}
      <div className="hidden md:grid md:grid-cols-[380px_1fr] md:h-[calc(100vh-48px)] max-w-[1280px] mx-auto"
           style={{ borderLeft: '1px solid var(--card-border)', borderRight: '1px solid var(--card-border)' }}>

        {/* Left column: featured card + log form */}
        <aside className="flex flex-col overflow-hidden"
               style={{ borderRight: '1px solid var(--card-border)' }}>

          {/* Featured beer card */}
          {featuredItem && (
            <DesktopFeaturedCard
              item={featuredItem}
              currentUserId={user?.id ?? ''}
              onEdit={openEditForm}
              onDelete={(id) => { void handleDelete(id) }}
            />
          )}

          {/* Log form toggle */}
          <div className="p-4 flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-black tracking-[0.1em] uppercase text-white
                               border-b-[3px] border-white pb-1">
                Log a Beer
              </span>
              <Button
                size="sm"
                onClick={openCreateForm}
                className="!bg-white !text-black hover:!bg-gray-200 !rounded-none !text-[11px] !font-black !tracking-widest !uppercase"
              >
                {showForm && !editingEntryId ? '✕ Close' : '+ New'}
              </Button>
            </div>
            {showForm && (
              <BeerEntryForm onSuccess={handleFormSuccess} onCancel={handleCreateCancel} />
            )}
          </div>
        </aside>

        {/* Right column: feed list */}
        <main className="flex flex-col overflow-hidden">
          {/* Feed header bar */}
          <div className="flex items-stretch flex-shrink-0"
               style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex-1 px-5 py-3">
              <div className="text-[11px] font-black tracking-[0.1em] uppercase text-white">
                Friends' Activity
              </div>
              <div className="text-[11px] font-light" style={{ color: 'var(--text-dim)' }}>
                Real-time · sorted by recent
              </div>
            </div>
            <div className="px-5 py-3 flex flex-col items-end justify-center"
                 style={{ borderLeft: '1px solid var(--card-border)', minWidth: '80px' }}>
              <div className="text-[28px] font-black tracking-[-0.04em] leading-none text-white">
                {data?.length ?? '—'}
              </div>
              <div className="text-[9px] font-bold tracking-[0.1em] uppercase"
                   style={{ color: 'var(--text-dim)' }}>
                Logs
              </div>
            </div>
          </div>

          {/* Scrollable feed rows */}
          <div className="overflow-y-auto flex-1">
            {isLoading && (
              <div className="text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Loading feed…
              </div>
            )}
            {error && (
              <div className="text-center py-6 text-red-400 text-sm">
                Failed to load feed.{' '}
                <button onClick={() => refetch()} className="underline">Retry</button>
              </div>
            )}
            {isEmpty && (
              <div className="text-center py-20 flex flex-col items-center gap-3"
                   style={{ color: 'var(--text-secondary)' }}>
                <span className="text-5xl">🫗</span>
                <p className="font-medium text-sm">No beers logged yet!</p>
              </div>
            )}
            {data?.map((item) => (
              <FeedCard
                key={item.entry.id}
                item={item}
                currentUserId={user?.id ?? ''}
                onEdit={openEditForm}
                onDelete={(id) => { void handleDelete(id) }}
                desktopRow
              />
            ))}
            {hasNextPage && (
              <div className="p-4 flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more posts'}
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit modal — shared between mobile and desktop */}
      <dialog
        ref={dialogRef}
        onClick={(e) => { if (e.target === dialogRef.current) closeEditModal() }}
        className="backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto max-w-lg w-[calc(100%-2rem)] open:flex open:items-center open:justify-center"
      >
        <div className="rounded-2xl p-5 w-full max-h-[85vh] overflow-y-auto"
             style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Edit your post</h2>
            <button onClick={closeEditModal}
                    className="text-xl leading-none transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>
              ✕
            </button>
          </div>
          {editingEntry && (
            <BeerEntryForm
              editingEntry={editingEntry}
              initialTaggedUserIds={editingItem?.tags.map((tag) => tag.tagged_user_id) ?? []}
              onSuccess={handleFormSuccess}
              onCancel={closeEditModal}
            />
          )}
        </div>
      </dialog>
    </>
  )
}
