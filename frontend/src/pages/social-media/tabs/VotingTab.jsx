import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Send,
  Eye,
  Users,
  Phone,
  MessageCircle,
  Copy,
  Search
} from 'lucide-react'

const safeFormatDate = (val) => {
  if (!val) return ''
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return ''
    return format(d, 'dd MMM yyyy, hh:mm a')
  } catch {
    return ''
  }
}

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

  // Voter Details Modal State
  const [votersModalPoll, setVotersModalPoll] = useState(null)
  const [selectedOptionFilter, setSelectedOptionFilter] = useState('ALL')
  const [votersData, setVotersData] = useState(null)
  const [votersLoading, setVotersLoading] = useState(false)
  const [voterSearch, setVoterSearch] = useState('')

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
    if (options.length < 8) {
      setOptions([...options, ''])
    } else {
      toast.error('Maximum 8 options allowed per poll')
    }
  }

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    } else {
      toast.error('Poll must have at least 2 options')
    }
  }

  const handleOptionChange = (index, value) => {
    const next = [...options]
    next[index] = value
    setOptions(next)
  }

  const handleOpenCreateModal = () => {
    setTitle('')
    setDescription('')
    setOptions(['', ''])
    setEndTime('')
    setIsAnonymous(true)
    setShowResultsBeforeClose(true)
    setEligibleRoles('ALL')
    setIsModalOpen(true)
  }

  const handleCreatePoll = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a poll title')
      return
    }

    const validOptions = options.map(o => o.trim()).filter(Boolean)
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        options: validOptions,
        is_anonymous: isAnonymous,
        show_results_before_close: showResultsBeforeClose,
        eligible_roles: eligibleRoles,
        status: 'ACTIVE'
      }
      if (endTime) {
        payload.end_time = new Date(endTime).toISOString()
      }

      await coreApi.socialPolls.create(payload)
      toast.success('Voting campaign launched successfully!')
      setIsModalOpen(false)
      loadPolls(false)
    } catch (err) {
      console.error('Failed to create poll:', err)
      const msg = err.response?.data?.error || 'Failed to create voting campaign'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVote = async (pollId, optionId) => {
    setVotingPollId(pollId)
    try {
      const res = await coreApi.socialPolls.vote(pollId, { option_id: optionId })
      toast.success(res.data?.message || 'Vote recorded successfully')

      // Update local state smoothly
      if (res.data?.poll) {
        setPolls(prev => prev.map(p => p.id === pollId ? res.data.poll : p))
      } else {
        loadPolls(false)
      }
    } catch (err) {
      console.error('Failed to cast vote:', err)
      const msg = err.response?.data?.error || 'Failed to record vote'
      toast.error(msg)
    } finally {
      setVotingPollId(null)
    }
  }

  const handleConfirmClosePoll = async () => {
    if (!closingPoll) return
    try {
      await coreApi.socialPolls.close(closingPoll.id)
      toast.success(`Poll "${closingPoll.title}" has been closed.`)
      setClosingPoll(null)
      loadPolls(false)
    } catch (err) {
      console.error('Failed to close poll:', err)
      toast.error('Failed to close voting campaign')
    }
  }

  const handleConfirmDeletePoll = async () => {
    if (!deletingPoll) return
    try {
      await coreApi.socialPolls.delete(deletingPoll.id)
      toast.success('Poll deleted successfully.')
      setDeletingPoll(null)
      loadPolls(false)
    } catch (err) {
      console.error('Failed to delete poll:', err)
      toast.error('Failed to delete voting campaign')
    }
  }

  // Voter Details Modal logic
  const handleOpenVotersModal = async (poll, option = null) => {
    setVotersModalPoll(poll)
    setSelectedOptionFilter(option ? option.id : 'ALL')
    setVoterSearch('')
    setVotersLoading(true)
    try {
      const res = await coreApi.socialPolls.voters(poll.id)
      setVotersData(res.data)
    } catch (err) {
      console.error('Failed to fetch voter details:', err)
      toast.error('Failed to load voter details')
    } finally {
      setVotersLoading(false)
    }
  }

  const handleCloseVotersModal = () => {
    setVotersModalPoll(null)
    setVotersData(null)
    setSelectedOptionFilter('ALL')
    setVoterSearch('')
  }

  const filteredVoters = useMemo(() => {
    if (!votersData?.options) return []
    let list = []
    votersData.options.forEach(opt => {
      if (selectedOptionFilter === 'ALL' || String(selectedOptionFilter) === String(opt.option_id)) {
        (opt.voters || []).forEach(v => {
          list.push({
            ...v,
            parent_option_id: opt.option_id,
            option_text: opt.option_text || ''
          })
        })
      }
    })
    if (voterSearch.trim()) {
      const q = voterSearch.toLowerCase().trim()
      list = list.filter(v =>
        (v.full_name && String(v.full_name).toLowerCase().includes(q)) ||
        (v.phone && String(v.phone).includes(q)) ||
        (v.username && String(v.username).toLowerCase().includes(q)) ||
        (v.member_id && String(v.member_id).toLowerCase().includes(q)) ||
        (v.address && String(v.address).toLowerCase().includes(q))
      )
    }
    return list
  }, [votersData, selectedOptionFilter, voterSearch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Filter and Actions Bar */}
      <FilterBar
        title="Voting Campaigns"
        searchPlaceholder="Search voting campaigns..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          {
            label: 'All Campaigns',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Campaigns', value: 'ALL' },
              { label: 'Live Voting', value: 'ACTIVE' },
              { label: 'Closed / Concluded', value: 'CLOSED' },
              { label: 'Draft', value: 'DRAFT' }
            ]
          }
        ]}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => loadPolls(true)}
              className="btn btn-secondary btn-sm"
              title="Refresh Polls"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} />
              <span>Launch Voting Campaign</span>
            </button>
          </div>
        }
      />

      {/* Main Polls Grid */}
      {loading ? (
        <LoadingState message="Loading voting and polls directory..." />
      ) : polls.length === 0 ? (
        <EmptyState
          icon={<Vote size={42} strokeWidth={1.5} color="var(--gray-400)" />}
          title="No Voting Campaigns Found"
          message={
            search || statusFilter !== 'ALL'
              ? 'No polls matched your filter criteria.'
              : 'Launch your first verified Trust poll to engage members and volunteers in democratic decision making.'
          }
          actionLabel="Launch Voting Campaign"
          onAction={handleOpenCreateModal}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 20 }}>
          {polls.map(poll => {
            const isActive = poll.status === 'ACTIVE'
            const isClosed = poll.status === 'CLOSED'
            const total = poll.total_votes || 0

            return (
              <div
                key={poll.id}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--border-radius-md)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                {/* Header */}
                <div style={{ padding: '16px 20px 12px 20px', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 12,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          background: isActive ? '#ecfdf5' : '#f3f4f6',
                          color: isActive ? '#059669' : '#6b7280',
                          border: isActive ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#10b981' : '#9ca3af' }} />
                        {isActive ? 'LIVE VOTING' : poll.status}
                      </span>

                      {poll.is_anonymous && (
                        <span style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Lock size={11} /> Anonymous
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Vote size={13} />
                      <span>{total} {total === 1 ? 'Vote Cast' : 'Votes Cast'}</span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                    {poll.title}
                  </h3>

                  {poll.description && (
                    <p style={{ fontSize: 13, color: 'var(--gray-600)', margin: 0, lineHeight: 1.5 }}>
                      {poll.description}
                    </p>
                  )}
                </div>

                {/* Options and Live Progress List */}
                <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
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

                          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                              {isVoted && <CheckCircle2 size={13} color="var(--primary-600)" style={{ flexShrink: 0 }} />}
                              <span style={{ fontSize: 12.5, fontWeight: isVoted ? 700 : 500, color: 'var(--gray-900)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                {opt.option_text}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>
                                {opt.votes_count || 0} votes
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)', minWidth: 38, textAlign: 'right' }}>
                                {pct}%
                              </span>

                              {/* View Voter Names & Outreach Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenVotersModal(poll, opt)
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  height: 24,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: (opt.votes_count || 0) > 0 ? 'var(--primary-700)' : 'var(--gray-600)',
                                  borderColor: (opt.votes_count || 0) > 0 ? 'var(--primary-200)' : 'var(--gray-300)',
                                  background: (opt.votes_count || 0) > 0 ? '#eff6ff' : 'var(--white)',
                                  fontWeight: 600
                                }}
                                title="View voter names and details to help them"
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>

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
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--gray-500)', background: 'var(--white)', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {poll.end_time ? (
                      <span>Deadline: {safeFormatDate(poll.end_time)}</span>
                    ) : (
                      <span>Open-ended campaign</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenVotersModal(poll, null)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}
                      title="View all voter responses and details"
                    >
                      <Users size={12} />
                      <span>View All Voters ({poll.total_votes || 0})</span>
                    </button>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => setClosingPoll(poll)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11.5 }}
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

      {/* Voter Details & Help Directory Modal */}
      {votersModalPoll && (
        <Modal
          isOpen={true}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--primary-50)',
                  border: '1px solid var(--primary-200)',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--gray-900)' }}>
                  Voter Details & Support Directory
                </div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--gray-500)', marginTop: 2 }}>
                  {votersModalPoll.title}
                </div>
              </div>
            </div>
          }
          onClose={handleCloseVotersModal}
          size="modal-lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter Pills for options */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--gray-200)' }}>
              <button
                type="button"
                onClick={() => setSelectedOptionFilter('ALL')}
                className={`btn btn-sm ${selectedOptionFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 20, fontSize: 12, padding: '4px 12px' }}
              >
                All Options ({votersData?.total_votes || 0})
              </button>
              {votersData?.options?.map(opt => {
                const isSelected = selectedOptionFilter === opt.option_id
                return (
                  <button
                    key={opt.option_id}
                    type="button"
                    onClick={() => setSelectedOptionFilter(opt.option_id)}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      borderRadius: 20,
                      fontSize: 12,
                      padding: '4px 12px',
                      maxWidth: 320,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                    title={opt.option_text}
                  >
                    {opt.option_text} ({opt.votes_count})
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input
                  type="text"
                  placeholder="Search by person name, phone, member ID, or location..."
                  value={voterSearch}
                  onChange={(e) => setVoterSearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: 34, height: 36, fontSize: 12.5 }}
                />
              </div>
              {voterSearch && (
                <button
                  type="button"
                  onClick={() => setVoterSearch('')}
                  className="btn btn-secondary btn-sm"
                  style={{ height: 36 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Voters List Area */}
            {votersLoading ? (
              <LoadingState message="Loading voter details and contact records..." />
            ) : filteredVoters.length === 0 ? (
              <EmptyState
                icon={<Users size={42} strokeWidth={1.5} color="var(--gray-400)" />}
                title="No voters found"
                message={voterSearch ? 'No voters match your search criteria.' : 'No votes recorded for this option yet.'}
              />
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                {filteredVoters.map((voter, vIdx) => {
                  const rawPhone = String(voter?.phone || '')
                  const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
                  const displayName = String(voter?.full_name || voter?.username || 'Voter')
                  const initial = displayName.charAt(0).toUpperCase()
                  const formattedVotedAt = safeFormatDate(voter?.voted_at)

                  return (
                    <div
                      key={voter?.vote_id || vIdx}
                      style={{
                        background: 'var(--white)',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Left: Avatar & Voter details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 16,
                            flexShrink: 0
                          }}
                        >
                          {initial}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
                              {displayName}
                            </span>
                            {voter?.member_id && (
                              <span style={{ fontSize: 11, padding: '1px 6px', background: 'var(--gray-100)', color: 'var(--gray-700)', borderRadius: 4, fontWeight: 600 }}>
                                ID: {voter.member_id}
                              </span>
                            )}
                            <span style={{ fontSize: 10.5, padding: '1px 6px', background: voter?.role === 'MEMBER' ? '#e0f2fe' : '#fef3c7', color: voter?.role === 'MEMBER' ? '#0369a1' : '#b45309', borderRadius: 4, fontWeight: 600 }}>
                              {voter?.role || 'MEMBER'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap', fontSize: 12, color: 'var(--gray-600)' }}>
                            {cleanPhone ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--gray-900)' }}>
                                <Phone size={11} color="var(--gray-500)" />
                                {cleanPhone}
                              </span>
                            ) : null}
                            {voter?.address ? (
                              <span style={{ color: 'var(--gray-600)', fontSize: 11.5 }}>
                                • {voter.address}
                              </span>
                            ) : null}
                            {formattedVotedAt ? (
                              <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>
                                • {formattedVotedAt}
                              </span>
                            ) : null}
                          </div>

                          {/* Option badge */}
                          <div style={{ marginTop: 6 }}>
                            <span style={{ fontSize: 11.5, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 12, display: 'inline-block' }}>
                              Option: <strong>{voter.option_text}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Assistance Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {cleanPhone ? (
                          <>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="btn btn-secondary btn-sm"
                              style={{ height: 28, padding: '2px 9px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                              title="Call member directly"
                            >
                              <Phone size={12} />
                              <span>Call</span>
                            </a>
                            <a
                              href={`https://wa.me/91${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ height: 28, padding: '2px 9px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#059669', borderColor: '#a7f3d0' }}
                              title="Message via WhatsApp"
                            >
                              <MessageCircle size={12} />
                              <span>WhatsApp</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cleanPhone)
                                toast.success(`Phone copied: ${cleanPhone}`)
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ height: 28, padding: '2px 7px' }}
                              title="Copy phone number"
                            >
                              <Copy size={12} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>
                            No phone recorded
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--gray-200)', paddingTop: 12, marginTop: 4, fontSize: 12, color: 'var(--gray-500)' }}>
              <span>Showing <strong>{filteredVoters.length}</strong> voter response{filteredVoters.length === 1 ? '' : 's'}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCloseVotersModal}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
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
                placeholder="e.g. Select Location for Annual Medical Camp 2026"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description / Instructions</label>
              <textarea
                rows={3}
                placeholder="Provide additional context or instructions for voters..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="form-control"
              />
            </div>

            {/* Voting Options */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Ballot Options ({options.length}/8)</span>
                {options.length < 8 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="btn btn-secondary btn-sm"
                    style={{ height: 22, padding: '0 6px', fontSize: 11 }}
                  >
                    <Plus size={11} /> Add Option
                  </button>
                )}
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', minWidth: 20 }}>
                      {i + 1}.
                    </div>
                    <input
                      type="text"
                      required
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={e => handleOptionChange(i, e.target.value)}
                      className="form-control"
                      style={{ flex: 1 }}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="btn btn-secondary btn-sm"
                        style={{ height: 34, padding: '0 8px', color: 'var(--danger)' }}
                        title="Remove option"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Target Audience & Schedule */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Eligible Roles</label>
                <select
                  value={eligibleRoles}
                  onChange={e => setEligibleRoles(e.target.value)}
                  className="form-control"
                >
                  <option value="ALL">Everyone (Members & Staff)</option>
                  <option value="MEMBER">Members Only</option>
                  <option value="STAFF,MANAGER,ADMIN">Trust Staff Only</option>
                  <option value="VOLUNTEER">Volunteers Only</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Voting Deadline (Optional)</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            {/* Integrity Flags */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="anonCheck"
                  checked={isAnonymous}
                  onChange={e => setIsAnonymous(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="anonCheck" style={{ fontSize: 12.5, color: 'var(--gray-800)', cursor: 'pointer' }}>
                  <strong>Anonymous Ballot:</strong> Hide voter identities from public feed.
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
