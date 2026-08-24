// BirthdayBanner.jsx — used by Manager & HR web dashboards
import React, { useEffect, useState } from 'react'
import { hrApi } from '../api'

// Confetti particle (pure CSS animation via inline style)
const Confetti = ({ color, left, delay, duration }) => (
  <span style={{
    position: 'absolute',
    top: -8, left: `${left}%`,
    width: 8, height: 8,
    borderRadius: color.includes('#F') ? '50%' : 2,
    background: color,
    animation: `fall ${duration}s ease-in ${delay}s infinite`,
    pointerEvents: 'none',
    opacity: 0.85,
    zIndex: 0,
  }} />
)

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF922B', '#CC5DE8', '#F06595']

export default function BirthdayBanner() {
  const [data, setData] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const todayStr = new Date().toDateString()
    const lastSeen = localStorage.getItem('birthdayBannerSeenDate')
    
    if (lastSeen === todayStr) {
      setDismissed(true)
      return
    }

    // Fetch the real birthday data
    hrApi.birthdayAlerts()
      .then(res => {
        const d = res.data || {}
        setData(d)
        
        // If there is actual birthday data to show, mark as seen and set auto-dismiss
        if ((d.today && d.today.length > 0) || (d.tomorrow && d.tomorrow.length > 0)) {
          localStorage.setItem('birthdayBannerSeenDate', todayStr)
          setTimeout(() => setDismissed(true), 120000) // Auto-dismiss after 2 minutes
        }
      })
      .catch(() => setData(null))
  }, [])

  if (dismissed || !data) return null

  const today = data.today || []
  const tomorrow = data.tomorrow || []

  if (today.length === 0 && tomorrow.length === 0) return null

  const hasBirthday = today.length > 0

  return (
    <>
      {/* Inject CSS keyframes once */}
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
        @keyframes bdayPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.04); }
        }
        @keyframes cakeWiggle {
          0%, 100% { transform: rotate(0deg); }
          25%       { transform: rotate(-8deg); }
          75%       { transform: rotate(8deg); }
        }
        @keyframes shimmer {
          0%, 100% { color: #E91E8C; }
          50%       { color: #FF9800; }
        }
        .bday-shimmer { animation: shimmer 1.6s ease-in-out infinite; }
        .bday-cake    { animation: cakeWiggle 1.2s ease-in-out infinite; display: inline-block; }
        .bday-banner  { animation: bdayPulse 2s ease-in-out infinite; }
      `}</style>

      <div className="bday-banner" style={{
        position: 'relative', overflow: 'hidden',
        background: hasBirthday
          ? 'linear-gradient(135deg, #FFF0F5 0%, #FDF2FF 50%, #FFF8E1 100%)'
          : 'linear-gradient(135deg, #FFFDE7 0%, #FFF9C4 100%)',
        border: `2px solid ${hasBirthday ? '#F9A8D4' : '#FDE68A'}`,
        borderRadius: 16, padding: '16px 20px',
        marginBottom: 20, boxShadow: '0 4px 20px rgba(219,39,119,0.12)',
      }}>
        {/* Confetti particles */}
        {hasBirthday && Array.from({ length: 18 }).map((_, i) => (
          <Confetti
            key={i}
            color={COLORS[i % COLORS.length]}
            left={Math.round((i / 18) * 100)}
            delay={i * 0.18}
            duration={2 + (i % 3) * 0.5}
          />
        ))}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="bday-cake" style={{ fontSize: 32 }}>🎂</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {hasBirthday
                    ? <span className="bday-shimmer" style={{ fontSize: 17, fontWeight: 800 }}>
                        🎉 Birthday Today!
                      </span>
                    : <span style={{ fontSize: 17, fontWeight: 800, color: '#92400E' }}>
                        ⏰ Birthday Tomorrow!
                      </span>
                  }
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                  {hasBirthday
                    ? "Wish your colleagues a happy birthday!"
                    : "Plan ahead — someone's birthday is tomorrow!"
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{
                border: 'none', background: 'transparent',
                cursor: 'pointer', color: '#9CA3AF', fontSize: 18,
                padding: '4px 8px', borderRadius: 8,
              }}
            >✕</button>
          </div>

          {/* Today's birthday people */}
          {today.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              {today.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'white', borderRadius: 12, padding: '10px 14px',
                  border: '1px solid #F9A8D4',
                  boxShadow: '0 2px 8px rgba(219,39,119,0.08)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#FFF0F5', border: '2px solid #F9A8D4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: '#BE185D',
                  }}>
                    {p.name?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                      {p.name}
                      {p.age && <span style={{ marginLeft: 6, fontSize: 11, color: '#DB2777', fontWeight: 600 }}>
                        Turning {p.age} 🎈
                      </span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.designation} · {p.employee_id}</div>
                  </div>
                  <span style={{ fontSize: 20 }}>🎁</span>
                </div>
              ))}
            </div>
          )}

          {/* Tomorrow's birthday people */}
          {tomorrow.length > 0 && (
            <div style={{ marginTop: today.length > 0 ? 12 : 14 }}>
              {today.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#B45309', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  🔔 Also tomorrow:
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {tomorrow.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'white', borderRadius: 12, padding: '10px 14px',
                    border: '1px solid #FDE68A',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: '#FEF3C7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 800, color: '#D97706',
                    }}>
                      {p.name?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.designation}</div>
                    </div>
                    <span style={{ fontSize: 18 }}>🎈</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
