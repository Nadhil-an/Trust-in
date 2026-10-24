import React, { useState, useEffect } from 'react'
import { accountsApi, coreApi } from '../../api'
import { LoadingState, formatINR, Modal } from '../../components/shared'
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

  // Secret delete mode (Ctrl + Shift + Q)
  const [secretDeleteMode, setSecretDeleteMode] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState([])
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, items: [] })
  const [deleting, setDeleting] = useState(false)

  // Secret key combination: Ctrl + Shift + Q
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        setSecretDeleteMode((prev) => {
          const next = !prev;
          if (next) {
            toast('🚨 Secret Delete Mode ENABLED. Select rows or click Delete to permanently erase data.', {
              id: 'secret-delete-mode',
              icon: '🗑️',
              duration: 4000,
              style: {
                borderRadius: '8px',
                background: '#18181B',
                color: '#EF4444',
                fontWeight: '700',
                border: '1px solid #DC2626'
              }
            });
          } else {
            toast.success('Secret Delete Mode DISABLED', { id: 'secret-delete-mode' });
          }
          return next;
        });
        setSelectedRowIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSelectRow = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedRowIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.length === currentItems.length && currentItems.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(currentItems.map(i => i.id));
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteConfirmModal.items.length === 0) return;
    setDeleting(true);
    try {
      for (const it of deleteConfirmModal.items) {
        await accountsApi.income.delete(it.id);
      }
      toast.success(`Successfully permanently deleted ${deleteConfirmModal.items.length} collection record(s) from database!`);
      setDeleteConfirmModal({ open: false, items: [] });
      setSelectedRowIds([]);
      fetchIncome();
      window.dispatchEvent(new CustomEvent('dashboard-refresh'));
    } catch (err) {
      toast.error('Failed to permanently delete collection(s): ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const fetchIncome = React.useCallback(async () => {
    setItemsLoading(true)
    try {
      const params = { date: selectedDate, page_size: 5000 }
      if (selectedUser) params.created_by = selectedUser
      
      const res = await accountsApi.income.list(params)
      const allItems = res.data.results || res.data || []
      const filtered = allItems.filter(i => {
        const isCorrectSource = i.source === 'DONATION' || i.source === 'MEMBERSHIP'
        const matchesSource = !selectedSource || i.source === selectedSource
        const matchesMethod = !selectedMethod || i.payment_method === selectedMethod
        return isCorrectSource && matchesSource && matchesMethod
      })
      setItems(filtered)
      setPage(1)
    } catch (err) {
      toast.error('Failed to load collections')
    } finally {
      setItemsLoading(false)
    }
  }, [selectedUser, selectedDate, selectedSource, selectedMethod]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

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

  // Real-time live dashboard sync on payment success
  useEffect(() => {
    const handleRefresh = () => {
      accountsApi.dashboard({ date: selectedDate }).then(r => setData(r.data)).catch(() => {})
      fetchIncome()
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [selectedDate, fetchIncome])

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

      {/* Secret Permanent Deletion Alert Banner */}
      {secretDeleteMode && (
        <div style={{
          background: 'linear-gradient(90deg, #FEF2F2 0%, #FFF1F2 100%)',
          border: '1.5px dashed #EF4444',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.5rem' }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: '0.95rem', letterSpacing: '0.3px' }}>
                SECRET PERMANENT DATABASE DELETION MODE ACTIVE
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7F1D1D', marginTop: 2 }}>
                Records deleted here are <strong>permanently purged</strong> from the database. Press <code>Ctrl + Shift + Q</code> again to exit.
              </div>
            </div>
          </div>

          {selectedRowIds.length > 0 && (
            <button
              className="btn"
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '7px 16px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
                cursor: 'pointer'
              }}
              onClick={() => setDeleteConfirmModal({
                open: true,
                items: currentItems.filter(i => selectedRowIds.includes(i.id))
              })}
            >
              <span>🗑️</span>
              <span>Permanently Delete Selected ({selectedRowIds.length})</span>
            </button>
          )}
        </div>
      )}

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
                {secretDeleteMode && (
                  <th style={{ width: 38, textAlign: 'center', background: '#f8fafc' }}>
                    <input
                      type="checkbox"
                      checked={selectedRowIds.length === currentItems.length && currentItems.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                      title="Select All"
                    />
                  </th>
                )}
                <th style={{ background: '#f8fafc' }}>Date</th>
                <th style={{ background: '#f8fafc' }}>Staff Member</th>
                <th style={{ background: '#f8fafc' }}>Donor</th>
                <th style={{ background: '#f8fafc' }}>Phone</th>
                <th style={{ background: '#f8fafc' }}>Place</th>
                <th style={{ background: '#f8fafc' }}>Payment</th>
                <th style={{ background: '#f8fafc' }}>Voucher No.</th>
                <th style={{ background: '#f8fafc' }}>Amount</th>
                {secretDeleteMode && <th style={{ background: '#f8fafc', textAlign: 'center' }}>Action</th>}
              </tr></thead>
              <tbody>
                {currentItems.length === 0
                  ? <tr><td colSpan={secretDeleteMode ? 10 : 8}><div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No collections found for the selected date.</div></td></tr>
                  : currentItems.map(i => {
                    const isSelected = selectedRowIds.includes(i.id);
                    return (
                      <tr
                        key={i.id}
                        style={{
                          backgroundColor: isSelected ? '#FEF2F2' : undefined,
                          cursor: secretDeleteMode ? 'pointer' : undefined
                        }}
                        onClick={() => secretDeleteMode && toggleSelectRow(i.id)}
                      >
                        {secretDeleteMode && (
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectRow(i.id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td style={{ fontSize: 12 }}>{format(new Date(i.date), 'dd MMM yyyy')}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5' }}>{i.created_by_name || '—'}</td>
                        <td style={{ fontWeight: isSelected ? 700 : 600 }}>{i.donor_name || '—'}</td>
                        <td style={{ fontSize: 12 }}>{i.phone || '—'}</td>
                        <td style={{ maxWidth: 160, fontSize: 12 }}>{i.place || '—'}</td>
                        <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{i.payment_method}</span></td>
                        <td className="td-mono" style={{ fontSize: 11, fontWeight: 600 }}>
                          {i.reference_number && !i.reference_number.startsWith('pay_') && !i.reference_number.startsWith('order_')
                            ? i.reference_number
                            : (i.receipt_number ? `VCH-${i.receipt_number.replace('RCP-', '')}` : '—')}
                        </td>
                        <td style={{ fontWeight: 700, color: '#EC4899' }}>{formatINR(i.amount)}</td>
                        {secretDeleteMode && (
                          <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-sm"
                              style={{
                                backgroundColor: '#DC2626',
                                color: '#FFFFFF',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: 4,
                                cursor: 'pointer'
                              }}
                              onClick={() => setDeleteConfirmModal({ open: true, items: [i] })}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
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

      {/* Permanent Deletion Confirmation Modal */}
      {deleteConfirmModal.open && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setDeleteConfirmModal({ open: false, items: [] })}
          title="⚠️ Confirm Permanent Database Deletion"
          size="modal-md"
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirmModal({ open: false, items: [] })}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={deleting}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={handlePermanentDelete}
              >
                {deleting ? 'Purging from Database...' : 'Permanently Delete Now'}
              </button>
            </>
          }
        >
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#991B1B',
              fontSize: '0.85rem'
            }}>
              <strong>WARNING:</strong> This action is completely permanent and cannot be reversed. The selected collection transaction(s) will be completely purged from the database and cash/bank balances will be adjusted.
            </div>

            <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8, fontWeight: 600 }}>
              Are you sure you want to delete the following {deleteConfirmModal.items.length === 1 ? 'collection' : `${deleteConfirmModal.items.length} collections`}?
            </p>

            <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#4B5563' }}>
              {deleteConfirmModal.items.map(it => (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{it.donor_name || 'Anonymous'}</span> ({it.source} - {formatINR(it.amount)} via {it.payment_method})
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
