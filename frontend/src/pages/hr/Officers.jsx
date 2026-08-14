import React, { useState, useCallback, useEffect } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"
const init = { full_name:"", designation:"", department:"", employment_type:"FULL_TIME", phone:"", email:"", joining_date:format(new Date(),"yyyy-MM-dd"), status:"ACTIVE" }
export default function Officers() {
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
    try { const res = await hrApi.officers.list({search}); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search])
  useEffect(() => { load() }, [load])
  const handleSave = async (e) => {
    e.preventDefault();
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");
    
    setSaving(true)
    try {
      if (selected) await hrApi.officers.update(selected.id, form)
      else await hrApi.officers.create(form)
      toast.success("Saved."); setShowModal(false); load()
    } catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }
  return (
    <div>
      <PageHeader title="Executive Officers" subtitle="Staff and employees">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setForm(init);setShowModal(true)}}>+ Add Officer</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Emp ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Type</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="👨‍💼" title="No officers" /></td></tr>
                  : items.map(o=>(<tr key={o.id} onClick={()=>{setViewItem(o);setShowViewModal(true)}} style={{cursor: 'pointer'}} className="hover-row"><td className="td-mono">{o.employee_id}</td><td>{o.full_name}</td><td>{o.designation}</td><td>{o.department}</td><td><span className="badge badge-blue">{o.employment_type}</span></td><td>{o.joining_date ? format(new Date(o.joining_date),"dd MMM yyyy") : "-"}</td><td><span className={`badge ${o.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{o.status}</span></td><td><button className="btn btn-sm btn-secondary" onClick={(e)=>{e.stopPropagation(); setSelected(o);setForm({...o});setShowModal(true)}}>Edit</button></td></tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={selected?"Edit Officer":"Add Officer"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" form="off-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="off-form" onSubmit={handleSave}>
            <div className="form-grid-3">
              <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" required value={form.full_name} onChange={e=>F("full_name",e.target.value)} /></div>
              <div className="form-group"><label className="form-label required">Designation</label><input className="form-control" required value={form.designation} onChange={e=>F("designation",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={form.department} onChange={e=>F("department",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e=>F("phone",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>F("email",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Joining Date</label><input className="form-control" type="date" value={form.joining_date} onChange={e=>F("joining_date",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Employment Type</label><select className="form-control" value={form.employment_type} onChange={e=>F("employment_type",e.target.value)}>{["FULL_TIME","PART_TIME","CONTRACT","DAILY_WAGE"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>F("status",e.target.value)}>{["ACTIVE","INACTIVE","TERMINATED"].map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
          </form>
        </Modal>
      )}

      {/* Details View Modal */}
      {showViewModal && viewItem && (
        <Modal isOpen={true} onClose={()=>setShowViewModal(false)} title="Officer Details" size="modal-lg"
          footer={<>
            <button className="btn btn-secondary" onClick={()=>setShowViewModal(false)}>Close</button>
            <button className="btn btn-primary" onClick={() => {
              setShowViewModal(false);
              setSelected(viewItem);
              setForm({...viewItem});
              setShowModal(true);
            }}>Edit Officer</button>
          </>}>
          <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Emp ID</strong><div>{viewItem.employee_id || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Full Name</strong><div>{viewItem.full_name || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Designation</strong><div>{viewItem.designation || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Department</strong><div>{viewItem.department || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Phone</strong><div>{viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Email</strong><div>{viewItem.email || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Joining Date</strong><div>{viewItem.joining_date ? format(new Date(viewItem.joining_date), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Employment Type</strong><div><span className="badge badge-blue">{viewItem.employment_type || '-'}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Status</strong><div><span className={`badge ${viewItem.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{viewItem.status}</span></div></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
