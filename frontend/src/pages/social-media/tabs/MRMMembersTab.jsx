import React, { useState, useEffect, useCallback } from 'react'
import { mrmApi } from '../../../api'
import { LoadingState, EmptyState, Modal, FilterBar, StatusBadge } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Eye, FileText, Plus, RefreshCw, Award, CheckCircle2, ShieldCheck, User } from 'lucide-react'

export default function MRMMembersTab() {
  const [members, setMembers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [badgeFilter, setBadgeFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')

  // 360 Profile Modal
  const [selectedMember, setSelectedMember] = useState(null)
  const [loadingMemberDetail, setLoadingMemberDetail] = useState(false)
  const [memberDetail, setMemberDetail] = useState(null)

  // Interaction Modal
  const [interactionMember, setInteractionMember] = useState(null)
  const [interactionForm, setInteractionForm] = useState({
    interaction_type: 'PHONE_CALL',
    summary: '',
    notes: '',
    confidential_notes: '',
    follow_up_date: '',
    follow_up_status: 'PENDING'
  })
  const [submittingInteraction, setSubmittingInteraction] = useState(false)

  // Task Assign Modal
  const [taskMember, setTaskMember] = useState(null)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    target_value: 1,
    target_unit: 'COUNT',
    due_date: format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')
  })
  const [submittingTask, setSubmittingTask] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchQuery.trim()) params.q = searchQuery.trim()
      if (statusFilter) params.status = statusFilter
      if (badgeFilter) params.badge = badgeFilter
      if (verifiedFilter !== '') params.is_verified = verifiedFilter

      const res = await mrmApi.members.list(params)
      setMembers(res.data?.results || [])
      setTotalCount(res.data?.count || 0)
    } catch (err) {
      console.error('Failed to load members:', err)
      toast.error('Failed to load member directory')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, badgeFilter, verifiedFilter])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchMembers()
    }, 250)
    return () => clearTimeout(delayDebounce)
  }, [fetchMembers])

  const openMemberDetail = async (member) => {
    setSelectedMember(member)
    setLoadingMemberDetail(true)
    try {
      const res = await mrmApi.members.get(member.id)
      setMemberDetail(res.data)
    } catch (err) {
      console.error('Failed to load member detail:', err)
      toast.error('Could not load member profile details')
    } finally {
      setLoadingMemberDetail(false)
    }
  }

  const handleSaveInteraction = async (e) => {
    e.preventDefault()
    if (!interactionMember) return
    if (!interactionForm.summary.trim()) {
      toast.error('Please enter a summary of the interaction.')
      return
    }

    setSubmittingInteraction(true)
    try {
      await mrmApi.members.createInteraction(interactionMember.id, interactionForm)
      toast.success('Interaction and administrative notes recorded!')
      setInteractionMember(null)
      setInteractionForm({
        interaction_type: 'PHONE_CALL',
        summary: '',
        notes: '',
        confidential_notes: '',
        follow_up_date: '',
        follow_up_status: 'PENDING'
      })
      if (selectedMember?.id === interactionMember.id) {
        openMemberDetail(interactionMember)
      }
    } catch (err) {
      console.error('Save interaction error:', err)
      toast.error('Failed to record interaction')
    } finally {
      setSubmittingInteraction(false)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!taskMember) return
    if (!taskForm.title.trim()) {
      toast.error('Task title is required')
      return
    }

    setSubmittingTask(true)
    try {
      await mrmApi.tasks.create({
        member: taskMember.id,
        ...taskForm
      })
      toast.success(`Task assigned to ${taskMember.full_name}`)
      setTaskMember(null)
      setTaskForm({
        title: '',
        description: '',
        category: 'GENERAL',
        target_value: 1,
        target_unit: 'COUNT',
        due_date: format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')
      })
      if (selectedMember?.id === taskMember.id) {
        openMemberDetail(taskMember)
      }
    } catch (err) {
      console.error('Create task error:', err)
      toast.error('Failed to create task')
    } finally {
      setSubmittingTask(false)
    }
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setBadgeFilter('')
    setVerifiedFilter('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard ERP Filter Bar */}
      <FilterBar search={searchQuery} onSearch={setSearchQuery}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={badgeFilter}
            onChange={(e) => setBadgeFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">All Badges</option>
            <option value="YELLOW">Yellow Badge</option>
            <option value="GREEN">Green Badge</option>
            <option value="ORANGE">Orange Badge</option>
            <option value="BLUE">Blue Badge</option>
            <option value="MAROON">Maroon Volunteer</option>
          </select>

          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '130px' }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            className="form-control"
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="">Verification</option>
            <option value="true">Verified Only</option>
            <option value="false">Unverified</option>
          </select>

          {(searchQuery || statusFilter || badgeFilter || verifiedFilter) && (
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}
        </div>
      </FilterBar>

      {/* Main Table in Standard Data Card */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Registered Members Registry
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {totalCount} Total
            </span>
          </div>
          <div className="data-card-actions">
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Showing {members.length} of {totalCount} records
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="No Members Found"
            message="No registered members match your filter criteria."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Member</th>
                  <th style={{ width: '15%' }}>Member ID</th>
                  <th style={{ width: '18%' }}>Earned Badges</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '12%' }}>Joined Date</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {m.photo ? (
                          <img
                            src={m.photo}
                            alt={m.full_name}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1px solid var(--gray-200)',
                              flexShrink: 0
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--primary-100)',
                            color: 'var(--primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                            flexShrink: 0
                          }}>
                            {m.full_name?.charAt(0) || 'M'}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{m.full_name}</span>
                            {m.is_verified && (
                              <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px' }}>
                                Verified
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 1 }}>
                            {m.occupation || m.membership_type || 'General Member'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="td-mono">{m.member_id}</span>
                    </td>
                    <td>
                      {m.earned_badges_summary && m.earned_badges_summary !== 'No badges yet' ? (
                        <span className="badge badge-yellow">
                          {m.earned_badges_summary}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                          No badges yet
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td style={{ color: 'var(--gray-600)', fontSize: 13 }}>
                      {m.joining_date ? format(new Date(m.joining_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => openMemberDetail(m)}
                          className="btn btn-secondary btn-sm"
                          title="Open 360° Profile"
                        >
                          <Eye size={12} />
                          Profile
                        </button>
                        <button
                          onClick={() => setInteractionMember(m)}
                          className="btn btn-secondary btn-sm"
                          title="Record Interaction Note"
                        >
                          <FileText size={12} />
                          Note
                        </button>
                        <button
                          onClick={() => setTaskMember(m)}
                          className="btn btn-primary btn-sm"
                          title="Assign Actionable Task"
                        >
                          <Plus size={12} />
                          Assign Task
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 360 Profile Modal */}
      {selectedMember && (
        <Modal
          isOpen={true}
          title={`Member 360° Profile: ${selectedMember.full_name} (${selectedMember.member_id})`}
          onClose={() => { setSelectedMember(null); setMemberDetail(null); }}
          size="modal-lg"
        >
          {loadingMemberDetail || !memberDetail ? (
            <div style={{ padding: '30px 0' }}>
              <LoadingState />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Overview Card */}
              <div style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                borderRadius: 'var(--border-radius)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {memberDetail.photo ? (
                    <img
                      src={memberDetail.photo}
                      alt={memberDetail.full_name}
                      style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--white)' }}
                    />
                  ) : (
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'var(--primary-700)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 700
                    }}>
                      {memberDetail.full_name?.charAt(0) || 'M'}
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {memberDetail.full_name}
                      {memberDetail.is_verified && <span className="badge badge-blue">Verified Member</span>}
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--gray-600)' }}>
                      ID: <strong className="td-mono">{memberDetail.member_id}</strong> &bull; Type: {memberDetail.membership_type} &bull; Joined: {memberDetail.joining_date}
                    </p>
                  </div>
                </div>

                <div>
                  <StatusBadge status={memberDetail.status} />
                </div>
              </div>

              {/* Stat Tiles */}
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="stat-card-label">Community Posts</div>
                  <div className="stat-card-value" style={{ fontSize: 22, marginTop: 4 }}>{memberDetail.posts_count || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Assigned Tasks</div>
                  <div className="stat-card-value" style={{ fontSize: 22, marginTop: 4 }}>{memberDetail.tasks?.length || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Achievements</div>
                  <div className="stat-card-value" style={{ fontSize: 22, marginTop: 4 }}>{memberDetail.achievements?.length || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Volunteer</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: memberDetail.volunteer_info ? 'var(--primary-700)' : 'var(--gray-500)', marginTop: 8 }}>
                    {memberDetail.volunteer_info ? `Active (${memberDetail.volunteer_info.status})` : 'Not Enrolled'}
                  </div>
                </div>
              </div>

              {/* Earned Badges History */}
              <div className="data-card" style={{ marginBottom: 0 }}>
                <div className="data-card-header">
                  <div className="data-card-title">Earned Trust Badges & Awards</div>
                  <span className="badge badge-yellow">{memberDetail.badges_list?.length || 0} Awarded</span>
                </div>
                {(!memberDetail.badges_list || memberDetail.badges_list.length === 0) ? (
                  <div style={{ padding: '20px', color: 'var(--gray-500)', fontSize: 13, textAlign: 'center' }}>
                    No badges awarded yet for this member.
                  </div>
                ) : (
                  <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {memberDetail.badges_list.map((b) => (
                      <div key={b.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>
                            {b.badge_name}
                          </span>
                          <span className="badge badge-blue">
                            &times; {b.times_earned}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                          Period: {b.qualifying_period} {b.is_permanent && '&bull; Permanent'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Administrative Logs & Interactions */}
              <div className="data-card" style={{ marginBottom: 0 }}>
                <div className="data-card-header">
                  <div className="data-card-title">Administrative Notes & Interactions</div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setInteractionMember(memberDetail)}
                  >
                    + Add Interaction
                  </button>
                </div>
                {(!memberDetail.interactions || memberDetail.interactions.length === 0) ? (
                  <div style={{ padding: '20px', color: 'var(--gray-500)', fontSize: 13, textAlign: 'center' }}>
                    No administrative interactions logged yet.
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Summary</th>
                          <th>Recorded By</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberDetail.interactions.map(it => (
                          <tr key={it.id}>
                            <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                              {it.created_at ? format(new Date(it.created_at), 'MMM d, yyyy') : '—'}
                            </td>
                            <td>
                              <span className="badge badge-gray">{it.interaction_type}</span>
                            </td>
                            <td style={{ fontSize: 13 }}>
                              <strong>{it.summary}</strong>
                              {it.notes && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{it.notes}</div>}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{it.recorded_by_name || 'Admin'}</td>
                            <td><StatusBadge status={it.follow_up_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Record Interaction Modal */}
      {interactionMember && (
        <Modal
          isOpen={true}
          title={`Log Interaction Note: ${interactionMember.full_name}`}
          onClose={() => setInteractionMember(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setInteractionMember(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="interaction-form"
                disabled={submittingInteraction}
                className="btn btn-primary btn-sm"
              >
                {submittingInteraction ? 'Saving...' : 'Save Note'}
              </button>
            </>
          }
        >
          <form id="interaction-form" onSubmit={handleSaveInteraction}>
            <div className="form-group">
              <label className="form-label required">Interaction Type</label>
              <select
                className="form-control"
                value={interactionForm.interaction_type}
                onChange={e => setInteractionForm({ ...interactionForm, interaction_type: e.target.value })}
              >
                <option value="PHONE_CALL">Phone Call</option>
                <option value="IN_PERSON">In-Person Meeting</option>
                <option value="WHATSAPP">WhatsApp / Messaging</option>
                <option value="EMAIL">Email</option>
                <option value="OFFICE_VISIT">Office Visit</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Summary</label>
              <input
                type="text"
                className="form-control"
                placeholder="Brief summary of interaction..."
                value={interactionForm.summary}
                onChange={e => setInteractionForm({ ...interactionForm, summary: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Discussion Notes</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Details of the discussion..."
                value={interactionForm.notes}
                onChange={e => setInteractionForm({ ...interactionForm, notes: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confidential Administrative Notes</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Confidential notes (visible only to Trust leadership)..."
                value={interactionForm.confidential_notes}
                onChange={e => setInteractionForm({ ...interactionForm, confidential_notes: e.target.value })}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={interactionForm.follow_up_date}
                  onChange={e => setInteractionForm({ ...interactionForm, follow_up_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Follow-up Status</label>
                <select
                  className="form-control"
                  value={interactionForm.follow_up_status}
                  onChange={e => setInteractionForm({ ...interactionForm, follow_up_status: e.target.value })}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Task Modal */}
      {taskMember && (
        <Modal
          isOpen={true}
          title={`Assign Actionable Task: ${taskMember.full_name}`}
          onClose={() => setTaskMember(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTaskMember(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="assign-task-form"
                disabled={submittingTask}
                className="btn btn-primary btn-sm"
              >
                {submittingTask ? 'Assigning...' : 'Assign Task'}
              </button>
            </>
          }
        >
          <form id="assign-task-form" onSubmit={handleCreateTask}>
            <div className="form-group">
              <label className="form-label required">Task Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Distribute 50 food relief kits"
                value={taskForm.title}
                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description / Instructions</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Detailed objectives and evidence submission instructions..."
                value={taskForm.description}
                onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
              />
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={taskForm.category}
                  onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}
                >
                  <option value="GENERAL">General</option>
                  <option value="VOLUNTEER">Volunteer</option>
                  <option value="COMMUNITY">Community</option>
                  <option value="EVENT">Event</option>
                  <option value="FUNDRAISING">Fundraising</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Value</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  value={taskForm.target_value}
                  onChange={e => setTaskForm({ ...taskForm, target_value: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit</label>
                <select
                  className="form-control"
                  value={taskForm.target_unit}
                  onChange={e => setTaskForm({ ...taskForm, target_unit: e.target.value })}
                >
                  <option value="COUNT">Count</option>
                  <option value="HOURS">Hours</option>
                  <option value="PEOPLE">People</option>
                  <option value="ITEMS">Items</option>
                  <option value="PERCENT">Percent</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Due Date</label>
              <input
                type="date"
                className="form-control"
                value={taskForm.due_date}
                onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
