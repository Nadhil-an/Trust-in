import React, { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { coreApi } from '../../../api'
import { StatCard, LoadingState, EmptyState } from '../../../components/shared'
import toast from 'react-hot-toast'
import {
  Users,
  Clock,
  Globe,
  Megaphone,
  BadgeCheck,
  Vote,
  Handshake,
  MessageSquare,
  RefreshCw
} from 'lucide-react'

const PIE_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#8B5CF6']

export default function AnalyticsTab({ onNavigateTab }) {
  const [period, setPeriod] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = { period }
      if (period === 'custom') {
        if (customStart) params.start_date = customStart
        if (customEnd) params.end_date = customEnd
      }
      const res = await coreApi.socialAnalytics.get(params)
      setData(res.data)
    } catch (err) {
      console.error('Failed to load social analytics:', err)
      toast.error('Unable to fetch live analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const handleCustomApply = (e) => {
    e.preventDefault()
    if (!customStart) {
      toast.error('Please pick a start date')
      return
    }
    fetchAnalytics()
  }

  const summary = data?.summary || {}
  const charts = data?.charts || {}

  const categoryData = [
    { name: 'Public Issues', value: charts.category_distribution?.PUBLIC || 0 },
    { name: 'Self Posts', value: charts.category_distribution?.SELF || 0 },
    { name: 'Official Trust', value: charts.category_distribution?.OFFICIAL_TRUST || 0 },
  ].filter(c => c.value > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Timeframe Filter Bar */}
      <div className="filter-bar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-600)', marginRight: '6px' }}>
            Timeframe:
          </span>
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'this_year', label: 'This Year' },
            { id: 'custom', label: 'Custom' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {period === 'custom' && (
            <form onSubmit={handleCustomApply} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="form-control"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
              />
              <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="form-control"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Apply
              </button>
            </form>
          )}

          <button
            onClick={fetchAnalytics}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={13} />
            Refresh Data
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0' }}>
          <LoadingState />
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="stats-grid">
            <StatCard
              label="Registered Members"
              value={summary.total_members || 0}
              sub={`+${summary.new_members || 0} new in period`}
              icon={<Users size={20} color="var(--primary-700)" />}
              variant="blue"
            />
            <StatCard
              label="Pending Post Approvals"
              value={summary.pending_post_approvals || 0}
              sub="Action required"
              icon={<Clock size={20} color="var(--warning)" />}
              variant={summary.pending_post_approvals > 0 ? "warning" : ""}
              onClick={() => onNavigateTab && onNavigateTab('posts')}
            />
            <StatCard
              label="Published Public Posts"
              value={summary.published_public_posts || 0}
              sub={`Out of ${summary.total_posts || 0} total posts`}
              icon={<Globe size={20} color="var(--success)" />}
              variant="success"
            />
            <StatCard
              label="Official Announcements"
              value={summary.published_official_posts || 0}
              sub="Official Trust posts"
              icon={<Megaphone size={20} color="var(--primary-600)" />}
              variant="blue"
              onClick={() => onNavigateTab && onNavigateTab('official')}
            />
            <StatCard
              label="Pending Verifications"
              value={summary.pending_verifications || 0}
              sub="Awaiting doc review"
              icon={<BadgeCheck size={20} color="var(--warning)" />}
              variant={summary.pending_verifications > 0 ? "warning" : ""}
              onClick={() => onNavigateTab && onNavigateTab('verifications')}
            />
            <StatCard
              label="Active Voting Polls"
              value={summary.active_voting_campaigns || 0}
              sub="Live community polls"
              icon={<Vote size={20} color="var(--primary-700)" />}
              variant="blue"
              onClick={() => onNavigateTab && onNavigateTab('voting')}
            />
            <StatCard
              label="POM Messages Live"
              value={summary.pom_messages_published || 0}
              sub="Public cooperation requests"
              icon={<Handshake size={20} color="var(--success)" />}
              variant="success"
              onClick={() => onNavigateTab && onNavigateTab('pom')}
            />
            <StatCard
              label="Total Engagement"
              value={summary.total_engagement || 0}
              sub={`${summary.period_likes || 0} likes • ${summary.period_comments || 0} comments`}
              icon={<MessageSquare size={20} color="var(--info)" />}
              variant="info"
            />
          </div>

          {/* Row 1 Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
            {/* Member Growth */}
            <div className="data-card" style={{ marginBottom: 0 }}>
              <div className="data-card-header">
                <div>
                  <div className="data-card-title">Member Growth Trajectory</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                    Daily new member registrations across selected timeframe
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: 260 }}>
                {charts.member_growth && charts.member_growth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.member_growth}>
                      <defs>
                        <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1E4DB7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1E4DB7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" name="New Members" stroke="#1E4DB7" strokeWidth={2} fillOpacity={1} fill="url(#colorMembers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No member registrations in this timeframe" message="Try expanding your date filter." />
                )}
              </div>
            </div>

            {/* Post Moderation Trends */}
            <div className="data-card" style={{ marginBottom: 0 }}>
              <div className="data-card-header">
                <div>
                  <div className="data-card-title">Posts Moderation Pipeline</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                    Volume of approved, pending and rejected content submissions
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: 260 }}>
                {charts.posts_trend && charts.posts_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.posts_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="approved" name="Approved" fill="#16A34A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="#D97706" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rejected" name="Rejected" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No post records found for this timeframe" message="Check other date periods." />
                )}
              </div>
            </div>
          </div>

          {/* Row 2 Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Engagement Trends */}
            <div className="data-card" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
              <div className="data-card-header">
                <div>
                  <div className="data-card-title">Community Interaction Velocity</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                    Daily volume of community discussions, comments and likes
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 20px', height: 250 }}>
                {charts.engagement_trends && charts.engagement_trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.engagement_trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="likes" name="Likes" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="comments" name="Comments" stroke="#1E4DB7" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No interactions recorded yet" message="Community engagement will appear once members interact." />
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="data-card" style={{ marginBottom: 0 }}>
              <div className="data-card-header">
                <div>
                  <div className="data-card-title">Content Distribution</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                    Post type allocation
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ height: 180, width: '100%' }}>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={3}
                        >
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="No posts categorized" />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                        <span style={{ color: 'var(--gray-700)', fontWeight: 500 }}>{cat.name}</span>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{cat.value} posts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
