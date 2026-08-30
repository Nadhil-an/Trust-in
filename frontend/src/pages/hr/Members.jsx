import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail, isPositiveNumber } from "../../utils/validators"

const init = { full_name:"", date_of_birth:"", gender:"MALE", phone:"", email:"", address:"", occupation:"", membership_type:"GENERAL", joining_date:format(new Date(),"yyyy-MM-dd"), monthly_fee:"100", status:"ACTIVE", blood_group:"", notes:"" }

export default function Members() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await hrApi.members.list({search}); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");
    if (form.monthly_fee && !isPositiveNumber(form.monthly_fee)) return toast.error("Fee must be positive");
    
    setSaving(true)
    try {
      if (selected) await hrApi.members.update(selected.id, form)
      else await hrApi.members.create(form)
      toast.success("Saved."); setShowModal(false); load()
    } catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Members" subtitle="Trust member management">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setForm(init);setShowModal(true)}}>+ Add Member</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member ID</th><th>Name</th><th>Phone</th><th>Type</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="👥" title="No members" /></td></tr>
                  : items.map(m=>(
                  <tr key={m.id} onClick={()=>{setViewItem(m);setShowViewModal(true)}} style={{cursor: 'pointer'}} className="hover-row">
                    <td className="td-mono">{m.member_id}</td>
                    <td>{m.full_name}</td>
                    <td>{m.phone}</td>
                    <td><span className="badge badge-blue">{m.membership_type}</span></td>
                    <td>{m.joining_date ? format(new Date(m.joining_date),"dd MMM yyyy") : "-"}</td>
                    <td><span className={`badge ${m.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{m.status}</span></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={(e)=>{e.stopPropagation(); setSelected(m);setForm({...m});setShowModal(true)}}>Edit</button></td>
                  </tr>
                ))}
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
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>F("status",e.target.value)}>{["ACTIVE","INACTIVE","SUSPENDED","DECEASED"].map(s=><option key={s}>{s}</option>)}</select></div>
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
            <button className="btn btn-primary" onClick={() => {
              setShowViewModal(false);
              setSelected(viewItem);
              setForm({...viewItem});
              setShowModal(true);
            }}>Edit Member</button>
          </>}>
          <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Member ID</strong><div>{viewItem.member_id || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Full Name</strong><div>{viewItem.full_name || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Phone</strong><div>{viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Email</strong><div>{viewItem.email || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Date of Birth</strong><div>{viewItem.date_of_birth ? format(new Date(viewItem.date_of_birth), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Gender</strong><div>{viewItem.gender || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Blood Group</strong><div>{viewItem.blood_group || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Membership Type</strong><div><span className="badge badge-blue">{viewItem.membership_type || '-'}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Joining Date</strong><div>{viewItem.joining_date ? format(new Date(viewItem.joining_date), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Monthly Fee (₹)</strong><div>{viewItem.monthly_fee || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Occupation</strong><div>{viewItem.occupation || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Status</strong><div><span className={`badge ${viewItem.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{viewItem.status}</span></div></div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Address</strong><div>{viewItem.address || '-'}</div></div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Notes</strong><div>{viewItem.notes || '-'}</div></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
