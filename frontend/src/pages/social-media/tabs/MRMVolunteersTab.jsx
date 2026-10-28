import React, { useState, useEffect } from 'react'
import { mrmApi } from '../../../api'
import { LoadingState, EmptyState, Modal, StatusBadge } from '../../../components/shared'
import toast from 'react-hot-toast'
import { Users, Wallet, Plus, CheckCircle2, XCircle, Fuel, Smartphone, Car, Shield } from 'lucide-react'

export default function MRMVolunteersTab() {
  const [volunteers, setVolunteers] = useState([])
  const [allowances, setAllowances] = useState([])
  const [loading, setLoading] = useState(true)
  const [subView, setSubView] = useState('APPLICATIONS') // 'APPLICATIONS' | 'ALLOWANCES'

  // Reject Modal
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Allowance Modal
  const [showAllowanceModal, setShowAllowanceModal] = useState(false)
  const [allowanceForm, setAllowanceForm] = useState({
    volunteer_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    petrol_allowance: 2000,
    recharge_allowance: 399,
    trip_allowance: 0,
    notes: ''
  })
  const [submittingAllowance, setSubmittingAllowance] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [volRes, allRes] = await Promise.all([
        mrmApi.volunteers.list(),
        mrmApi.allowances.list()
      ])
      setVolunteers(volRes.data || [])
      setAllowances(allRes.data || [])
    } catch (err) {
      console.error('Failed to load volunteer data:', err)
      toast.error('Failed to load volunteers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateStatus = async (id, status) => {
    try {
      await mrmApi.volunteers.updateStatus(id, {
        status,
        rejection_reason: status === 'REJECTED' ? rejectionReason : undefined
      })
      toast.success(`Volunteer status updated to ${status}`)
      setSelectedVolunteer(null)
      setRejectionReason('')
      loadData()
    } catch (err) {
      console.error('Update volunteer error:', err)
      toast.error('Failed to update volunteer status')
    }
  }

  const handleSaveAllowance = async (e) => {
    e.preventDefault()
    if (!allowanceForm.volunteer_id) {
      toast.error('Please select a volunteer.')
      return
    }

    const petrol = Number(allowanceForm.petrol_allowance || 0)
    const recharge = Number(allowanceForm.recharge_allowance || 0)
    const trip = Number(allowanceForm.trip_allowance || 0)
    const total = petrol + recharge + trip

    if (total > 5399) {
      toast.error(`Total allowance (₹${total.toFixed(2)}) exceeds established monthly cap of ₹5,399.00`)
      return
    }

    setSubmittingAllowance(true)
    try {
      await mrmApi.allowances.create(allowanceForm)
      toast.success('Volunteer monthly allowance record created!')
      setShowAllowanceModal(false)
      setAllowanceForm({
        volunteer_id: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        petrol_allowance: 2000,
        recharge_allowance: 399,
        trip_allowance: 0,
        notes: ''
      })
      loadData()
    } catch (err) {
      console.error('Save allowance error:', err)
      toast.error('Failed to record allowance')
    } finally {
      setSubmittingAllowance(false)
    }
  }

  const handleApproveAllowance = async (id, status) => {
    try {
      await mrmApi.allowances.updateStatus(id, { status })
      toast.success(`Allowance ${status.toLowerCase()}!`)
      loadData()
    } catch (err) {
      console.error('Allowance action error:', err)
      toast.error('Failed to update allowance')
    }
  }

  const totalCalculated = Number(allowanceForm.petrol_allowance || 0) + Number(allowanceForm.recharge_allowance || 0) + Number(allowanceForm.trip_allowance || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Established Policy Banner */}
      <div className="data-card" style={{ marginBottom: 0 }}>
        <div className="data-card-header">
          <div>
            <div className="data-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="var(--primary-700)" />
              Volunteer Operations & Established Allowance Policy
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--gray-500)' }}>
              Enforces established Trust allowance limits and Green Badge prerequisites for Maroon distinction.
            </p>
          </div>

          <div className="data-card-actions">
            <button
              onClick={() => setSubView('APPLICATIONS')}
              className={`btn btn-sm ${subView === 'APPLICATIONS' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Users size={13} />
              Applications Desk ({volunteers.length})
            </button>
            <button
              onClick={() => setSubView('ALLOWANCES')}
              className={`btn btn-sm ${subView === 'ALLOWANCES' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Wallet size={13} />
              Monthly Allowances ({allowances.length})
            </button>
          </div>
        </div>

        {/* Established Monthly Policy Breakdown */}
        <div style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          background: 'var(--gray-50)'
        }}>
          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-600)', fontWeight: 600 }}>
              <Fuel size={14} color="var(--primary-600)" />
              Petrol Allowance
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginTop: 2 }}>₹2,000 / mo</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Maximum monthly limit</div>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-600)', fontWeight: 600 }}>
              <Smartphone size={14} color="var(--primary-600)" />
              Mobile Recharge
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginTop: 2 }}>₹399 / mo</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Standard Trust plan</div>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-600)', fontWeight: 600 }}>
              <Car size={14} color="var(--primary-600)" />
              Trip & Field Allowance
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginTop: 2 }}>₹3,000 / mo</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Official field visits</div>
          </div>

          <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--primary-800)', fontWeight: 700 }}>
              <Wallet size={14} color="var(--primary-700)" />
              Established Monthly Cap
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-700)', marginTop: 2 }}>₹5,399 / mo</div>
            <div style={{ fontSize: 11, color: 'var(--primary-500)' }}>Subject to verification</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {subView === 'APPLICATIONS' ? (
        /* Applications Table */
        <div className="data-card">
          <div className="data-card-header">
            <div className="data-card-title">
              Volunteer Applications & Maroon Badge Eligibility
              <span className="badge badge-gray" style={{ marginLeft: 8 }}>
                {volunteers.length} Total
              </span>
            </div>
            <div className="data-card-actions">
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                Showing {volunteers.length} records
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px 0' }}>
              <LoadingState />
            </div>
          ) : volunteers.length === 0 ? (
            <EmptyState title="No Volunteers Found" message="No volunteer applications have been submitted yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Volunteer Name</th>
                    <th style={{ width: '16%' }}>Volunteer ID</th>
                    <th style={{ width: '22%' }}>Green Badge Prerequisite</th>
                    <th style={{ width: '14%' }}>Service Hours</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteers.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{v.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{v.phone} {v.email && `• ${v.email}`}</div>
                      </td>

                      <td>
                        <span className="td-mono">{v.volunteer_id}</span>
                      </td>

                      <td>
                        {v.has_green_badge ? (
                          <span className="badge badge-green">
                            Green Badge Earned
                          </span>
                        ) : (
                          <span className="badge badge-gray">
                            Prerequisite Pending
                          </span>
                        )}
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                        {v.total_hours} hrs
                      </td>

                      <td>
                        <StatusBadge status={v.status} />
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          {v.status !== 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateStatus(v.id, 'APPROVED')}
                              className="btn btn-success btn-sm"
                            >
                              <CheckCircle2 size={12} />
                              Approve
                            </button>
                          )}
                          {v.status !== 'REJECTED' && (
                            <button
                              onClick={() => setSelectedVolunteer(v)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                            >
                              <XCircle size={12} />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Allowances Table */
        <div className="data-card">
          <div className="data-card-header">
            <div className="data-card-title">
              Volunteer Monthly Allowance Records (Cap: ₹5,399)
              <span className="badge badge-gray" style={{ marginLeft: 8 }}>
                {allowances.length} Total
              </span>
            </div>
            <div className="data-card-actions">
              <button
                onClick={() => setShowAllowanceModal(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={14} />
                Record Allowance
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px 0' }}>
              <LoadingState />
            </div>
          ) : allowances.length === 0 ? (
            <EmptyState title="No Allowance Records" message="No monthly allowance records recorded yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Volunteer</th>
                    <th style={{ width: '12%' }}>Month/Year</th>
                    <th style={{ width: '14%' }}>Petrol (₹2k)</th>
                    <th style={{ width: '14%' }}>Recharge (₹399)</th>
                    <th style={{ width: '14%' }}>Trip (₹3k)</th>
                    <th style={{ width: '12%' }}>Total Approved</th>
                    <th style={{ width: '6%' }}>Status</th>
                    <th style={{ width: '6%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allowances.map((al) => (
                    <tr key={al.id}>
                      <td style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                        {al.volunteer_name}
                      </td>

                      <td className="td-mono">
                        {al.month}/{al.year}
                      </td>

                      <td style={{ color: 'var(--gray-700)' }}>
                        ₹{Number(al.petrol_allowance).toFixed(2)}
                      </td>

                      <td style={{ color: 'var(--gray-700)' }}>
                        ₹{Number(al.recharge_allowance).toFixed(2)}
                      </td>

                      <td style={{ color: 'var(--gray-700)' }}>
                        ₹{Number(al.trip_allowance).toFixed(2)}
                      </td>

                      <td style={{ fontWeight: 700, color: 'var(--primary-700)' }}>
                        ₹{Number(al.total_approved).toFixed(2)}
                      </td>

                      <td>
                        <StatusBadge status={al.status} />
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {al.status === 'PENDING' && (
                          <button
                            onClick={() => handleApproveAllowance(al.id, 'APPROVED')}
                            className="btn btn-primary btn-sm"
                          >
                            <CheckCircle2 size={12} />
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Allowance Modal */}
      {showAllowanceModal && (
        <Modal
          isOpen={true}
          title="Record Monthly Volunteer Allowance"
          onClose={() => setShowAllowanceModal(false)}
        >
          <form onSubmit={handleSaveAllowance} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--border-radius-sm)', padding: '10px 14px', fontSize: 12.5, color: 'var(--primary-900)' }}>
              Standard policy configuration: Petrol max ₹2,000 | Recharge max ₹399 | Trip max ₹3,000. Total monthly cap is ₹5,399.
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Select Volunteer</label>
              <select
                className="form-control"
                value={allowanceForm.volunteer_id}
                onChange={(e) => setAllowanceForm({ ...allowanceForm, volunteer_id: e.target.value })}
                required
              >
                <option value="">-- Choose Volunteer --</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.full_name} ({v.volunteer_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Month</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  className="form-control"
                  value={allowanceForm.month}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, month: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Year</label>
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  className="form-control"
                  value={allowanceForm.year}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, year: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Petrol (Max ₹2,000)</label>
                <input
                  type="number"
                  max="2000"
                  className="form-control"
                  value={allowanceForm.petrol_allowance}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, petrol_allowance: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Mobile (Max ₹399)</label>
                <input
                  type="number"
                  max="399"
                  className="form-control"
                  value={allowanceForm.recharge_allowance}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, recharge_allowance: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Trip (Max ₹3,000)</label>
                <input
                  type="number"
                  max="3000"
                  className="form-control"
                  value={allowanceForm.trip_allowance}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, trip_allowance: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>Total Monthly Allowance:</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: totalCalculated > 5399 ? 'var(--danger)' : 'var(--primary-700)' }}>
                ₹{totalCalculated.toFixed(2)} / ₹5,399.00
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes / Approval Context</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Details of field trips, receipts verified..."
                value={allowanceForm.notes}
                onChange={(e) => setAllowanceForm({ ...allowanceForm, notes: e.target.value })}
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAllowanceModal(false)}
                disabled={submittingAllowance}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingAllowance || totalCalculated > 5399}
              >
                <Wallet size={14} />
                {submittingAllowance ? 'Saving...' : 'Save Allowance Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Reason Modal */}
      {selectedVolunteer && (
        <Modal
          isOpen={true}
          title={`Reject Volunteer: ${selectedVolunteer.full_name}`}
          onClose={() => setSelectedVolunteer(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Reason for Rejection</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Explain why the volunteer application was declined..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedVolunteer(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleUpdateStatus(selectedVolunteer.id, 'REJECTED')}
              >
                <XCircle size={14} />
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
