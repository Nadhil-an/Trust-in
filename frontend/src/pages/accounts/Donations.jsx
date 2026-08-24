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
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)

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
        const params = { date: selectedDate }
        if (selectedUser) params.created_by = selectedUser
        
        const res = await accountsApi.income.list(params)
        const allItems = res.data.results || res.data
        const filtered = allItems.filter(i => i.source === 'DONATION' || i.source === 'MEMBERSHIP')
        setItems(filtered)
      } catch (err) {
        toast.error('Failed to load collections')
      } finally {
        setItemsLoading(false)
      }
    }
    fetchIncome()
  }, [selectedUser, selectedDate])

  if (loading) return <LoadingState />
  const acc = data || {}

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.yellow}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💝</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Donations</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>{formatINR(acc.today_donations_total)}</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 500, color: '#6b7280' }}>
            <div><span style={{ color: '#9ca3af' }}>Cash:</span> {formatINR(acc.today_donations_cash)}</div>
            <div>&bull;</div>
            <div><span style={{ color: '#9ca3af' }}>Bank:</span> {formatINR(acc.today_donations_bank)}</div>
          </div>
        </div>
        
        <div style={{ background: 'white', borderRadius: 16, padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.blue}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Memberships</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>{formatINR(acc.today_memberships_total)}</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 500, color: '#6b7280' }}>
            <div><span style={{ color: '#9ca3af' }}>Cash:</span> {formatINR(acc.today_memberships_cash)}</div>
            <div>&bull;</div>
            <div><span style={{ color: '#9ca3af' }}>Bank:</span> {formatINR(acc.today_memberships_bank)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #f3f4f6', paddingBottom: 16, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Individual Collections</h3>
          <select 
            value={selectedUser} 
            onChange={e => setSelectedUser(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, minWidth: 200, backgroundColor: '#f9fafb' }}
          >
            <option value="">All Staff Members</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>

        {itemsLoading ? <LoadingState /> : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            No collections found for the selected date.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Staff Member</th>
                  <th>Donor Name</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{format(new Date(item.created_at), 'hh:mm a')}</td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>{item.created_by_name || '—'}</td>
                    <td>{item.donor_name || 'Anonymous'}</td>
                    <td><span className="badge" style={{ background: '#e0e7ff', color: '#4f46e5' }}>{item.source}</span></td>
                    <td><span className="badge" style={{ background: '#f3f4f6', color: '#4b5563' }}>{item.payment_method}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: C.green }}>{formatINR(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
