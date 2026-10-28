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

  // Moderation state
  const [approvingId, setApprovingId] = useState(null)
  const [rejectingItem, setRejectingItem] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('Violation of community guidelines / unverified issue')
  const [rejecting, setRejecting] = useState(false)
  
  // Forward form state
  const [forwardCategory, setForwardCategory] = useState('OTHER')
  const [forwardPriority, setForwardPriority] = useState('NORMAL')
  const [forwarding, setForwarding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleApprove = async (item, e) => {
    if (e) e.stopPropagation()
    setApprovingId(item.id)
    try {
      const res = await coreApi.memberPosts.approve(item.id)
      toast.success(res.data?.message || 'Post approved and published to mobile app!')
      
      // Update state locally
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'APPROVED', rejection_reason: '' } : p))
      if (selectedItem?.id === item.id) {
        setSelectedItem(prev => ({ ...prev, status: 'APPROVED', rejection_reason: '' }))
      }
    } catch (err) {
      console.error('Approve post error:', err)
      toast.error(err.response?.data?.error || 'Failed to approve post')
    } finally {
      setApprovingId(null)
    }
  }

  const handleOpenReject = (item, e) => {
    if (e) e.stopPropagation()
    setRejectingItem(item)
    setRejectionReason('Violation of community guidelines / unverified issue')
  }

  const handleConfirmReject = async () => {
    if (!rejectingItem) return
    setRejecting(true)
    try {
      const res = await coreApi.memberPosts.reject(rejectingItem.id, { reason: rejectionReason })
      toast.success(res.data?.message || 'Post rejected and restricted from mobile app.')

      setItems(prev => prev.map(p => p.id === rejectingItem.id ? { ...p, status: 'REJECTED', rejection_reason: rejectionReason } : p))
      if (selectedItem?.id === rejectingItem.id) {
        setSelectedItem(prev => ({ ...prev, status: 'REJECTED', rejection_reason: rejectionReason }))
      }
      setRejectingItem(null)
    } catch (err) {
      console.error('Reject post error:', err)
      toast.error(err.response?.data?.error || 'Failed to reject post')
    } finally {
      setRejecting(false)
    }
  }

  const handleOpenDelete = (postOrId, e) => {
    if (e) e.stopPropagation()
    const item = typeof postOrId === 'object' && postOrId !== null
      ? postOrId
      : items.find(i => i.id === postOrId) || { id: postOrId }
    setPostToDelete(item)
  }

  const handleConfirmDelete = async () => {
    if (!postToDelete) return
    const id = postToDelete.id
    setIsDeleting(true)
    setDeletingId(id)
    try {
      await coreApi.memberPosts.delete(id)
      toast.success('Post deleted and removed from all mobile applications.')
      setItems(prev => prev.filter(item => item.id !== id))
      if (selectedItem?.id === id) {
        setSelectedItem(null)
      }
      setPostToDelete(null)
    } catch (err) {
      console.error('Delete post error:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete post. Please try again.'
      toast.error(errorMsg)
    } finally {
      setIsDeleting(false)
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

      setSelectedItem(prev => (prev && prev.id === targetPost.id ? {
        ...prev,
        status: 'FORWARDED_TO_FAO',
        assessment_request: newReqId,
        assessment_request_number: newReqNumber,
      } : prev))

      toast.success(res.data?.message || `Successfully forwarded to FAO as ${newReqNumber}!`)
      loadData()
    } catch (err) {
      console.error('Forward to FAO error:', err)
      toast.error(err.response?.data?.error || 'Failed to forward to FAO')
    } finally {
      setForwarding(false)
    }
  }

  const totalCount = items.length
  const pendingCount = items.filter(i => i.status === 'PENDING_APPROVAL' || i.status === 'OPEN').length
  const approvedCount = items.filter(i => i.status === 'APPROVED').length
  const forwardedCount = items.filter(i => i.status === 'FORWARDED_TO_FAO').length
  const rejectedCount = items.filter(i => i.status === 'REJECTED').length

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_APPROVAL':
      case 'OPEN':
        return (
          <span style={{ background: '#FEF3C7', color: '#B45309', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '3px', background: '#D97706', display: 'inline-block' }}></span>
            PENDING APPROVAL
          </span>
        )
      case 'APPROVED':
        return (
          <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>✅</span> APPROVED & LIVE
          </span>
        )
      case 'FORWARDED_TO_FAO':
        return (
          <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>🚀</span> WITH FAO
          </span>
        )
      case 'REJECTED':
        return (
          <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>⛔</span> REJECTED / RESTRICTED
          </span>
        )
      default:
        return (
          <span style={{ background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
            {status}
          </span>
        )
    }
  }

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <PageHeader
        title="Public Issues Moderation & Verification"
        subtitle="Review hardship posts uploaded by members, restrict fake violations, approve verified issues for mobile app publication, and route assistance to Field Assessment Officers"
      />

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Uploaded Issues" value={totalCount} icon="📢" variant="blue" />
        <StatCard label="Pending Approval" value={pendingCount} icon="⏳" variant={pendingCount > 0 ? "yellow" : "blue"} />
        <StatCard label="Approved & Published" value={approvedCount} icon="✅" variant="green" />
        <StatCard label="Forwarded to FAO" value={forwardedCount} icon="🚀" variant="blue" />
        <StatCard label="Rejected Violations" value={rejectedCount} icon="⛔" variant="red" />
      </div>

      {/* Filter Bar with Status Tabs */}
      <FilterBar search={search} onSearch={setSearch}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#fff', fontWeight: '600' }}
          >
            <option value="ALL">All Statuses ({totalCount})</option>
            <option value="PENDING_APPROVAL">Pending Approval ({pendingCount})</option>
            <option value="APPROVED">Approved & Published ({approvedCount})</option>
            <option value="FORWARDED_TO_FAO">Forwarded to FAO ({forwardedCount})</option>
            <option value="REJECTED">Rejected / Restricted ({rejectedCount})</option>
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
          message={search ? 'No issues matching your search criteria.' : 'No member issues found for the selected status.'}
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
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Media</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Moderation Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isPending = item.status === 'PENDING_APPROVAL' || item.status === 'OPEN'
                const isHovered = hoveredRowId === item.id
                const isApproving = approvingId === item.id

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
                      background: isHovered ? '#F0F9FF' : (isPending ? '#FEFDF8' : '#FFFFFF'),
                      transition: 'background-color 0.15s ease',
                    }}
                    title="Click row to view full details and moderation controls"
                  >
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      {item.created_at ? (
                        <div>
                          <div style={{ fontWeight: '600', color: '#0F172A', fontSize: '13px', lineHeight: 1.25 }}>
                            {format(new Date(item.created_at), 'dd MMM yyyy')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', fontWeight: '500' }}>
                            {format(new Date(item.created_at), 'hh:mm a')}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
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
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: item.post_type === 'CHARITY' ? '#FFF1F2' : '#F0F9FF',
                            color: item.post_type === 'CHARITY' ? '#E11D48' : '#0284C7',
                            border: `1px solid ${item.post_type === 'CHARITY' ? '#FECDD3' : '#BAE6FD'}`,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: '700',
                            marginTop: '3px',
                          }}>
                            {item.post_type === 'CHARITY' ? '💖 Charity' : '📢 Awareness'}
                          </span>
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
                      <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: item.images?.length > 0 ? '#EFF6FF' : '#F1F5F9',
                          color: item.images?.length > 0 ? '#0284C7' : '#64748B',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          📷 {item.images?.length || 0}
                        </span>
                        {item.video && (
                          <span style={{ background: '#F5F3FF', color: '#7C3AED', padding: '3px 6px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                            🎥
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {getStatusBadge(item.status)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        {isPending && (
                          <button
                            onClick={(e) => handleApprove(item, e)}
                            disabled={isApproving}
                            className="btn btn-sm"
                            style={{
                              background: '#16A34A',
                              color: '#fff',
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            title="Approve and publish to mobile app immediately"
                          >
                            {isApproving ? '...' : '✅ Approve'}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedItem(item)
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', fontWeight: '600' }}
                        >
                          View Details ➜
                        </button>
                        <button
                          onClick={(e) => handleOpenDelete(item, e)}
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
                          }}
                          title="Delete post and remove from all mobile applications"
                        >
                          {deletingId === item.id ? '...' : '🗑️'}
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

      {/* Full Details & Moderation Modal */}
      {selectedItem && (
        <Modal
          isOpen={true}
          title={`Public Issue Verification — #${selectedItem.id.slice(0, 8)}`}
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
                    Member: @{selectedItem.author?.username} • ID: {selectedItem.author?.member_id || selectedItem.author?.username} • Posted {selectedItem.created_at ? format(new Date(selectedItem.created_at), 'dd MMM yyyy, hh:mm a') : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  background: selectedItem.post_type === 'CHARITY' ? '#FFF1F2' : '#F0F9FF',
                  color: selectedItem.post_type === 'CHARITY' ? '#E11D48' : '#0284C7',
                  border: `1px solid ${selectedItem.post_type === 'CHARITY' ? '#FECDD3' : '#BAE6FD'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {selectedItem.post_type === 'CHARITY' ? '💖 Charity Post' : '📢 Awareness Post'}
                </span>
                {getStatusBadge(selectedItem.status)}
              </div>
            </div>

            {/* Moderation Warning if Rejected */}
            {selectedItem.status === 'REJECTED' && (
              <div style={{ padding: '12px 16px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', color: '#991B1B' }}>
                <strong>⛔ Post is currently REJECTED & Restricted:</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  Reason: {selectedItem.rejection_reason || 'Violation of community guidelines'}
                </div>
              </div>
            )}

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

            {/* Uploaded Photos Gallery */}
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

            {/* Uploaded Video */}
            {selectedItem.video && (
              <div style={{ padding: '14px', background: '#F5F3FF', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
                <strong style={{ fontSize: '12px', color: '#6D28D9', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  🎥 Attached Video Clip (30s)
                </strong>
                <video
                  src={selectedItem.video}
                  controls
                  style={{ width: '100%', maxHeight: '240px', borderRadius: '6px', background: '#000' }}
                />
              </div>
            )}

            {/* ── Social Media Moderation & Approval Controls ── */}
            <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️</span> Social Media Publication Decision
              </h4>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {selectedItem.status !== 'APPROVED' ? (
                  <button
                    onClick={() => handleApprove(selectedItem)}
                    disabled={approvingId === selectedItem.id}
                    className="btn"
                    style={{
                      flex: 1,
                      padding: '12px 18px',
                      background: '#16A34A',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {approvingId === selectedItem.id ? 'Approving...' : '✅ Approve & Publish to Mobile App'}
                  </button>
                ) : (
                  <div style={{ flex: 1, padding: '10px 14px', background: '#DCFCE7', borderRadius: '8px', border: '1px solid #86EFAC', color: '#15803D', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✅</span> Approved & Currently Live on Member App Feeds & Profiles
                  </div>
                )}

                {selectedItem.status !== 'REJECTED' && (
                  <button
                    onClick={() => handleOpenReject(selectedItem)}
                    className="btn"
                    style={{
                      padding: '12px 18px',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      fontWeight: '700',
                      fontSize: '13px',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      cursor: 'pointer'
                    }}
                  >
                    ⛔ Reject / Restrict (Fake/Violation)
                  </button>
                )}
              </div>

              {/* Forward to FAO Section */}
              <div style={{ paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#334155' }}>
                  🚀 Forward to Field Assessment Officer (FAO) Pipeline
                </h5>

                {selectedItem.status === 'FORWARDED_TO_FAO' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#DBEAFE', borderRadius: '8px', border: '1px solid #93C5FD' }}>
                    <div>
                      <div style={{ fontWeight: '700', color: '#1E40AF', fontSize: '13.5px' }}>
                        ✅ Forwarded to Field Assessment Officer (FAO)
                      </div>
                      <div style={{ fontSize: '12px', color: '#1E3A8A', marginTop: '2px' }}>
                        Assessment Request Number: <strong>{selectedItem.assessment_request_number || 'Created'}</strong>
                      </div>
                    </div>
                    {selectedItem.assessment_request && (
                      <Link
                        to={`/slt/entry/assessment/${selectedItem.assessment_request}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '12px', padding: '6px 12px', fontWeight: '700' }}
                      >
                        View in Assessment ➜
                      </Link>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                          CATEGORY
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
                          PRIORITY
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
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '6px'
                      }}
                    >
                      {forwarding ? 'Forwarding to FAO...' : 'Forward to FAO for Physical Verification'}
                    </button>
                  </div>
                )}
              </div>

              {/* Permanent Deletion */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', color: '#DC2626' }}>
                  Wipe this content permanently from database and storage
                </span>
                <button
                  onClick={() => handleOpenDelete(selectedItem)}
                  disabled={deletingId === selectedItem.id}
                  className="btn btn-sm"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    cursor: 'pointer',
                  }}
                >
                  {deletingId === selectedItem.id ? 'Deleting...' : '🗑️ Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Violation Modal */}
      {rejectingItem && (
        <Modal
          isOpen={true}
          title={`Reject Post — #${rejectingItem.id.slice(0, 8)}`}
          onClose={() => setRejectingItem(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              Are you sure you want to reject this post by <strong>@{rejectingItem.author?.username}</strong>?
              This will restrict the post from ever appearing in the mobile app feed or on their public profile.
            </p>

            <div className="form-group">
              <label className="form-label required">Select or Enter Reason for Rejection</label>
              <select
                className="form-control"
                style={{ marginBottom: '8px' }}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              >
                <option value="Violation of community guidelines / unverified issue">Violation of community guidelines</option>
                <option value="Fake or misleading information / photo mismatch">Fake or misleading information</option>
                <option value="Duplicate or spam posting">Duplicate or spam posting</option>
                <option value="Inappropriate language or offensive content">Inappropriate language / offensive content</option>
                <option value="Custom">Custom Reason (specified below)</option>
              </select>

              <textarea
                className="form-control"
                rows={3}
                placeholder="Specific violation details (logged to audit trail)..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectingItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#DC2626', color: '#fff', fontWeight: '700' }}
                disabled={rejecting}
                onClick={handleConfirmReject}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject & Restrict'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Styled Delete Confirmation Alert Modal */}
      {postToDelete && (
        <Modal
          isOpen={true}
          title="Delete Community Post"
          onClose={() => !isDeleting && setPostToDelete(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0
              }}>
                🗑️
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                  Are you sure you want to delete this community post?
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', lineHeight: '1.5' }}>
                  This will immediately remove the post, its photos, and comments from all member mobile applications.
                </p>
              </div>
            </div>

            {/* Post Summary Preview Box */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: '700', color: '#1E293B' }}>
                  {postToDelete.author?.full_name || postToDelete.author?.username || 'Community Member'}
                </span>
                <span style={{ color: '#64748B', fontSize: '11.5px' }}>
                  #{postToDelete.id ? postToDelete.id.slice(0, 8) : ''}
                </span>
              </div>
              {postToDelete.description && (
                <p style={{
                  margin: 0,
                  color: '#475569',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontStyle: 'italic'
                }}>
                  "{postToDelete.description}"
                </p>
              )}
            </div>

            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              color: '#991B1B'
            }}>
              <span>⚠️</span>
              <span><strong>Warning:</strong> This action is permanent and cannot be reversed.</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDeleting}
                onClick={() => setPostToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#DC2626',
                  color: '#fff',
                  fontWeight: '700',
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
                disabled={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting ? 'Deleting...' : '🗑️ Delete Permanently'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Enlarged Photo Modal */}
      {activePhoto && (
        <Modal
          isOpen={true}
          title="Attached Photo"
          onClose={() => setActivePhoto(null)}
          size="modal-lg"
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img
              src={activePhoto}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
