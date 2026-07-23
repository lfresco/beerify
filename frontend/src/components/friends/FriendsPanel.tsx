import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useFriends, useUserSearch } from '@/hooks/useFriends'
import type { Profile } from '@/types/database'

export function FriendsPanel() {
  const {
    friends,
    removeFriend,
    group,
    requests,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
  } = useFriends()
  const [q, setQ] = useState('')
  const search = useUserSearch(q)

  const friendIds = useMemo(
    () => new Set((friends.data ?? []).map((f) => f.profile.id)),
    [friends.data],
  )

  const incomingPending = useMemo(
    () => (requests.data?.incoming ?? []).filter((r) => r.status === 'pending'),
    [requests.data],
  )

  const outgoingPending = useMemo(
    () => (requests.data?.outgoing ?? []).filter((r) => r.status === 'pending'),
    [requests.data],
  )

  const incomingRequesterIds = useMemo(
    () => new Set(incomingPending.map((r) => r.requester_id)),
    [incomingPending],
  )

  const outgoingRecipientIds = useMemo(
    () => new Set(outgoingPending.map((r) => r.recipient_id)),
    [outgoingPending],
  )

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-slate-100">Friends</h3>
        <p className="text-sm text-slate-400">
          Send requests, accept incoming ones, and manage who is in your Friends group.
        </p>
      </div>

      {/* Incoming requests */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-slate-300">
          Incoming requests ({incomingPending.length})
        </h4>
        {requests.isLoading ? (
          <p className="text-sm text-slate-400">Loading requests...</p>
        ) : incomingPending.length === 0 ? (
          <p className="text-sm text-slate-400">No incoming requests.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {incomingPending.map((r) => (
              <UserRow
                key={r.id}
                profile={r.profiles}
                right={(
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      loading={acceptRequest.isPending}
                      onClick={() => acceptRequest.mutate(r.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={declineRequest.isPending}
                      onClick={() => declineRequest.mutate(r.id)}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Outgoing requests */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-slate-300">
          Sent requests ({outgoingPending.length})
        </h4>
        {requests.isLoading ? (
          <p className="text-sm text-slate-400">Loading requests...</p>
        ) : outgoingPending.length === 0 ? (
          <p className="text-sm text-slate-400">No pending sent requests.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {outgoingPending.map((r) => (
              <UserRow
                key={r.id}
                profile={r.profiles}
                right={(
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cancelRequest.isPending}
                    onClick={() => cancelRequest.mutate(r.id)}
                  >
                    Cancel
                  </Button>
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2">
        <Input
          label="Find people"
          placeholder="Search by username or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q.trim().length >= 2 && (
          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {search.isLoading && (
              <p className="text-sm text-slate-400 py-2">Searching…</p>
            )}
            {!search.isLoading && (search.data ?? []).length === 0 && (
              <p className="text-sm text-slate-400 py-2">No matches.</p>
            )}
            {(search.data ?? []).map((p: Profile) => (
              <UserRow
                key={p.id}
                profile={p}
                right={
                  friendIds.has(p.id) ? (
                    <span className="text-xs text-slate-500">Added</span>
                  ) : incomingRequesterIds.has(p.id) ? (
                    <span className="text-xs text-slate-500">Requested you</span>
                  ) : outgoingRecipientIds.has(p.id) ? (
                    <span className="text-xs text-slate-500">Pending</span>
                  ) : (
                    <Button
                      size="sm"
                      loading={sendRequest.isPending}
                      onClick={() =>
                        sendRequest.mutate(p.id, {
                          onSuccess: () => setQ(''),
                        })
                      }
                    >
                      Request
                    </Button>
                  )
                }
              />
            ))}
          </div>
        )}
        {sendRequest.error && (
          <p className="text-xs text-red-400">
            {(sendRequest.error as Error).message}
          </p>
        )}
        {acceptRequest.error && (
          <p className="text-xs text-red-400">{(acceptRequest.error as Error).message}</p>
        )}
        {declineRequest.error && (
          <p className="text-xs text-red-400">{(declineRequest.error as Error).message}</p>
        )}
        {cancelRequest.error && (
          <p className="text-xs text-red-400">{(cancelRequest.error as Error).message}</p>
        )}
      </div>

      {/* Existing friends */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-slate-300">
          Your friends ({friends.data?.length ?? 0})
        </h4>
        {group.isLoading || friends.isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (friends.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">
            No friends yet — search above and add someone.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {friends.data!.map((f) => (
              <UserRow
                key={f.membership_id}
                profile={f.profile}
                right={
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={removeFriend.isPending}
                    onClick={() => removeFriend.mutate(f.membership_id)}
                  >
                    Remove
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function UserRow({ profile, right }: { profile: Profile; right: React.ReactNode }) {
  const initial = (profile.display_name ?? profile.username ?? '?')[0]?.toUpperCase()
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 text-sm font-bold shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-100 truncate">
          {profile.display_name ?? profile.username}
        </div>
        <div className="text-xs text-slate-400 truncate">@{profile.username}</div>
      </div>
      {right}
    </div>
  )
}
