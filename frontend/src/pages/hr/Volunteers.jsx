import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"

const init = { full_name:"", phone:"", email:"", address:"", skills:"", availability:"WEEKENDS", joining_date:format(new Date(),"yyyy-MM-dd"), status:"ACTIVE", notes:"" }

export default function Volunteers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)

  // Secret delete mode state (Ctrl + Shift + Q)
  const [secretDeleteMode, setSecretDeleteMode] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState([])
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, items: [] })
  const [deleting, setDeleting] = useState(false)

  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await hrApi.volunteers.list({search}); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search])
  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

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
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.length === items.length && items.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(items.map(i => i.id));
    }
  };

  const handlePermanentDelete = async () => {
    const itemsToDelete = deleteConfirmModal.items || [];
    if (itemsToDelete.length === 0) return;
    setDeleting(true);
    try {
      for (const item of itemsToDelete) {
        await hrApi.volunteers.delete(item.id);
      }
      toast.success(
        itemsToDelete.length === 1
          ? `Volunteer "${itemsToDelete[0].full_name}" permanently deleted.`
          : `${itemsToDelete.length} volunteers permanently deleted.`
      );
      setSelectedRowIds(prev => prev.filter(id => !itemsToDelete.some(it => it.id === id)));
      setDeleteConfirmModal({ open: false, items: [] });
      load();
    } catch (err) {
      toast.error('Failed to delete: ' + (err.response?.data?.error || err.message || 'Server error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");
    
    setSaving(true)
    try {
      if (selected) await hrApi.volunteers.update(selected.id, form)
      else await hrApi.volunteers.create(form)
      toast.success("Saved."); setShowModal(false); load()
    } catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Volunteers" subtitle="Volunteer management">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setForm(init);setShowModal(true)}}>+ Add Volunteer</button>
      </PageHeader>
      <div className="data-card">
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
                  items: items.filter(i => selectedRowIds.includes(i.id))
                })}
              >
                <span>🗑️</span>
                <span>Permanently Delete Selected ({selectedRowIds.length})</span>
              </button>
            )}
          </div>
        )}

        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {secretDeleteMode && (
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.length === items.length && items.length > 0}
                        onChange={toggleSelectAll}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                        title="Select All"
                      />
                    </th>
                  )}
                  <th>ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Skills</th>
                  <th>Availability</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={secretDeleteMode ? 8 : 7}><EmptyState icon="🙋" title="No volunteers" /></td></tr>
                  : items.map(v => {
                    const isRowSelected = selectedRowIds.includes(v.id);
                    return (
                      <tr
                        key={v.id}
                        onClick={() => {
                          if (secretDeleteMode) {
                            toggleSelectRow(v.id);
                          } else {
                            setViewItem(v);
                            setShowViewModal(true);
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isRowSelected ? '#FEF2F2' : undefined
                        }}
                        className="hover-row"
                      >
                        {secretDeleteMode && (
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={(e) => toggleSelectRow(v.id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td className="td-mono">{v.volunteer_id}</td>
                        <td style={{ fontWeight: isRowSelected ? 700 : undefined }}>{v.full_name}</td>
                        <td>{v.phone}</td>
                        <td>{v.skills}</td>
                        <td><span className="badge badge-blue">{v.availability}</span></td>
                        <td><span className={`badge ${v.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{v.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(v);
                                setForm({...v});
                                setShowModal(true);
                              }}
                            >
                              Edit
                            </button>
                            {secretDeleteMode && (
                              <button
                                className="btn btn-sm"
                                style={{
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  padding: '4px 10px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmModal({ open: true, items: [v] });
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={selected?"Edit Volunteer":"Add Volunteer"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" form="vol-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="vol-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" required value={form.full_name} onChange={e=>F("full_name",e.target.value)} /></div>
              <div className="form-group"><label className="form-label required">Phone</label><input className="form-control" required value={form.phone} onChange={e=>F("phone",e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>F("email",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Joining Date</label><input className="form-control" type="date" value={form.joining_date} onChange={e=>F("joining_date",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Availability</label><select className="form-control" value={form.availability} onChange={e=>F("availability",e.target.value)}>{["FULL_TIME","PART_TIME","WEEKENDS","ON_CALL"].map(a=><option key={a}>{a}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>F("status",e.target.value)}>{["ACTIVE","INACTIVE"].map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-group"><label className="form-label">Skills</label><textarea className="form-control" rows={2} value={form.skills} onChange={e=>F("skills",e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e=>F("notes",e.target.value)} /></div>
          </form>
        </Modal>
      )}

      {/* Details View Modal */}
      {showViewModal && viewItem && (
        <Modal isOpen={true} onClose={()=>setShowViewModal(false)} title="Volunteer Details" size="modal-lg"
          footer={<>
            {secretDeleteMode && (
              <button
                className="btn btn-sm"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  marginRight: 'auto',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setShowViewModal(false);
                  setDeleteConfirmModal({ open: true, items: [viewItem] });
                }}
              >
                🗑️ Permanently Delete
              </button>
            )}
            <button className="btn btn-secondary" onClick={()=>setShowViewModal(false)}>Close</button>
            <button className="btn btn-primary" onClick={() => {
              setShowViewModal(false);
              setSelected(viewItem);
              setForm({...viewItem});
              setShowModal(true);
            }}>Edit Volunteer</button>
          </>}>
          <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Volunteer ID</strong><div>{viewItem.volunteer_id || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Full Name</strong><div>{viewItem.full_name || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Phone</strong><div>{viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Email</strong><div>{viewItem.email || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Joining Date</strong><div>{viewItem.joining_date ? format(new Date(viewItem.joining_date), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Availability</strong><div><span className="badge badge-blue">{viewItem.availability || '-'}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Status</strong><div><span className={`badge ${viewItem.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{viewItem.status}</span></div></div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Skills</strong><div>{viewItem.skills || '-'}</div></div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Address</strong><div>{viewItem.address || '-'}</div></div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Notes</strong><div>{viewItem.notes || '-'}</div></div>
          </div>
        </Modal>
      )}

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
              <strong>WARNING:</strong> This action is completely permanent and cannot be reversed. The selected record(s) will be completely removed from the database.
            </div>

            <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8, fontWeight: 600 }}>
              Are you sure you want to delete the following {deleteConfirmModal.items.length === 1 ? 'volunteer' : `${deleteConfirmModal.items.length} volunteers`}?
            </p>

            <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#4B5563' }}>
              {deleteConfirmModal.items.map(it => (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{it.full_name}</span> (ID: <span className="td-mono">{it.volunteer_id}</span>, Phone: {it.phone})
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
