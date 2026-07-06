import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
        setMessage('Check your email to confirm your account!')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div className="text-center">
          <div className="text-6xl mb-2">🍺</div>
          <h1 className="text-3xl font-bold text-amber-400">BeerLog</h1>
          <p className="text-slate-400 text-sm mt-1">Track and share your beer adventures</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex rounded-xl overflow-hidden border border-slate-600">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors capitalize
                  ${mode === m ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {message ? (
            <div className="text-center text-green-400 text-sm py-2">{message}</div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <Button type="submit" loading={loading} size="lg" className="mt-1">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
