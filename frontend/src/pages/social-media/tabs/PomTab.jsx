import React, { useState, useEffect, useCallback } from 'react'
import { coreApi } from '../../../api'
import { LoadingState, EmptyState, Modal, ConfirmModal, FilterBar } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Handshake,
  Plus,
  RefreshCw,
  Pin,
  Trash2,
  User,
  Phone,
  MapPin,
  Calendar,
  Eye,
  MessageSquare,
  Archive,
  Send,
  Clock,
  AlertCircle
} from 'lucide-react'

const CATEGORY_MAP = {
  COMMUNITY_SUPPORT: { label: 'Community Support', badgeClass: 'badge-blue' },
  EMERGENCY_BLOOD: { label: 'Emergency & Blood', badgeClass: 'badge-red' },
  EDUCATION: { label: 'Education Assistance', badgeClass: 'badge-yellow' },
  DISASTER_RELIEF: { label: 'Disaster Relief Help', badgeClass: 'badge-red' },
  CIVIC: { label: 'Civic & Infrastructure', badgeClass: 'badge-green' },
  GENERAL: { label: 'General Trust Cooperation', badgeClass: 'badge-gray' },
}

export default function PomTab() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  // Create POM modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('COMMUNITY_SUPPORT')
  const [description, setDescription] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [targetLocation, setTargetLocation] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation modal state
  const [deletingPom, setDeletingPom] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (categoryFilter !== 'ALL') params.category = categoryFilter
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (search.trim()) params.search = search.trim()

      const res = await coreApi.pomMessages.list(params)
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setMessages(list)
    } catch (err) {
      console.error('Failed to load POM messages:', err)
      toast.error('Failed to load Public Cooperation Messages')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, statusFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMessages()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadMessages])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      toast.error('Please enter both title and description')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('category', category)
      formData.append('description', description.trim())
      if (contactPerson) formData.append('contact_person', contactPerson.trim())
      if (contactPhone) formData.append('contact_phone', contactPhone.trim())
      if (targetLocation) formData.append('target_location', targetLocation.trim())
      if (expiresAt) formData.append('expires_at', new Date(expiresAt).toISOString())
      formData.append('status', 'PUBLISHED')
      if (imageFile) {
        formData.append('image', imageFile)
      }

      await coreApi.pomMessages.create(formData)
      toast.success('Public Cooperation Message broadcasted successfully!')
      setIsModalOpen(false)
      // Reset
      setTitle('')
      setDescription('')
      setContactPerson('')
      setContactPhone('')
      setTargetLocation('')
      setExpiresAt('')
      setImageFile(null)
      loadMessages()
    } catch (err) {
      console.error('Create POM error:', err)
      toast.error(err.response?.data?.detail || 'Failed to create POM message')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTogglePin = async (item) => {
    try {
      await coreApi.pomMessages.update(item.id, { is_pinned: !item.is_pinned })
      toast.success(item.is_pinned ? 'Message unpinned' : 'Message pinned to top')
      loadMessages()
    } catch (err) {
      toast.error('Failed to update pin status')
    }
  }

  const handleChangeStatus = async (item, newStatus) => {
    try {
      await coreApi.pomMessages.update(item.id, { status: newStatus })
      toast.success(`Message marked as ${newStatus}`)
      loadMessages()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingPom) return
    setIsDeleting(true)
    try {
      await coreApi.pomMessages.delete(deletingPom.id)
      toast.success('Public cooperation (POM) message deleted successfully.')
      setMessages(prev => prev.filter(m => m.id !== deletingPom.id))
      setDeletingPom(null)
    } catch (err) {
      toast.error('Failed to delete message')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Control Header & Action Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search Public Cooperation Messages..."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setCategoryFilter('ALL'); setStatusFilter('ALL'); setSearch(''); }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            New POM Message
          </button>
        </div>
      </FilterBar>

      {/* Main POM Grid */}
      {loading ? (
        <div style={{ padding: '40px 0' }}>
          <LoadingState />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          title="No Public Cooperation Messages"
          message="Broadcast requests for community assistance, emergency blood donation, or civic cooperation by clicking 'New POM Message'."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {messages.map(item => {
            const catMeta = CATEGORY_MAP[item.category] || CATEGORY_MAP.GENERAL

            return (
              <div
                key={item.id}
                className="data-card"
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: item.is_pinned ? '1px solid var(--primary-500)' : '1px solid var(--gray-200)'
                }}
              >
                <div style={{ padding: '16px 20px' }}>
                  {/* Category and Pin Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className={`badge ${catMeta.badgeClass}`}>
                      {catMeta.label}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.is_pinned && (
                        <span className="badge badge-blue" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Pin size={10} /> PINNED
                        </span>
                      )}
                      {item.is_expired ? (
                        <span className="badge badge-red" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <AlertCircle size={10} /> EXPIRED
                        </span>
                      ) : (
                        <span className={`badge ${item.status === 'PUBLISHED' ? 'badge-green' : item.status === 'DRAFT' ? 'badge-yellow' : 'badge-gray'}`}>
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.4 }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: 'var(--gray-600)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </p>

                  {/* Contact & Location Info */}
                  <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)', padding: '10px 12px', fontSize: 12, color: 'var(--gray-700)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {item.contact_person && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={13} color="var(--gray-500)" />
                        <span><strong>Contact:</strong> {item.contact_person} {item.contact_phone && `(${item.contact_phone})`}</span>
                      </div>
                    )}
                    {item.target_location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={13} color="var(--gray-500)" />
                        <span><strong>Location:</strong> {item.target_location}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gray-500)' }}>
                      <Calendar size={13} />
                      <span>Published: {item.published_at ? format(new Date(item.published_at), 'dd MMM yyyy') : 'Recently'}</span>
                    </div>
                    {item.expires_at && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: item.is_expired ? 'var(--danger)' : '#b45309',
                        fontWeight: item.is_expired ? 700 : 500,
                        marginTop: 2
                      }}>
                        <Clock size={13} />
                        <span>
                          {item.is_expired ? 'Expired on: ' : 'Expires on: '}
                          {format(new Date(item.expires_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Stats & Actions */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, background: 'var(--white)' }}>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--gray-500)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={12} /> {item.views_count || 0}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageSquare size={12} /> {item.responses_count || 0}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(item)}
                      className="btn btn-secondary btn-sm"
                      title={item.is_pinned ? 'Unpin message' : 'Pin message'}
                    >
                      <Pin size={12} />
                      {item.is_pinned ? 'Unpin' : 'Pin'}
                    </button>

                    {item.status === 'PUBLISHED' ? (
                      <button
                        type="button"
                        onClick={() => handleChangeStatus(item, 'ARCHIVED')}
                        className="btn btn-secondary btn-sm"
                      >
                        <Archive size={12} />
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleChangeStatus(item, 'PUBLISHED')}
                        className="btn btn-success btn-sm"
                      >
                        Publish
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeletingPom(item)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                      title="Delete POM"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New POM Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          title="Create Public Cooperation Message (POM)"
          onClose={() => setIsModalOpen(false)}
          size="modal-md"
        >
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Message Title / Headline</label>
              <input
                type="text"
                required
                className="form-control"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Urgent: O+ Blood Needed at General Hospital"
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Location / District</label>
                <input
                  type="text"
                  className="form-control"
                  value={targetLocation}
                  onChange={e => setTargetLocation(e.target.value)}
                  placeholder="e.g. Kannur District"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Description & Instructions</label>
              <textarea
                rows={4}
                required
                className="form-control"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide detailed instructions on how volunteers and members can participate or offer help..."
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact Person</label>
                <input
                  type="text"
                  className="form-control"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  placeholder="e.g. Trust Coordinator"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Expiry Date & Time (Optional)</label>
              <input
                type="datetime-local"
                className="form-control"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>
                Optional deadline for this cooperation request. After this time, it automatically retires from the public mobile feed.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Attach Image (Optional)</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={e => setImageFile(e.target.files[0] || null)}
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                <Send size={14} />
                {isSubmitting ? 'Publishing...' : 'Broadcast POM Message'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Styled Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(deletingPom)}
        onClose={() => setDeletingPom(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Public Cooperation (POM)"
        message={
          deletingPom ? (
            <div>
              <span>Are you sure you want to delete POM </span>
              <strong style={{ color: 'var(--gray-900)' }}>"{deletingPom.title}"</strong>?
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.4 }}>
                This cooperation broadcast banner and its member responses will be permanently removed.
              </div>
            </div>
          ) : ''
        }
        confirmText={isDeleting ? 'Deleting...' : 'Delete POM'}
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  )
}
