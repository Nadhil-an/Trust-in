import React, { useState, useCallback, useEffect } from "react"
import { hrApi, accountsApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, ConfirmModal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"


export default function VerificationDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmState, setConfirmState] = useState({ isOpen: false, row: null, type: '' })

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('') // 'CASH' or 'UPI'
  const [modalStaff, setModalStaff] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [transactionSearch, setTransactionSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hrApi.promoterRegistry.dailySummary(dateFilter, { verification_status: 'UNVERIFIED' })
      const summaryList = res.data || []
      const newRows = summaryList.map(item => {
        const entry = item.registry_entry
        return {
          staff_id: item.staff_id,
          staff_name: item.staff_name,
          is_present: item.is_present,
          entry_id: entry?.id || null,
          date: dateFilter,
          cash_collected: entry?.cash_collected ?? item.cash_collected,
          online_collected: entry?.online_collected ?? item.online_collected,
          entry_code: item.book_number ? String(item.book_number) : (entry?.entry_code || ''),
          starting_reading: item.auto_starting_reading || entry?.starting_reading || '',
          ending_reading: item.auto_ending_reading || entry?.ending_reading || '',
          cash_submitted: entry?.cash_submitted || '',
          is_closed: entry?.is_closed || false,
          has_discrepancy: entry?.has_discrepancy || false,
          hasChanges: false,
        }
      })
      setRows(newRows)
    } catch (err) {
      toast.error("Failed to load verification list: " + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }, [dateFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const updateField = (staffId, field, value) => {
    setRows(prev => prev.map(r =>
      r.staff_id === staffId ? { ...r, [field]: value, hasChanges: true } : r
    ))
  }

  const handleVerify = async (row) => {
    setSavingId(row.staff_id)
    try {
      const payload = {
        promoter: row.staff_id,
        date: dateFilter,
        verification_status: 'VERIFIED',
        // In case entry doesn't exist, provide defaults
        starting_reading: parseInt(row.starting_reading) || 0,
        ending_reading: parseInt(row.ending_reading) || 0,
        entry_code: row.entry_code,
        cash_collected: parseFloat(row.cash_collected) || 0,
        online_collected: parseFloat(row.online_collected) || 0,
        cash_submitted: parseFloat(row.cash_submitted) || 0,
      }

      if (row.entry_id) {
        await hrApi.promoterRegistry.update(row.entry_id, payload)
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
    setTransactionSearch('')
    try {
      const res = await hrApi.promoterRegistry.transactions(staff.staff_id, dateFilter)
      const data = type === 'CASH' ? res.data.cash : res.data.online
      setTransactions([...data].sort((a, b) => b.id - a.id))
    } catch (err) {
      toast.error("Failed to load transactions")
    } finally {
      setModalLoading(false)
    }
  }

  const handleDeleteTransaction = async (id) => {
    try {
      await accountsApi.income.delete(id)
      toast.success('Transaction deleted')
      setTransactions(prev => prev.filter(t => t.id !== id))
      load() // Refresh main table totals
    } catch (err) {
      toast.error('Failed to delete transaction')
    }
  }

  const filteredRows = rows.filter(r =>
    r.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.entry_code?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const totalA = (parseFloat(a.cash_collected) || 0) + (parseFloat(a.online_collected) || 0);
    const totalB = (parseFloat(b.cash_collected) || 0) + (parseFloat(b.online_collected) || 0);
    return totalB - totalA;
  });

  const totals = filteredRows.reduce((acc, r) => ({
    cash_collected: acc.cash_collected + parseFloat(r.cash_collected || 0),
    online_collected: acc.online_collected + parseFloat(r.online_collected || 0),
    cash_submitted: acc.cash_submitted + parseFloat(r.cash_submitted || 0),
  }), { cash_collected: 0, online_collected: 0, cash_submitted: 0 })

  return (
    <div>
      <style>{`
        @media print {
          @page { size: landscape; margin: 15mm; }
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .hide-print { display: none !important; }
          input.form-control { border: none !important; background: transparent !important; padding: 0 !important; color: black !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .print-header { display: none; }
        @media print {
          .print-header { display: block; text-align: center; margin-bottom: 20px; }
        }
      `}</style>

      <div className="hide-print">
        <PageHeader
          title="Verification Dashboard"
          subtitle="Verify daily mobile collections before moving them to Promoter Registry"
        />
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ isOpen: false, row: null, type: '' })}
        onConfirm={() => {
          if (confirmState.type === 'VERIFY' && confirmState.row) {
            handleVerify(confirmState.row)
          } else if (confirmState.type === 'DELETE' && confirmState.row) {
            handleDeleteTransaction(confirmState.row)
          }
        }}
        title={confirmState.type === 'VERIFY' ? 'Verify Collections' : 'Delete Transaction'}
        message={confirmState.type === 'VERIFY' ? `Are you sure you want to verify collections for ${confirmState.row?.staff_name}?` : 'Are you sure you want to delete this transaction? This will affect the total collected.'}
        isDanger={confirmState.type === 'DELETE'}
        confirmText={confirmState.type === 'VERIFY' ? 'Verify' : 'Delete'}
      />

      <div className="data-card printable-area">
        <div className="print-header">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: '2px solid #E5E7EB', paddingBottom: 16, marginBottom: 16 }}>
            <img src="/logo-full.png" alt="Sreelakshmi Charitable Trust" style={{ height: 100, objectFit: 'contain' }} />
            <h1 style={{ margin: '10px 0 0 0', color: '#1F2937', fontSize: 24 }}>Verification Dashboard</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>Verify daily mobile collections before moving them to Promoter Registry</p>
            <div style={{ marginTop: 10, padding: '6px 16px', background: '#F3F4F6', borderRadius: 8, fontWeight: 700, fontSize: 15, color: '#374151' }}>
              Date: {format(new Date(dateFilter + 'T00:00:00'), 'dd-MMM-yyyy')}
            </div>
          </div>
        </div>

        <div className="hide-print">
          <FilterBar>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', background: 'white' }}>
              <span style={{ fontSize: 16, color: '#6B7280' }}>🔍</span>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 14 }}
              />
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#6B7280' }}>
              <button
                className="btn"
                style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                onClick={() => window.print()}
              >
                🖨️ Print / PDF
              </button>
            </div>
          </FilterBar>
        </div>

        {loading ? <LoadingState /> : filteredRows.length === 0 ? (
          <EmptyState icon="✅" title="All clear!" subtitle={`No unverified collections for ${format(new Date(dateFilter + 'T00:00:00'), 'dd-MM-yyyy')}`} />
        ) : (
          <div className="table-wrap">
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th rowSpan={2} style={thStyle()}>Name</th>
                  <th rowSpan={2} style={thStyle()}>Voucher No</th>
                  <th colSpan={2} style={thStyle('center', '#4338CA', '#EEF2FF')}>Voucher Reading</th>
                  <th colSpan={2} style={thStyle('center', '#0369A1', '#E0F2FE')}>Voucher Reading <br /><span style={{ fontSize: 10, fontWeight: 400 }}>(Auto from Mobile)</span></th>
                  <th rowSpan={2} style={thStyle('center', '#7C3AED', '#F5F3FF')}>Cash Submitted<br /><span style={{ fontSize: 10, fontWeight: 400 }}>at Office</span></th>
                  <th rowSpan={2} style={thStyle('center', '#059669', '#ECFDF5')}>Total<br />Collected</th>
                  <th rowSpan={2} style={thStyle('center')}>Action</th>
                </tr>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={subThStyle('#4338CA')}>Starting</th>
                  <th style={subThStyle('#4338CA')}>Ending</th>
                  <th style={subThStyle('#0369A1')}>Cash</th>
                  <th style={subThStyle('#0369A1')}>Online</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const cashFloat = parseFloat(row.cash_collected) || 0
                  const onlineFloat = parseFloat(row.online_collected) || 0
                  const totalCollected = cashFloat + onlineFloat
                  const cashSubmittedFloat = parseFloat(row.cash_submitted) || 0
                  const hasMismatch = row.cash_submitted !== '' && Math.abs(cashSubmittedFloat - cashFloat) > 0.01

                  return (
                    <tr key={row.staff_id} style={{
                      background: row.is_closed ? '#F0FDF4' : 'white',
                      opacity: row.is_closed ? 0.85 : 1,
                      borderBottom: '1px solid #F3F4F6'
                    }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ textTransform: 'capitalize' }}>{row.staff_name}</span>
                          {!row.is_present && <span style={{ fontSize: 10, color: '#EF4444', background: '#FEE2E2', padding: '2px 6px', borderRadius: 4 }}>ABSENT</span>}
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px' }}>
                        <input type="text" className="form-control" style={{ minWidth: 110 }}
                          value={row.entry_code}
                          disabled={row.is_closed}
                          placeholder="VR..."
                          onChange={e => updateField(row.staff_id, 'entry_code', e.target.value)}
                        />
                      </td>

                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" className="form-control" style={{ minWidth: 70, textAlign: 'center' }}
                          value={row.starting_reading}
                          disabled={row.is_closed}
                          onChange={e => updateField(row.staff_id, 'starting_reading', e.target.value)}
                        />
                      </td>

                      <td style={{ padding: '6px 8px', borderRight: '2px solid #E0E7FF' }}>
                        <input type="number" className="form-control" style={{ minWidth: 70, textAlign: 'center' }}
                          value={row.ending_reading}
                          disabled={row.is_closed}
                          onChange={e => updateField(row.staff_id, 'ending_reading', e.target.value)}
                        />
                      </td>

                      <td style={{ padding: '6px 8px' }}>
                        <div
                          style={{ minWidth: 90, textAlign: 'center', background: '#F0F9FF', padding: '6px', borderRadius: 4, cursor: 'pointer', color: '#0369A1', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          onClick={() => openTransactionsModal(row, 'CASH')}
                          title="Click to view full details"
                        >
                          {row.cash_collected} <span style={{ fontSize: 11, opacity: 0.6 }}>↗</span>
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px', borderRight: '2px solid #BAE6FD' }}>
                        <div
                          style={{ minWidth: 90, textAlign: 'center', background: '#F0F9FF', padding: '6px', borderRadius: 4, cursor: 'pointer', color: '#0369A1', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          onClick={() => openTransactionsModal(row, 'UPI')}
                          title="Click to view full details"
                        >
                          {row.online_collected} <span style={{ fontSize: 11, opacity: 0.6 }}>↗</span>
                        </div>
                      </td>

                      <td style={{ padding: '6px 8px', borderRight: '2px solid #DDD6FE' }}>
                        <div style={{ position: 'relative' }}>
                          <input type="number" className="form-control"
                            style={{
                              minWidth: 100, textAlign: 'center',
                              background: row.is_closed ? '#F5F3FF' : hasMismatch ? '#FEF2F2' : '#FAF5FF',
                              borderColor: hasMismatch ? '#FCA5A5' : undefined,
                            }}
                            value={row.cash_submitted}
                            disabled={row.is_closed}
                            placeholder="0.00"
                            onChange={e => updateField(row.staff_id, 'cash_submitted', e.target.value)}
                          />
                          {hasMismatch && (
                            <span title={`Expected ₹${cashFloat.toFixed(2)}`}
                              style={{ position: 'absolute', top: -2, right: -2, fontSize: 14, cursor: 'help' }}>⚠️</span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                        ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="hide-print" style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <button
                          className="btn"
                          style={{ background: '#10B981', color: 'white', padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                          onClick={() => setConfirmState({ isOpen: true, row: row, type: 'VERIFY' })}
                          disabled={savingId === row.staff_id}
                        >
                          <span style={{ fontSize: 16 }}>✔️</span> {savingId === row.staff_id ? '...' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals Footer */}
              <tfoot>
                <tr style={{ background: '#F8FAFC', fontWeight: 700, borderTop: '2px solid #E5E7EB' }}>
                  <td colSpan={4} style={{ padding: '10px 14px', color: '#374151' }}>Day Totals</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#0369A1' }}>
                    ₹{totals.cash_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#0369A1' }}>
                    ₹{totals.online_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#7C3AED' }}>
                    ₹{totals.cash_submitted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#059669' }}>
                    ₹{(totals.cash_collected + totals.online_collected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="hide-print"></td>
                </tr>
              </tfoot>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', background: '#F8FAFC', marginBottom: 16 }}>
              <span style={{ fontSize: 16, color: '#6B7280' }}>🔍</span>
              <input
                type="text"
                placeholder="Search transactions by Voucher No, Donor, or Amount..."
                value={transactionSearch}
                onChange={e => setTransactionSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 14 }}
              />
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
                  {transactions.filter(t =>
                    (t.receipt_number && t.receipt_number.toLowerCase().includes(transactionSearch.toLowerCase())) ||
                    (t.donor_name && t.donor_name.toLowerCase().includes(transactionSearch.toLowerCase())) ||
                    (t.amount.toString().includes(transactionSearch))
                  ).map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: 12, color: '#6B7280' }}>{t.time}</td>
                      <td style={{ padding: 12, fontWeight: 500 }}>{t.receipt_number || '-'}</td>
                      <td style={{ padding: 12, fontWeight: 700, color: '#0369A1' }}>₹{t.amount.toFixed(2)}</td>
                      <td style={{ padding: 12 }}>{t.donor_name || 'N/A'}</td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <button
                          onClick={() => setConfirmState({ isOpen: true, row: t.id, type: 'DELETE' })}
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
