import React, { useState, useEffect, useMemo } from 'react'
import { hrApi } from '../../api'
import { LoadingState, EmptyState, PageHeader, Modal, formatINR } from '../../components/shared'
import { format, parseISO, subMonths, addMonths } from 'date-fns'
import toast from 'react-hot-toast'
import { 
  Gift, 
  Award, 
  DollarSign, 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  TrendingUp,
  UserCheck,
  HeartHandshake,
  ShieldCheck,
  RefreshCw,
  Wallet
} from 'lucide-react'

export default function StaffBonusLedgerPage() {
  const currentMonthStr = format(new Date(), 'yyyy-MM')
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr)
  const [data, setData] = useState({ summary: {}, results: [] })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [copiedCode, setCopiedCode] = useState(null)

  // Staff detail modal state
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffDetails, setStaffDetails] = useState(null)
  const [loadingStaffDetails, setLoadingStaffDetails] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'donations', 'members'

  // Fetch all staff bonus overview for the selected month
  const fetchBonusData = async () => {
    setLoading(true)
    try {
      const res = await hrApi.staffBonus.all({ month: selectedMonth, detailed: 'true' })
      if (res.data && res.data.results) {
        setData(res.data)
      } else if (Array.isArray(res.data)) {
        setData({
          month: selectedMonth,
          month_label: format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy'),
          summary: {
            total_staff: res.data.length,
            total_base_salary: res.data.reduce((acc, s) => acc + (Number(s.base_salary) || 0), 0),
            total_month_donation_bonus: res.data.reduce((acc, s) => acc + (Number(s.month_donation_bonus) || 0), 0),
            total_month_membership_bonus: res.data.reduce((acc, s) => acc + (Number(s.month_membership_bonus) || 0), 0),
            total_month_bonus: res.data.reduce((acc, s) => acc + (Number(s.month_total_bonus) || 0), 0),
            total_month_earnings: res.data.reduce((acc, s) => acc + (Number(s.month_total_earnings) || 0), 0),
          },
          results: res.data
        })
      }
    } catch (err) {
      toast.error('Failed to load bonus & commission data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBonusData()
  }, [selectedMonth])

  // Real-time synchronization on dashboard-refresh
  useEffect(() => {
    const handler = () => fetchBonusData()
    window.addEventListener('dashboard-refresh', handler)
    return () => window.removeEventListener('dashboard-refresh', handler)
  }, [selectedMonth])

  // Open individual staff detailed statement
  const openStaffDetails = async (staff) => {
    setSelectedStaff(staff)
    setLoadingStaffDetails(true)
    setActiveTab('all')
    try {
      const res = await hrApi.staffBonus.transactions({ 
        staff_id: staff.staff_uid, 
        month: selectedMonth,
        page_size: 150 
      })
      setStaffDetails(res.data)
    } catch (err) {
      toast.error(`Failed to load details for ${staff.name}`)
    } finally {
      setLoadingStaffDetails(false)
    }
  }

  // Quick month navigation
  const handlePrevMonth = () => {
    try {
      const current = parseISO(`${selectedMonth}-01`)
      setSelectedMonth(format(subMonths(current, 1), 'yyyy-MM'))
    } catch {}
  }

  const handleNextMonth = () => {
    try {
      const current = parseISO(`${selectedMonth}-01`)
      setSelectedMonth(format(addMonths(current, 1), 'yyyy-MM'))
    } catch {}
  }

  const handleCopy = (code, e) => {
    if (e) e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success(`Copied referral code: ${code}`)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  // Filtered staff results
  const filteredStaff = useMemo(() => {
    const list = data.results || []
    return list.filter(item => {
      const matchesSearch = 
        !searchTerm ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.staff_uid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.phone?.includes(searchTerm) ||
        item.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesRole = roleFilter === 'ALL' || item.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [data.results, searchTerm, roleFilter])

  // Format month label nicely
  const formattedMonthLabel = useMemo(() => {
    try {
      return format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')
    } catch {
      return selectedMonth
    }
  }, [selectedMonth])

  const summary = data.summary || {}

  return (
    <div className="space-y-6">
      {/* ── Page Header & Controls ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Gift className="w-6 h-6" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
              Staff Bonus & Commission Ledger
            </h1>
          </div>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Tracking monthly eligible donation incentives (10%) and membership bonuses (30%) per staff member.
          </p>
        </div>

        {/* Month Selector Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg text-gray-600 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3 font-semibold text-gray-800 text-sm">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>{formattedMonthLabel}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg text-gray-600 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs px-2.5 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {selectedMonth !== currentMonthStr && (
            <button
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="text-xs px-3 py-2 bg-purple-50 text-purple-700 font-semibold rounded-xl border border-purple-200 hover:bg-purple-100 transition shadow-sm"
            >
              This Month
            </button>
          )}

          <button
            onClick={fetchBonusData}
            disabled={loading}
            className="p-2 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-xl transition shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Policy Rules Banner ── */}
      <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-blue-50/90 border border-purple-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-purple-600 text-white rounded-xl shadow-sm">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-purple-950">
                Staff Incentive & Salary Commission Policy
              </h4>
              <p className="text-xs text-purple-900/80 mt-0.5 leading-relaxed">
                • <strong>Donation Bonus:</strong> 10% (₹100 for every ₹1,000) on eligible donations collected.<br className="hidden md:inline" />
                • <strong>Membership Bonus:</strong> 30% (₹30 for every ₹100 registration fee) credited to respective staff bonus balance.<br />
                • Both bonuses are tracked independently and automatically paid out with monthly salary processing.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-white/90 text-purple-700 border border-purple-200 rounded-xl shadow-xs">
            Active Cycle: {formattedMonthLabel}
          </div>
        </div>
      </div>

      {/* ── Top Summary KPI Cards for Selected Month ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Eligible Staff</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{summary.total_staff || 0}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Active field officers</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Donation Bonus (10%)</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-0.5">{formatINR(summary.total_month_donation_bonus || 0)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">₹100 per ₹1,000 received</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Member Bonus (30%)</div>
            <div className="text-2xl font-extrabold text-purple-600 mt-0.5">{formatINR(summary.total_month_membership_bonus || 0)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">₹30 per ₹100 registration</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total Month Bonus</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-0.5">{formatINR(summary.total_month_bonus || 0)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">10% + 30% combined</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Month Salary + Bonus</div>
            <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">{formatINR(summary.total_month_earnings || 0)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Total month allocation</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff name, ID, phone, referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Filter Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
          >
            <option value="ALL">All Roles</option>
            <option value="STAFF">General Staff</option>
            <option value="FIELD_ASSESSMENT_OFFICER">Field Assessment Officer</option>
            <option value="ASSESSMENT_CALCULATION_OFFICER">Assessment Officer</option>
            <option value="GENERAL_ENQUIRY_OFFICER">General Enquiry Officer</option>
          </select>
        </div>
      </div>

      {/* ── Main Staff Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              Staff Achieved Bonus & Monthly Earnings — {formattedMonthLabel}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Click on any staff member name or row to view the full itemized list of donations and member signups achieved.
            </p>
          </div>
          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
            Showing {filteredStaff.length} of {data.results?.length || 0} staff
          </span>
        </div>

        {loading ? (
          <div className="p-12">
            <LoadingState />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12">
            <EmptyState 
              icon="🎁" 
              title="No Staff Bonus Records Found" 
              message={searchTerm ? "No staff members match the selected search criteria." : "No staff accounts found for this period."} 
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Referral Code</th>
                  <th className="py-3.5 px-4 text-right">Base Salary</th>
                  <th className="py-3.5 px-4 text-right">Donation Bonus (10%)</th>
                  <th className="py-3.5 px-4 text-right">Member Bonus (30%)</th>
                  <th className="py-3.5 px-4 text-right">Total Month Bonus</th>
                  <th className="py-3.5 px-4 text-right">Month Salary + Bonus</th>
                  <th className="py-3.5 px-4 text-right">Available Payout</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredStaff.map((staff) => (
                  <tr
                    key={staff.staff_uid}
                    onClick={() => openStaffDetails(staff)}
                    className="hover:bg-purple-50/30 cursor-pointer transition group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 group-hover:text-purple-700 transition">
                            {staff.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {staff.staff_uid}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {staff.role?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-200/80 text-[11px]">
                          {staff.referral_code || `slt-${staff.name?.toLowerCase()}`}
                        </span>
                        <button
                          onClick={(e) => handleCopy(staff.referral_code, e)}
                          className="p-1 text-gray-400 hover:text-purple-600 transition"
                          title="Copy referral code"
                        >
                          {copiedCode === staff.referral_code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                      {formatINR(staff.base_salary)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-emerald-600">
                        +{formatINR(staff.month_donation_bonus)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {staff.month_donations_count || 0} donations
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-purple-600">
                        +{formatINR(staff.month_membership_bonus)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {staff.month_members_count || 0} members
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-purple-900 bg-purple-50/80 px-2 py-1 rounded-lg inline-block border border-purple-100">
                        +{formatINR(staff.month_total_bonus)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-extrabold text-indigo-700 text-sm">
                        {formatINR(staff.month_total_earnings)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-semibold text-emerald-700">
                        {formatINR(staff.available_balance)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Paid: {formatINR(staff.total_paid_out)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openStaffDetails(staff)
                        }}
                        className="text-xs px-2.5 py-1.5 bg-gray-50 text-purple-700 hover:bg-purple-100 border border-gray-200 rounded-lg font-semibold transition"
                      >
                        View Breakdown →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Staff Itemized Statement Modal / Drawer ── */}
      {selectedStaff && (
        <Modal
          open={!!selectedStaff}
          onClose={() => {
            setSelectedStaff(null)
            setStaffDetails(null)
          }}
          title={`Staff Statement: ${selectedStaff.name} (${formattedMonthLabel})`}
          width={900}
        >
          <div className="space-y-5">
            {/* Staff Profile Overview Card */}
            <div className="bg-gradient-to-r from-gray-50 via-purple-50/40 to-indigo-50/40 p-4 rounded-2xl border border-gray-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center shadow-md">
                  {selectedStaff.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    {selectedStaff.name}
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      {selectedStaff.role?.replace(/_/g, ' ')}
                    </span>
                  </h3>
                  <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500 mt-0.5">
                    <span>ID: <strong className="font-mono text-gray-700">{selectedStaff.staff_uid}</strong></span>
                    {selectedStaff.phone && <span>• Phone: <strong>{selectedStaff.phone}</strong></span>}
                    {selectedStaff.email && <span>• Email: <strong>{selectedStaff.email}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Referral Code Pill */}
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-purple-200 shadow-xs">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Referral Code</div>
                  <div className="font-mono font-bold text-purple-700 text-xs">
                    {selectedStaff.referral_code}
                  </div>
                </div>
                <button
                  onClick={(e) => handleCopy(selectedStaff.referral_code, e)}
                  className="p-1 hover:bg-purple-50 rounded text-purple-600 transition"
                  title="Copy Code"
                >
                  {copiedCode === selectedStaff.referral_code ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 4 Performance Metric Cards for the Month */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50/90 p-3.5 rounded-xl border border-gray-200">
                <div className="text-[11px] font-semibold text-gray-500 uppercase">1-Month Base Salary</div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {formatINR(staffDetails?.month_summary?.base_salary ?? selectedStaff.base_salary)}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Standard salary</div>
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                <div className="text-[11px] font-semibold text-emerald-700 uppercase">Donation Bonus (10%)</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  +{formatINR(staffDetails?.month_summary?.donation_bonus ?? selectedStaff.month_donation_bonus)}
                </div>
                <div className="text-[10px] text-emerald-600/80 mt-0.5">
                  {staffDetails?.month_summary?.donations_count ?? selectedStaff.month_donations_count ?? 0} donations
                </div>
              </div>

              <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200">
                <div className="text-[11px] font-semibold text-purple-700 uppercase">Member Bonus (30%)</div>
                <div className="text-xl font-bold text-purple-600 mt-1">
                  +{formatINR(staffDetails?.month_summary?.membership_bonus ?? selectedStaff.month_membership_bonus)}
                </div>
                <div className="text-[10px] text-purple-600/80 mt-0.5">
                  {staffDetails?.month_summary?.members_count ?? selectedStaff.month_members_count ?? 0} registrations
                </div>
              </div>

              <div className="bg-indigo-50/90 p-3.5 rounded-xl border border-indigo-200">
                <div className="text-[11px] font-semibold text-indigo-700 uppercase">Total Month Earnings</div>
                <div className="text-xl font-extrabold text-indigo-700 mt-1">
                  {formatINR(staffDetails?.month_summary?.total_earnings ?? selectedStaff.month_total_earnings)}
                </div>
                <div className="text-[10px] text-indigo-500 mt-0.5">Salary + All Bonuses</div>
              </div>
            </div>

            {/* Sub-Tabs for Breakdown */}
            <div className="flex border-b border-gray-200 text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTab === 'all'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                All Month Transactions ({(staffDetails?.transactions || []).length})
              </button>
              <button
                onClick={() => setActiveTab('donations')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTab === 'donations'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Donation Collections (10%) (
                {(staffDetails?.transactions || []).filter(t => t.bonus_type === 'DONATION').length}
                )
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`px-4 py-2.5 font-bold border-b-2 transition ${
                  activeTab === 'members'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                New Member Signups (30%) (
                {(staffDetails?.transactions || []).filter(t => t.bonus_type === 'MEMBERSHIP').length}
                )
              </button>
            </div>

            {/* Itemized Transactions Table */}
            {loadingStaffDetails ? (
              <div className="py-12">
                <LoadingState />
              </div>
            ) : !staffDetails?.transactions || staffDetails.transactions.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No bonus activity recorded for {selectedStaff.name} during {formattedMonthLabel}.
              </div>
            ) : (
              <div className="table-wrap max-h-72 overflow-y-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] font-bold text-gray-600 uppercase border-b border-gray-200">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Details / Reference</th>
                      <th className="py-2.5 px-3 text-right">Bonus Amount Credited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {(staffDetails.transactions || [])
                      .filter(t => {
                        if (activeTab === 'donations') return t.bonus_type === 'DONATION'
                        if (activeTab === 'members') return t.bonus_type === 'MEMBERSHIP'
                        return true
                      })
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/70">
                          <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px]">
                            {t.created_at ? format(parseISO(t.created_at), 'dd MMM yyyy, hh:mm a') : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {t.bonus_type === 'DONATION' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                                💖 10% Donation
                              </span>
                            ) : t.bonus_type === 'MEMBERSHIP' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 text-[10px]">
                                👥 30% Member
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[10px]">
                                {t.bonus_type}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-800">
                            <div className="font-medium">{t.description || 'Bonus incentive'}</div>
                            {t.member_name && (
                              <div className="text-[10px] text-gray-500">
                                Member: <strong>{t.member_name}</strong>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                            +{formatINR(t.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* All-Time Account Balances Summary Footer */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="text-gray-500">
                All-time accumulated bonus: <strong className="text-purple-700">{formatINR(selectedStaff.total_bonus)}</strong> · 
                Paid out via payroll: <strong className="text-gray-700">{formatINR(selectedStaff.total_paid_out)}</strong>
              </div>
              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                Available for Next Salary Cycle: {formatINR(selectedStaff.available_balance)}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
