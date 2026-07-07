import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const { user, session, profile, loading, setAuth, setProfile, setLoading, reset } = useAuthStore()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          setAuth(session.user, session)
          fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((e) => {
        console.error('getSession failed:', e)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setAuth(session.user, session)
        fetchProfile(session.user.id)
      } else {
        reset()
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile(userId: string) {
    console.log('[useAuth] fetchProfile called for userId:', userId)
    setLoading(true)
    try {
      console.log('[useAuth] Fetching profile from Supabase...')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      console.log('[useAuth] fetchProfile result:', { data, error })
      if (error) console.error('fetchProfile error:', error)
      setProfile(data ?? null)
    } catch (e) {
      console.error('fetchProfile threw:', e)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/auth/callback`,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, session, profile, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }
}
