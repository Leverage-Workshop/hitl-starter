'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLIENT } from '@/lib/data'
import { BracketMark } from '@/components/ui/BracketMark'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    })

    setLoading(false)

    if (result.error) {
      setError(result.error.message ?? 'Sign-in failed. Please try again.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__brand">
          <BracketMark size={32} />
          <div className="login__brand-mark">{CLIENT.name} / Console</div>
        </div>

        {/* brass hairline */}
        <div className="login__sep"></div>

        <div className="login__form">
          {error && (
            <div className="login__error" role="alert">
              {error}
            </div>
          )}

          <div className="login__field">
            <label className="login__label">Email</label>
            <input
              className="login__input"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login__field">
            <label className="login__label">Password</label>
            <input
              className="login__input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="login__row">
            <a href="#" className="login__forgot">Forgot password</a>
          </div>

          <button
            className="btn btn--brass login__submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </div>
      </form>

      <div className="login__corner">
        <span>v 0.4.2</span>
        <span className="sep">·</span>
        <span>env · prod</span>
        <span className="sep">·</span>
        <span>us-east-1</span>
      </div>
    </div>
  )
}
