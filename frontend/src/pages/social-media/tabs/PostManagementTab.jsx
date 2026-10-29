import React, { useState, useEffect, useCallback } from 'react'
import { coreApi } from '../../../api'
import { LoadingState, EmptyState, Modal, FilterBar, StatusBadge } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Eye, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

export default function PostManagementTab() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  // Action states
  const [approvingId, setApprovingId] = useState(null)
  const [rejectingItem, setRejectingItem] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [activePhoto, setActivePhoto] = useState(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (categoryFilter !== 'ALL') params.post_category = categoryFilter
      if (search.trim()) params.search = search.trim()

      const res = await coreApi.memberPosts.list(params)
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setPosts(list)
    } catch (err) {
      console.error('Failed to load posts:', err)
      toast.error('Failed to load posts queue')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, statusFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPosts()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadPosts])

  const handleApprove = async (post, e) => {
    if (e) e.stopPropagation()
    setApprovingId(post.id)
    try {
      const res = await coreApi.memberPosts.approve(post.id)
      toast.success(res.data?.message || 'Post approved and published!')
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'APPROVED' } : p))
      if (selectedPost?.id === post.id) {
        setSelectedPost(prev => ({ ...prev, status: 'APPROVED' }))
      }
    } catch (err) {
      console.error('Approve post error:', err)
      toast.error(err.response?.data?.error || 'Failed to approve post')
    } finally {
      setApprovingId(null)
    }
  }

  const handleOpenReject = (post, e) => {
    if (e) e.stopPropagation()
    setRejectingItem(post)
    setRejectionReason('Violation of community guidelines / unverified issue')
  }

  const handleConfirmReject = async () => {
    if (!rejectingItem) return
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason')
      return
    }
    setRejecting(true)
    try {
      const res = await coreApi.memberPosts.reject(rejectingItem.id, { reason: rejectionReason.trim() })
      toast.success(res.data?.message || 'Post rejected.')
      setPosts(prev => prev.map(p => p.id === rejectingItem.id ? { ...p, status: 'REJECTED', rejection_reason: rejectionReason } : p))
      if (selectedPost?.id === rejectingItem.id) {
        setSelectedPost(prev => ({ ...prev, status: 'REJECTED', rejection_reason: rejectionReason }))
      }
      setRejectingItem(null)
    } catch (err) {
      console.error('Reject post error:', err)
      toast.error(err.response?.data?.error || 'Failed to reject post')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard Filter Bar */}
      <FilterBar search={search} onSearch={setSearch}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Categories</option>
            <option value="PUBLIC">Public Posts</option>
            <option value="SELF">Self Posts</option>
            <option value="OFFICIAL_TRUST">Official Trust</option>
          </select>

          <select
            className="form-control"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Review</option>
            <option value="APPROVED">Approved & Live</option>
            <option value="FORWARDED_TO_FAO">Forwarded to FAO</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setSearch(''); setCategoryFilter('ALL'); setStatusFilter('ALL'); }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}
        </div>
      </FilterBar>

      {/* Main Posts Data Card */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Post Moderation Queue
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {posts.length} Posts
            </span>
          </div>
          <div className="data-card-actions">
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Showing {posts.length} content submissions
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="No Posts Found"
            message="No posts match your category, status or search filters."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Author</th>
                  <th style={{ width: '35%' }}>Content Snippet</th>
                  <th style={{ width: '12%' }}>Category</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => {
                  const isPending = post.status === 'PENDING_APPROVAL'
                  return (
                    <tr key={post.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'var(--primary-100)',
                            color: 'var(--primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12,
                            flexShrink: 0
                          }}>
                            {(post.author?.full_name || post.author?.username || 'M')[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 13 }}>
                              {post.author?.full_name || post.author?.username}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                              @{post.author?.username} &bull; {post.created_at ? format(new Date(post.created_at), 'MMM d, yyyy') : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: 'var(--gray-800)', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.content || '(No text content)'}
                        </div>
                        {post.images && post.images.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--primary-700)', marginTop: 2 }}>
                            {post.images.length} attachment{post.images.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-blue">
                          {post.post_category}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={post.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedPost(post)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Eye size={12} />
                            Details
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={(e) => handleApprove(post, e)}
                                disabled={approvingId === post.id}
                                className="btn btn-success btn-sm"
                              >
                                <CheckCircle2 size={12} />
                                {approvingId === post.id ? 'Approving...' : 'Approve'}
                              </button>
                              <button
                                onClick={(e) => handleOpenReject(post, e)}
                                className="btn btn-danger btn-sm"
                              >
                                <XCircle size={12} />
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Post Details Modal */}
      {selectedPost && (
        <Modal
          isOpen={true}
          title={`Post Review #${selectedPost.id}`}
          onClose={() => setSelectedPost(null)}
          size="modal-lg"
          footer={
            <>
              {selectedPost.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { const p = selectedPost; setSelectedPost(null); handleOpenReject(p); }}
                  >
                    Reject Post
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleApprove(selectedPost)}
                  >
                    Approve & Publish
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedPost(null)}
              >
                Close
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{selectedPost.author?.full_name || selectedPost.author?.username}</strong>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  Posted on {selectedPost.created_at ? format(new Date(selectedPost.created_at), 'PPPp') : 'Unknown'}
                </div>
              </div>
              <StatusBadge status={selectedPost.status} />
            </div>

            <div style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--gray-200)', fontSize: 14, lineHeight: 1.6 }}>
              {selectedPost.content}
            </div>

            {selectedPost.images && selectedPost.images.length > 0 && (
              <div>
                <label className="form-label">Attached Media</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {selectedPost.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.image}
                      alt="Post Attachment"
                      style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--gray-300)', cursor: 'pointer' }}
                      onClick={() => setActivePhoto(img.image)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedPost.rejection_reason && (
              <div style={{ background: 'var(--danger-light)', padding: '12px', borderRadius: 6, color: 'var(--danger)', fontSize: 13 }}>
                <strong>Rejection Reason:</strong> {selectedPost.rejection_reason}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <Modal
          isOpen={true}
          title="Reject Post"
          onClose={() => setRejectingItem(null)}
          footer={
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setRejectingItem(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={rejecting}
                onClick={handleConfirmReject}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label required">Specify Reason for Rejection</label>
            <textarea
              className="form-control"
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Provide a clear, policy-based reason..."
              required
            />
          </div>
        </Modal>
      )}

      {/* Photo Lightbox */}
      {activePhoto && (
        <Modal
          isOpen={true}
          title="Attached Photo Preview"
          onClose={() => setActivePhoto(null)}
          size="modal-lg"
        >
          <div style={{ textAlign: 'center' }}>
            <img src={activePhoto} alt="Full Size" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 6 }} />
          </div>
        </Modal>
      )}
    </div>
  )
}
