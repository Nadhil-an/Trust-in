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
          <img src="/logo-full.png" alt="Sree Lakshmi Logo" style={{ width: 140, height: 'auto', marginBottom: 24, objectFit: 'contain', borderRadius: 16, backgroundColor: 'white', padding: 12 }} />
          <h1>Sree Lakshmi Charitable Trust</h1>
          <p>Integrated Management System for transparent, accountable, and efficient operations.</p>
          <div className="login-features">
            <div className="login-feature">
              <span className="login-feature-icon">🔐</span>
              <span className="login-feature-text">Role-based secure access — Manager, Accountant, Cashier, HR</span>
            </div>
            <div className="login-feature">
              <span className="login-feature-icon">⚡</span>
              <span className="login-feature-text">Real-time updates across all modules via WebSocket</span>
            </div>
            <div className="login-feature">
              <span className="login-feature-icon">📊</span>
              <span className="login-feature-text">Complete financial tracking with audit trail</span>
            </div>
            <div className="login-feature">
              <span className="login-feature-icon">👥</span>
              <span className="login-feature-text">Comprehensive HR, payroll & member management</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="login-right">
        <div className="login-form-wrap">
          <h2>Welcome Back</h2>
          <p>Sign in to your account to continue</p>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-input-group">
              <span className="login-input-icon">👤</span>
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
              <span className="login-input-icon">🔒</span>
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
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-500)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showPass ? <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
              </button>
            </div>

            <button id="login-btn" className="login-btn" type="submit" disabled={isLoading}>
              {isLoading ? (
                <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white', width: 16, height: 16 }} /> Signing in...</>
              ) : (
                <>Sign In →</>
              )}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: '16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8, fontWeight: 600 }}>🔑 Default Admin Credentials:</p>
            <p style={{ fontSize: 12, color: 'var(--gray-600)' }}>Username: <strong>admin</strong> &nbsp;|&nbsp; Password: <strong>Admin@2026</strong></p>
          </div>

          <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 16, textAlign: 'center' }}>
            Sree Lakshmi Charitable Trust — Internal System v1.0<br />
            Secured by OWASP guidelines
          </p>
        </div>
      </div>
    </div>
  )
}
