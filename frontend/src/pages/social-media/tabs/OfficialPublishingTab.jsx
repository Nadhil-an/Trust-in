import React, { useState, useEffect } from 'react'
import { coreApi } from '../../../api'
import { LoadingState, EmptyState } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Megaphone,
  Image as ImageIcon,
  Video,
  Send,
  Pin,
  MapPin,
  Phone,
  ShieldCheck,
  Heart,
  MessageSquare,
  X
} from 'lucide-react'

export default function OfficialPublishingTab() {
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('Sree Lakshmi Charitable Trust HQ')
  const [contactNumber, setContactNumber] = useState('')
  const [isPinned, setIsPinned] = useState(true)
  const [images, setImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [videoFile, setVideoFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Published announcements history
  const [officialPosts, setOfficialPosts] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadOfficialPosts = async () => {
    setLoadingHistory(true)
    try {
      const res = await coreApi.memberPosts.list({ post_category: 'OFFICIAL_TRUST', status: 'ALL' })
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setOfficialPosts(list)
    } catch (err) {
      console.error('Failed to load official posts:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadOfficialPosts()
  }, [])

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed per official announcement')
      return
    }
    setImages(prev => [...prev, ...files])
    const newPreviews = files.map(file => URL.createObjectURL(file))
    setImagePreviews(prev => [...prev, ...newPreviews])
  }

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handlePublish = async (e) => {
    e.preventDefault()
    if (!description.trim()) {
      toast.error('Announcement message cannot be empty')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('description', description.trim())
      formData.append('post_category', 'OFFICIAL_TRUST')
      formData.append('post_type', 'AWARENESS')
      formData.append('is_pinned', isPinned ? 'true' : 'false')
      if (address) formData.append('address', address)
      if (contactNumber) formData.append('contact_number', contactNumber)

      images.forEach(img => {
        formData.append('images', img)
      })

      if (videoFile) {
        formData.append('video', videoFile)
      }

      await coreApi.memberPosts.create(formData)
      toast.success('Official Trust Announcement published and pushed to all members!')

      // Reset form
      setDescription('')
      setImages([])
      setImagePreviews([])
      setVideoFile(null)
      loadOfficialPosts()
    } catch (err) {
      console.error('Publish error:', err)
      toast.error(err.response?.data?.detail || 'Failed to publish announcement')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Composer Row (Form on Left, Live Mobile Preview on Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1.3fr) minmax(300px, 0.7fr)', gap: '20px', alignItems: 'start' }}>
        {/* Left: Compose Form in Data Card */}
        <div className="data-card" style={{ marginBottom: 0 }}>
          <div className="data-card-header">
            <div className="data-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={18} color="var(--primary-700)" />
              Compose Official Trust Announcement
            </div>
          </div>

          <form onSubmit={handlePublish} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Description / Content */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">Announcement Content</label>
              <textarea
                rows={5}
                className="form-control"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Write official Trust announcement, directives, or event news here..."
                required
              />
            </div>

            {/* Quick Details (Contact & Location) */}
            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Official Contact Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={contactNumber}
                  onChange={e => setContactNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Issuer / Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Sree Lakshmi Trust HQ"
                />
              </div>
            </div>

            {/* Media Uploaders */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Media Attachments (Up to 5 Photos & 1 Video)</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <ImageIcon size={14} />
                  Add Images
                  <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>

                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                  <Video size={14} />
                  Add Video
                  <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0] || null)} style={{ display: 'none' }} />
                </label>

                {videoFile && (
                  <span style={{ fontSize: 12, color: 'var(--primary-700)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Video size={13} /> {videoFile.name}
                    <button type="button" onClick={() => setVideoFile(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center' }}>
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>

              {/* Image previews */}
              {imagePreviews.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {imagePreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', width: 60, height: 60, borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', border: '1px solid var(--gray-300)' }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pin to top toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--gray-200)' }}>
              <input
                type="checkbox"
                id="pinToggle"
                checked={isPinned}
                onChange={e => setIsPinned(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="pinToggle" style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Pin size={14} color="var(--primary-600)" /> Pin this announcement to the top of member mobile feeds
              </label>
            </div>

            {/* Publish Action Button */}
            <div style={{ paddingTop: 4 }}>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim()}
                className="btn btn-primary"
              >
                <Send size={14} />
                {isSubmitting ? 'Publishing & Broadcasting...' : 'Broadcast Official Announcement'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live Interactive Mobile Feed Preview */}
        <div style={{
          background: 'var(--gray-900)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow-lg)',
          color: '#F8FAFC'
        }}>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginBottom: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Live Mobile App Preview
          </div>

          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--border-radius)',
            overflow: 'hidden',
            color: 'var(--gray-900)',
            border: '1px solid var(--gray-200)'
          }}>
            {/* Mobile Post Header */}
            <div style={{ padding: '14px', borderBottom: '1px solid var(--gray-100)' }}>
              {isPinned && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-700)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Pin size={12} /> PINNED ANNOUNCEMENT
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-900)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                  SLT
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 13, color: 'var(--gray-900)' }}>
                    <span>Sree Lakshmi Trust</span>
                    <ShieldCheck size={14} color="var(--primary-600)" />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                    Official Account &bull; Just now
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Post Body */}
            <div style={{ padding: '14px', fontSize: 12.5, color: 'var(--gray-800)', lineHeight: 1.5 }}>
              {description ? description : (
                <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>
                  Your official announcement text will preview here in real time as you type...
                </span>
              )}
            </div>

            {/* Preview Media */}
            {imagePreviews.length > 0 && (
              <div style={{ width: '100%', height: 180, background: '#000', overflow: 'hidden' }}>
                <img src={imagePreviews[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Footer / Location */}
            <div style={{ padding: '10px 14px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', fontSize: 11, color: 'var(--gray-500)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {address || 'Trust HQ'}</span>
              <span><Heart size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Like &bull; <MessageSquare size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Comment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Published Announcements History in Data Card */}
      <div className="data-card">
        <div className="data-card-header">
          <div className="data-card-title">
            Published Official Announcements
            <span className="badge badge-gray" style={{ marginLeft: 8 }}>
              {officialPosts.length} Broadcasted
            </span>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '40px 0' }}>
            <LoadingState />
          </div>
        ) : officialPosts.length === 0 ? (
          <EmptyState
            title="No official announcements yet"
            message="Compose your first announcement above to broadcast official notices to members."
          />
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {officialPosts.map(post => (
              <div
                key={post.id}
                style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: post.is_pinned ? '1px solid var(--primary-400)' : '1px solid var(--gray-200)',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {post.is_pinned && (
                      <span className="badge badge-blue" style={{ fontSize: 10, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Pin size={10} /> PINNED
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {post.created_at ? format(new Date(post.created_at), 'dd MMM yyyy, hh:mm a') : 'Recently'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>&bull; {post.likes_count || 0} likes &bull; {post.comments_count || 0} comments</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-800)', lineHeight: 1.4 }}>
                    {post.description}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-green">
                    LIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
