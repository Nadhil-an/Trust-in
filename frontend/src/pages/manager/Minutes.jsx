import React, { useState, useCallback, useEffect } from "react"
import { managerApi } from "../../api"
import { StatusBadge, LoadingState, EmptyState, PageHeader, FilterBar, Modal, ConfirmModal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function Minutes() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await managerApi.minutes.list({ search }); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async (form) => {
    try {
      if (selected) await managerApi.minutes.update(selected.id, form)
      else await managerApi.minutes.create(form)
      toast.success("Saved."); setShowModal(false); setSelected(null); load()
    } catch (_) { toast.error("Save failed") }
  }

  const executeDelete = async () => {
    if (!deleteConfirm) return
    try { await managerApi.minutes.delete(deleteConfirm); toast.success("Deleted."); load() }
    catch (_) { toast.error("Delete failed") }
    setDeleteConfirm(null)
  }

  return (
    <div>
      <PageHeader title="Minutes Registry" subtitle="Meeting records and decisions">
        <button className="btn btn-primary" onClick={() => { setSelected(null); setShowModal(true) }}>+ New Minutes</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Meeting ID</th><th>Title</th><th>Date</th><th>Type</th><th>Chairperson</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={7}><EmptyState icon="📝" title="No minutes found" /></td></tr>
                  : items.map(m => (
                  <tr key={m.id}>
                    <td className="td-mono">{m.meeting_id}</td>
                    <td>{m.title}</td>
                    <td>{m.meeting_date ? format(new Date(m.meeting_date), "dd MMM yyyy") : "-"}</td>
                    <td><span className="badge badge-blue">{m.meeting_type}</span></td>
                    <td>{m.chairperson}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setSelected(m); setShowModal(true) }}>Edit</button>
                      {" "}
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(m.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <MinutesModal initial={selected} onClose={() => { setShowModal(false); setSelected(null) }} onSave={handleSave} />
      )}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={executeDelete}
        title="Delete Minutes"
        message="Are you sure you want to delete this meeting minutes record? This action cannot be undone."
      />
    </div>
  )
}

function MinutesModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { title:"", meeting_date:"", meeting_type:"BOARD", location:"", chairperson:"", agenda:"", discussions:"", decisions:"" })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave(form); setSaving(false)
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={initial ? "Edit Minutes" : "New Meeting Minutes"} size="modal-lg"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="minutes-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
      <form id="minutes-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label required">Title</label>
            <input className="form-control" required value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label required">Meeting Date</label>
            <input className="form-control" type="date" required value={form.meeting_date} onChange={e => setForm(f=>({...f,meeting_date:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">Meeting Type</label>
            <select className="form-control" value={form.meeting_type} onChange={e => setForm(f=>({...f,meeting_type:e.target.value}))}>
              {["BOARD","GENERAL","COMMITTEE","EMERGENCY","ANNUAL","OTHER"].map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Location</label>
            <input className="form-control" value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label required">Chairperson</label>
            <input className="form-control" required value={form.chairperson} onChange={e => setForm(f=>({...f,chairperson:e.target.value}))} /></div>
        </div>
        <div className="form-group"><label className="form-label required">Agenda</label>
          <textarea className="form-control" rows={3} required value={form.agenda} onChange={e => setForm(f=>({...f,agenda:e.target.value}))} /></div>
        <div className="form-group"><label className="form-label">Discussions</label>
          <textarea className="form-control" rows={3} value={form.discussions} onChange={e => setForm(f=>({...f,discussions:e.target.value}))} /></div>
        <div className="form-group"><label className="form-label">Decisions</label>
          <textarea className="form-control" rows={3} value={form.decisions} onChange={e => setForm(f=>({...f,decisions:e.target.value}))} /></div>
      </form>
    </Modal>
  )
}
