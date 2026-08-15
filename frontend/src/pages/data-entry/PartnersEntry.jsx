// pages/data-entry/PartnersEntry.jsx — Register new partners/organisations
import React, { useState, useCallback, useEffect } from 'react'
import { managerApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, StatusBadge } from '../../components/shared'
import toast from 'react-hot-toast'

const PARTNER_TYPES = ['CLUB', 'GROUP', 'ASSOCIATION', 'LOCAL_TEAM', 'NGO', 'GOVERNMENT', 'OTHER']

const EMPTY_FORM = {
  organization_name: '',
  partner_type: 'CLUB',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  status: 'ACTIVE',
}

export default function PartnersEntry() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await managerApi.partners.list({ search })
      setItems(res.data.results || res.data)
    } catch { toast.error('Failed to load partners') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (form.phone && form.phone.length !== 10) return toast.error('Enter a valid 10-digit phone number')
    setSaving(true)
    try {
      await managerApi.partners.create(form)
      toast.success('Partner registered!')
      setShowModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault()
      const form = e.target.form
      const index = Array.prototype.indexOf.call(form, e.target)
      if (form.elements[index + 1]) {
        form.elements[index + 1].focus()
      }
    }
  }

  return (
    <div>
      <PageHeader title="🤝 Partners Entry" subtitle="Register new partner organisations, clubs and groups">
        <span className="badge badge-blue" style={{ fontSize: 13, padding: '6px 14px' }}>{items.length} Partners</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Partner</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>ID</th><th>Organisation</th><th>Type</th>
                <th>Contact Person</th><th>Phone</th><th>Status</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon="🤝" title="No partners registered" /></td></tr>
                  : items.map(p => (
                    <tr key={p.id}>
                      <td className="td-mono" style={{ fontSize: 11 }}>{p.partner_id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.organization_name}</div>
                        {p.email && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p.email}</div>}
                      </td>
                      <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{p.partner_type}</span></td>
                      <td>{p.contact_person || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.phone || '—'}</td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Register New Partner" size="modal-lg">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Organisation Name</label>
              <input className="form-control" required value={form.organization_name} onChange={e => setF('organization_name', e.target.value)} placeholder="Full organisation name" />
            </div>
            <div className="form-group">
              <label className="form-label">Partner Type</label>
              <select className="form-control" value={form.partner_type} onChange={e => setF('partner_type', e.target.value)}>
                {PARTNER_TYPES.map(t => <option key={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Contact Person</label>
              <input className="form-control" required value={form.contact_person} onChange={e => setF('contact_person', e.target.value)} placeholder="Primary contact name" />
            </div>
            <div className="form-group">
              <label className="form-label required">Phone</label>
              <input className="form-control" required value={form.phone} onChange={e => setF('phone', e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit number" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="contact@example.com" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} value={form.address} onChange={e => setF('address', e.target.value)} placeholder="Office address..." />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any notes about this partner..." />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Register Partner'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
