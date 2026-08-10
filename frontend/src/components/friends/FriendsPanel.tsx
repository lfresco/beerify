import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useFriends, useUserSearch } from '@/hooks/useFriends'
import type { Profile } from '@/types/database'

export function FriendsPanel() {
  const {
    friends,
    removeFriend,
    group,
    groups,
    requests,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    createGroup,
    updateGroup,
  } = useFriends()
  const [q, setQ] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupBio, setNewGroupBio] = useState('')
  const [newGroupImage, setNewGroupImage] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupBio, setEditGroupBio] = useState('')
  const [editGroupImage, setEditGroupImage] = useState('')
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

  const acceptedFriendsFallback = useMemo(() => {
    const byId = new Map<string, { friendship_id: string; profile: Profile }>()

    for (const request of requests.data?.incoming ?? []) {
      if (request.status !== 'accepted') continue
      if (!request.profiles) continue
      byId.set(request.requester_id, {
        friendship_id: request.id,
        profile: request.profiles,
      })
    }

    for (const request of requests.data?.outgoing ?? []) {
      if (request.status !== 'accepted') continue
      if (!request.profiles) continue
      byId.set(request.recipient_id, {
        friendship_id: request.id,
        profile: request.profiles,
      })
    }

    return Array.from(byId.values())
  }, [requests.data])

  const effectiveFriends = useMemo(
    () => ((friends.data?.length ?? 0) > 0 ? friends.data! : acceptedFriendsFallback),
    [friends.data, acceptedFriendsFallback],
  )

  const acceptedConnectionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of requests.data?.incoming ?? []) {
      if (row.status === 'accepted') ids.add(row.requester_id)
    }
    for (const row of requests.data?.outgoing ?? []) {
      if (row.status === 'accepted') ids.add(row.recipient_id)
    }
    return ids
  }, [requests.data])

  const connectedIds = useMemo(() => {
    const ids = new Set(friendIds)
    for (const id of acceptedConnectionIds) ids.add(id)
    return ids
  }, [friendIds, acceptedConnectionIds])

  function startEditGroup(groupId: string, name: string, description: string | null, imageUrl: string | null) {
    setEditingGroupId(groupId)
    setEditGroupName(name)
    setEditGroupBio(description ?? '')
    setEditGroupImage(imageUrl ?? '')
  }

  function resetCreateGroupForm() {
    setNewGroupName('')
    setNewGroupBio('')
    setNewGroupImage('')
  }

  function stopEditGroup() {
    setEditingGroupId(null)
    setEditGroupName('')
    setEditGroupBio('')
    setEditGroupImage('')
  }

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-slate-100">Friends</h3>
        <p className="text-sm text-slate-400">
          Send requests, accept incoming ones, and optionally organize friends into groups.
        </p>
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-slate-300">
          Your groups ({groups.data?.length ?? 0})
        </h4>

        {groups.isLoading ? (
          <p className="text-sm text-slate-400">Loading groups...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(groups.data ?? []).map((g) => {
              const isEditing = editingGroupId === g.id
              return (
                <div key={g.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex flex-col gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        label="Group name"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        placeholder="Weekend Crew"
                      />
                      <Textarea
                        label="Group bio"
                        value={editGroupBio}
                        onChange={(e) => setEditGroupBio(e.target.value)}
                        rows={2}
                        placeholder="What this group is about"
                      />
                      <Input
                        label="Group image URL"
                        value={editGroupImage}
                        onChange={(e) => setEditGroupImage(e.target.value)}
                        placeholder="https://..."
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          loading={updateGroup.isPending}
                          onClick={() => updateGroup.mutate(
                            {
                              id: g.id,
                              name: editGroupName,
                              description: editGroupBio,
                              group_image_url: editGroupImage,
                            },
                            { onSuccess: stopEditGroup },
                          )}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={stopEditGroup}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        {g.group_image_url ? (
                          <img src={g.group_image_url} alt={g.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm">
                            {g.name[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-100">{g.name}</p>
                          {g.description && <p className="text-xs text-slate-400 mt-0.5">{g.description}</p>}
                          {g.id === group?.id && <p className="text-xs text-amber-400 mt-1">Default group</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditGroup(g.id, g.name, g.description, g.group_image_url)}
                        >
                          Edit
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-200">Create a new group</p>
          <Input
            label="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Beer Travelers"
          />
          <Textarea
            label="Group bio"
            value={newGroupBio}
            onChange={(e) => setNewGroupBio(e.target.value)}
            rows={2}
            placeholder="Short description"
          />
          <Input
            label="Group image URL"
            value={newGroupImage}
            onChange={(e) => setNewGroupImage(e.target.value)}
            placeholder="https://..."
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={createGroup.isPending}
              onClick={() => createGroup.mutate(
                {
                  name: newGroupName,
                  description: newGroupBio,
                  group_image_url: newGroupImage,
                },
                { onSuccess: resetCreateGroupForm },
              )}
            >
              Create group
            </Button>
            <Button size="sm" variant="ghost" onClick={resetCreateGroupForm}>Clear</Button>
          </div>
          {createGroup.error && <p className="text-xs text-red-400">{(createGroup.error as Error).message}</p>}
          {updateGroup.error && <p className="text-xs text-red-400">{(updateGroup.error as Error).message}</p>}
        </div>
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
                  connectedIds.has(p.id) ? (
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
          Your friends ({effectiveFriends.length})
        </h4>
        {groups.isLoading || friends.isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : effectiveFriends.length === 0 ? (
          <p className="text-sm text-slate-400">
            No friends yet — search above and add someone.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {effectiveFriends.map((f) => (
              <UserRow
                key={f.friendship_id}
                profile={f.profile}
                right={
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={removeFriend.isPending}
                    onClick={() => removeFriend.mutate(f.friendship_id)}
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
