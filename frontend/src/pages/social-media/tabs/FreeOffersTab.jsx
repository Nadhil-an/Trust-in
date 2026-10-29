import React, { useState, useEffect, useCallback } from 'react'
import { rewardsAdminApi } from '../../../api'
import { LoadingState, EmptyState, Modal } from '../../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Gift,
  Award,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  Sliders,
  DollarSign,
  Activity,
  Users,
  ShieldCheck,
  ChevronRight,
  Flame,
  Smartphone,
  Navigation,
} from 'lucide-react'

export default function FreeOffersTab() {
  const [activeSubTab, setActiveSubTab] = useState('members') // 'members' | 'tiers' | 'offers' | 'redemptions'
  const [loading, setLoading] = useState(true)

  // Overview Stats
  const [overview, setOverview] = useState(null)

  // Members Data
  const [members, setMembers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  // Tiers Data
  const [tiers, setTiers] = useState([])
  const [editingTier, setEditingTier] = useState(null)
  const [tierForm, setTierForm] = useState({
    min_subscription_amount: 0,
    min_self_service_count: 0,
    name: '',
    color: '#EAB308',
    description: '',
  })

  // Offers Data
  const [offers, setOffers] = useState([])
  const [editingOffer, setEditingOffer] = useState(null)
  const [offerForm, setOfferForm] = useState({
    reward_value: 0,
    cooldown_days: 20,
    cooldown_independent: false,
    title: '',
    description: '',
    min_badge_tier_id: '',
  })

  // Redemptions Data
  const [redemptions, setRedemptions] = useState([])
  const [redemptionStatusFilter, setRedemptionStatusFilter] = useState('')
  const [actionModal, setActionModal] = useState({ open: false, redemption: null, action: 'FULFILL', remarks: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, tiersRes, offersRes, membersRes, redemptionsRes] = await Promise.all([
        rewardsAdminApi.overview(),
        rewardsAdminApi.tiers.list(),
        rewardsAdminApi.offers.list(),
        rewardsAdminApi.members({ search: memberSearch, tier: tierFilter }),
        rewardsAdminApi.redemptions.list(redemptionStatusFilter ? { status: redemptionStatusFilter } : {}),
      ])
      setOverview(overviewRes.data)
      setTiers(tiersRes.data || [])
      setOffers(offersRes.data || [])
      setMembers(membersRes.data?.results || [])
      setRedemptions(redemptionsRes.data || [])
    } catch (err) {
      console.error('Failed to load rewards administration data:', err)
      toast.error('Could not load reward data')
    } finally {
      setLoading(false)
    }
  }, [memberSearch, tierFilter, redemptionStatusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Save Tier Thresholds
  const handleSaveTier = async (e) => {
    e.preventDefault()
    if (!editingTier) return
    try {
      await rewardsAdminApi.tiers.update(editingTier.id, tierForm)
      toast.success(`Updated ${editingTier.name} thresholds!`)
      setEditingTier(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update badge tier')
    }
  }

  // Save Offer Configuration
  const handleSaveOffer = async (e) => {
    e.preventDefault()
    if (!editingOffer) return
    try {
      await rewardsAdminApi.offers.update(editingOffer.id, offerForm)
      toast.success(`Updated ${editingOffer.title} settings!`)
      setEditingOffer(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update offer')
    }
  }

  // Fulfill or Reject Redemption
  const handleFulfillAction = async () => {
    if (!actionModal.redemption) return
    try {
      await rewardsAdminApi.redemptions.action(actionModal.redemption.id, {
        action: actionModal.action,
        admin_remarks: actionModal.remarks,
      })
      toast.success(actionModal.action === 'FULFILL' ? 'Reward marked as fulfilled!' : 'Claim rejected')
      setActionModal({ open: false, redemption: null, action: 'FULFILL', remarks: '' })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process redemption')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Overview KPI Ribbon ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{overview?.total_verified_members ?? 0}</div>
            <div className="text-xs text-slate-500 font-medium">Verified Program Members</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">₹{overview?.total_subscription_amount?.toLocaleString() ?? 0}</div>
            <div className="text-xs text-slate-500 font-medium">Cycle Subscriptions</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{overview?.total_self_service_actions ?? 0}</div>
            <div className="text-xs text-slate-500 font-medium">Self-Service Actions</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {overview?.pending_redemptions ?? 0} <span className="text-xs font-normal text-slate-400">/ {overview?.total_redemptions ?? 0} total</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">Pending Claim Fulfillments</div>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveSubTab('members')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeSubTab === 'members'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Member Performance</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tiers')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeSubTab === 'tiers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Badge Qualification Settings</span>
        </button>

        <button
          onClick={() => setActiveSubTab('offers')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeSubTab === 'offers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Free Offers & Cooldowns</span>
        </button>

        <button
          onClick={() => setActiveSubTab('redemptions')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
            activeSubTab === 'redemptions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Redemption Claims</span>
          {Boolean(overview?.pending_redemptions) && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
              {overview.pending_redemptions}
            </span>
          )}
        </button>
      </div>

      {/* ── SubTab 1: Member Performance Monitoring ── */}
      {activeSubTab === 'members' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search member name, username..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Badge Tiers</option>
                {tiers.map((t) => (
                  <option key={t.tier_key} value={t.tier_key}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>

              <button
                onClick={loadData}
                className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Active Badge</th>
                  <th className="px-4 py-3">Active 30-Day Cycle</th>
                  <th className="px-4 py-3">Subscription Amount</th>
                  <th className="px-4 py-3">Self-Service Count</th>
                  <th className="px-4 py-3">Redemptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      No members matching the criteria found.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{m.full_name || m.username}</div>
                        <div className="text-xs text-slate-400">@{m.username} • {m.role}</div>
                      </td>
                      <td className="px-4 py-3">
                        {m.is_verified ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.badge ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: `${m.badge.color}20`,
                              color: m.badge.color,
                              border: `1px solid ${m.badge.color}`,
                            }}
                          >
                            <span className="mr-1">{m.badge.icon}</span> {m.badge.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No Badge Yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.cycle ? (
                          <div>
                            <span className="font-medium text-slate-700">Cycle #{m.cycle.cycle_number}</span>
                            <div className="text-xs text-slate-400">
                              {m.cycle.start_date} to {m.cycle.end_date}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        ₹{(m.cycle?.subscription_amount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">
                        {m.cycle?.self_service_count ?? 0} activities
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700">
                          {m.redemptions_count} claim{m.redemptions_count !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SubTab 2: Badge Qualification Settings ── */}
      {activeSubTab === 'tiers' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-center justify-between">
            <div>
              <strong>Dynamic Badge Configuration:</strong> Qualification is calculated strictly using Subscription Amount and Self-Service Count. Referrals are excluded completely.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{tier.icon}</span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
                    >
                      Tier #{tier.level_order}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">{tier.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tier.description}</p>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Min Subscription:</span>
                      <span className="font-bold text-emerald-700">₹{tier.min_subscription_amount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Min Self-Service:</span>
                      <span className="font-bold text-indigo-700">{tier.min_self_service_count} actions</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingTier(tier)
                    setTierForm({
                      name: tier.name,
                      color: tier.color,
                      min_subscription_amount: tier.min_subscription_amount,
                      min_self_service_count: tier.min_self_service_count,
                      description: tier.description,
                    })
                  }}
                  className="mt-4 w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure Thresholds</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SubTab 3: Free Offers & Cooldowns ── */}
      {activeSubTab === 'offers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {offers.map((offer) => {
              const isPetrol = offer.offer_key === 'PETROL'
              const isRecharge = offer.offer_key === 'RECHARGE'
              const isTour = offer.offer_key === 'TOUR'

              return (
                <div key={offer.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        {isPetrol && <Flame className="w-6 h-6 text-amber-500" />}
                        {isRecharge && <Smartphone className="w-6 h-6 text-blue-500" />}
                        {isTour && <Navigation className="w-6 h-6 text-emerald-500" />}
                      </div>
                      <span className="text-xl font-extrabold text-emerald-600">
                        ₹{offer.reward_value.toLocaleString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-800 text-lg">{offer.title}</h3>
                    <p className="text-xs text-slate-600 mt-1">{offer.description}</p>

                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Cooldown Policy:</span>
                        <span className="font-semibold text-slate-800">
                          {offer.cooldown_days} days
                          {offer.cooldown_independent ? ' (Independent)' : ' (Monthly Cycle)'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Minimum Badge Required:</span>
                        <span className="font-semibold text-blue-700">{offer.min_badge_tier_name}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingOffer(offer)
                      setOfferForm({
                        title: offer.title,
                        reward_value: offer.reward_value,
                        cooldown_days: offer.cooldown_days,
                        cooldown_independent: offer.cooldown_independent,
                        description: offer.description,
                        min_badge_tier_id: offer.min_badge_tier_id || '',
                      })
                    }}
                    className="mt-5 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Edit Offer & Cooldown</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SubTab 4: Redemption Claims ── */}
      {activeSubTab === 'redemptions' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Member Claim Submissions</h3>
            <div className="flex items-center space-x-2">
              <select
                value={redemptionStatusFilter}
                onChange={(e) => setRedemptionStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 px-3 py-1.5"
              >
                <option value="">All Statuses</option>
                <option value="PENDING_FULFILLMENT">Pending Fulfillment</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Offer Claimed</th>
                  <th className="px-4 py-3">Reward Value</th>
                  <th className="px-4 py-3">Claim Date</th>
                  <th className="px-4 py-3">Cooldown End</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {redemptions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      No redemption claims found.
                    </td>
                  </tr>
                ) : (
                  redemptions.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{r.user?.full_name || r.user?.username}</div>
                        <div className="text-xs text-slate-400">@{r.user?.username}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.offer?.title}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">₹{r.reward_value}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.redeemed_at ? format(new Date(r.redeemed_at), 'dd MMM yyyy, HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.cooldown_until ? format(new Date(r.cooldown_until), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'FULFILLED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1" /> Fulfilled
                          </span>
                        )}
                        {r.status === 'PENDING_FULFILLMENT' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </span>
                        )}
                        {r.status === 'REJECTED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 mr-1" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'PENDING_FULFILLMENT' && (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setActionModal({ open: true, redemption: r, action: 'FULFILL', remarks: '' })}
                              className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition"
                            >
                              Fulfill
                            </button>
                            <button
                              onClick={() => setActionModal({ open: true, redemption: r, action: 'REJECT', remarks: '' })}
                              className="px-2.5 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Badge Tier Thresholds ── */}
      {editingTier && (
        <Modal isOpen={Boolean(editingTier)} onClose={() => setEditingTier(null)} title={`Configure ${editingTier.name} Badge`}>
          <form onSubmit={handleSaveTier} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Name</label>
              <input
                type="text"
                value={tierForm.name}
                onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Min Subscription (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={tierForm.min_subscription_amount}
                  onChange={(e) => setTierForm({ ...tierForm, min_subscription_amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Min Self-Service Count</label>
                <input
                  type="number"
                  value={tierForm.min_self_service_count}
                  onChange={(e) => setTierForm({ ...tierForm, min_self_service_count: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Description</label>
              <textarea
                value={tierForm.description}
                onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                Save Thresholds
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Edit Offer & Cooldown ── */}
      {editingOffer && (
        <Modal isOpen={Boolean(editingOffer)} onClose={() => setEditingOffer(null)} title={`Configure ${editingOffer.title}`}>
          <form onSubmit={handleSaveOffer} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Offer Title</label>
              <input
                type="text"
                value={offerForm.title}
                onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reward Value (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={offerForm.reward_value}
                  onChange={(e) => setOfferForm({ ...offerForm, reward_value: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cooldown (Days)</label>
                <input
                  type="number"
                  value={offerForm.cooldown_days}
                  onChange={(e) => setOfferForm({ ...offerForm, cooldown_days: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cooldown_independent"
                checked={offerForm.cooldown_independent}
                onChange={(e) => setOfferForm({ ...offerForm, cooldown_independent: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="cooldown_independent" className="text-xs text-slate-700 font-medium">
                Enforce cooldown independently of the 30-day monthly cycle (e.g. 20-day Petrol Cooldown)
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Badge Tier</label>
              <select
                value={offerForm.min_badge_tier_id}
                onChange={(e) => setOfferForm({ ...offerForm, min_badge_tier_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Verified Member</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name} (Tier #{t.level_order})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                Save Offer Configuration
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Fulfill / Reject Redemption ── */}
      {actionModal.open && (
        <Modal
          isOpen={actionModal.open}
          onClose={() => setActionModal({ open: false, redemption: null, action: 'FULFILL', remarks: '' })}
          title={actionModal.action === 'FULFILL' ? 'Fulfill Member Reward' : 'Reject Reward Claim'}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {actionModal.action === 'FULFILL' ? (
                <>
                  Confirm fulfillment of <strong>{actionModal.redemption?.offer?.title}</strong> (₹{actionModal.redemption?.reward_value}) for <strong>{actionModal.redemption?.user?.full_name}</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to reject the claim for <strong>{actionModal.redemption?.offer?.title}</strong>?
                </>
              )}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Remarks / Voucher Code / Notes
              </label>
              <textarea
                value={actionModal.remarks}
                onChange={(e) => setActionModal({ ...actionModal, remarks: e.target.value })}
                placeholder="e.g. Fuel voucher sent via WhatsApp / Recharge completed"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setActionModal({ open: false, redemption: null, action: 'FULFILL', remarks: '' })}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFulfillAction}
                className={`px-4 py-2 text-sm text-white rounded-lg font-medium ${
                  actionModal.action === 'FULFILL' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionModal.action === 'FULFILL' ? 'Confirm Fulfillment' : 'Reject Claim'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

