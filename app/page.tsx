'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLIENT } from '@/lib/data'
import { BracketMark } from '@/components/ui/BracketMark'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('j.grant@halberd-co.com')
  const [password, setPassword] = useState('••••••••')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // Set auth cookie and redirect to dashboard
    document.cookie = 'hitl_authed=true; path=/; max-age=86400; SameSite=Lax'
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
          <div className="login__field">
            <label className="login__label">Email</label>
            <input
              className="login__input"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login__field">
            <label className="login__label">Password</label>
            <input
              className="login__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="login__row">
            <a href="#" className="login__forgot">Forgot password</a>
          </div>

          <button className="btn btn--brass login__submit" type="submit">
            Sign in →
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
