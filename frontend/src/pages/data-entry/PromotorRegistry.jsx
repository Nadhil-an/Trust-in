import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal, ConfirmModal, useSecretDelete, SecretDeleteBanner } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"


// ── Amount & Input Formatting Helpers ─────────────────────────────────────
const formatAmount = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const cleanInputValue = (val) => {
  if (val === null || val === undefined || val === '') return '0';
  const str = String(val).trim();
  if (str === '' || str === '0' || str === '0.00' || str === '0.0') return '0';
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  return num % 1 === 0 ? String(Math.round(num)) : str;
};

export default function PromotorRegistry() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState('')
  const [mismatchModalData, setMismatchModalData] = useState(null)
  const [confirmState, setConfirmState] = useState({ isOpen: false, row: null, type: '' })

  const {
    secretDeleteMode,
    selectedRowIds,
    deleteConfirmModal,
    setDeleteConfirmModal,
    deleting,
    toggleSelectRow,
    toggleSelectAll,
    confirmDeleteSelected,
    confirmDeleteOne,
    handlePermanentDelete,
  } = useSecretDelete({
    items: rows,
    itemName: 'promoter registry record',
    onDelete: async (itemsToDelete) => {
      for (const it of itemsToDelete) {
        if (it.id) {
          await hrApi.promoterRegistry.delete(it.id);
        }
      }
    },
    reload: () => load(),
  });

  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('') // 'CASH' or 'UPI'
  const [modalStaff, setModalStaff] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [transactionSearch, setTransactionSearch] = useState('')

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
          cash_count: item.cash_count || 0,
          online_count: item.online_count || 0,

          // Voucher book fields (Prioritize HR assigned book number)
          entry_code: item.book_number ? String(item.book_number) : (entry?.entry_code || ''),
          starting_reading: item.auto_starting_reading || entry?.starting_reading || '',
          ending_reading: item.auto_ending_reading || entry?.ending_reading || '',

          // Cash submitted at office in the evening
          cash_submitted: cleanInputValue(entry?.cash_submitted),
          online_verified: cleanInputValue(entry?.online_verified),

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
        online_verified: parseFloat(row.online_verified) || 0,
        excess_less: ((row.cash_submitted !== '' ? ((parseFloat(row.cash_submitted) || 0) - (parseFloat(row.cash_collected) || 0)) : 0) +
                     ((row.online_verified !== '' && row.online_verified !== undefined) ? ((parseFloat(row.online_verified) || 0) - (parseFloat(row.online_collected) || 0)) : 0)),
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
    try {
      await hrApi.vouchers.activateNext(staffId)
      toast.success("Next voucher book activated!")
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to activate next book")
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

  // ── Print Styles ─────────────────────────────────────────────────
  const filteredRows = rows.filter(r =>
    r.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.entry_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totals = filteredRows.reduce((acc, r) => {
    const cashColl = parseFloat(r.cash_collected || 0)
    const onlineColl = parseFloat(r.online_collected || 0)
    const cashSub = parseFloat(r.cash_submitted || 0)
    const onlineVer = (r.online_verified !== '' && r.online_verified !== undefined) ? parseFloat(r.online_verified || 0) : 0
    const diff = (r.cash_submitted !== '' ? (cashSub - cashColl) : 0) +
                 ((r.online_verified !== '' && r.online_verified !== undefined) ? (onlineVer - onlineColl) : 0)
    return {
      cash_collected: acc.cash_collected + cashColl,
      online_collected: acc.online_collected + onlineColl,
      cash_submitted: acc.cash_submitted + cashSub,
      online_verified: acc.online_verified + onlineVer,
      excess_less: acc.excess_less + diff,
    }
  }, { cash_collected: 0, online_collected: 0, cash_submitted: 0, online_verified: 0, excess_less: 0 })

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0; /* Removes browser date/time/URL headers */
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
            padding: 10mm 15mm;
            box-sizing: border-box;
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
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #E5E7EB;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
        }
      `}</style>

      <div className="hide-print">
        <PageHeader
          title="Promoters Registry Book"
          subtitle="Daily collection reconciliation — auto-populated from mobile app transactions"
        />
      </div>

      <ConfirmModal 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({ isOpen: false, row: null, type: '' })}
        onConfirm={() => {
          if (confirmState.type === 'UNVERIFY' && confirmState.row) {
            handleSave(confirmState.row, 'unverify')
          } else if (confirmState.type === 'ACTIVATE_NEXT' && confirmState.row) {
            handleActivateNext(confirmState.row)
          }
        }}
        title={confirmState.type === 'UNVERIFY' ? 'Unverify Collections' : 'Activate Next Voucher Book'}
        message={confirmState.type === 'UNVERIFY' ? 'Are you sure you want to unverify this? It will be moved back to the Verification Dashboard.' : 'Are you sure you want to activate the queued voucher book for this staff?'}
        isDanger={confirmState.type === 'UNVERIFY'}
        confirmText={confirmState.type === 'UNVERIFY' ? 'Unverify' : 'Activate'}
      />

      <div className="data-card printable-area">
        <div className="print-header">
          <h1 style={{ margin: 0, color: '#1F2937', fontSize: 22 }}>Promoters Registry Book</h1>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#374151' }}>
            Date: {format(new Date(dateFilter + 'T00:00:00'), 'dd-MMM-yyyy')}
          </div>
        </div>

        <div className="hide-print">
          <FilterBar search={searchTerm} onSearch={setSearchTerm} placeholder="Search staff...">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: '#374151', fontSize: 12 }}>Date:</span>
              <input
                type="date"
                className="filter-select"
                style={{ width: '140px', height: 32, fontSize: 12 }}
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button 
                className="btn" 
                style={{ background: '#4F46E5', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12 }}
                onClick={() => window.print()}
              >
                🖨️ Print
              </button>
            </div>
          </FilterBar>
        </div>

        <SecretDeleteBanner
          secretDeleteMode={secretDeleteMode}
          selectedRowIds={selectedRowIds}
          onDeleteSelected={() => confirmDeleteSelected(filteredRows)}
          itemName="promoter records"
        />

        {loading ? <LoadingState /> : rows.length === 0 ? (
          <EmptyState icon="📝" title={`No staff have collected on ${format(new Date(dateFilter + 'T00:00:00'), 'dd-MM-yyyy')} yet`} />
        ) : (
          <>
            <div className="table-wrap">
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {secretDeleteMode && (
                      <th rowSpan={2} style={{ width: 44, textAlign: 'center', background: '#F8FAFC', padding: '6px' }}>
                        <input
                          type="checkbox"
                          checked={selectedRowIds.length === filteredRows.length && filteredRows.length > 0}
                          onChange={() => toggleSelectAll(filteredRows)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                          title="Select All"
                        />
                      </th>
                    )}
                    <th rowSpan={2} style={thStyle()}>Name</th>
                    <th rowSpan={2} style={thStyle()}>Voucher No</th>
                    <th colSpan={2} style={thStyle('center', '#4338CA', '#EEF2FF')}>Voucher Reading</th>
                    <th colSpan={2} style={thStyle('center', '#0369A1', '#E0F2FE')}>Voucher Reading <br/><span style={{ fontSize: 10, fontWeight: 400 }}>(Auto from Mobile)</span></th>
                    <th rowSpan={2} style={thStyle('center', '#7C3AED', '#F5F3FF')}>Cash Submitted<br/><span style={{ fontSize: 10, fontWeight: 400 }}>at Office</span></th>
                    <th rowSpan={2} style={thStyle('center', '#2563EB', '#EFF6FF')}>Online Verification<br/><span style={{ fontSize: 10, fontWeight: 400 }}>(Office Verified)</span></th>
                    <th rowSpan={2} style={thStyle('center', '#D97706', '#FFFBEB')}>Excess / Less<br/><span style={{ fontSize: 10, fontWeight: 400 }}>(Auto Calculated)</span></th>
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
                  {filteredRows.map(row => {
                    const isSaving = savingId === row.staff_id
                    const cashFloat = parseFloat(row.cash_collected) || 0
                    const onlineFloat = parseFloat(row.online_collected) || 0
                    const totalCollected = cashFloat + onlineFloat
                    const cashSubmittedFloat = row.cash_submitted !== '' ? (parseFloat(row.cash_submitted) || 0) : null
                    const onlineVerifiedFloat = (row.online_verified !== '' && row.online_verified !== undefined) ? (parseFloat(row.online_verified) || 0) : null
                    const hasMismatch = cashSubmittedFloat !== null && Math.abs(cashSubmittedFloat - cashFloat) > 0.01

                    let diff = 0
                    let hasEntered = false
                    if (cashSubmittedFloat !== null) {
                      diff += (cashSubmittedFloat - cashFloat)
                      hasEntered = true
                    }
                    if (onlineVerifiedFloat !== null) {
                      diff += (onlineVerifiedFloat - onlineFloat)
                      hasEntered = true
                    }

                    let diffText = '—'
                    let diffBg = '#F9FAFB'
                    let diffBorder = '#E5E7EB'
                    let diffColor = '#6B7280'
                    if (hasEntered) {
                      const roundedDiff = Math.round(diff * 100) / 100
                      const formattedAbs = formatAmount(Math.abs(roundedDiff))
                      if (roundedDiff > 0.009) {
                        diffText = `+ ₹${formattedAbs} (Excess)`
                        diffBg = '#F0FDF4'
                        diffBorder = '#86EFAC'
                        diffColor = '#16A34A'
                      } else if (roundedDiff < -0.009) {
                        diffText = `- ₹${formattedAbs} (Less)`
                        diffBg = '#FEF2F2'
                        diffBorder = '#FCA5A5'
                        diffColor = '#DC2626'
                      } else {
                        diffText = '₹0 (Match)'
                        diffBg = '#F9FAFB'
                        diffBorder = '#D1D5DB'
                        diffColor = '#059669'
                      }
                    }

                    return (
                      <tr key={row.staff_id} style={{
                        background: selectedRowIds.includes(row.id || row.staff_id) ? '#FEF2F2' : (row.is_closed ? '#F0FDF4' : 'white'),
                        opacity: row.is_closed ? 0.85 : 1,
                        borderBottom: '1px solid #F3F4F6'
                      }}>
                        {secretDeleteMode && (
                          <td style={{ textAlign: 'center', padding: '6px' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedRowIds.includes(row.id || row.staff_id)}
                              onChange={(e) => toggleSelectRow(row.id || row.staff_id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        {/* Name */}
                        <td style={{ padding: '4px 6px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>{row.staff_name}</span>
                            {row.is_closed && (
                              <span style={{ fontSize: 9, background: '#BBF7D0', color: '#166534', borderRadius: 4, padding: '1px 4px' }}>
                                ✓
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Voucher No */}
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                          <input type="text" className="form-control" style={{ width: 44, textAlign: 'center', padding: '3px 2px', fontSize: 11 }}
                            value={row.entry_code}
                            disabled={row.is_closed}
                            placeholder="VR"
                            onChange={e => updateField(row.staff_id, 'entry_code', e.target.value)}
                          />
                          {row.voucher_book && row.voucher_book.next_book_number && (row.voucher_book.voucher_end - row.voucher_book.current_voucher <= 2) && (
                            <button 
                              type="button"
                              onClick={() => setConfirmState({ isOpen: true, row: row.staff_id, type: 'ACTIVATE_NEXT' })}
                              style={{ marginTop: 2, width: '100%', padding: '2px', fontSize: 9, background: '#F59E0B', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}
                              title="Activate Next Voucher Book"
                            >
                              ⚡ Next
                            </button>
                          )}
                        </td>

                        {/* Starting Reading */}
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                          <input type="number" className="form-control" style={{ width: 48, textAlign: 'center', padding: '3px 2px', fontSize: 11 }}
                            value={row.starting_reading}
                            disabled={row.is_closed}
                            onChange={e => updateField(row.staff_id, 'starting_reading', e.target.value)}
                          />
                        </td>

                        {/* Ending Reading */}
                        <td style={{ padding: '4px 2px', borderRight: '2px solid #E0E7FF', textAlign: 'center' }}>
                          <input type="number" className="form-control" style={{ width: 48, textAlign: 'center', padding: '3px 2px', fontSize: 11 }}
                            value={row.ending_reading}
                            disabled={row.is_closed}
                            onChange={e => updateField(row.staff_id, 'ending_reading', e.target.value)}
                          />
                        </td>

                        {/* Cash Collected — auto from mobile */}
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                            <input type="number" className="form-control" style={{ width: 52, textAlign: 'center', background: '#F0F9FF', padding: '3px 14px 3px 2px', fontSize: 11 }}
                              value={cleanInputValue(row.cash_collected)}
                              disabled={row.is_closed}
                              onChange={e => updateField(row.staff_id, 'cash_collected', e.target.value)}
                            />
                            <span 
                              style={{ position: 'absolute', right: '3px', cursor: 'pointer', fontSize: 9, color: '#0369A1', opacity: 0.7 }}
                              onClick={() => openTransactionsModal(row, 'CASH')}
                              title="Click to view full details"
                            >↗</span>
                          </div>
                        </td>

                        {/* Online Collected — auto from mobile */}
                        <td style={{ padding: '4px 2px', borderRight: '2px solid #BAE6FD', textAlign: 'center' }}>
                          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                            <input type="number" className="form-control" style={{ width: 52, textAlign: 'center', background: '#F0F9FF', padding: '3px 14px 3px 2px', fontSize: 11 }}
                              value={cleanInputValue(row.online_collected)}
                              disabled={row.is_closed}
                              onChange={e => updateField(row.staff_id, 'online_collected', e.target.value)}
                            />
                            <span 
                              style={{ position: 'absolute', right: '3px', cursor: 'pointer', fontSize: 9, color: '#0369A1', opacity: 0.7 }}
                              onClick={() => openTransactionsModal(row, 'UPI')}
                              title="Click to view full details"
                            >↗</span>
                          </div>
                        </td>

                        {/* Cash Submitted at Office (IMMUTABLE IN REGISTRY) */}
                        <td style={{ padding: '4px 3px', borderRight: '2px solid #DDD6FE', textAlign: 'center' }}>
                          <div
                            style={{
                              width: 62,
                              margin: '0 auto',
                              padding: '3px 2px',
                              borderRadius: 4,
                              fontWeight: 700,
                              fontSize: 11,
                              background: hasMismatch ? '#FEF2F2' : '#F5F3FF',
                              color: hasMismatch ? '#991B1B' : '#6D28D9',
                              border: `1px solid ${hasMismatch ? '#FCA5A5' : '#DDD6FE'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2,
                            }}
                            title={`Cash submitted: ₹${formatAmount(cashSubmittedFloat || 0)} (Verified)`}
                          >
                            <span>{formatAmount(cashSubmittedFloat || 0)}</span>
                            {hasMismatch && (
                              <span title={`Expected ₹${formatAmount(cashFloat)}`} style={{ cursor: 'help', fontSize: 10 }}>⚠️</span>
                            )}
                          </div>
                        </td>

                        {/* Online Verification (IMMUTABLE IN REGISTRY) */}
                        <td style={{ padding: '4px 3px', borderRight: '2px solid #BFDBFE', textAlign: 'center' }}>
                          <div
                            style={{
                              width: 58,
                              margin: '0 auto',
                              padding: '3px 2px',
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: 11,
                              background: '#F0F9FF',
                              color: '#0369A1',
                              border: '1px solid #BAE6FD',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={`Online verified: ₹${formatAmount(onlineVerifiedFloat || 0)}`}
                          >
                            {formatAmount(onlineVerifiedFloat || 0)}
                          </div>
                        </td>

                        {/* Excess / Less (Auto Calculated) */}
                        <td style={{ padding: '4px 3px', borderRight: '2px solid #FDE68A', textAlign: 'center' }}>
                          <div
                            style={{
                              width: 82,
                              margin: '0 auto',
                              padding: '3px 1px',
                              borderRadius: 4,
                              fontWeight: 700,
                              fontSize: 10,
                              background: diffBg,
                              border: `1px solid ${diffBorder}`,
                              color: diffColor,
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {diffText}
                          </div>
                        </td>

                        {/* Total Collected */}
                        <td style={{ padding: '4px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: '#059669', fontSize: 11 }}>
                            ₹{formatAmount(totalCollected)}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 500, color: '#6B7280' }}>
                            ({(row.cash_count || 0) + (row.online_count || 0)} Ent)
                          </div>
                        </td>

                        {/* Action */}
                        <td className="hide-print" style={{ padding: '4px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {row.is_closed ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 13 }}>🔒 Done</span>
                              {secretDeleteMode && (
                                <button
                                  className="btn btn-sm"
                                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
                                  onClick={(e) => confirmDeleteOne({ ...row, id: row.id || row.staff_id }, e)}
                                >
                                  Delete
                                </button>
                              )}
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
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {secretDeleteMode && (
                                <button
                                  className="btn btn-sm"
                                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
                                  onClick={(e) => confirmDeleteOne({ ...row, id: row.id || row.staff_id }, e)}
                                >
                                  Delete
                                </button>
                              )}
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
                                onClick={() => setConfirmState({ isOpen: true, row: row, type: 'UNVERIFY' })}
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
                    <td colSpan={4} style={{ padding: '6px 6px', color: '#374151', fontSize: 11 }}>Day Totals</td>
                    <td style={{ padding: '6px 3px', textAlign: 'center', color: '#0369A1', fontSize: 11 }}>
                      ₹{formatAmount(totals.cash_collected)}
                    </td>
                    <td style={{ padding: '6px 3px', textAlign: 'center', color: '#0369A1', fontSize: 11 }}>
                      ₹{formatAmount(totals.online_collected)}
                    </td>
                    <td style={{ padding: '6px 3px', textAlign: 'center', color: '#7C3AED', fontSize: 11 }}>
                      ₹{formatAmount(totals.cash_submitted)}
                    </td>
                    <td style={{ padding: '6px 3px', textAlign: 'center', color: '#2563EB', fontSize: 11 }}>
                      ₹{formatAmount(totals.online_verified)}
                    </td>
                    <td style={{ padding: '6px 3px', textAlign: 'center', color: totals.excess_less > 0.009 ? '#16A34A' : totals.excess_less < -0.009 ? '#DC2626' : '#059669', fontSize: 10 }}>
                      {totals.excess_less > 0.009 ? `+ ₹${formatAmount(totals.excess_less)}` : totals.excess_less < -0.009 ? `- ₹${formatAmount(Math.abs(totals.excess_less))}` : '₹0'}
                    </td>
                    <td style={{ padding: '6px 3px', textAlign: 'center', color: '#059669', fontSize: 11 }}>
                      ₹{formatAmount(totals.cash_collected + totals.online_collected)}
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

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 700, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#1F2937' }}>
                {modalType === 'CASH' ? '💵 Cash' : '📱 Online'} Transactions - {modalStaff?.staff_name} ({transactions.length} Entries)
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

// ── Style helpers ─────────────────────────────────────────────────
function thStyle(align = 'left', color = '#374151', bg = '#F8FAFC') {
  return {
    padding: '5px 3px',
    textAlign: align,
    color,
    background: bg,
    fontWeight: 700,
    fontSize: 11,
    borderBottom: '2px solid #E5E7EB',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  }
}

function subThStyle(color = '#374151') {
  return {
    padding: '3px 2px',
    textAlign: 'center',
    color,
    fontWeight: 600,
    fontSize: 10,
    borderBottom: '2px solid #E5E7EB',
  }
}
