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

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await managerApi.partners.list({ search }); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    try {
      if (selected) await managerApi.partners.update(selected.id, form)
      else await managerApi.partners.create(form)
      toast.success("Saved."); setShowModal(false); setSelected(null); load()
    } catch (_) { toast.error("Save failed") }
  }

  return (
    <div>
      <PageHeader title="Partners" subtitle="Clubs, Groups, Associations and Local Teams" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Organization</th><th>Type</th><th>Contact</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={7}><EmptyState icon="🤝" title="No partners found" /></td></tr>
                  : items.map(p => (
                  <tr key={p.id}>
                    <td className="td-mono">{p.partner_id}</td>
                    <td>{p.organization_name}</td>
                    <td><span className="badge badge-blue">{p.partner_type}</span></td>
                    <td>{p.contact_person}</td>
                    <td>{p.phone}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && <PartnerModal initial={selected} onClose={() => { setShowModal(false); setSelected(null) }} onSave={handleSave} />}
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
