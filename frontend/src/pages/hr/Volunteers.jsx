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
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await hrApi.volunteers.list({search}); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search])
  useEffect(() => { load() }, [load])

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
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Skills</th><th>Availability</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="🙋" title="No volunteers" /></td></tr>
                  : items.map(v=>(<tr key={v.id} onClick={()=>{setViewItem(v);setShowViewModal(true)}} style={{cursor: 'pointer'}} className="hover-row"><td className="td-mono">{v.volunteer_id}</td><td>{v.full_name}</td><td>{v.phone}</td><td>{v.skills}</td><td><span className="badge badge-blue">{v.availability}</span></td><td><span className={`badge ${v.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{v.status}</span></td><td><button className="btn btn-sm btn-secondary" onClick={(e)=>{e.stopPropagation(); setSelected(v);setForm({...v});setShowModal(true)}}>Edit</button></td></tr>))}
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
              <div className="form-group"><label className="form-label required">Phone</label><input className="form-control" required value={form.phone} onChange={e=>F("phone",e.target.value)} /></div>
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
    </div>
  )
}
