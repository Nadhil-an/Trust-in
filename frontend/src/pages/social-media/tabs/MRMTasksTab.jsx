import React, { useState, useEffect, useCallback } from 'react'
import { mrmApi } from '../../../api'
import { LoadingState, EmptyState, Modal, ConfirmModal, FilterBar, StatCard } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  ExternalLink,
  Target
} from 'lucide-react'

export default function MRMTasksTab() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchMember, setSearchMember] = useState('')

  // Create Task Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [membersList, setMembersList] = useState([])
  const [createForm, setCreateForm] = useState({
    member: '',
    title: '',
    description: '',
    category: 'GENERAL',
    target_value: 1,
    target_unit: 'COUNT',
    due_date: format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')
  })
  const [submittingCreate, setSubmittingCreate] = useState(false)

  // Review Modal
  const [taskToReview, setTaskToReview] = useState(null)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [reviewForm, setReviewForm] = useState({
    status: 'COMPLETED',
    achieved_value: 0,
    review_notes: ''
  })
  const [submittingReview, setSubmittingReview] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (categoryFilter) params.category = categoryFilter

      const res = await mrmApi.tasks.list(params)
      setTasks(res.data || [])
    } catch (err) {
      console.error('Failed to load tasks:', err)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const loadMembersForDropdown = async () => {
    try {
      const res = await mrmApi.members.list({ limit: 100 })
      setMembersList(res.data?.results || [])
    } catch (err) {
      console.error('Failed to load members for selector:', err)
    }
  }

  const handleOpenCreate = () => {
    loadMembersForDropdown()
    setShowCreateModal(true)
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!createForm.member) {
      toast.error('Please select a member to assign the task.')
      return
    }
    if (!createForm.title.trim()) {
      toast.error('Task title is required')
      return
    }

    setSubmittingCreate(true)
    try {
      await mrmApi.tasks.create(createForm)
      toast.success('New task successfully assigned!')
      setShowCreateModal(false)
      setCreateForm({
        member: '',
        title: '',
        description: '',
        category: 'GENERAL',
        target_value: 1,
        target_unit: 'COUNT',
        due_date: format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')
      })
      fetchTasks()
    } catch (err) {
      console.error('Create task error:', err)
      toast.error('Failed to create task')
    } finally {
      setSubmittingCreate(false)
    }
  }

  const handleOpenReview = (task) => {
    setTaskToReview(task)
    setReviewForm({
      status: task.status === 'SUBMITTED' ? 'COMPLETED' : task.status,
      achieved_value: task.achieved_value || task.target_value,
      review_notes: task.review_notes || ''
    })
  }

  const handleConfirmReview = async (e) => {
    e.preventDefault()
    if (!taskToReview) return

    setSubmittingReview(true)
    try {
      await mrmApi.tasks.review(taskToReview.id, reviewForm)
      toast.success(`Task #${taskToReview.task_number} review updated (${reviewForm.status})!`)
      setTaskToReview(null)
      fetchTasks()
    } catch (err) {
      console.error('Review task error:', err)
      toast.error('Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return
    try {
      await mrmApi.tasks.delete(taskToDelete.id)
      toast.success('Task deleted')
      setTaskToDelete(null)
      fetchTasks()
    } catch (err) {
      console.error('Delete task error:', err)
      toast.error('Failed to delete task')
    }
  }

  const displayTasks = tasks.filter((t) => {
    if (!searchMember.trim()) return true
    const q = searchMember.toLowerCase()
    return (
      t.task_number?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q) ||
      t.member_name?.toLowerCase().includes(q)
    )
  })

  // Quick stats
  const activeCount = tasks.filter(t => ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length
  const submittedCount = tasks.filter(t => t.status === 'SUBMITTED').length
  const overdueCount = tasks.filter(t => t.is_overdue || t.status === 'OVERDUE').length
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length

  const getStatusBadge = (st) => {
    switch (st) {
      case 'COMPLETED': return <span className="badge badge-green">Completed</span>
      case 'SUBMITTED': return <span className="badge badge-yellow">Awaiting Review</span>
      case 'IN_PROGRESS': return <span className="badge badge-blue">In Progress</span>
      case 'ASSIGNED': return <span className="badge badge-blue">Assigned</span>
      case 'OVERDUE': return <span className="badge badge-red">Overdue</span>
      case 'REJECTED': return <span className="badge badge-red">Rejected</span>
      default: return <span className="badge badge-gray">{st}</span>
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Metric Cards */}
      <div className="stats-grid">
        <StatCard
          label="Active In Progress"
          value={activeCount}
          icon={<Clock size={20} color="var(--primary-600)" />}
          sub="Ongoing assignments"
        />
        <StatCard
          label="Awaiting Review"
          value={submittedCount}
          variant="warning"
          icon={<Eye size={20} color="var(--warning)" />}
          sub="Pending proof verification"
        />
        <StatCard
          label="Overdue Tasks"
          value={overdueCount}
          variant="danger"
          icon={<AlertTriangle size={20} color="var(--danger)" />}
          sub="Passed deadline"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          variant="success"
          icon={<CheckCircle2 size={20} color="var(--success)" />}
          sub="Verified and finalized"
        />
      </div>

      {/* Control Header & Filters */}
      <FilterBar
        search={searchMember}
        onSearch={setSearchMember}
        placeholder="Search task #, title, or member name..."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted for Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          <select
            className="form-control"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="">All Categories</option>
            <option value="SERVICE">Trust Service</option>
            <option value="RECRUITMENT">Referrals</option>
            <option value="DONATION">Donations</option>
            <option value="FIELD_WORK">Field Work</option>
            <option value="COMMUNITY">Community</option>
            <option value="GENERAL">General</option>
          </select>

          {(searchMember || statusFilter || categoryFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setCategoryFilter(''); setSearchMember(''); }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            Create Task
          </button>
        </div>
      </FilterBar>

      {/* Tasks Table */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Assigned Objectives & Targets
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {displayTasks.length} Total
            </span>
          </div>
          <div className="data-card-actions">
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Showing {displayTasks.length} of {tasks.length} tasks
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : displayTasks.length === 0 ? (
          <EmptyState
            title="No Tasks Found"
            message="No member tasks match the selected filters."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Task & Category</th>
                  <th style={{ width: '20%' }}>Assigned Member</th>
                  <th style={{ width: '22%' }}>Target Progress</th>
                  <th style={{ width: '12%' }}>Due Date</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayTasks.map((t) => {
                  const percent = Math.min(100, Math.round(t.completion_percentage || 0))
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="td-mono">#{t.task_number}</span>
                          <span>{t.title}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                          Category: <strong>{t.category?.replace(/_/g, ' ')}</strong>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{t.member_name}</div>
                        <div className="td-mono" style={{ fontSize: 11, color: 'var(--gray-500)' }}>{t.member_id_str}</div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                            {t.achieved_value} / {t.target_value} {t.target_unit}
                          </span>
                          <span style={{ fontWeight: 700, color: percent >= 100 ? 'var(--success)' : 'var(--primary-700)' }}>
                            {percent}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'var(--gray-200)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percent}%`,
                              height: '100%',
                              background: percent >= 100 ? 'var(--success)' : 'var(--primary-600)',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                      </td>

                      <td>
                        <div style={{ color: t.is_overdue ? 'var(--danger)' : 'var(--gray-700)', fontWeight: t.is_overdue ? 700 : 500, fontSize: 13 }}>
                          {t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '—'}
                        </div>
                        {t.is_overdue && (
                          <span className="badge badge-red" style={{ fontSize: 10, padding: '1px 5px', marginTop: 2 }}>
                            Overdue
                          </span>
                        )}
                      </td>

                      <td>
                        {getStatusBadge(t.status)}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          {t.status === 'SUBMITTED' ? (
                            <button
                              onClick={() => handleOpenReview(t)}
                              className="btn btn-warning btn-sm"
                              title="Review Evidence"
                            >
                              <Eye size={12} />
                              Review
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenReview(t)}
                              className="btn btn-secondary btn-sm"
                              title="Update Status"
                            >
                              Update
                            </button>
                          )}

                          <button
                            onClick={() => setTaskToDelete(t)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                            title="Delete Task"
                          >
                            <Trash2 size={12} />
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
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <Modal
          isOpen={true}
          title="Create & Assign New Member Task"
          onClose={() => setShowCreateModal(false)}
        >
          <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Select Member</label>
              <select
                className="form-control"
                value={createForm.member}
                onChange={(e) => setCreateForm({ ...createForm, member: e.target.value })}
                required
              >
                <option value="">-- Choose Member --</option>
                {membersList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Task Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Host Blood Donation Awareness Camp"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                required
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                >
                  <option value="SERVICE">Trust Service Contribution</option>
                  <option value="RECRUITMENT">Member Referral / Enrollment</option>
                  <option value="DONATION">Subscription / Donation Drive</option>
                  <option value="FIELD_WORK">Field Assessment</option>
                  <option value="COMMUNITY">Community Participation</option>
                  <option value="GENERAL">General Activity</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Deadline Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Target Goal Value</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={createForm.target_value}
                  onChange={(e) => setCreateForm({ ...createForm, target_value: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Measurement Unit</label>
                <select
                  className="form-control"
                  value={createForm.target_unit}
                  onChange={(e) => setCreateForm({ ...createForm, target_unit: e.target.value })}
                >
                  <option value="COUNT">Count / Persons</option>
                  <option value="AMOUNT">Amount (₹ INR)</option>
                  <option value="HOURS">Hours</option>
                  <option value="VISITS">Visits</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Instructions & Description</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Explain the specific requirements, evidence submission instructions..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={submittingCreate}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingCreate}
              >
                <Plus size={14} />
                {submittingCreate ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Task Modal */}
      {taskToReview && (
        <Modal
          isOpen={true}
          title={`Review Task #${taskToReview.task_number}: ${taskToReview.title}`}
          onClose={() => setTaskToReview(null)}
        >
          <form onSubmit={handleConfirmReview} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Task Info Summary */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px', fontSize: 13 }}>
              <div><strong>Member:</strong> {taskToReview.member_name} ({taskToReview.member_id_str})</div>
              <div style={{ marginTop: 4 }}><strong>Target:</strong> {taskToReview.target_value} {taskToReview.target_unit}</div>
              <div style={{ marginTop: 4 }}><strong>Deadline:</strong> {taskToReview.due_date}</div>
            </div>

            {/* Member Submitted Evidence */}
            {taskToReview.evidence_notes && (
              <div style={{ background: 'var(--warning-light)', border: '1px solid #FDE68A', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px', fontSize: 13 }}>
                <strong style={{ color: '#854D0E' }}>Member Submission Evidence:</strong>
                <p style={{ margin: '4px 0 0 0', color: '#713F12' }}>{taskToReview.evidence_notes}</p>
                {taskToReview.evidence_file && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={taskToReview.evidence_file}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--primary-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ExternalLink size={13} /> View Uploaded Evidence File
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Review Decision</label>
                <select
                  className="form-control"
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  required
                >
                  <option value="COMPLETED">Approve as Completed</option>
                  <option value="IN_PROGRESS">Request Revision (In Progress)</option>
                  <option value="REJECTED">Reject Submission</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label required">Verified Achieved Value</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={reviewForm.achieved_value}
                  onChange={(e) => setReviewForm({ ...reviewForm, achieved_value: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Reviewer Notes / Feedback</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Comments on verified evidence, appreciation or reason for revision..."
                value={reviewForm.review_notes}
                onChange={(e) => setReviewForm({ ...reviewForm, review_notes: e.target.value })}
              />
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTaskToReview(null)}
                disabled={submittingReview}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingReview}
              >
                <CheckCircle2 size={14} />
                {submittingReview ? 'Submitting...' : 'Confirm Review'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Task Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Assigned Task"
        message={
          taskToDelete ? (
            <div>
              <span>Are you sure you want to delete task </span>
              <strong style={{ color: 'var(--gray-900)' }}>#{taskToDelete.task_number} ("{taskToDelete.title}")</strong>?
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.4 }}>
                This will remove the task and any submitted member progress.
              </div>
            </div>
          ) : ''
        }
        confirmText="Delete Task"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  )
}
