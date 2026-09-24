import React, { useState, useEffect } from 'react'
import { accountsApi, coreApi } from '../../api'
import { LoadingState, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const C = { green: '#22C55E', yellow: '#F59E0B', blue: '#1E4DB7' }

export default function Donations() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)
  
  // Pagination State
  const [page, setPage] = useState(1)

  // Fetch users once
  useEffect(() => {
    coreApi.users.list({ role: 'STAFF' }).then(res => {
      setUsers(res.data.results || res.data || [])
    }).catch(err => console.error(err))
  }, [])

  // Fetch dashboard stats for selected date
  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true)
      try {
        const dashRes = await accountsApi.dashboard({ date: selectedDate })
        setData(dashRes.data)
      } catch (err) {
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [selectedDate])

  useEffect(() => {
    const fetchIncome = async () => {
      setItemsLoading(true)
      try {
        const params = { date: selectedDate, page_size: 5000 }
        if (selectedUser) params.created_by = selectedUser
        
        const res = await accountsApi.income.list(params)
        const allItems = res.data.results || res.data
        const filtered = allItems.filter(i => {
          const isCorrectSource = i.source === 'DONATION' || i.source === 'MEMBERSHIP'
          const matchesSource = !selectedSource || i.source === selectedSource
          const matchesMethod = !selectedMethod || i.payment_method === selectedMethod
          return isCorrectSource && matchesSource && matchesMethod
        })
        setItems(filtered)
        setPage(1) // Reset page on filter change
      } catch (err) {
        toast.error('Failed to load collections')
      } finally {
        setItemsLoading(false)
      }
    }
    fetchIncome()
  }, [selectedUser, selectedDate, selectedSource, selectedMethod])

  if (loading) return <LoadingState />
  const acc = data || {}

  // Calculate Pagination variables
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / 10) || 1;
  const currentItems = items.slice((page - 1) * 10, page * 10);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Donations & Memberships</h2>
          <p style={{ marginTop: 4, color: '#6b7280' }}>View donations and memberships for the selected date</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>Date:</span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, backgroundColor: 'white', color: '#111827', minWidth: 160 }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.yellow}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💝</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Donations</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{formatINR(acc.today_donations_total)}</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
            <div><span style={{ color: '#9ca3af' }}>Cash:</span> {formatINR(acc.today_donations_cash)}</div>
            <div>&bull;</div>
            <div><span style={{ color: '#9ca3af' }}>Bank:</span> {formatINR(acc.today_donations_bank)}</div>
          </div>
        </div>
        
        <div style={{ background: 'white', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.blue}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💳</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Memberships</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{formatINR(acc.today_memberships_total)}</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
            <div><span style={{ color: '#9ca3af' }}>Cash:</span> {formatINR(acc.today_memberships_cash)}</div>
            <div>&bull;</div>
            <div><span style={{ color: '#9ca3af' }}>Bank:</span> {formatINR(acc.today_memberships_bank)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #e2e8f0', padding: '16px 20px', background: 'white' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Individual Collections</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select 
              value={selectedSource} 
              onChange={e => setSelectedSource(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minWidth: 160, backgroundColor: '#f9fafb' }}
            >
              <option value="">All Sources</option>
              <option value="DONATION">Donation</option>
              <option value="MEMBERSHIP">Membership</option>
            </select>
            <select 
              value={selectedMethod} 
              onChange={e => setSelectedMethod(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minWidth: 160, backgroundColor: '#f9fafb' }}
            >
              <option value="">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
              <option value="BANK">Bank Transfer</option>
            </select>
            <select 
              value={selectedUser} 
              onChange={e => setSelectedUser(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200, backgroundColor: '#f9fafb' }}
            >
              <option value="">All Staff</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {itemsLoading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}><tr>
                <th style={{ background: '#f8fafc' }}>Date</th>
                <th style={{ background: '#f8fafc' }}>Staff Member</th>
                <th style={{ background: '#f8fafc' }}>Donor</th>
                <th style={{ background: '#f8fafc' }}>Phone</th>
                <th style={{ background: '#f8fafc' }}>Place</th>
                <th style={{ background: '#f8fafc' }}>Payment</th>
                <th style={{ background: '#f8fafc' }}>Voucher No.</th>
                <th style={{ background: '#f8fafc' }}>Amount</th>
              </tr></thead>
              <tbody>
                {currentItems.length === 0
                  ? <tr><td colSpan={8}><div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No collections found for the selected date.</div></td></tr>
                  : currentItems.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.date), 'dd MMM yyyy')}</td>
                      <td style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5' }}>{i.created_by_name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{i.donor_name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{i.phone || '—'}</td>
                      <td style={{ maxWidth: 160, fontSize: 12 }}>{i.place || '—'}</td>
                      <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{i.payment_method}</span></td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ fontWeight: 700, color: '#EC4899' }}>{formatINR(i.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Footer */}
        {!itemsLoading && totalPages >= 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Page <span style={{ fontWeight: 600, color: '#0f172a' }}>{page}</span> / <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalPages}</span> <span style={{ color: '#94a3b8' }}>({totalCount} entries)</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary btn-sm" 
                disabled={page === 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                disabled={page === totalPages} 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
