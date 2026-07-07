import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

// Singleton flag: ensures auth initialization only happens once globally
let authInitialized = false

export function useAuth() {
  const { user, session, profile, loading, setAuth, setProfile, setLoading, reset } = useAuthStore()
  const fetchingRef = useRef(false)

  useEffect(() => {
    // Only the FIRST component that mounts with useAuth will initialize
    if (authInitialized) return
    authInitialized = true

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuth(session.user, session)
        fetchProfile(session.user.id)
      } else {
        reset()
      }
    })

    return () => {
      subscription.unsubscribe()
      authInitialized = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile(userId: string) {
    // Prevent concurrent/duplicate fetches
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) console.error('fetchProfile error:', error)
      setProfile(data ?? null)
    } catch (e) {
      console.error('fetchProfile threw:', e)
      setProfile(null)
    } finally {
      setLoading(false)
      fetchingRef.current = false
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

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, session, profile, loading, signInWithEmail, signUpWithEmail, signOut }
}
