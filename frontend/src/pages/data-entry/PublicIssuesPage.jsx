import React, { useState, useEffect, useCallback } from 'react'
import { coreApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, StatCard } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

const CATEGORIES = [
  { value: 'OTHER', label: 'Other / General Assistance' },
  { value: 'MEDICAL', label: 'Medical Assistance' },
  { value: 'HOUSING', label: 'Housing / Construction' },
  { value: 'FOOD', label: 'Food Assistance' },
  { value: 'EDUCATION', label: 'Education Assistance' },
  { value: 'LIVELIHOOD', label: 'Livelihood Support' },
  { value: 'DISABILITY', label: 'Disability Support' },
  { value: 'ELDERLY', label: 'Elderly Care' },
]

const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'LOW', label: 'Low' },
]

export default function PublicIssuesPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedItem, setSelectedItem] = useState(null)
  const [activePhoto, setActivePhoto] = useState(null)
  const [hoveredRowId, setHoveredRowId] = useState(null)
  
  // Forward form state
  const [forwardCategory, setForwardCategory] = useState('OTHER')
  const [forwardPriority, setForwardPriority] = useState('NORMAL')
  const [forwarding, setForwarding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search && search.trim()) params.search = search.trim()
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter

      const res = await coreApi.memberPosts.list(params)
      const dataList = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setItems(dataList)
    } catch (err) {
      console.error('Failed to load public issues:', err)
      toast.error('Failed to load public issues')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDeletePost = async (id, e) => {
    if (e) e.stopPropagation()
    const confirmed = window.confirm(
      'Are you sure you want to delete this community post?\n\nThis will immediately remove the post, its photos, and comments from all member mobile applications.'
    )
    if (!confirmed) return

    setDeletingId(id)
    try {
      await coreApi.memberPosts.delete(id)
      toast.success('Post deleted and removed from all mobile applications.')
      setItems(prev => prev.filter(item => item.id !== id))
      if (selectedItem?.id === id) {
        setSelectedItem(null)
      }
    } catch (err) {
      console.error('Delete post error:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete post. Please try again.'
      toast.error(errorMsg)
    } finally {
      setDeletingId(null)
    }
  }

  const handleForwardToFao = async (targetPost = selectedItem) => {
    if (!targetPost || forwarding) return
    setForwarding(true)
    try {
      const res = await coreApi.memberPosts.forwardToFao(targetPost.id, {
        category: forwardCategory,
        priority: forwardPriority,
      })
      
      const newReqNumber = res.data?.request_number || 'WITH FAO'
      const newReqId = res.data?.assessment_request_id || null

      // 1. INSTANT optimistic state update for table rows (NO page refresh needed!)
      setItems(prevItems => prevItems.map(p => {
        if (p.id === targetPost.id) {
          return {
            ...p,
            status: 'FORWARDED_TO_FAO',
            assessment_request: newReqId,
            assessment_request_number: newReqNumber,
          }
        }
        return p
      }))

      // 2. INSTANT optimistic state update for active details modal
      setSelectedItem(prev => (prev && prev.id === targetPost.id ? {
        ...prev,
        status: 'FORWARDED_TO_FAO',
        assessment_request: newReqId,
        assessment_request_number: newReqNumber,
      } : prev))

      toast.success(res.data?.message || `Successfully forwarded to FAO as ${newReqNumber}!`)

      // Sync silently in background
      loadData()
    } catch (err) {
      console.error('Forward to FAO error:', err)
      toast.error(err.response?.data?.error || 'Failed to forward to FAO')
    } finally {
      setForwarding(false)
    }
  }

  const totalCount = items.length
  const openCount = items.filter(i => i.status === 'OPEN').length
  const forwardedCount = items.filter(i => i.status === 'FORWARDED_TO_FAO').length

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <PageHeader
        title="Public Issues & Help Requests"
        subtitle="Review community hardship problems posted by members and route them to Field Assessment Officers"
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Reported Issues" value={totalCount} icon="📢" variant="blue" />
        <StatCard label="Pending / Open" value={openCount} icon="⏳" variant="yellow" />
        <StatCard label="Forwarded to FAO" value={forwardedCount} icon="✅" variant="green" />
      </div>

      {/* Filter Bar */}
      <FilterBar search={search} onSearch={setSearch}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#fff' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="FORWARDED_TO_FAO">Forwarded to FAO</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </FilterBar>

      {/* Issues Table */}
      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No Public Issues Found"
          message={search ? 'No issues matching your search criteria.' : 'No member issues have been reported yet.'}
        />
      ) : (
        <div className="table-responsive" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 16px' }}>Date & Time</th>
                <th style={{ padding: '14px 16px' }}>Reported By</th>
                <th style={{ padding: '14px 16px' }}>Contact</th>
                <th style={{ padding: '14px 16px' }}>Location / Address</th>
                <th style={{ padding: '14px 16px' }}>Description Preview</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Photos</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isOpen = item.status === 'OPEN'
                const isForwarded = item.status === 'FORWARDED_TO_FAO'
                const isHovered = hoveredRowId === item.id
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    onMouseEnter={() => setHoveredRowId(item.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      fontSize: '13px',
                      cursor: 'pointer',
                      background: isHovered ? '#F0F9FF' : '#FFFFFF',
                      transition: 'background-color 0.15s ease',
                    }}
                    title="Click row to view full details and forward to FAO"
                  >
                    <td style={{ padding: '14px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {item.created_at ? format(new Date(item.created_at), 'dd MMM yyyy, hh:mm a') : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.author?.photo ? (
                          <img
                            src={item.author.photo}
                            alt=""
                            style={{ width: '32px', height: '32px', borderRadius: '16px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {(item.author?.full_name || item.author?.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: '#0F172A' }}>{item.author?.full_name || item.author?.username}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>@{item.author?.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {item.contact_number ? (
                        <a
                          href={`tel:${item.contact_number}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: '#0284C7', textDecoration: 'none', fontWeight: '600' }}
                        >
                          📞 {item.contact_number}
                        </a>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.address ? `📍 ${item.address}` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.description}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: item.images?.length > 0 ? '#EFF6FF' : '#F1F5F9',
                        color: item.images?.length > 0 ? '#0284C7' : '#64748B',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        📷 {item.images?.length || 0}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {isOpen ? (
                        <span style={{ background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                          ⏳ OPEN
                        </span>
                      ) : isForwarded ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>
                            WITH FAO
                          </span>
                          {item.assessment_request_number && (
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0284C7' }}>
                              {item.assessment_request_number}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedItem(item)
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', fontWeight: '600' }}
                        >
                          {isOpen ? 'View & Forward ➜' : 'View Details ➜'}
                        </button>
                        <button
                          onClick={(e) => handleDeletePost(item.id, e)}
                          disabled={deletingId === item.id}
                          className="btn btn-sm"
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Delete post and remove from all mobile applications"
                        >
                          {deletingId === item.id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Details & Forward Modal */}
      {selectedItem && (
        <Modal
          isOpen={true}
          title={`Public Issue Details — #${selectedItem.id.slice(0, 8)}`}
          onClose={() => setSelectedItem(null)}
          size="modal-lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Member Profile Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedItem.author?.photo ? (
                  <img
                    src={selectedItem.author.photo}
                    alt=""
                    style={{ width: '48px', height: '48px', borderRadius: '24px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                    {(selectedItem.author?.full_name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 style={{ margin: 0, color: '#0F172A', fontSize: '16px', fontWeight: '700' }}>{selectedItem.author?.full_name}</h4>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Member: @{selectedItem.author?.username} • Posted {selectedItem.created_at ? format(new Date(selectedItem.created_at), 'dd MMM yyyy, hh:mm a') : ''}
                  </div>
                </div>
              </div>

              <div>
                {selectedItem.status === 'OPEN' ? (
                  <span style={{ background: '#FEF3C7', color: '#B45309', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                    ⏳ OPEN FOR ACTION
                  </span>
                ) : (
                  <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                    ✅ {selectedItem.status}
                  </span>
                )}
              </div>
            </div>

            {/* Contact & Address Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ padding: '12px 14px', background: '#F0F9FF', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
                <div style={{ fontSize: '11px', color: '#0369A1', fontWeight: '700', textTransform: 'uppercase' }}>Contact Number</div>
                <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                  {selectedItem.contact_number ? (
                    <a href={`tel:${selectedItem.contact_number}`} style={{ color: '#0284C7', textDecoration: 'none' }}>
                      📞 {selectedItem.contact_number}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', color: '#15803D', fontWeight: '700', textTransform: 'uppercase' }}>Address / Location</div>
                <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
                  📍 {selectedItem.address || 'Not provided'}
                </div>
              </div>
            </div>

            {/* Issue Description */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Problem Description
              </label>
              <div style={{ padding: '14px 16px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#1E293B', lineHeight: '1.6', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                {selectedItem.description}
              </div>
            </div>

            {/* Uploaded Photos Gallery (up to 10) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                  Uploaded Photos ({selectedItem.images?.length || 0})
                </label>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Click any image to enlarge</span>
              </div>

              {(!selectedItem.images || selectedItem.images.length === 0) ? (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', border: '1px dashed #CBD5E1' }}>
                  No photos uploaded with this post.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                  {selectedItem.images.map((img, i) => (
                    <div
                      key={img.id || i}
                      onClick={() => setActivePhoto(img.image)}
                      style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0', cursor: 'pointer', background: '#F1F5F9' }}
                    >
                      <img
                        src={img.image}
                        alt={`Photo ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        #{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Forward to FAO Section */}
            <div style={{ marginTop: '10px', padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🚀</span> Assessment Pipeline Action
              </h4>

              {selectedItem.status === 'FORWARDED_TO_FAO' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: '#DCFCE7', borderRadius: '8px', border: '1px solid #86EFAC', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#15803D', fontSize: '14px' }}>
                      ✅ Already Forwarded to Field Assessment Officer (FAO)
                    </div>
                    <div style={{ fontSize: '13px', color: '#166534', marginTop: '3px' }}>
                      Assessment Request Number: <strong>{selectedItem.assessment_request_number || 'Created'}</strong>
                    </div>
                  </div>
                  {selectedItem.assessment_request && (
                    <Link
                      to={`/slt/entry/assessment/${selectedItem.assessment_request}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '12px', padding: '8px 14px', fontWeight: '700' }}
                    >
                      View in Assessment ➜
                    </Link>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#64748B', lineHeight: '1.5' }}>
                    Forwarding will create an official <strong>Assessment Request</strong> with status <code>WITH_FAO</code>, transfer all uploaded photos to the assessment record, and notify Field Assessment Officers for verification.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                        ASSESSMENT CATEGORY
                      </label>
                      <select
                        value={forwardCategory}
                        onChange={(e) => setForwardCategory(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#fff' }}
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                        PRIORITY LEVEL
                      </label>
                      <select
                        value={forwardPriority}
                        onChange={(e) => setForwardPriority(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#fff' }}
                      >
                        {PRIORITIES.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleForwardToFao(selectedItem)}
                    disabled={forwarding}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    {forwarding ? 'Forwarding to FAO...' : 'Forward to FAO (Field Assessment Officer)'}
                  </button>
                </div>
              )}

              {/* Delete / Violation Control Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#991B1B' }}>Content Violation / Deletion Control</div>
                  <div style={{ fontSize: '12px', color: '#B91C1C' }}>
                    Deleting this post will immediately wipe it from all member mobile applications and feeds.
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePost(selectedItem.id)}
                  disabled={deletingId === selectedItem.id}
                  className="btn btn-sm"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    backgroundColor: '#DC2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deletingId === selectedItem.id ? 'Deleting...' : '🗑️ Delete Post from Mobile App'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Lightbox / Zoom Modal for individual photo */}
      {activePhoto && (
        <Modal
          isOpen={true}
          title="Photo Preview"
          onClose={() => setActivePhoto(null)}
          size="modal-lg"
        >
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <img
              src={activePhoto}
              alt="Enlarged preview"
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
