import React, { useState, useCallback, useEffect } from "react"
import { hrApi, accountsApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"


export default function VerificationDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('') // 'CASH' or 'UPI'
  const [modalStaff, setModalStaff] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [transactions, setTransactions] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hrApi.promoterRegistry.dailySummary(dateFilter, { verification_status: 'UNVERIFIED' })
      setRows(res.data || [])
    } catch (err) {
      toast.error("Failed to load verification list: " + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }, [dateFilter])

  useEffect(() => { load() }, [load])

  const handleVerify = async (row) => {
    if (!window.confirm(`Verify collections for ${row.staff_name}?`)) return
    setSavingId(row.staff_id)
    try {
      const payload = {
        promoter: row.staff_id,
        date: dateFilter,
        verification_status: 'VERIFIED',
        // In case entry doesn't exist, provide defaults
        starting_reading: parseInt(row.auto_starting_reading) || 0,
        ending_reading: parseInt(row.auto_ending_reading) || 0,
        cash_collected: parseFloat(row.cash_collected) || 0,
        online_collected: parseFloat(row.online_collected) || 0,
      }

      if (row.registry_entry?.id) {
        await hrApi.promoterRegistry.update(row.registry_entry.id, payload)
      } else {
        await hrApi.promoterRegistry.create(payload)
      }
      toast.success(`${row.staff_name} verified successfully!`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setSavingId(null)
    }
  }

  const openTransactionsModal = async (staff, type) => {
    setModalStaff(staff)
    setModalType(type)
    setModalOpen(true)
    setModalLoading(true)
    try {
      const res = await hrApi.promoterRegistry.transactions(staff.staff_id, dateFilter)
      setTransactions(type === 'CASH' ? res.data.cash : res.data.online)
    } catch (err) {
      toast.error("Failed to load transactions")
    } finally {
      setModalLoading(false)
    }
  }

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This will affect the total collected.')) return
    try {
      await accountsApi.income.delete(id)
      toast.success('Transaction deleted')
      setTransactions(prev => prev.filter(t => t.id !== id))
      load() // Refresh main table totals
    } catch (err) {
      toast.error('Failed to delete transaction')
    }
  }

  return (
    <div>
      <PageHeader
        title="Verification Dashboard"
        subtitle="Verify daily mobile collections before moving them to Promoter Registry"
      />

      <div className="data-card">
        <FilterBar>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>Date:</span>
            <input
              type="date"
              className="filter-select"
              style={{ width: '200px' }}
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
          </div>
        </FilterBar>

        {loading ? <LoadingState /> : rows.length === 0 ? (
          <EmptyState icon="✅" title="All clear!" subtitle={`No unverified collections for ${format(new Date(dateFilter + 'T00:00:00'), 'dd-MM-yyyy')}`} />
        ) : (
          <div className="table-wrap">
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={thStyle()}>Staff Name</th>
                  <th style={thStyle('center', '#0369A1', '#E0F2FE')} colSpan={2}>Collections Received (Auto)</th>
                  <th style={thStyle('center')}>Action</th>
                </tr>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={subThStyle('#4338CA')}></th>
                  <th style={subThStyle('#0369A1')}>💵 Cash</th>
                  <th style={subThStyle('#0369A1')}>📱 Online / UPI</th>
                  <th style={subThStyle()}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.staff_id} style={{ borderBottom: '1px solid #E5E7EB', background: row.is_closed ? '#F3F4F6' : 'white' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1F2937' }}>
                      {row.staff_name} {!row.is_present && <span style={{ fontSize: 10, color: '#EF4444', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>ABSENT</span>}
                    </td>
                    
                    <td style={{ padding: '12px 16px', textAlign: 'center', borderLeft: '1px solid #E5E7EB' }}>
                      <div 
                        style={{ color: '#0369A1', fontWeight: 700, cursor: 'pointer', background: '#F0F9FF', padding: '6px 12px', borderRadius: 6, display: 'inline-block' }}
                        onClick={() => openTransactionsModal(row, 'CASH')}
                      >
                        ₹ {parseFloat(row.cash_collected).toFixed(2)}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div 
                        style={{ color: '#0369A1', fontWeight: 700, cursor: 'pointer', background: '#F0F9FF', padding: '6px 12px', borderRadius: 6, display: 'inline-block' }}
                        onClick={() => openTransactionsModal(row, 'UPI')}
                      >
                        ₹ {parseFloat(row.online_collected).toFixed(2)}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center', borderLeft: '1px solid #E5E7EB' }}>
                      <button
                        className="btn"
                        style={{ background: '#10B981', color: 'white', padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        onClick={() => handleVerify(row)}
                        disabled={savingId === row.staff_id}
                      >
                        <span style={{ fontSize: 16 }}>✔️</span> {savingId === row.staff_id ? 'Verifying...' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 700, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#1F2937' }}>
                {modalType === 'CASH' ? '💵 Cash' : '📱 Online'} Transactions - {modalStaff?.staff_name}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6B7280' }}>&times;</button>
            </div>

            {modalLoading ? <LoadingState /> : transactions.length === 0 ? (
              <EmptyState icon="📉" title="No transactions found" />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Time</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Voucher No</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Amount</th>
                    <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Donor</th>
                    <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: 12, color: '#6B7280' }}>{t.time}</td>
                      <td style={{ padding: 12, fontWeight: 500 }}>{t.receipt_number || '-'}</td>
                      <td style={{ padding: 12, fontWeight: 700, color: '#0369A1' }}>₹{t.amount.toFixed(2)}</td>
                      <td style={{ padding: 12 }}>{t.donor_name || 'N/A'}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDeleteTransaction(t.id)}
                          style={{ background: '#FEE2E2', color: '#EF4444', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer' }}>
                          <span style={{ fontSize: 16 }}>🗑️</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function thStyle(align = 'left', color = '#4B5563', bg = '#F8FAFC') {
  return { padding: '12px 16px', textAlign: align, borderBottom: `2px solid ${color}`, color, background: bg, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }
}
function subThStyle(color = '#4B5563') {
  return { padding: '8px 16px', textAlign: 'center', borderBottom: '1px solid #E5E7EB', color, fontSize: 12, background: 'white' }
}
