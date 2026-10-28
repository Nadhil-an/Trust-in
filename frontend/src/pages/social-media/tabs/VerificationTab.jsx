import React, { useState, useEffect, useCallback } from 'react'
import { coreApi } from '../../../api'
import { LoadingState, EmptyState, Modal, FilterBar, StatusBadge } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { BadgeCheck, CheckCircle2, XCircle, Eye, FileText, RefreshCw } from 'lucide-react'

export default function VerificationTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const [selectedReq, setSelectedReq] = useState(null)
  const [activeDocUrl, setActiveDocUrl] = useState(null)
  const [rejectingItem, setRejectingItem] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (search.trim()) params.search = search.trim()

      const res = await coreApi.verifications.list(params)
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setRequests(list)
    } catch (err) {
      console.error('Failed to load verifications:', err)
      toast.error('Failed to load verification applications')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRequests()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadRequests])

  const handleApprove = async (item) => {
    setIsProcessing(true)
    try {
      const res = await coreApi.verifications.approve(item.id)
      toast.success(res.data?.message || 'Member verified successfully! Badge awarded.')
      setRequests(prev => prev.map(r => r.id === item.id ? { ...r, status: 'APPROVED' } : r))
      if (selectedReq?.id === item.id) {
        setSelectedReq(prev => ({ ...prev, status: 'APPROVED' }))
      }
    } catch (err) {
      console.error('Approve verification error:', err)
      toast.error(err.response?.data?.error || 'Failed to approve verification')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenReject = (item) => {
    setRejectingItem(item)
    setRejectionReason('Documents provided are illegible or incomplete.')
  }

  const handleConfirmReject = async () => {
    if (!rejectingItem) return
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejecting verification')
      return
    }
    setIsProcessing(true)
    try {
      const res = await coreApi.verifications.reject(rejectingItem.id, { reason: rejectionReason.trim() })
      toast.success(res.data?.message || 'Verification rejected with reason.')
      setRequests(prev => prev.map(r => r.id === rejectingItem.id ? { ...r, status: 'REJECTED', rejection_reason: rejectionReason } : r))
      if (selectedReq?.id === rejectingItem.id) {
        setSelectedReq(prev => ({ ...prev, status: 'REJECTED', rejection_reason: rejectionReason }))
      }
      setRejectingItem(null)
    } catch (err) {
      console.error('Reject verification error:', err)
      toast.error(err.response?.data?.error || 'Failed to reject verification')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filter Bar */}
      <FilterBar search={search} onSearch={setSearch}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="ALL">All Requests</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Verified Members</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {(search || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('ALL'); }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}
        </div>
      </FilterBar>

      {/* Main Data Card */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Member Verification Applications
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {requests.length} Applications
            </span>
          </div>
          <div className="data-card-actions">
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Showing {requests.length} verification requests
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No Verification Requests"
            message="No account verification submissions match your filter."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Applicant</th>
                  <th style={{ width: '20%' }}>ID Document Info</th>
                  <th style={{ width: '15%' }}>Submitted Date</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '13%' }}>Uploaded Proofs</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(item => {
                  const isPending = item.status === 'PENDING'
                  const isApproved = item.status === 'APPROVED'

                  return (
                    <tr key={item.id}>
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
                            {(item.full_name || item.user_details?.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{item.full_name || item.user_details?.full_name}</span>
                              {item.user_details?.is_verified && (
                                <span className="badge badge-blue" style={{ fontSize: 9, padding: '1px 5px' }}>Verified</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                              @{item.user_details?.username} &bull; ID: {item.user_details?.member_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray">
                          {item.id_proof_type}
                        </span>
                        {item.id_proof_number && (
                          <div className="td-mono" style={{ marginTop: 2, fontSize: 11 }}>
                            {item.id_proof_number}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--gray-600)', fontSize: 12 }}>
                        {item.submitted_at ? format(new Date(item.submitted_at), 'MMM d, yyyy') : 'Recently'}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {item.id_proof_document && (
                            <button
                              type="button"
                              onClick={() => setActiveDocUrl(item.id_proof_document)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                              ID Proof
                            </button>
                          )}
                          {item.address_proof_document && (
                            <button
                              type="button"
                              onClick={() => setActiveDocUrl(item.address_proof_document)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                              Address
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedReq(item)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Eye size={12} />
                            Details
                          </button>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApprove(item)}
                                className="btn btn-success btn-sm"
                              >
                                <CheckCircle2 size={12} />
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleOpenReject(item)}
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

      {/* Review Details Modal */}
      {selectedReq && (
        <Modal
          isOpen={true}
          title={`Verification Dossier: ${selectedReq.full_name || selectedReq.user_details?.username}`}
          onClose={() => setSelectedReq(null)}
          size="modal-lg"
          footer={
            <>
              {selectedReq.status === 'PENDING' && (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { const r = selectedReq; setSelectedReq(null); handleOpenReject(r); }}
                  >
                    Reject Application
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleApprove(selectedReq)}
                  >
                    Approve & Award Badge
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedReq(null)}
              >
                Close
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{selectedReq.full_name || selectedReq.user_details?.full_name}</strong>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  User ID: {selectedReq.user_details?.id} &bull; Member Ref: {selectedReq.user_details?.member_id}
                </div>
              </div>
              <StatusBadge status={selectedReq.status} />
            </div>

            <div className="form-grid-2">
              <div className="data-card" style={{ padding: 16, marginBottom: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--gray-500)', fontWeight: 600 }}>ID Proof Information</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)', marginTop: 4 }}>{selectedReq.id_proof_type}</div>
                <div className="td-mono" style={{ marginTop: 2 }}>{selectedReq.id_proof_number || 'N/A'}</div>
                {selectedReq.id_proof_document && (
                  <button
                    onClick={() => setActiveDocUrl(selectedReq.id_proof_document)}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                  >
                    View Document File
                  </button>
                )}
              </div>

              <div className="data-card" style={{ padding: 16, marginBottom: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--gray-500)', fontWeight: 600 }}>Address Document</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)', marginTop: 4 }}>
                  {selectedReq.address_proof_document ? 'Address Proof Provided' : 'None Uploaded'}
                </div>
                {selectedReq.address_proof_document && (
                  <button
                    onClick={() => setActiveDocUrl(selectedReq.address_proof_document)}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                  >
                    View Address File
                  </button>
                )}
              </div>
            </div>

            {selectedReq.rejection_reason && (
              <div style={{ background: 'var(--danger-light)', padding: 12, borderRadius: 6, color: 'var(--danger)', fontSize: 13 }}>
                <strong>Rejection Reason:</strong> {selectedReq.rejection_reason}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <Modal
          isOpen={true}
          title="Reject Verification"
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
                disabled={isProcessing}
                onClick={handleConfirmReject}
              >
                {isProcessing ? 'Processing...' : 'Confirm Rejection'}
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
              placeholder="e.g. Document image is blurry or expired..."
              required
            />
          </div>
        </Modal>
      )}

      {/* Document Viewer Modal */}
      {activeDocUrl && (
        <Modal
          isOpen={true}
          title="Verification Document Preview"
          onClose={() => setActiveDocUrl(null)}
          size="modal-lg"
        >
          <div style={{ textAlign: 'center' }}>
            <img src={activeDocUrl} alt="Document Proof" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 6, border: '1px solid var(--gray-300)' }} />
          </div>
        </Modal>
      )}
    </div>
  )
}
