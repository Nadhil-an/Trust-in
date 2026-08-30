import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export default function PerformancePoints() {
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [officers, setOfficers] = useState([])
  const [leaderboardData, setLeaderboardData] = useState({ leaderboard: [], best_performer: null })
  const [loading, setLoading] = useState(true)
  const [showAwardModal, setShowAwardModal] = useState(false)

  // Form state
  const [targetEmployee, setTargetEmployee] = useState("")
  const [points, setPoints] = useState(10)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [boardRes, officersRes] = await Promise.all([
        hrApi.performancePoints.leaderboard({ month: selectedMonth, year: selectedYear }),
        hrApi.officers.list({ limit: 100 })
      ])
      setLeaderboardData(boardRes.data)
      const allOfficers = officersRes.data.results || officersRes.data
      const staffOnly = allOfficers.filter(o => o.designation && o.designation.toUpperCase() === 'STAFF')
      setOfficers(staffOnly)
    } catch (_) {
      toast.error("Failed to load performance points data")
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => { loadData() }, [loadData])

  const handleAwardPoints = async (e) => {
    e.preventDefault()
    if (!targetEmployee) {
      toast.error("Please select a staff member")
      return
    }
    setSubmitting(true)
    try {
      await hrApi.performancePoints.create({
        employee: targetEmployee,
        points: parseInt(points, 10),
        month: selectedMonth,
        year: selectedYear,
        reason,
      })
      toast.success("Performance points awarded successfully! 🏆")
      setShowAwardModal(false)
      setReason("")
      loadData()
    } catch (_) {
      toast.error("Failed to award points")
    } finally {
      setSubmitting(false)
    }
  }

  const bestPerformer = leaderboardData.best_performer

  return (
    <div>
      <PageHeader title="Achieved Points & Performance" subtitle="Award performance points and identify the Best Performer of the Month">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
          <select 
            className="form-control" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            style={{ width: '130px' }}
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select 
            className="form-control" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            style={{ width: '100px' }}
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button className="btn btn-primary" onClick={() => setShowAwardModal(true)}>
            + Award Points
          </button>
        </div>
      </PageHeader>

      {/* Best Performer Banner */}
      {bestPerformer && (
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          borderRadius: '16px',
          padding: '24px 32px',
          color: 'white',
          boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              fontSize: '48px',
              background: 'rgba(255, 255, 255, 0.2)',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.3)'
            }}>
              👑
            </div>
            <div>
              <div style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '12px', opacity: 0.9, fontWeight: 700 }}>
                BEST PERFORMANCE OF THE MONTH ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 2px 0' }}>{bestPerformer.full_name}</h2>
              <div style={{ opacity: 0.85, fontSize: '14px' }}>
                {bestPerformer.designation} • ID: {bestPerformer.emp_code}
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '12px 24px',
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.25)'
          }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>TOTAL POINTS</div>
            <div style={{ fontSize: '32px', fontWeight: 900 }}>🏆 {bestPerformer.total_points}</div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="data-card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', padding: '16px 20px 0 20px', color: '#1e293b' }}>
          Monthly Performance Leaderboard ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
        </h3>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Staff Member</th>
                  <th>Employee Code</th>
                  <th>Designation</th>
                  <th>Total Achieved Points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.leaderboard.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon="🏆" title={`No points awarded for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`} /></td></tr>
                ) : leaderboardData.leaderboard.map((item) => (
                  <tr key={item.employee_id} style={item.rank === 1 ? { background: '#f0f9ff' } : {}}>
                    <td>
                      {item.rank === 1 ? (
                        <span style={{ fontSize: '18px' }}>🥇 <strong>#1</strong></span>
                      ) : item.rank === 2 ? (
                        <span style={{ fontSize: '16px' }}>🥈 #2</span>
                      ) : item.rank === 3 ? (
                        <span style={{ fontSize: '16px' }}>🥉 #3</span>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#64748b' }}>#{item.rank}</span>
                      )}
                    </td>
                    <td>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.full_name}</strong>
                      {item.rank === 1 && (
                        <span className="badge badge-green" style={{ marginLeft: 8 }}>Top Performer</span>
                      )}
                    </td>
                    <td className="td-mono">{item.emp_code}</td>
                    <td>{item.designation || 'Staff'}</td>
                    <td>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#4f46e5' }}>
                        ⭐ {item.total_points} pts
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Award Points Modal */}
      {showAwardModal && (
        <Modal isOpen={true} onClose={() => setShowAwardModal(false)} title="Award Performance Points" size="modal-md"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowAwardModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={submitting} onClick={handleAwardPoints}>Award Points</button>
          </>}>
          <form onSubmit={handleAwardPoints} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Select Staff Member *</label>
              <select className="form-control" value={targetEmployee} onChange={(e) => setTargetEmployee(e.target.value)} required>
                <option value="">-- Choose Staff Member --</option>
                {officers.map(o => (
                  <option key={o.id} value={o.id}>{o.full_name} ({o.employee_id} - {o.designation})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Points *</label>
                <input 
                  type="number" 
                  min="1"
                  max="1000"
                  className="form-control"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Month & Year</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input className="form-control" value={`${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`} disabled />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Performance Reason / Remarks</label>
              <textarea 
                className="form-control" 
                rows={3} 
                placeholder="E.g., Excellent donation collection and field assessment work during the month..." 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
