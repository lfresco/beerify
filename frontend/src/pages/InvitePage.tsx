import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function InvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const [invite, setInvite] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link — no token found.')
      setLoading(false)
      return
    }
    supabase
      .from('invites')
      .select('*, friend_groups(name), profiles!referrer_id(display_name, username)')
      .eq('invite_token', token)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) {
          setError('Invite not found or already used.')
        } else if (new Date(data.expires_at) < new Date()) {
          setError('This invite has expired.')
        } else if (data.used_at) {
          setError('This invite has already been used.')
        } else {
          setInvite(data)
        }
        setLoading(false)
      })
  }, [token])

  async function acceptInvite() {
    if (!user || !session || !token) return navigate('/#/login')
    setJoining(true)
    try {
      await apiRequest('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }, session.access_token)
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Checking invite…</div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">😞</div>
          <h2 className="font-bold text-lg text-slate-100 mb-2">Invite issue</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/')}>Go to app</Button>
        </Card>
      </div>
    )
  }

  const inviter = (invite.profiles as any)?.display_name ?? (invite.profiles as any)?.username
  const group = (invite.friend_groups as any)?.name

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-sm w-full flex flex-col gap-4 text-center">
        <div className="text-5xl">🍺</div>
        <div>
          <h2 className="font-bold text-xl text-slate-100">{inviter} invited you!</h2>
          {group && <p className="text-slate-400 text-sm mt-1">Join <span className="text-amber-400 font-medium">{group}</span> on BeerLog</p>}
        </div>
        {!user ? (
          <>
            <p className="text-slate-400 text-sm">Sign up or log in first, then come back to this link.</p>
            <Button onClick={() => navigate(`/#/login?next=/invite?token=${token}`)}>
              Sign up / Log in
            </Button>
          </>
        ) : (
          <Button size="lg" loading={joining} onClick={acceptInvite}>
            Accept and join
          </Button>
        )}
      </Card>
    </div>
  )
}
