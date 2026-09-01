import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function PromotorRegistry() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [mismatchModalData, setMismatchModalData] = useState(null)

  // ── Load & merge daily summary ───────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hrApi.promoterRegistry.dailySummary(dateFilter, { verification_status: 'VERIFIED' })
      const summaryList = res.data || []

      // Map into editable row objects
      const newRows = summaryList.map(item => {
        const entry = item.registry_entry
        return {
          // Identifiers
          staff_id: item.staff_id,
          staff_name: item.staff_name,
          is_present: item.is_present,         // from Attendance records
          entry_id: entry?.id || null,
          date: dateFilter,

          // Vothen Reading — auto from mobile transactions (editable override)
          cash_collected: entry?.cash_collected ?? item.cash_collected,
          online_collected: entry?.online_collected ?? item.online_collected,

          // Voucher book fields (Prioritize HR assigned book number)
          entry_code: item.book_number ? String(item.book_number) : (entry?.entry_code || ''),
          starting_reading: item.auto_starting_reading || entry?.starting_reading || '',
          ending_reading: item.auto_ending_reading || entry?.ending_reading || '',

          // Cash submitted at office in the evening
          cash_submitted: entry?.cash_submitted || '',

          // Closing
          is_closed: entry?.is_closed || false,
          has_discrepancy: entry?.has_discrepancy || false,

          // Tracking changes
          hasChanges: false,
        }
      })

      setRows(newRows)
    } catch (err) {
      toast.error("Failed to load registry: " + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }, [dateFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => {
      load()
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  // ── Field update ─────────────────────────────────────────────────
  const updateField = (staffId, field, value) => {
    setRows(prev => prev.map(r =>
      r.staff_id === staffId ? { ...r, [field]: value, hasChanges: true } : r
    ))
  }

  // ── Save / Close Day / Reopen ────────────────────────────────────
  const handleSave = async (row, action = 'save', forceClose = false) => {
    // Discrepancy warning before closing
    if (action === 'close' && !forceClose) {
      const cashCollectedFloat = parseFloat(row.cash_collected) || 0
      const cashSubmittedFloat = parseFloat(row.cash_submitted) || 0
      const cashOk = Math.abs(cashSubmittedFloat - cashCollectedFloat) < 0.01

      if (!cashOk) {
        const diff = Math.abs(cashSubmittedFloat - cashCollectedFloat)
        setMismatchModalData({
          row,
          action,
          cashCollected: cashCollectedFloat,
          cashSubmitted: cashSubmittedFloat,
          difference: diff
        })
        return
      }
    }

    setSavingId(row.staff_id)
    try {
      const payload = {
        promoter: row.staff_id,
        date: dateFilter,
        entry_code: row.entry_code,
        starting_reading: parseInt(row.starting_reading) || 0,
        ending_reading: parseInt(row.ending_reading) || 0,
        cash_collected: parseFloat(row.cash_collected) || 0,
        online_collected: parseFloat(row.online_collected) || 0,
        cash_submitted: parseFloat(row.cash_submitted) || 0,
        ...(action === 'close' ? { is_closed: true } : action === 'reopen' ? { is_closed: false } : {}),
        ...(action === 'unverify' ? { verification_status: 'UNVERIFIED' } : {})
      }

      if (row.entry_id) {
        await hrApi.promoterRegistry.update(row.entry_id, payload)
      } else {
        await hrApi.promoterRegistry.create(payload)
      }

      toast.success(action === 'close' ? 'Day closed.' : 'Saved.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message)
    } finally {
      setSavingId(null)
    }
  }

  const handleActivateNext = async (staffId) => {
    if (!window.confirm("Are you sure you want to activate the queued voucher book for this staff?")) return
    try {
      await hrApi.vouchers.activateNext(staffId)
      toast.success("Next voucher book activated!")
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to activate next book")
    }
  }

  // ── Print Styles ─────────────────────────────────────────────────
  const totals = rows.reduce((acc, r) => ({
    cash_collected: acc.cash_collected + parseFloat(r.cash_collected || 0),
    online_collected: acc.online_collected + parseFloat(r.online_collected || 0),
    cash_submitted: acc.cash_submitted + parseFloat(r.cash_submitted || 0),
  }), { cash_collected: 0, online_collected: 0, cash_submitted: 0 })

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 15mm;
          }
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .hide-print {
            display: none !important;
          }
          input.form-control {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            color: black !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .print-header {
          display: none;
        }
        @media print {
          .print-header {
            display: block;
            text-align: center;
            margin-bottom: 20px;
          }
        }
      `}</style>

      <div className="hide-print">
        <PageHeader
          title="Promoters Registry Book"
          subtitle="Daily collection reconciliation — auto-populated from mobile app transactions"
        />
      </div>

      <div className="data-card printable-area">
        <div className="print-header">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: '2px solid #E5E7EB', paddingBottom: 16, marginBottom: 16 }}>
            <img src="/logo-full.png" alt="Sreelakshmi Charitable Trust" style={{ height: 100, objectFit: 'contain' }} />
            <h1 style={{ margin: '10px 0 0 0', color: '#1F2937', fontSize: 24 }}>Promoters Registry Book</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>Daily collection reconciliation — auto-populated from mobile app transactions</p>
            <div style={{ marginTop: 10, padding: '6px 16px', background: '#F3F4F6', borderRadius: 8, fontWeight: 700, fontSize: 15, color: '#374151' }}>
              Date: {format(new Date(dateFilter + 'T00:00:00'), 'dd-MMM-yyyy')}
            </div>
          </div>
        </div>

        <div className="hide-print">
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
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#6B7280' }}>
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

        {loading ? <LoadingState /> : rows.length === 0 ? (
          <EmptyState icon="📝" title={`No staff have collected on ${format(new Date(dateFilter + 'T00:00:00'), 'dd-MM-yyyy')} yet`} />
        ) : (
          <>
            <div className="table-wrap">
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th rowSpan={2} style={thStyle()}>Name</th>
                    <th rowSpan={2} style={thStyle()}>Voucher No</th>
                    <th colSpan={2} style={thStyle('center', '#4338CA', '#EEF2FF')}>Voucher Reading</th>
                    <th colSpan={2} style={thStyle('center', '#0369A1', '#E0F2FE')}>Vothen Reading <br/><span style={{ fontSize: 10, fontWeight: 400 }}>(Auto from Mobile)</span></th>
                    <th rowSpan={2} style={thStyle('center', '#7C3AED', '#F5F3FF')}>Cash Submitted<br/><span style={{ fontSize: 10, fontWeight: 400 }}>at Office</span></th>
                    <th rowSpan={2} style={thStyle('center', '#059669', '#ECFDF5')}>Total<br/>Collected</th>
                    <th rowSpan={2} className="hide-print" style={thStyle('center')}>Status / Action</th>
                  </tr>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={subThStyle('#4338CA')}>Starting</th>
                    <th style={subThStyle('#4338CA')}>Ending</th>
                    <th style={subThStyle('#0369A1')}>Cash</th>
                    <th style={subThStyle('#0369A1')}>Online</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isSaving = savingId === row.staff_id
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
                        {/* Name */}
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{row.staff_name}</span>
                            {row.is_closed && (
                              <span style={{ fontSize: 10, background: '#BBF7D0', color: '#166534', borderRadius: 6, padding: '1px 6px' }}>
                                ✓ Closed
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Voucher No */}
                        <td style={{ padding: '6px 8px' }}>
                          <input type="text" className="form-control" style={{ minWidth: 110 }}
                            value={row.entry_code}
                            disabled={row.is_closed}
                            placeholder="VR..."
                            onChange={e => updateField(row.staff_id, 'entry_code', e.target.value)}
                          />
                          {row.voucher_book && row.voucher_book.next_book_number && (row.voucher_book.voucher_end - row.voucher_book.current_voucher <= 2) && (
                            <button 
                              type="button"
                              onClick={() => handleActivateNext(row.staff_id)}
                              style={{ marginTop: 4, width: '100%', padding: '4px 8px', fontSize: 10, background: '#F59E0B', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            >
                              <span>⚡ Activate Next Book</span>
                            </button>
                          )}
                        </td>

                        {/* Starting Reading */}
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" className="form-control" style={{ minWidth: 70, textAlign: 'center' }}
                            value={row.starting_reading}
                            disabled={row.is_closed}
                            onChange={e => updateField(row.staff_id, 'starting_reading', e.target.value)}
                          />
                        </td>

                        {/* Ending Reading */}
                        <td style={{ padding: '6px 8px', borderRight: '2px solid #E0E7FF' }}>
                          <input type="number" className="form-control" style={{ minWidth: 70, textAlign: 'center' }}
                            value={row.ending_reading}
                            disabled={row.is_closed}
                            onChange={e => updateField(row.staff_id, 'ending_reading', e.target.value)}
                          />
                        </td>

                        {/* Cash Collected — auto from mobile, editable override */}
                        <td style={{ padding: '6px 8px' }}>
                          <input type="number" className="form-control" style={{ minWidth: 90, textAlign: 'center', background: '#F0F9FF' }}
                            value={row.cash_collected}
                            disabled={row.is_closed}
                            onChange={e => updateField(row.staff_id, 'cash_collected', e.target.value)}
                          />
                        </td>

                        {/* Online Collected — auto from mobile, editable override */}
                        <td style={{ padding: '6px 8px', borderRight: '2px solid #BAE6FD' }}>
                          <input type="number" className="form-control" style={{ minWidth: 90, textAlign: 'center', background: '#F0F9FF' }}
                            value={row.online_collected}
                            disabled={row.is_closed}
                            onChange={e => updateField(row.staff_id, 'online_collected', e.target.value)}
                          />
                        </td>

                        {/* Cash Submitted at Office */}
                        <td style={{ padding: '6px 8px', borderRight: '2px solid #DDD6FE' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input type="number" className="form-control"
                              style={{
                                minWidth: 100, textAlign: 'center',
                                paddingRight: hasMismatch ? 28 : 8,
                                background: row.is_closed ? '#F5F3FF' : hasMismatch ? '#FEF2F2' : '#FAF5FF',
                                borderColor: hasMismatch ? '#EF4444' : undefined,
                                color: hasMismatch ? '#991B1B' : undefined,
                                fontWeight: hasMismatch ? 700 : 'normal'
                              }}
                              value={row.cash_submitted}
                              disabled={row.is_closed}
                              placeholder="0.00"
                              onChange={e => updateField(row.staff_id, 'cash_submitted', e.target.value)}
                            />
                            {hasMismatch && (
                              <span title={`Cash Mismatch! Expected ₹${cashFloat.toFixed(2)}, Submitted ₹${cashSubmittedFloat.toFixed(2)}`}
                                style={{ position: 'absolute', right: 8, fontSize: 13, cursor: 'help', lineHeight: 1, userSelect: 'none' }}>⚠️</span>
                            )}
                          </div>
                        </td>

                        {/* Total Collected */}
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                          ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Action */}
                        <td className="hide-print" style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {row.is_closed ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 13 }}>🔒 Done</span>
                              <button className="btn btn-sm"
                                style={{ background: '#EAB308', color: 'white', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                                disabled={savingId === row.staff_id}
                                onClick={() => handleSave(row, 'reopen')}
                                title="Reopen for editing"
                              >
                                {savingId === row.staff_id ? '...' : 'Edit'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm"
                                style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                                disabled={!row.hasChanges || savingId === row.staff_id}
                                onClick={() => handleSave(row, 'save')}
                              >
                                {savingId === row.staff_id ? '...' : 'Save'}
                              </button>
                              <button className="btn btn-sm"
                                style={{
                                  background: '#16A34A', color: 'white', border: 'none',
                                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                                  opacity: row.cash_submitted === '' ? 0.5 : 1
                                }}
                                disabled={savingId === row.staff_id || row.cash_submitted === ''}
                                onClick={() => handleSave(row, 'close')}
                                title="Close the day for this staff member"
                              >
                                {savingId === row.staff_id ? '...' : '🔒 Close'}
                              </button>
                              
                              <button 
                                className="btn btn-sm" 
                                style={{ background: '#FEE2E2', color: '#EF4444', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }} 
                                onClick={() => {
                                  if(window.confirm('Are you sure you want to unverify this? It will be moved back to the Verification Dashboard.')) {
                                    handleSave(row, 'unverify')
                                  }
                                }}
                              >
                                Unverify
                              </button>
                            </div>
                          )}
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
                    <td className="hide-print" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Styled Cash Mismatch Warning Modal */}
      {mismatchModalData && (
        <Modal 
          isOpen={true} 
          onClose={() => setMismatchModalData(null)} 
          title="⚠️ Cash Mismatch Warning"
          footer={
            <>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setMismatchModalData(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: '#EF4444', borderColor: '#EF4444', fontWeight: 600 }}
                onClick={() => {
                  const { row, action } = mismatchModalData;
                  setMismatchModalData(null);
                  handleSave(row, action, true);
                }}
              >
                Yes, Close Day Anyway
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: 28 }}>
              ⚠️
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 18, color: '#111827', fontWeight: 700 }}>
              Cash Discrepancy Detected
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              The cash submitted at office does not match mobile collection for <strong style={{ color: '#1F2937' }}>{mismatchModalData.row.staff_name}</strong>.
            </p>
          </div>

          <div style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, border: '1px solid #FCA5A5', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#7F1D1D', fontWeight: 500 }}>Cash Collected (Mobile App):</span>
              <strong style={{ color: '#991B1B' }}>₹{mismatchModalData.cashCollected.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#7F1D1D', fontWeight: 500 }}>Cash Submitted (at Office):</span>
              <strong style={{ color: '#991B1B' }}>₹{mismatchModalData.cashSubmitted.toFixed(2)}</strong>
            </div>
            <div style={{ borderTop: '1px dashed #FCA5A5', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
              <span style={{ color: '#991B1B' }}>Unmatched Difference:</span>
              <span style={{ color: '#DC2626' }}>₹{mismatchModalData.difference.toFixed(2)}</span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: '#374151', textAlign: 'center', fontWeight: 500 }}>
            Do you still want to close the day for <strong>{mismatchModalData.row.staff_name}</strong>?
          </p>
        </Modal>
      )}
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────
function thStyle(align = 'left', color = '#374151', bg = '#F8FAFC') {
  return {
    padding: '10px 14px',
    textAlign: align,
    color,
    background: bg,
    fontWeight: 700,
    fontSize: 12,
    borderBottom: '2px solid #E5E7EB',
    whiteSpace: 'nowrap',
  }
}

function subThStyle(color = '#374151') {
  return {
    padding: '6px 14px',
    textAlign: 'center',
    color,
    fontWeight: 600,
    fontSize: 11,
    borderBottom: '2px solid #E5E7EB',
  }
}
