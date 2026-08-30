import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"
const init = { full_name:"", designation:"PRESIDENT", term_start:"", term_end:"", phone:"", email:"", status:"ACTIVE" }
export default function ExecMembers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))
  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await hrApi.execMembers.list({search}); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search])
  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])
  const handleSave = async (e) => {
    e.preventDefault();
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");
    
    setSaving(true)
    try {
      const payload = { ...form };
      if (!payload.appointment_date) payload.appointment_date = payload.term_start || format(new Date(), "yyyy-MM-dd");
      if (payload.term_end === "") payload.term_end = null;
      
      if (selected) await hrApi.execMembers.update(selected.id, payload)
      else await hrApi.execMembers.create(payload)
      toast.success("Saved."); setShowModal(false); load()
    } catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }
  return (
    <div>
      <PageHeader title="Executive Members" subtitle="Trust committee and board members">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setForm(init);setShowModal(true)}}>+ Add Exec Member</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Designation</th><th>Term Start</th><th>Term End</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="👔" title="No executive members" /></td></tr>
                  : items.map(m=>(<tr key={m.id} onClick={()=>{setViewItem(m);setShowViewModal(true)}} style={{cursor: 'pointer'}} className="hover-row"><td className="td-mono">{m.exec_id}</td><td>{m.full_name}</td><td><span className="badge badge-blue">{m.designation}</span></td><td>{m.term_start ? format(new Date(m.term_start),"MMM yyyy") : "-"}</td><td>{m.term_end ? format(new Date(m.term_end),"MMM yyyy") : "-"}</td><td>{m.phone}</td><td><span className={`badge ${m.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{m.status}</span></td><td><button className="btn btn-sm btn-secondary" onClick={(e)=>{e.stopPropagation(); setSelected(m);setForm({...m});setShowModal(true)}}>Edit</button></td></tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={selected?"Edit":"Add Exec Member"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" form="em-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="em-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label required">Name</label><input className="form-control" required value={form.full_name} onChange={e=>F("full_name",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Designation</label><select className="form-control" value={form.designation} onChange={e=>F("designation",e.target.value)}>{["PRESIDENT","VICE_PRESIDENT","SECRETARY","JOINT_SECRETARY","TREASURER","COMMITTEE_MEMBER"].map(d=><option key={d} value={d}>{d.replace('_', ' ')}</option>)}</select></div>
              <div className="form-group"><label className="form-label required">Phone</label><input className="form-control" required value={form.phone} onChange={e=>F("phone",e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>F("email",e.target.value)} /></div>
              <div className="form-group"><label className="form-label required">Term Start</label><input className="form-control" type="date" required value={form.term_start} onChange={e=>F("term_start",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Term End</label><input className="form-control" type="date" value={form.term_end || ''} onChange={e=>F("term_end",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>F("status",e.target.value)}>{["ACTIVE","INACTIVE"].map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
          </form>
        </Modal>
      )}

      {/* Details View Modal */}
      {showViewModal && viewItem && (
        <Modal isOpen={true} onClose={()=>setShowViewModal(false)} title="Executive Details" size="modal-lg"
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
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>ID</strong><div>{viewItem.exec_id || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Full Name</strong><div>{viewItem.full_name || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Designation</strong><div><span className="badge badge-blue">{viewItem.designation || '-'}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Phone</strong><div>{viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Email</strong><div>{viewItem.email || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Term Start</strong><div>{viewItem.term_start ? format(new Date(viewItem.term_start), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Term End</strong><div>{viewItem.term_end ? format(new Date(viewItem.term_end), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Status</strong><div><span className={`badge ${viewItem.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{viewItem.status}</span></div></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
