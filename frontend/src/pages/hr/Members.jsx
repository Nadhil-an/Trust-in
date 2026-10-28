import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail, isPositiveNumber } from "../../utils/validators"

const init = { full_name:"", date_of_birth:"", gender:"MALE", phone:"", email:"", address:"", occupation:"", membership_type:"GENERAL", joining_date:format(new Date(),"yyyy-MM-dd"), monthly_fee:"100", status:"ACTIVE", blood_group:"", notes:"", password:"", username:"" }

export default function Members() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // Secret Permanent Deletion Mode (Ctrl + Shift + Q)
  const [secretDeleteMode, setSecretDeleteMode] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState([])
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, items: [] })
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const res = await hrApi.members.list(params)
      setItems(res.data.results || res.data)
    }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, statusFilter])

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
        await hrApi.members.delete(item.id);
      }
      toast.success(
        itemsToDelete.length === 1
          ? `Member "${itemsToDelete[0].full_name}" permanently deleted from database.`
          : `${itemsToDelete.length} members permanently deleted from database.`
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

  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");
    if (form.monthly_fee && !isPositiveNumber(form.monthly_fee)) return toast.error("Fee must be positive");
    if (form.password && form.password.trim().length < 6) return toast.error("Password must be at least 6 characters");
    
    setSaving(true);
    try {
      const payload = { ...form };

      // Clean read-only & computed metadata fields so server validation never rejects them
      delete payload.id;
      delete payload.member_id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.created_by;
      delete payload.role;
      delete payload.is_phone_signup;
      delete payload.valid_upto;
      delete payload.days_left;
      delete payload.is_expired;
      delete payload.receipts;

      if (typeof payload.photo === 'string') delete payload.photo;
      if (typeof payload.document === 'string') delete payload.document;
      if (!payload.date_of_birth) payload.date_of_birth = null;
      if (!payload.email || !payload.email.trim()) payload.email = '';

      const hasPassword = Boolean(payload.password && payload.password.trim());
      const newPassword = hasPassword ? payload.password.trim() : null;

      if (!hasPassword) {
        delete payload.password;
      }

      if (selected) {
        // Update member record details
        await hrApi.members.update(selected.id, payload);

        // Explicitly guarantee password reset on member's linked user account
        if (newPassword) {
          await hrApi.members.resetPassword(selected.id, {
            password: newPassword,
            username: payload.username || undefined,
          });
        }
      } else {
        await hrApi.members.create(payload);
      }

      toast.success(
        selected
          ? (newPassword ? "Member updated & password reset successfully!" : "Member updated successfully.")
          : "Member added successfully."
      );
      setShowModal(false);
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 
                  err.response?.data?.detail || 
                  (err.response?.data && typeof err.response.data === 'object'
                    ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(', ')
                    : null) || 
                  err.message || 
                  "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Members" subtitle="Trust member management">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setForm(init);setShowPassword(false);setShowModal(true)}}>+ Add Member</button>
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
              <span style={{ fontSize: 24 }}>🚨</span>
              <div>
                <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.88rem', letterSpacing: '0.5px' }}>
                  SECRET PERMANENT DELETION MODE (Press Ctrl+Shift+Q to exit)
                </div>
                <div style={{ color: '#B91C1C', fontSize: '0.78rem', marginTop: 2 }}>
                  Select row lines with checkboxes or click individual "Delete" buttons to permanently purge them from the database.
                </div>
              </div>
            </div>
            {selectedRowIds.length > 0 && (
              <button
                className="btn btn-sm"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: 6,
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
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

        <FilterBar search={search} onSearch={setSearch}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>
              Status:
            </label>
            <select
              className="form-control"
              style={{ width: '150px', padding: '0.4rem 0.6rem', fontSize: '0.875rem' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </FilterBar>
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
                  <th>Member ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Joining Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={secretDeleteMode ? 9 : 8}><EmptyState icon="👥" title="No members" /></td></tr>
                  : items.map(m=>{
                    const isRowSelected = selectedRowIds.includes(m.id);
                    return (
                      <tr
                        key={m.id}
                        onClick={()=>{
                          if (secretDeleteMode) {
                            toggleSelectRow(m.id);
                          } else {
                            setViewItem(m);
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
                              onChange={(e) => toggleSelectRow(m.id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td className="td-mono">{m.member_id}</td>
                        <td style={{ fontWeight: isRowSelected ? 700 : 600 }}>
                          {m.full_name}
                          {m.is_phone_signup && (
                            <span className="badge badge-purple" style={{ fontSize: 9, marginLeft: 6, padding: '2px 5px' }}>📱 Mobile</span>
                          )}
                        </td>
                        <td>{m.phone || '-'}</td>
                        <td>
                          <span className="badge badge-indigo" style={{ fontWeight: 700, fontSize: 10 }}>
                            {m.role || 'MEMBER'}
                          </span>
                        </td>
                        <td><span className="badge badge-blue">{m.membership_type || 'GENERAL'}</span></td>
                        <td>{m.joining_date ? format(new Date(m.joining_date),"dd MMM yyyy") : "-"}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className={`badge ${m.status==="ACTIVE"?"badge-green":m.status==="EXPIRED"?"badge-red":"badge-gray"}`}>
                              {m.status}
                            </span>
                            {m.valid_upto && (
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 500,
                                color: m.status === 'EXPIRED' ? '#dc2626' : '#6b7280',
                                marginTop: '3px',
                                whiteSpace: 'nowrap'
                              }}>
                                {m.membership_type === 'LIFE' || m.membership_type === 'HONORARY' || m.membership_type === 'PATRON'
                                  ? 'Lifetime'
                                  : m.status === 'EXPIRED'
                                    ? `Expired: ${m.valid_upto}`
                                    : `Valid: ${m.valid_upto}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={(e)=>{
                                e.stopPropagation();
                                setSelected(m);
                                setForm({...m, username: m.username || m.phone || m.member_id || "", password:""});
                                setShowPassword(false);
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
                                  setDeleteConfirmModal({ open: true, items: [m] });
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
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={selected?"Edit Member":"Add Member"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="member-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="member-form" onSubmit={handleSave}>
            <div className="form-grid-3">
              <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" required value={form.full_name} onChange={e=>F("full_name",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Date of Birth</label><input className="form-control" type="date" value={form.date_of_birth} onChange={e=>F("date_of_birth",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Gender</label><select className="form-control" value={form.gender} onChange={e=>F("gender",e.target.value)}>{["MALE","FEMALE","OTHER"].map(g=><option key={g}>{g}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Phone</label><input className="form-control" required value={form.phone} onChange={e=>F("phone",e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>F("email",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Blood Group</label><select className="form-control" value={form.blood_group} onChange={e=>F("blood_group",e.target.value)}><option value="">Select</option>{["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(g=><option key={g}>{g}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Membership Type</label><select className="form-control" value={form.membership_type} onChange={e=>F("membership_type",e.target.value)}>{["GENERAL","LIFE","HONORARY","PATRON","ASSOCIATE"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Joining Date</label><input className="form-control" type="date" required value={form.joining_date} onChange={e=>F("joining_date",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Monthly Fee (₹)</label><input className="form-control" type="number" value={form.monthly_fee} onChange={e=>F("monthly_fee",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Occupation</label><input className="form-control" value={form.occupation} onChange={e=>F("occupation",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>F("status",e.target.value)}>{["ACTIVE","EXPIRED","INACTIVE","SUSPENDED","DECEASED"].map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Username</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#6b7280' }}>
                    (Login ID)
                  </span>
                </label>
                <input
                  className="form-control td-mono"
                  value={form.username || ""}
                  onChange={e => F("username", e.target.value.trim())}
                  placeholder="e.g. 9400883082"
                />
                <small style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: '3px', display: 'block' }}>
                  Login ID for mobile & web dashboard.
                </small>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 3' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{selected ? "Reset Password" : "Login Password"}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#6b7280' }}>
                    {selected ? "(Leave blank to keep existing password)" : "(Optional — min 6 chars)"}
                  </span>
                </label>
                <div style={{ position: 'relative', maxWidth: '420px' }}>
                  <input
                    className="form-control"
                    type={showPassword ? "text" : "password"}
                    value={form.password || ""}
                    onChange={e => F("password", e.target.value)}
                    placeholder={selected ? "Enter new password to reset login" : "Min 6 characters"}
                    minLength={6}
                    style={{ paddingRight: 40 }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280',
                      fontSize: '14px',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
                <small style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: '3px', display: 'block' }}>
                  Once saved, the password will be securely updated in the database server for this member.
                </small>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Address</label><textarea className="form-control" rows={2} value={form.address} onChange={e=>F("address",e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e=>F("notes",e.target.value)} /></div>
          </form>
        </Modal>
      )}

      {/* Details View Modal */}
      {showViewModal && viewItem && (
        <Modal isOpen={true} onClose={()=>setShowViewModal(false)} title="Member Details" size="modal-lg"
          footer={<>
            <button className="btn btn-secondary" onClick={()=>setShowViewModal(false)}>Close</button>
            {secretDeleteMode && (
              <button
                className="btn btn-sm"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: 6,
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
            <button className="btn btn-primary" onClick={() => {
              setShowViewModal(false);
              setSelected(viewItem);
              setForm({...viewItem, username: viewItem.username || viewItem.phone || viewItem.member_id || "", password: ""});
              setShowPassword(false);
              setShowModal(true);
            }}>Edit Member</button>
          </>}>
          <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Member / Login ID</strong><div className="td-mono">{viewItem.member_id || viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Full Name</strong><div>{viewItem.full_name || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Phone</strong><div>{viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Email</strong><div>{viewItem.email || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Date of Birth</strong><div>{viewItem.date_of_birth ? format(new Date(viewItem.date_of_birth), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Gender</strong><div>{viewItem.gender || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Blood Group</strong><div>{viewItem.blood_group || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Membership Type</strong><div><span className="badge badge-blue">{viewItem.membership_type || '-'}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Joining Date</strong><div>{viewItem.joining_date ? format(new Date(viewItem.joining_date), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Monthly Fee (₹)</strong><div>{viewItem.monthly_fee || '-'}</div></div>
            <div>
              <strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Status & Validity</strong>
              <div>
                <span className={`badge ${viewItem.status==="ACTIVE"?"badge-green":viewItem.status==="EXPIRED"?"badge-red":"badge-gray"}`}>
                  {viewItem.status}
                </span>
                {viewItem.valid_upto && (
                  <span style={{ display:'block', fontSize: '0.75rem', marginTop: '4px', color: viewItem.status === 'EXPIRED' ? '#dc2626' : '#4b5563', fontWeight: 500 }}>
                    {viewItem.membership_type === 'LIFE' || viewItem.membership_type === 'HONORARY' || viewItem.membership_type === 'PATRON'
                      ? 'Lifetime'
                      : viewItem.status === 'EXPIRED'
                        ? `Expired: ${viewItem.valid_upto}`
                        : `Valid until ${viewItem.valid_upto}`}
                  </span>
                )}
              </div>
            </div>
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
              <strong>WARNING:</strong> This action is completely permanent and cannot be reversed. The selected record(s) and their linked authentication credentials, receipts, and documents will be completely deleted from the database.
            </div>

            <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8, fontWeight: 600 }}>
              Are you sure you want to delete the following {deleteConfirmModal.items.length === 1 ? 'member' : `${deleteConfirmModal.items.length} members`}?
            </p>

            <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#4B5563' }}>
              {deleteConfirmModal.items.map(it => (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{it.full_name}</span> (ID: <span className="td-mono">{it.member_id}</span>, Phone: {it.phone})
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
