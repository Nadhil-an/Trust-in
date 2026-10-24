import React, { useState, useCallback, useEffect } from "react"
import { managerApi } from "../../api"
import { StatusBadge, LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import toast from "react-hot-toast"

export default function Partners() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)

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
    if (selectedRowIds.length === items.length && items.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(items.map(i => i.id));
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteConfirmModal.items.length === 0) return;
    setDeleting(true);
    try {
      for (const it of deleteConfirmModal.items) {
        await managerApi.partners.delete(it.id);
      }
      toast.success(`Successfully permanently deleted ${deleteConfirmModal.items.length} partner record(s) from database!`);
      setDeleteConfirmModal({ open: false, items: [] });
      setSelectedRowIds([]);
      load();
      window.dispatchEvent(new CustomEvent('dashboard-refresh'));
    } catch (err) {
      toast.error('Failed to permanently delete partner(s): ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await managerApi.partners.list({ search }); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleSave = async (form) => {
    try {
      if (selected) await managerApi.partners.update(selected.id, form)
      else await managerApi.partners.create(form)
      toast.success("Saved."); setShowModal(false); setSelected(null); load()
    } catch (_) { toast.error("Save failed") }
  }

  return (
    <div>
      <PageHeader title="Partners" subtitle="Clubs, Groups, Associations and Local Teams">
        <button className="btn btn-primary" onClick={() => { setSelected(null); setShowModal(true) }}>+ Add Partner</button>
      </PageHeader>

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

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {secretDeleteMode && (
                    <th style={{ width: 38, textAlign: 'center' }}>
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
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Status</th>
                  {secretDeleteMode && <th style={{ textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={secretDeleteMode ? 8 : 7}><EmptyState icon="🤝" title="No partners found" /></td></tr>
                  : items.map(p => {
                    const isSelected = selectedRowIds.includes(p.id);
                    return (
                      <tr
                        key={p.id}
                        style={{
                          backgroundColor: isSelected ? '#FEF2F2' : undefined,
                          cursor: secretDeleteMode ? 'pointer' : undefined
                        }}
                        onClick={() => secretDeleteMode && toggleSelectRow(p.id)}
                      >
                        {secretDeleteMode && (
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectRow(p.id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td className="td-mono">{p.partner_id}</td>
                        <td style={{ fontWeight: isSelected ? 700 : 500 }}>{p.organization_name}</td>
                        <td><span className="badge badge-blue">{p.partner_type}</span></td>
                        <td>{p.contact_person}</td>
                        <td>{p.phone}</td>
                        <td><StatusBadge status={p.status} /></td>
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
                              onClick={() => setDeleteConfirmModal({ open: true, items: [p] })}
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
      </div>
      {showModal && <PartnerModal initial={selected} onClose={() => { setShowModal(false); setSelected(null) }} onSave={handleSave} />}

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
              <strong>WARNING:</strong> This action is completely permanent and cannot be reversed. The selected partner(s) will be completely purged from the database.
            </div>

            <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8, fontWeight: 600 }}>
              Are you sure you want to delete the following {deleteConfirmModal.items.length === 1 ? 'partner' : `${deleteConfirmModal.items.length} partners`}?
            </p>

            <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#4B5563' }}>
              {deleteConfirmModal.items.map(it => (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{it.organization_name}</span> (ID: <span className="td-mono">{it.partner_id}</span>, Contact: {it.contact_person}, Phone: {it.phone})
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PartnerModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { organization_name:"", partner_type:"CLUB", contact_person:"", phone:"", email:"", address:"", notes:"", status:"ACTIVE" })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave(form); setSaving(false)
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={initial ? "Edit Partner" : "Add Partner"} size="modal-lg"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="partner-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
      <form id="partner-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          {[["organization_name","Organization Name",true],["contact_person","Contact Person",true],["phone","Phone",true],["email","Email",false]].map(([k,l,r])=>(
            <div className="form-group" key={k}><label className={`form-label${r?" required":""}`}>{l}</label>
              <input className="form-control" required={r} value={form[k]} onChange={e=>setForm(f=>({...f,[k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value}))} /></div>
          ))}
          <div className="form-group"><label className="form-label">Partner Type</label>
            <select className="form-control" value={form.partner_type} onChange={e=>setForm(f=>({...f,partner_type:e.target.value}))}>
              {["CLUB","GROUP","ASSOCIATION","LOCAL_TEAM","NGO","GOVERNMENT","OTHER"].map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              {["ACTIVE","INACTIVE","SUSPENDED"].map(s=><option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="form-group"><label className="form-label">Address</label>
          <textarea className="form-control" rows={2} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} /></div>
        <div className="form-group"><label className="form-label">Notes</label>
          <textarea className="form-control" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
      </form>
    </Modal>
  )
}
