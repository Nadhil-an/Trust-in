import React, { useState, useEffect, useCallback } from 'react'
import { coreApi } from '../../../api'
import { LoadingState, EmptyState, Modal, ConfirmModal, FilterBar } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Vote,
  Plus,
  RefreshCw,
  BarChart3,
  Trash2,
  Clock,
  Lock,
  CheckCircle2,
  X,
  Send
} from 'lucide-react'

export default function VotingTab() {
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  // Create Poll Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [endTime, setEndTime] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [showResultsBeforeClose, setShowResultsBeforeClose] = useState(true)
  const [eligibleRoles, setEligibleRoles] = useState('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Voting interaction state
  const [votingPollId, setVotingPollId] = useState(null)
  const [closingPoll, setClosingPoll] = useState(null)
  const [deletingPoll, setDeletingPoll] = useState(null)

  const loadPolls = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const params = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (search.trim()) params.search = search.trim()

      const res = await coreApi.socialPolls.list(params)
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setPolls(list)
    } catch (err) {
      console.error('Failed to load polls:', err)
      toast.error('Failed to load voting campaigns')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPolls(true)
    }, 250)
    return () => clearTimeout(timer)
  }, [loadPolls])

  // Real-time synchronization: listen for WebSocket dashboard-refresh only (NO aggressive interval polling)
  useEffect(() => {
    const handleRefresh = (e) => {
      const mod = e?.detail?.module
      if (!mod || mod === 'SOCIAL_POLLS') {
        loadPolls(false)
      }
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => {
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [loadPolls])

  const handleAddOption = () => {
    if (options.length >= 6) {
      toast.error('Maximum 6 options allowed per poll')
      return
    }
    setOptions(prev => [...prev, ''])
  }

  const handleOptionChange = (index, value) => {
    setOptions(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      toast.error('A poll requires at least 2 options')
      return
    }
    setOptions(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreatePoll = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a poll title')
      return
    }
    const validOptions = options.map(o => o.trim()).filter(Boolean)
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 valid options')
      return
    }

    setIsSubmitting(true)
    try {
      await coreApi.socialPolls.create({
        title: title.trim(),
        description: description.trim(),
        options: validOptions,
        end_time: endTime || null,
        is_anonymous: isAnonymous,
        show_results_before_close: showResultsBeforeClose,
        eligible_roles: eligibleRoles,
        status: 'ACTIVE'
      })
      toast.success('Voting campaign launched and accessible across all member apps!')
      setIsModalOpen(false)
      setTitle('')
      setDescription('')
      setOptions(['', ''])
      setEndTime('')
      loadPolls()
    } catch (err) {
      console.error('Create poll error:', err)
      toast.error(err.response?.data?.detail || 'Failed to create poll')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVote = async (pollId, optionId) => {
    setVotingPollId(pollId)
    try {
      await coreApi.socialPolls.vote(pollId, { option_id: optionId })
      toast.success('Vote recorded!')
      loadPolls()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cast vote')
    } finally {
      setVotingPollId(null)
    }
  }

  const handleConfirmClosePoll = async () => {
    if (!closingPoll) return
    try {
      await coreApi.socialPolls.update(closingPoll.id, { status: 'CLOSED' })
      toast.success('Voting closed.')
      setClosingPoll(null)
      loadPolls()
    } catch (err) {
      toast.error('Failed to close poll')
    }
  }

  const handleConfirmDeletePoll = async () => {
    if (!deletingPoll) return
    try {
      await coreApi.socialPolls.delete(deletingPoll.id)
      toast.success('Poll deleted.')
      setPolls(prev => prev.filter(p => p.id !== deletingPoll.id))
      setDeletingPoll(null)
    } catch (err) {
      toast.error('Failed to delete poll')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search voting campaigns..."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="ALL">All Campaigns</option>
            <option value="ACTIVE">Live Voting</option>
            <option value="CLOSED">Concluded Polls</option>
          </select>

          {(search || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setStatusFilter('ALL'); setSearch(''); }}
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
            Launch Voting Campaign
          </button>
        </div>
      </FilterBar>

      {/* Main Polls Grid */}
      {loading ? (
        <div style={{ padding: '40px 0' }}>
          <LoadingState />
        </div>
      ) : polls.length === 0 ? (
        <EmptyState
          title="No voting campaigns found"
          message="Engage Trust members on key community decisions by launching a voting campaign above."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
          {polls.map(poll => {
            const isActive = poll.status === 'ACTIVE'
            const totalVotes = poll.total_votes || 0

            return (
              <div
                key={poll.id}
                className="data-card"
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isActive ? '1px solid var(--primary-500)' : '1px solid var(--gray-200)'
                }}
              >
                <div style={{ padding: '20px' }}>
                  {/* Status, Turnout & Timing Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge ${isActive ? 'badge-green' : 'badge-gray'}`}>
                        {isActive ? 'LIVE VOTING' : 'CONCLUDED'}
                      </span>

                      {poll.is_anonymous && (
                        <span className="badge badge-gray" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Lock size={10} /> Anonymous
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-700)' }}>
                      {totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'} Cast
                    </span>
                  </div>

                  {/* Title and Description */}
                  <h3 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.4 }}>
                    {poll.title}
                  </h3>
                  {poll.description && (
                    <p style={{ margin: '0 0 16px 0', fontSize: 12.5, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                      {poll.description}
                    </p>
                  )}

                  {/* Dedicated Results & Options Box */}
                  <div style={{
                    background: 'var(--gray-50)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BarChart3 size={12} /> Live Results & Options
                    </div>

                    {poll.options?.map(opt => {
                      const isVoted = poll.my_voted_option_id === opt.id
                      const pct = opt.percentage || 0

                      return (
                        <div
                          key={opt.id}
                          style={{
                            background: 'var(--white)',
                            border: isVoted ? '1px solid var(--primary-500)' : '1px solid var(--gray-200)',
                            borderRadius: 'var(--border-radius-sm)',
                            padding: '8px 12px',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Progress fill bar */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bottom: 0,
                              width: `${pct}%`,
                              background: isVoted ? 'var(--primary-100)' : 'var(--gray-100)',
                              transition: 'width 0.4s ease',
                              zIndex: 0
                            }}
                          />

                          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isVoted && <CheckCircle2 size={13} color="var(--primary-600)" />}
                              <span style={{ fontSize: 12.5, fontWeight: isVoted ? 700 : 500, color: 'var(--gray-900)' }}>
                                {opt.option_text}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>
                                {opt.votes_count || 0} votes
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)', minWidth: 38, textAlign: 'right' }}>
                                {pct}%
                              </span>

                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleVote(poll.id, opt.id)}
                                  disabled={votingPollId === poll.id}
                                  className={`btn ${isVoted ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                  style={{ height: 24, padding: '2px 8px', fontSize: 11 }}
                                  title={isVoted ? 'Your currently selected vote' : 'Click to cast or change vote'}
                                >
                                  {isVoted ? 'Selected' : 'Vote'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--gray-500)', background: 'var(--white)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {poll.end_time ? (
                      <span>Deadline: {format(new Date(poll.end_time), 'dd MMM yyyy, hh:mm a')}</span>
                    ) : (
                      <span>Open-ended campaign</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => setClosingPoll(poll)}
                        className="btn btn-secondary btn-sm"
                      >
                        Close Voting
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeletingPoll(poll)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                      title="Delete Campaign"
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

      {/* Create Poll Wizard Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          title="Create New Voting Campaign"
          onClose={() => setIsModalOpen(false)}
          size="modal-md"
        >
          <form onSubmit={handleCreatePoll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Poll Question / Title</label>
              <input
                type="text"
                required
                className="form-control"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Which community health initiative should the Trust prioritize next quarter?"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description / Context (Optional)</label>
              <textarea
                rows={2}
                className="form-control"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief background information for voters..."
              />
            </div>

            {/* Dynamic Options List */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label required" style={{ marginBottom: 0 }}>Poll Options (Min: 2, Max: 6)</label>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus size={12} /> Add Option
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', width: 20 }}>
                      #{i + 1}
                    </span>
                    <input
                      type="text"
                      required
                      className="form-control"
                      value={opt}
                      onChange={e => handleOptionChange(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                        title="Remove option"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Voting Deadline */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Voting Deadline (Optional)</label>
              <input
                type="datetime-local"
                className="form-control"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>

            {/* Settings Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="anonCheck"
                  checked={isAnonymous}
                  onChange={e => setIsAnonymous(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="anonCheck" style={{ fontSize: 12.5, color: 'var(--gray-800)', cursor: 'pointer' }}>
                  <strong>Anonymous Voting:</strong> Keep individual member voting choices confidential.
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="resultsCheck"
                  checked={showResultsBeforeClose}
                  onChange={e => setShowResultsBeforeClose(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="resultsCheck" style={{ fontSize: 12.5, color: 'var(--gray-800)', cursor: 'pointer' }}>
                  <strong>Live Results:</strong> Allow voters to see live progress bars after voting.
                </label>
              </div>
            </div>

            {/* Submit */}
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
                <Vote size={14} />
                {isSubmitting ? 'Creating...' : 'Launch Voting Campaign'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Close Voting Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(closingPoll)}
        onClose={() => setClosingPoll(null)}
        onConfirm={handleConfirmClosePoll}
        title="Close Voting Campaign"
        message={
          closingPoll ? (
            <div>
              <span>Are you sure you want to close voting for </span>
              <strong style={{ color: 'var(--gray-900)' }}>"{closingPoll.title}"</strong>?
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.4 }}>
                No further member or staff votes will be accepted once closed.
              </div>
            </div>
          ) : ''
        }
        confirmText="Close Voting"
        cancelText="Cancel"
        isDanger={false}
      />

      {/* Delete Poll Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingPoll)}
        onClose={() => setDeletingPoll(null)}
        onConfirm={handleConfirmDeletePoll}
        title="Delete Voting Campaign"
        message={
          deletingPoll ? (
            <div>
              <span>Are you sure you want to permanently delete </span>
              <strong style={{ color: 'var(--gray-900)' }}>"{deletingPoll.title}"</strong>?
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.4 }}>
                All collected votes and results for this poll will be erased.
              </div>
            </div>
          ) : ''
        }
        confirmText="Delete Poll"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  )
}
