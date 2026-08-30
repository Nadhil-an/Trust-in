import React, { useState, useCallback, useEffect, useRef } from 'react'
import { coreApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  location: '',
  category: 'Upcoming',
  short_description: '',
  content: '',
}

export default function EventEntry() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const fileInputRef = useRef(null)

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
    return `${baseUrl}${url}`;
  };

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await coreApi.events.list({ search })
      setItems(res.data.results || res.data || [])
    } catch { toast.error('Failed to load events') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0])
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title) return toast.error('Enter an event title')
    if (!form.location) return toast.error('Enter a location')

    setSaving(true)
    try {
      const payload = { ...form }
      if (imageFile) {
        payload.image = imageFile
      }

      if (editingId) {
        await coreApi.events.update(editingId, payload)
        toast.success('Event updated successfully!')
      } else {
        await coreApi.events.create(payload)
        toast.success('Event published successfully!')
      }
      
      setShowModal(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
      setImageFile(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return
    try {
      await coreApi.events.delete(id)
      toast.success('Event deleted')
      load()
    } catch (err) {
      toast.error('Failed to delete event')
    }
  }

  const openNewModal = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setImageFile(null)
    setShowModal(true)
  }

  const handleEdit = (item) => {
    setForm({
      title: item.title,
      date: item.date,
      location: item.location,
      category: item.category,
      short_description: item.short_description,
      content: item.content,
    })
    setEditingId(item.id)
    setImageFile(null)
    setShowModal(true)
  }

  return (
    <div>
      <PageHeader title="📢 Events & News" subtitle="Publish and manage upcoming and past events">
        <button className="btn btn-primary" onClick={openNewModal}>+ Publish Event</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Cover</th><th>Date</th><th>Event Title</th><th>Location</th><th>Category</th>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon="📢" title="No events recorded" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td>
                        {i.image ? (
                          <img src={getImageUrl(i.image)} alt={i.title} style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <div style={{ width: 60, height: 40, backgroundColor: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>No Img</span>
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.date), 'dd MMM yyyy')}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{i.title}</td>
                      <td style={{ fontSize: 12 }}>{i.location}</td>
                      <td>
                        <span className={`badge ${i.category === 'Upcoming' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: 10 }}>
                          {i.category}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(i)}>Edit</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(i.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? "Edit Event" : "Publish Event"} size="modal-lg">
        <form onSubmit={handleSave}>
          
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Event Title</label>
              <input className="form-control" required value={form.title} onChange={e => setF('title', e.target.value)} placeholder="e.g. Tree Plantation Drive" />
            </div>
            
            <div className="form-group">
              <label className="form-label required">Date</label>
              <input type="date" className="form-control" required value={form.date} onChange={e => setF('date', e.target.value)} />
            </div>
            
            <div className="form-group">
              <label className="form-label required">Location</label>
              <input className="form-control" required value={form.location} onChange={e => setF('location', e.target.value)} placeholder="e.g. Kochi, Kerala" />
            </div>
            
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={form.category} onChange={e => setF('category', e.target.value)}>
                <option value="Upcoming">Upcoming</option>
                <option value="Past">Past</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Cover Image</label>
              <input 
                type="file" 
                className="form-control" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleImageChange} 
                style={{ padding: '8px' }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Short Summary</label>
              <input className="form-control" value={form.short_description} onChange={e => setF('short_description', e.target.value)} placeholder="Brief 1-line description of the event..." />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Full Details & Objectives</label>
              <textarea 
                className="form-control" 
                value={form.content} 
                onChange={e => setF('content', e.target.value)} 
                placeholder="Provide complete description and agenda..." 
                rows={4}
              />
            </div>
          </div>
          
          <div className="modal-footer" style={{ padding: 0, marginTop: 12, justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Publish Event')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
