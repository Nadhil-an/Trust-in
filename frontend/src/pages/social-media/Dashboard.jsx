import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { coreApi } from '../../api'
import { PageHeader, StatCard, LoadingState, EmptyState, Modal } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function SocialMediaDashboard() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectingItem, setRejectingItem] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [activePhoto, setActivePhoto] = useState(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await coreApi.memberPosts.list({ status: 'ALL' })
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setPosts(list)
    } catch (err) {
      console.error('Failed to load social posts:', err)
      toast.error('Failed to load social media posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  const pendingPosts = posts.filter(p => p.status === 'PENDING_APPROVAL' || p.status === 'OPEN')
  const approvedPosts = posts.filter(p => p.status === 'APPROVED')
  const forwardedPosts = posts.filter(p => p.status === 'FORWARDED_TO_FAO')
  const rejectedPosts = posts.filter(p => p.status === 'REJECTED')

  const handleApprove = async (post, e) => {
    if (e) e.stopPropagation()
    setApprovingId(post.id)
    try {
      const res = await coreApi.memberPosts.approve(post.id)
      toast.success(res.data?.message || 'Post approved and published to mobile app!')
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
    setRejecting(true)
    try {
      const res = await coreApi.memberPosts.reject(rejectingItem.id, { reason: rejectionReason })
      toast.success(res.data?.message || 'Post rejected and restricted from mobile app.')
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
    <div className="page-container" style={{ padding: '24px' }}>
      <PageHeader
        title="Social Media Moderation Dashboard"
        subtitle="Review community posts, filter fake or violating content, and approve public issues before they appear in the mobile app"
      />

      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          label="Pending Moderation"
          value={pendingPosts.length}
          icon="⏳"
          variant={pendingPosts.length > 0 ? "yellow" : "blue"}
        />
        <StatCard
          label="Approved & Live on App"
          value={approvedPosts.length}
          icon="✅"
          variant="green"
        />
        <StatCard
          label="Forwarded to FAO"
          value={forwardedPosts.length}
          icon="📋"
          variant="blue"
        />
        <StatCard
          label="Rejected / Restricted"
          value={rejectedPosts.length}
          icon="⛔"
          variant="red"
        />
      </div>

      {/* Quick Navigation Alert Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
        border: '1px solid #BFDBFE',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '28px', background: '#fff', width: '50px', height: '50px', borderRadius: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
            📢
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#1E3A8A' }}>
              Public Issues Management Section
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#3B82F6' }}>
              Access full queue, deep inspections, location verification, and forward issues directly to Field Assessment Officers (FAO).
            </p>
          </div>
        </div>
        <Link
          to="/slt/social/public-issues"
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Open Public Issues Section ➜
        </Link>
      </div>

      {/* Action Center: Pending Approval Queue */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⏳</span> Pending Member Posts Awaiting Your Approval
              {pendingPosts.length > 0 && (
                <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                  {pendingPosts.length} waiting
                </span>
              )}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              Posts listed here are restricted and NOT visible to other mobile users until you approve them.
            </p>
          </div>

          <button
            onClick={loadPosts}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px' }}
          >
            🔄 Refresh Queue
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : pendingPosts.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#0F172A' }}>Queue Clear! No Pending Posts</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              All member-uploaded posts have been reviewed and approved. New submissions will appear here automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {pendingPosts.map(post => {
              const isApproving = approvingId === post.id
              return (
                <div
                  key={post.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedPost(post)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div>
                    {/* Header: Author & Time */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {post.author?.photo ? (
                          <img
                            src={post.author.photo}
                            alt=""
                            style={{ width: '36px', height: '36px', borderRadius: '18px', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {(post.author?.full_name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0F172A' }}>
                            {post.author?.full_name || post.author?.username}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            @{post.author?.username} • {post.created_at ? format(new Date(post.created_at), 'dd MMM, hh:mm a') : ''}
                          </div>
                        </div>
                      </div>

                      <span style={{ background: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>
                        ⏳ PENDING
                      </span>
                    </div>

                    {/* Contact & Location Info */}
                    <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#334155' }}>
                      {post.contact_number && (
                        <div style={{ marginBottom: '2px', fontWeight: '600' }}>
                          📞 <a href={`tel:${post.contact_number}`} onClick={e => e.stopPropagation()} style={{ color: '#0284C7', textDecoration: 'none' }}>{post.contact_number}</a>
                        </div>
                      )}
                      {post.address && (
                        <div style={{ color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📍 {post.address}
                        </div>
                      )}
                    </div>

                    {/* Description preview */}
                    <p style={{
                      fontSize: '13px',
                      color: '#1E293B',
                      lineHeight: '1.5',
                      marginBottom: '12px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {post.description}
                    </p>

                    {/* Photos thumbnails */}
                    {post.images && post.images.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {post.images.slice(0, 4).map((img, idx) => (
                          <img
                            key={img.id || idx}
                            src={img.image}
                            alt=""
                            onClick={(e) => { e.stopPropagation(); setActivePhoto(img.image); }}
                            style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #E2E8F0' }}
                          />
                        ))}
                        {post.images.length > 4 && (
                          <div style={{ width: '56px', height: '56px', borderRadius: '6px', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
                            +{post.images.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Moderation Actions Footer */}
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                    <button
                      onClick={(e) => handleApprove(post, e)}
                      disabled={isApproving}
                      className="btn btn-sm"
                      style={{
                        flex: 1,
                        background: '#16A34A',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '12.5px',
                        padding: '8px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Approve post and make it visible in mobile app"
                    >
                      {isApproving ? 'Approving...' : '✅ Approve & Publish'}
                    </button>

                    <button
                      onClick={(e) => handleOpenReject(post, e)}
                      className="btn btn-sm"
                      style={{
                        background: '#FEE2E2',
                        color: '#DC2626',
                        fontWeight: '600',
                        fontSize: '12.5px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #FECACA',
                        cursor: 'pointer'
                      }}
                      title="Reject post due to violation or fake content"
                    >
                      ⛔ Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Moderation Policies Guide */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
          🛡️ Social Media Content & Anti-Violation Policy Guidelines
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', fontSize: '13px', color: '#475569' }}>
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', borderLeft: '4px solid #16A34A' }}>
            <strong style={{ color: '#166534', display: 'block', marginBottom: '3px' }}>1. Genuine Community Hardships</strong>
            Approve posts with real distress problems, medical/food/education assistance, housing repairs, or elderly support with clear photos and contact info.
          </div>
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', borderLeft: '4px solid #DC2626' }}>
            <strong style={{ color: '#991B1B', display: 'block', marginBottom: '3px' }}>2. Fake & Violation Restriction</strong>
            Immediately reject duplicate spam, offensive material, unverified monetary solicitations, or misleading photographs.
          </div>
          <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', borderLeft: '4px solid #0284C7' }}>
            <strong style={{ color: '#0369A1', display: 'block', marginBottom: '3px' }}>3. Route to Field Officers (FAO)</strong>
            For verified critical issues requiring on-ground investigation and trust financial disbursements, forward the issue to Field Assessment Officers.
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
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
                placeholder="Specific violation details (visible to audit log)..."
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

      {/* Detail Modal */}
      {selectedPost && (
        <Modal
          isOpen={true}
          title={`Review Post Details — #${selectedPost.id.slice(0, 8)}`}
          onClose={() => setSelectedPost(null)}
          size="modal-lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px' }}>
              <div>
                <strong style={{ fontSize: '15px', color: '#0F172A' }}>{selectedPost.author?.full_name}</strong>
                <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '8px' }}>@{selectedPost.author?.username}</span>
              </div>
              <span style={{
                background: selectedPost.status === 'APPROVED' ? '#DCFCE7' : selectedPost.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                color: selectedPost.status === 'APPROVED' ? '#15803D' : selectedPost.status === 'REJECTED' ? '#B91C1C' : '#B45309',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}>
                {selectedPost.status}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#334155' }}>
              <div><strong>Contact:</strong> {selectedPost.contact_number || 'N/A'}</div>
              <div style={{ marginTop: '4px' }}><strong>Location:</strong> {selectedPost.address || 'N/A'}</div>
            </div>

            <div>
              <strong style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase' }}>Description</strong>
              <div style={{ marginTop: '6px', padding: '12px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', lineHeight: '1.6', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                {selectedPost.description}
              </div>
            </div>

            {selectedPost.images && selectedPost.images.length > 0 && (
              <div>
                <strong style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase' }}>Attached Photos ({selectedPost.images.length})</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {selectedPost.images.map((img, i) => (
                    <img
                      key={img.id || i}
                      src={img.image}
                      alt=""
                      onClick={() => setActivePhoto(img.image)}
                      style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #E2E8F0' }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              {selectedPost.status !== 'APPROVED' && (
                <button
                  className="btn"
                  style={{ background: '#16A34A', color: '#fff', fontWeight: '700' }}
                  onClick={() => handleApprove(selectedPost)}
                  disabled={approvingId === selectedPost.id}
                >
                  {approvingId === selectedPost.id ? 'Approving...' : '✅ Approve & Publish'}
                </button>
              )}
              {selectedPost.status !== 'REJECTED' && (
                <button
                  className="btn"
                  style={{ background: '#DC2626', color: '#fff', fontWeight: '700' }}
                  onClick={() => handleOpenReject(selectedPost)}
                >
                  ⛔ Reject Post
                </button>
              )}
              <Link
                to="/slt/social/public-issues"
                className="btn btn-secondary"
              >
                Go to Public Issues Pipeline ➜
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Enlarged Photo Modal */}
      {activePhoto && (
        <Modal
          isOpen={true}
          title="Attached Photo Preview"
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
