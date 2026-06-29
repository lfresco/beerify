import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { StatsPanel } from '@/components/stats/StatsPanel'

export default function ProfilePage() {
  const { profile } = useAuthStore()
  const { signOut } = useAuth()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName, bio })
        .eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setEditing(false)
    },
  })

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 text-2xl font-bold shrink-0">
            {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex flex-col gap-2">
                <Input
                  label="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Textarea
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2 mt-1">
                  <Button size="sm" loading={updateProfile.isPending} onClick={() => updateProfile.mutate()}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-100">{profile?.display_name ?? profile?.username}</h2>
                <p className="text-sm text-slate-400">@{profile?.username}</p>
                {profile?.bio && <p className="text-sm text-slate-300 mt-1">{profile.bio}</p>}
                <button onClick={() => setEditing(true)} className="text-xs text-amber-400 hover:underline mt-2">Edit profile</button>
              </>
            )}
          </div>
        </div>
      </Card>

      <StatsPanel />

      <Button variant="danger" onClick={signOut}>Sign out</Button>
    </div>
  )
}
