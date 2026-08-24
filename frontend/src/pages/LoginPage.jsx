import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (e) => {
    clearError()
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form)
    if (result.success) navigate('/')
  }

  return (
    <div className="login-page">
      {/* Left Brand Panel */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo-wrap">
            <img src="/logo-full.png" alt="Sree Lakshmi Logo" />
          </div>
          <h1 className="login-brand-title">Sree Lakshmi<br/>Charitable Trust</h1>
          <p className="login-brand-sub">Empowering communities through<br/>transparent and accountable operations.</p>
        </div>

        <div style={{ position: 'absolute', bottom: 40, left: 40, display: 'inline-block', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '12px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: 'var(--white)' }}>2026</span>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--primary-100)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Est. Year</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-form-header">
            <div className="login-form-icon">🏛️</div>
            <h2>Welcome Back</h2>
            <p>Sign in to your management portal</p>
          </div>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-input-group">
              <span className="login-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                id="username"
                className="login-input"
                type="text"
                name="username"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="login-input-group">
              <span className="login-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                id="password"
                className="login-input"
                type={showPass ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="login-eye-btn">
                {showPass
                  ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>

            <button id="login-btn" className="login-btn" type="submit" disabled={isLoading}>
              {isLoading ? (
                <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white', width: 16, height: 16 }} /> Signing in...</>
              ) : (
                <>Sign In <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
              )}
            </button>
          </form>

          <div className="login-footer">
            <span>🔒</span> Secured internal portal &nbsp;·&nbsp; Sree Lakshmi Charitable Trust
          </div>
        </div>
      </div>
    </div>
  )
}

