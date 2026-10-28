import React, { useState, useEffect } from 'react'
import { mrmApi } from '../../../api'
import { LoadingState, EmptyState } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Trophy, Send, Upload, User, Image as ImageIcon, Heart, MessageSquare, Share2 } from 'lucide-react'

export default function MRMAppreciationTab() {
  const [membersList, setMembersList] = useState([])
  const [badgesList, setBadgesList] = useState([])
  const [appreciations, setAppreciations] = useState([])
  const [loading, setLoading] = useState(true)

  // Composer Form State
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [badgeKey, setBadgeKey] = useState('')
  const [category, setCategory] = useState('SPECIAL_RECOGNITION')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [publishing, setPublishing] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [membersRes, badgesRes, appRes] = await Promise.all([
        mrmApi.members.list({ limit: 100 }),
        mrmApi.badges.list(),
        mrmApi.appreciations.list()
      ])
      setMembersList(membersRes.data?.results || [])
      setBadgesList(badgesRes.data || [])
      setAppreciations(appRes.data || [])
    } catch (err) {
      console.error('Failed to load appreciation studio data:', err)
      toast.error('Failed to load appreciation data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleMemberChange = (id) => {
    setSelectedMemberId(id)
    const found = membersList.find(m => m.id === id)
    setSelectedMember(found || null)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handlePublish = async (e) => {
    e.preventDefault()
    if (!selectedMemberId) {
      toast.error('Please select an eligible member to recognize.')
      return
    }
    if (!title.trim() || !description.trim()) {
      toast.error('Title and appreciation message are required.')
      return
    }

    setPublishing(true)
    try {
      const formData = new FormData()
      formData.append('member_id', selectedMemberId)
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('recognition_category', category)
      if (badgeKey) formData.append('badge_key', badgeKey)
      if (imageFile) formData.append('image', imageFile)

      await mrmApi.appreciations.publish(formData)
      toast.success('Official Trust Appreciation post published to the social feed!')

      // Reset
      setSelectedMemberId('')
      setSelectedMember(null)
      setBadgeKey('')
      setTitle('')
      setDescription('')
      setImageFile(null)
      setImagePreview(null)
      loadData()
    } catch (err) {
      console.error('Publish appreciation error:', err)
      toast.error('Failed to publish appreciation post')
    } finally {
      setPublishing(false)
    }
  }

  const selectedBadgeObj = badgesList.find(b => b.badge_key === badgeKey)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Two Column Layout: Composer (Left) + Live Mobile Preview (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1.3fr) minmax(300px, 0.7fr)', gap: '20px', alignItems: 'start' }}>
        {/* Left: Composer Form in Data Card */}
        <div className="data-card" style={{ marginBottom: 0 }}>
          <div className="data-card-header">
            <div className="data-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={18} color="var(--primary-700)" />
              Compose Official Member Appreciation
            </div>
          </div>

          <form onSubmit={handlePublish} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Member Selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Select Member to Recognize</label>
              <select
                className="form-control"
                value={selectedMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                required
              >
                <option value="">-- Choose Member --</option>
                {membersList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.member_id}) - {m.earned_badges_summary || 'No badges'}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Member Preview Card */}
            {selectedMember && (
              <div style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                {selectedMember.photo ? (
                  <img
                    src={selectedMember.photo}
                    alt={selectedMember.full_name}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--primary-700)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}>
                    {selectedMember.full_name?.charAt(0) || 'M'}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 13 }}>{selectedMember.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    ID: {selectedMember.member_id} &bull; Badges: <strong style={{ color: 'var(--warning)' }}>{selectedMember.earned_badges_summary}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Recognition Category & Badge Tier */}
            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Recognition Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="SPECIAL_RECOGNITION">Special Recognition</option>
                  <option value="SERVICE_EXCELLENCE">Trust Service Excellence</option>
                  <option value="REFERRAL_CHAMPION">Referral Milestone</option>
                  <option value="DONATION_CONTRIBUTOR">Generous Contributor</option>
                  <option value="VOLUNTEER_HERO">Volunteer Distinction</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Featured Badge</label>
                <select
                  className="form-control"
                  value={badgeKey}
                  onChange={(e) => setBadgeKey(e.target.value)}
                >
                  <option value="">-- Optional Badge Tag --</option>
                  {badgesList.map((b) => (
                    <option key={b.badge_key} value={b.badge_key}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Post Title */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Appreciation Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Saluting Dedication: Outstanding Service by Nadil Ali"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Commendation Message</label>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Write the Trust recognition message celebrating this member's achievements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Optional Photo Attachment */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Commemorative Photo (Optional)</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>

            <div style={{ paddingTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={publishing}
              >
                <Send size={14} />
                {publishing ? 'Publishing to Community...' : 'Publish Official Trust Appreciation'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live Mobile App Feed Preview */}
        <div style={{
          background: 'var(--gray-900)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow-lg)',
          color: '#F8FAFC'
        }}>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginBottom: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Live Mobile Feed Preview
          </div>

          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--border-radius)',
            overflow: 'hidden',
            color: 'var(--gray-900)',
            border: '1px solid var(--gray-200)'
          }}>
            {/* Trust Official Header */}
            <div style={{
              background: 'var(--primary-900)',
              padding: '12px 14px',
              color: 'var(--white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>Sree Lakshmi Charitable Trust</div>
                <div style={{ fontSize: 10.5, color: 'var(--primary-200)' }}>Official Appreciation</div>
              </div>
              <span className="badge badge-yellow" style={{ fontSize: 10, padding: '2px 8px' }}>
                OFFICIAL
              </span>
            </div>

            {/* Ribbon Banner */}
            <div style={{
              background: 'var(--warning-light)',
              borderBottom: '1px solid #FDE68A',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#92400E',
              fontWeight: 700
            }}>
              <span>SPECIAL TRUST RECOGNITION</span>
              {selectedBadgeObj && (
                <span className="badge badge-yellow" style={{ fontSize: 10 }}>
                  {selectedBadgeObj.name}
                </span>
              )}
            </div>

            {/* Recognized Member Header */}
            <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedMember?.photo ? (
                <img
                  src={selectedMember.photo}
                  alt={selectedMember.full_name}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--warning)' }}
                />
              ) : (
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--warning)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 15
                }}>
                  {selectedMember?.full_name?.charAt(0) || 'M'}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-900)' }}>
                  {selectedMember?.full_name || 'Member Full Name'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>
                  Member #{selectedMember?.member_id || 'SLT-00000'}
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div style={{ padding: '0 14px 14px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)', marginBottom: 4 }}>
                {title || 'Saluting Outstanding Dedication'}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                {description || 'The Trustees and members proudly appreciate and celebrate the exemplary community contributions of our esteemed member.'}
              </p>
            </div>

            {/* Uploaded Photo Preview in Card */}
            {imagePreview && (
              <div style={{ width: '100%', maxHeight: 200, overflow: 'hidden' }}>
                <img
                  src={imagePreview}
                  alt="Appreciation preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            {/* Footer Action Icons */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', color: 'var(--gray-500)', fontSize: 11.5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Heart size={13} /> Like (0)</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MessageSquare size={13} /> Comments (0)</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Share2 size={13} /> Share</span>
            </div>
          </div>
        </div>
      </div>

      {/* Published Appreciations Timeline in Data Card */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Recent Published Trust Appreciations
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {appreciations.length} Published
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : appreciations.length === 0 ? (
          <EmptyState title="No Appreciations Yet" message="No official member appreciations have been published yet." />
        ) : (
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {appreciations.map((ap) => (
              <div key={ap.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {ap.member_photo ? (
                    <img src={ap.member_photo} alt={ap.member_name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-700)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                      {ap.member_name?.charAt(0) || 'M'}
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--gray-900)' }}>{ap.member_name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {ap.created_at ? format(new Date(ap.created_at), 'MMM d, yyyy') : ''}
                    </div>
                  </div>
                  {ap.badge_name && (
                    <span className="badge badge-yellow" style={{ marginLeft: 'auto', fontSize: 10 }}>
                      {ap.badge_name}
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-900)' }}>{ap.post_title}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {ap.post_description}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-200)', paddingTop: 8 }}>
                  Approved & Published by <strong>{ap.approved_by_name || 'Trust Admin'}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
