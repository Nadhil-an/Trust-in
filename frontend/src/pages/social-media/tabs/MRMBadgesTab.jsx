import React, { useState, useEffect, useCallback } from 'react'
import { mrmApi } from '../../../api'
import { LoadingState, EmptyState, Modal, FilterBar } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Award, Plus, RefreshCw, CheckCircle2, Shield, Calendar, Search } from 'lucide-react'

export default function MRMBadgesTab() {
  const [badges, setBadges] = useState([])
  const [awards, setAwards] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState('')
  const [searchMember, setSearchMember] = useState('')

  // Auto-evaluating state
  const [evaluating, setEvaluating] = useState(false)

  // Manual Award Modal
  const [showManualModal, setShowManualModal] = useState(false)
  const [membersList, setMembersList] = useState([])
  const [manualForm, setManualForm] = useState({
    member_id: '',
    badge_key: 'YELLOW',
    reason: '',
    is_permanent: false,
    period_str: format(new Date(), 'yyyy-MM')
  })
  const [submittingManual, setSubmittingManual] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [badgesRes, awardsRes] = await Promise.all([
        mrmApi.badges.list(),
        mrmApi.badges.awards(selectedBadgeFilter ? { badge_key: selectedBadgeFilter } : {})
      ])
      setBadges(badgesRes.data || [])
      setAwards(awardsRes.data || [])
    } catch (err) {
      console.error('Failed to load badges:', err)
      toast.error('Failed to load badge data')
    } finally {
      setLoading(false)
    }
  }, [selectedBadgeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const loadMembers = async () => {
    try {
      const res = await mrmApi.members.list({ limit: 100 })
      setMembersList(res.data?.results || [])
    } catch (err) {
      console.error('Failed to load members:', err)
    }
  }

  const handleOpenManual = () => {
    loadMembers()
    setShowManualModal(true)
  }

  const handleRunEvaluation = async () => {
    setEvaluating(true)
    try {
      const res = await mrmApi.badges.evaluate({})
      toast.success(res.data?.message || 'Badge auto-evaluation completed!')
      fetchData()
    } catch (err) {
      console.error('Evaluation error:', err)
      toast.error('Evaluation failed')
    } finally {
      setEvaluating(false)
    }
  }

  const handleGrantManualAward = async (e) => {
    e.preventDefault()
    if (!manualForm.member_id) {
      toast.error('Please select a member to award.')
      return
    }
    if (!manualForm.reason.trim()) {
      toast.error('A mandatory justification reason is required for manual awards.')
      return
    }

    setSubmittingManual(true)
    try {
      await mrmApi.badges.awardManual(manualForm)
      toast.success('Badge awarded successfully!')
      setShowManualModal(false)
      setManualForm({
        member_id: '',
        badge_key: 'YELLOW',
        reason: '',
        is_permanent: false,
        period_str: format(new Date(), 'yyyy-MM')
      })
      fetchData()
    } catch (err) {
      console.error('Manual award error:', err)
      const msg = err.response?.data?.detail || 'Failed to award badge'
      toast.error(msg)
    } finally {
      setSubmittingManual(false)
    }
  }

  const displayAwards = awards.filter((aw) => {
    if (!searchMember.trim()) return true
    const q = searchMember.toLowerCase()
    return (
      aw.member_name?.toLowerCase().includes(q) ||
      aw.badge_name?.toLowerCase().includes(q) ||
      aw.qualifying_period?.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 5 Badge Tiers Showcase Banner */}
      <div className="data-card" style={{ marginBottom: 0 }}>
        <div className="data-card-header">
          <div>
            <div className="data-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={18} color="var(--primary-700)" />
              Trust Progressive Badge Hierarchy (25% Incremental Engine)
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--gray-500)' }}>
              Standardized criteria across referrals, daily collection targets, and verified Trust services.
            </p>
          </div>

          <div className="data-card-actions">
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={13} className={evaluating ? 'animate-spin' : ''} />
              {evaluating ? 'Evaluating Members...' : 'Run Auto-Evaluation'}
            </button>

            <button
              onClick={handleOpenManual}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} />
              Manual Badge Award
            </button>
          </div>
        </div>

        {/* 5 Tiers Grid */}
        <div style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          background: 'var(--gray-50)'
        }}>
          {/* Yellow */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="badge badge-yellow">Yellow Tier</span>
              <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>Baseline</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5, color: 'var(--gray-600)', lineHeight: 1.6 }}>
              <li>&ge;10 referrals / mo</li>
              <li>₹1,000 daily collection</li>
              <li>&ge;3 verified services</li>
              <li>Subject to monthly review</li>
            </ul>
          </div>

          {/* Green */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="badge badge-green">Green Tier</span>
              <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>+25% Target</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5, color: 'var(--gray-600)', lineHeight: 1.6 }}>
              <li>&ge;13 referrals / mo</li>
              <li>₹1,250 daily collection</li>
              <li>&ge;6 verified services</li>
              <li>Volunteer prerequisite</li>
            </ul>
          </div>

          {/* Orange */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="badge" style={{ background: '#FFEDD5', color: '#C2410C' }}>Orange Tier</span>
              <span style={{ fontSize: 11, color: '#C2410C', fontWeight: 600 }}>+25% Target</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5, color: 'var(--gray-600)', lineHeight: 1.6 }}>
              <li>&ge;16 referrals / mo</li>
              <li>₹1,562.50 daily collection</li>
              <li>&ge;9 verified services</li>
              <li>Permanent on 1st award</li>
            </ul>
          </div>

          {/* Blue */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="badge badge-blue">Blue Tier</span>
              <span style={{ fontSize: 11, color: 'var(--primary-700)', fontWeight: 600 }}>+25% Target</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5, color: 'var(--gray-600)', lineHeight: 1.6 }}>
              <li>&ge;20 referrals / mo</li>
              <li>₹1,953.13 daily collection</li>
              <li>&ge;12 verified services</li>
              <li>Permanent on 1st award</li>
            </ul>
          </div>

          {/* Maroon */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="badge" style={{ background: '#FFE4E6', color: '#9F1239' }}>Maroon Volunteer</span>
              <span style={{ fontSize: 11, color: '#9F1239', fontWeight: 600 }}>Special Distinction</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5, color: 'var(--gray-600)', lineHeight: 1.6 }}>
              <li>Requires Green Badge</li>
              <li>Volunteer Desk Application</li>
              <li>Trust Board Approval</li>
              <li>Permanent Status</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <FilterBar
        search={searchMember}
        onSearch={setSearchMember}
        placeholder="Search awarded member or period..."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={selectedBadgeFilter}
            onChange={(e) => setSelectedBadgeFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="">All Badge Tiers</option>
            <option value="YELLOW">Yellow Badge</option>
            <option value="GREEN">Green Badge</option>
            <option value="ORANGE">Orange Badge</option>
            <option value="BLUE">Blue Badge</option>
            <option value="MAROON">Maroon Volunteer</option>
          </select>

          {(searchMember || selectedBadgeFilter) && (
            <button
              onClick={() => { setSelectedBadgeFilter(''); setSearchMember(''); }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}
        </div>
      </FilterBar>

      {/* Main Table in Data Card */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Badge Awards & Honors Registry
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {displayAwards.length} Total
            </span>
          </div>
          <div className="data-card-actions">
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Showing {displayAwards.length} of {awards.length} records
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : displayAwards.length === 0 ? (
          <EmptyState
            title="No Awards Found"
            message="No member badge awards match your criteria. Run auto-evaluation or grant a manual badge above."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Member Name</th>
                  <th style={{ width: '18%' }}>Badge Tier</th>
                  <th style={{ width: '14%' }}>Period</th>
                  <th style={{ width: '12%' }}>Times Earned</th>
                  <th style={{ width: '12%' }}>Longevity</th>
                  <th style={{ width: '20%' }}>Award Source & Reason</th>
                </tr>
              </thead>
              <tbody>
                {displayAwards.map((aw) => (
                  <tr key={aw.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{aw.member_name}</div>
                      <div className="td-mono" style={{ fontSize: 11, color: 'var(--gray-500)' }}>{aw.member_id}</div>
                    </td>

                    <td>
                      <span className="badge badge-yellow">
                        {aw.badge_name}
                      </span>
                    </td>

                    <td className="td-mono">
                      {aw.qualifying_period}
                    </td>

                    <td>
                      <span className="badge badge-blue">
                        &times; {aw.times_earned}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${aw.is_permanent ? 'badge-green' : 'badge-gray'}`}>
                        {aw.is_permanent ? 'Permanent' : 'Period-Based'}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: 12, fontWeight: 600, color: aw.award_source === 'MANUAL' ? '#7C3AED' : 'var(--primary-700)' }}>
                        {aw.award_source === 'MANUAL' ? 'Manual Grant' : 'Auto Evaluated'}
                      </div>
                      {aw.reason && (
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={aw.reason}>
                          {aw.reason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Grant Modal */}
      {showManualModal && (
        <Modal
          isOpen={true}
          title="Grant Manual Member Recognition"
          onClose={() => setShowManualModal(false)}
        >
          <form onSubmit={handleGrantManualAward} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--border-radius-sm)', padding: '10px 14px', fontSize: 12.5, color: 'var(--primary-900)' }}>
              Manual awards are recorded under Trust compliance audit log with your administrative credentials. A valid justification is required.
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Select Member</label>
              <select
                className="form-control"
                value={manualForm.member_id}
                onChange={(e) => setManualForm({ ...manualForm, member_id: e.target.value })}
                required
              >
                <option value="">-- Choose Member --</option>
                {membersList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Badge Tier</label>
                <select
                  className="form-control"
                  value={manualForm.badge_key}
                  onChange={(e) => setManualForm({ ...manualForm, badge_key: e.target.value })}
                  required
                >
                  <option value="YELLOW">Yellow Badge</option>
                  <option value="GREEN">Green Badge</option>
                  <option value="ORANGE">Orange Badge</option>
                  <option value="BLUE">Blue Badge</option>
                  <option value="MAROON">Maroon Volunteer</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Qualifying Period</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="YYYY-MM (e.g. 2026-10)"
                  value={manualForm.period_str}
                  onChange={(e) => setManualForm({ ...manualForm, period_str: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="permCheck"
                checked={manualForm.is_permanent}
                onChange={(e) => setManualForm({ ...manualForm, is_permanent: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="permCheck" style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)', cursor: 'pointer' }}>
                Mark as Permanent Badge (Will not expire or reset)
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Mandatory Justification Reason</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Explain the verified contributions, exceptional community efforts, or board approval reason..."
                value={manualForm.reason}
                onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
                required
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowManualModal(false)}
                disabled={submittingManual}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingManual}
              >
                <Award size={14} />
                {submittingManual ? 'Awarding...' : 'Award Badge'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
