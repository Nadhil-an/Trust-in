import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi } from '../../api'
import { StatCard, StatusBadge, AmountDisplay, LoadingState, PageHeader, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ManagerDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const res = await managerApi.dashboard()
      setData(res.data)
    } catch (e) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Listen for real-time dashboard refresh
    const handler = () => load()
    window.addEventListener('dashboard-refresh', handler)
    return () => window.removeEventListener('dashboard-refresh', handler)
  }, [])

  if (loading) return <LoadingState />

  const { requests = {}, finance = {}, hr = {}, recent_requests = [] } = data || {}

  return (
    <div>
      <PageHeader
        title="Manager Dashboard"
        subtitle={`Overview — ${format(new Date(), 'EEEE, dd MMMM yyyy')}`}
      >
        <button className="btn btn-primary" id="new-request-btn"
          onClick={() => navigate('/manager/requests')}>
          + New Request
        </button>
      </PageHeader>

      {/* Requests Stats */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Assessment Requests
        </p>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <StatCard label="Pending" value={requests.pending || 0} icon="📋" variant="" sub="Awaiting review" />
        <StatCard label="Under Review" value={requests.under_review || 0} icon="🔍" variant="info" />
        <StatCard label="Approved" value={requests.approved || 0} icon="✅" variant="success" />
        <StatCard label="Cashier Pending" value={requests.cashier_pending || 0} icon="⏳" variant="warning" />
        <StatCard label="Completed" value={requests.completed || 0} icon="🎯" variant="success" />
        <StatCard label="Rejected" value={requests.rejected || 0} icon="❌" variant="danger" />
        <StatCard label="On Hold" value={requests.on_hold || 0} icon="⏸️" variant="warning" />
        <StatCard label="Total" value={requests.total || 0} icon="📊" />
      </div>

      {/* Finance + HR stats */}
      <div className="stats-grid">
        <StatCard label="Cash Balance" value={formatINR(finance.cash_balance)} icon="💵" variant="success" sub="Available in hand" />
        <StatCard label="Bank Balance" value={formatINR(finance.bank_balance)} icon="🏦" variant="success" sub="All bank accounts" />
        <StatCard label="Total Balance" value={formatINR(finance.total_balance)} icon="💰" sub="Cash + Bank" />
        <StatCard label="Active Members" value={hr.members || 0} icon="👥" variant="info" />
        <StatCard label="Volunteers" value={hr.volunteers || 0} icon="🙋" variant="info" />
      </div>

      {/* Recent Requests Table */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">Recent Assessment Requests</div>
          <div className="data-card-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/manager/requests')}>
              View All
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request No</th>
                <th>Purpose</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Requested By</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent_requests.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No requests found</td></tr>
              ) : recent_requests.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/manager/requests/${r.id}`)}>
                  <td className="td-mono">{r.request_number}</td>
                  <td>{r.purpose}</td>
                  <td><span className="badge badge-blue">{r.category}</span></td>
                  <td><AmountDisplay amount={r.amount_requested} /></td>
                  <td>{r.requested_by_name}</td>
                  <td>
                    <span className={`badge ${r.priority === 'URGENT' ? 'badge-red' : r.priority === 'HIGH' ? 'badge-yellow' : 'badge-gray'}`}>
                      {r.priority}
                    </span>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>
                    {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
