import React, { useState, useEffect, useMemo } from 'react'
import { hrApi } from '../../api'
import { LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import { format, parseISO, subMonths, addMonths } from 'date-fns'
import toast from 'react-hot-toast'
import { 
  Gift, 
  Award, 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Copy, 
  Check, 
  HeartHandshake, 
  UserCheck, 
  RefreshCw, 
  Wallet,
  ArrowRight
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
      console.error('Error fetching bonus data:', err)
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
      console.error('Error loading staff details:', err)
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
    if (!code) return
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      paddingBottom: '40px',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box'
    }}>
      
      {/* ── Top Header & Month Controls ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: '1 1 280px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            color: '#1E4DB7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #BFDBFE',
            flexShrink: 0
          }}>
            <Gift size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Staff Bonus & Commission Ledger
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
              Tracking monthly eligible donation incentives (10%) and membership bonuses (30%) per staff member.
            </p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', maxWidth: '100%' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '10px',
            padding: '2px',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <button
              onClick={handlePrevMonth}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '6px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 10px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A'
            }}>
              <Calendar size={15} color="#1E4DB7" />
              <span>{formattedMonthLabel}</span>
            </div>

            <button
              onClick={handleNextMonth}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '6px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer'
            }}
          />

          {selectedMonth !== currentMonthStr && (
            <button
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="btn btn-sm"
              style={{
                background: '#EFF6FF',
                color: '#1E4DB7',
                border: '1px solid #BFDBFE',
                fontWeight: 600,
                borderRadius: '10px'
              }}
            >
              This Month
            </button>
          )}

          <button
            onClick={fetchBonusData}
            disabled={loading}
            className="btn btn-sm btn-secondary"
            style={{
              padding: '7px 10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Policy Rules Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #F0FDF4 0%, #EFF6FF 50%, #FAF5FF 100%)',
        border: '1px solid #C7D2FE',
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: '1 1 300px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: '#1E4DB7',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Award size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Staff Incentive & Salary Commission Policy
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                • <strong>Donation Bonus:</strong> 10% (₹100 for every ₹1,000) on eligible donations collected.<br />
                • <strong>Membership Bonus:</strong> 30% (₹30 for every ₹100 registration fee) credited to respective staff bonus balance.<br />
                • Both bonuses are tracked independently and automatically paid out with monthly salary processing.
              </p>
            </div>
          </div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            background: '#FFFFFF',
            color: '#1E4DB7',
            border: '1px solid #BFDBFE',
            borderRadius: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            whiteSpace: 'nowrap'
          }}>
            Active Cycle: {formattedMonthLabel}
          </div>
        </div>
      </div>

      {/* ── 5 KPI Summary Cards for Selected Month ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: '12px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}>
        {/* Card 1: Eligible Staff */}
        <div style={{
          background: '#FFFFFF',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#EFF6FF',
            color: '#1E4DB7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>Eligible Staff</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{summary.total_staff || 0}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Active field officers</div>
          </div>
        </div>

        {/* Card 2: Donation Bonus */}
        <div style={{
          background: '#FFFFFF',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#DCFCE7',
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <HeartHandshake size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>Donation Bonus (10%)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>{formatINR(summary.total_month_donation_bonus || 0)}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>₹100 per ₹1,000 received</div>
          </div>
        </div>

        {/* Card 3: Member Bonus */}
        <div style={{
          background: '#FFFFFF',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#F3E8FF',
            color: '#7C3AED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <UserCheck size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>Member Bonus (30%)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#7C3AED', marginTop: '2px' }}>{formatINR(summary.total_month_membership_bonus || 0)}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>₹30 per ₹100 registration</div>
          </div>
        </div>

        {/* Card 4: Total Month Bonus */}
        <div style={{
          background: '#FFFFFF',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#FEF3C7',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Gift size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>Total Month Bonus</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>{formatINR(summary.total_month_bonus || 0)}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>10% + 30% combined</div>
          </div>
        </div>

        {/* Card 5: Month Salary + Bonus */}
        <div style={{
          background: '#FFFFFF',
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
          boxSizing: 'border-box',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#EFF6FF',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Wallet size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>Month Salary + Bonus</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E4DB7', marginTop: '2px' }}>{formatINR(summary.total_month_earnings || 0)}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Total month allocation</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}>
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%', flex: '1 1 240px' }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search staff name, ID, phone, referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '12px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              color: '#0F172A',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Filter Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              color: '#0F172A',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Roles</option>
            <option value="STAFF">General Staff</option>
            <option value="FIELD_ASSESSMENT_OFFICER">Field Assessment Officer</option>
            <option value="ASSESSMENT_CALCULATION_OFFICER">Assessment Officer</option>
            <option value="GENERAL_ENQUIRY_OFFICER">General Enquiry Officer</option>
          </select>

          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '5px 12px',
            borderRadius: '20px',
            background: '#EFF6FF',
            color: '#1E4DB7',
            border: '1px solid #BFDBFE',
            whiteSpace: 'nowrap'
          }}>
            Showing {filteredStaff.length} staff
          </span>
        </div>
      </div>

      {/* ── Main Staff Table Card ── */}
      <div className="data-card" style={{ marginBottom: 0, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
        <div className="data-card-header">
          <div>
            <div className="data-card-title">
              Staff Achieved Bonus & Monthly Earnings — {formattedMonthLabel}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Click on any staff member name or row to view their itemized statement of collections and membership bonuses.
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px' }}>
            <LoadingState />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon="🎁" 
              title="No Staff Bonus Records Found" 
              message={searchTerm ? "No staff members match the selected search criteria." : "No staff accounts found for this period."} 
            />
          </div>
        ) : (
          <div className="table-wrap" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Staff Member</th>
                  <th style={{ textAlign: 'left' }}>Referral Code</th>
                  <th style={{ textAlign: 'right' }}>Base Salary</th>
                  <th style={{ textAlign: 'right' }}>Donation Bonus (10%)</th>
                  <th style={{ textAlign: 'right' }}>Member Bonus (30%)</th>
                  <th style={{ textAlign: 'right' }}>Total Month Bonus</th>
                  <th style={{ textAlign: 'right' }}>Month Salary + Bonus</th>
                  <th style={{ textAlign: 'right' }}>Available Payout</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <tr
                    key={staff.staff_uid}
                    onClick={() => openStaffDetails(staff)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                  >
                    {/* Staff Member */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #1E4DB7 0%, #2563EB 100%)',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(30, 77, 183, 0.2)'
                        }}>
                          {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                            {staff.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span className="td-mono" style={{ fontSize: '11px', color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                              {staff.staff_uid}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              {staff.role?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Referral Code */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '11px',
                          color: '#6D28D9',
                          background: '#F5F3FF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #DDD6FE'
                        }}>
                          {staff.referral_code || '—'}
                        </span>
                        <button
                          onClick={(e) => handleCopy(staff.referral_code, e)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#94A3B8',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Copy referral code"
                        >
                          {copiedCode === staff.referral_code ? (
                            <Check size={14} color="#16A34A" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Base Salary */}
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                      {formatINR(staff.base_salary)}
                    </td>

                    {/* Donation Bonus (10%) */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#16A34A', fontSize: '13px' }}>
                        +{formatINR(staff.month_donation_bonus)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                        {staff.month_donations_count || 0} donations
                      </div>
                    </td>

                    {/* Member Bonus (30%) */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#7C3AED', fontSize: '13px' }}>
                        +{formatINR(staff.month_membership_bonus)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                        {staff.month_members_count || 0} members
                      </div>
                    </td>

                    {/* Total Month Bonus */}
                    <td style={{ textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 700,
                        color: '#D97706',
                        background: '#FEF3C7',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        display: 'inline-block'
                      }}>
                        +{formatINR(staff.month_total_bonus)}
                      </span>
                    </td>

                    {/* Month Salary + Bonus */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#1E4DB7', fontSize: '14px' }}>
                        {formatINR(staff.month_total_earnings)}
                      </div>
                    </td>

                    {/* Available Payout */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#16A34A', fontSize: '13px' }}>
                        {formatINR(staff.available_balance)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                        Paid: {formatINR(staff.total_paid_out)}
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openStaffDetails(staff)
                        }}
                        className="btn btn-sm btn-secondary"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>Breakdown</span>
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Staff Itemized Statement Modal ── */}
      {selectedStaff && (
        <Modal
          isOpen={!!selectedStaff}
          onClose={() => {
            setSelectedStaff(null)
            setStaffDetails(null)
          }}
          title={`Staff Statement: ${selectedStaff.name} (${formattedMonthLabel})`}
          size="modal-xl"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Staff Profile Overview Header */}
            <div style={{
              background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #CBD5E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1E4DB7 0%, #2563EB 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedStaff.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedStaff.name}</span>
                    <span className="badge badge-blue" style={{ fontSize: '10px' }}>
                      {selectedStaff.role?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span>ID: <strong className="td-mono">{selectedStaff.staff_uid}</strong></span>
                    {selectedStaff.phone && <span>• Phone: <strong>{selectedStaff.phone}</strong></span>}
                    {selectedStaff.email && <span>• Email: <strong>{selectedStaff.email}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Referral Code Box */}
              <div style={{
                background: '#FFFFFF',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #DDD6FE',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Referral Code</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6D28D9', fontSize: '13px' }}>
                    {selectedStaff.referral_code}
                  </div>
                </div>
                <button
                  onClick={(e) => handleCopy(selectedStaff.referral_code, e)}
                  style={{
                    border: 'none',
                    background: '#F5F3FF',
                    color: '#6D28D9',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Copy Referral Code"
                >
                  {copiedCode === selectedStaff.referral_code ? (
                    <Check size={14} color="#16A34A" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* 4 Performance Metric Cards for Selected Staff */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Base Salary</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                  {formatINR(staffDetails?.month_summary?.base_salary ?? selectedStaff.base_salary)}
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>Standard 1-Month Salary</div>
              </div>

              <div style={{ background: '#F0FDF4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Donation Bonus (10%)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                  +{formatINR(staffDetails?.month_summary?.donation_bonus ?? selectedStaff.month_donation_bonus)}
                </div>
                <div style={{ fontSize: '10px', color: '#16A34A' }}>
                  {staffDetails?.month_summary?.donations_count ?? selectedStaff.month_donations_count ?? 0} donations
                </div>
              </div>

              <div style={{ background: '#FAF5FF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E9D5FF' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Member Bonus (30%)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#7C3AED', marginTop: '2px' }}>
                  +{formatINR(staffDetails?.month_summary?.membership_bonus ?? selectedStaff.month_membership_bonus)}
                </div>
                <div style={{ fontSize: '10px', color: '#7C3AED' }}>
                  {staffDetails?.month_summary?.members_count ?? selectedStaff.month_members_count ?? 0} registrations
                </div>
              </div>

              <div style={{ background: '#EFF6FF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E4DB7', textTransform: 'uppercase' }}>Total Month Earnings</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E4DB7', marginTop: '2px' }}>
                  {formatINR(staffDetails?.month_summary?.total_earnings ?? selectedStaff.month_total_earnings)}
                </div>
                <div style={{ fontSize: '10px', color: '#1E4DB7' }}>Salary + All Bonuses</div>
              </div>
            </div>

            {/* Sub-Tabs for Filtering Transactions */}
            <div style={{
              display: 'flex',
              borderBottom: '2px solid #E2E8F0',
              gap: '4px'
            }}>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: activeTab === 'all' ? '#1E4DB7' : '#64748B',
                  borderBottom: activeTab === 'all' ? '2px solid #1E4DB7' : '2px solid transparent',
                  marginBottom: '-2px'
                }}
              >
                All Month Transactions ({(staffDetails?.transactions || []).length})
              </button>

              <button
                onClick={() => setActiveTab('donations')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: activeTab === 'donations' ? '#16A34A' : '#64748B',
                  borderBottom: activeTab === 'donations' ? '2px solid #16A34A' : '2px solid transparent',
                  marginBottom: '-2px'
                }}
              >
                Donation Collections (10%) (
                {(staffDetails?.transactions || []).filter(t => (t.bonus_type || '').includes('DONATION')).length}
                )
              </button>

              <button
                onClick={() => setActiveTab('members')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: activeTab === 'members' ? '#7C3AED' : '#64748B',
                  borderBottom: activeTab === 'members' ? '2px solid #7C3AED' : '2px solid transparent',
                  marginBottom: '-2px'
                }}
              >
                New Member Signups (30%) (
                {(staffDetails?.transactions || []).filter(t => (t.bonus_type || '').includes('MEMBER') || (t.bonus_type || '').includes('REFERRAL')).length}
                )
              </button>
            </div>

            {/* Transactions Table */}
            {loadingStaffDetails ? (
              <div style={{ padding: '30px' }}>
                <LoadingState />
              </div>
            ) : !staffDetails?.transactions || staffDetails.transactions.length === 0 ? (
              <div style={{
                padding: '30px',
                textAlign: 'center',
                color: '#64748B',
                fontSize: '12px',
                background: '#F8FAFC',
                borderRadius: '10px',
                border: '1px dashed #CBD5E1'
              }}>
                No bonus activity recorded for {selectedStaff.name} during {formattedMonthLabel}.
              </div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>Date & Time</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>Staff Member</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>New Member Name</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}>Staff Designation</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = (staffDetails.transactions || []).filter(t => {
                        const type = (t.bonus_type || '').toUpperCase()
                        if (activeTab === 'donations') return type.includes('DONATION')
                        if (activeTab === 'members') return type.includes('MEMBER') || type.includes('REFERRAL')
                        return true
                      })

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#64748B', padding: '24px', fontSize: '12px' }}>
                              No {activeTab === 'donations' ? 'donation' : activeTab === 'members' ? 'member signup' : 'bonus'} transactions found for this period.
                            </td>
                          </tr>
                        )
                      }

                      return filtered.map((t) => {
                        const staffName = t.staff_name || staffDetails?.staff?.name || selectedStaff?.name || '—'
                        const staffUid = t.staff_uid || staffDetails?.staff?.staff_uid || selectedStaff?.staff_uid || ''
                        const rawRole = t.staff_designation || staffDetails?.staff?.role || selectedStaff?.role || 'STAFF'
                        const designation = rawRole.replace(/_/g, ' ')
                        const memberName = t.member_name || (t.bonus_type?.includes('DONATION') ? 'Direct Donor' : '—')

                        return (
                          <tr key={t.id}>
                            {/* 1. Date & Time */}
                            <td style={{ color: '#64748B', fontSize: '11px', whiteSpace: 'nowrap', padding: '10px 14px' }} className="td-mono">
                              {t.created_at ? format(parseISO(t.created_at), 'dd MMM yyyy, hh:mm a') : '—'}
                            </td>

                            {/* 2. Staff Member Name */}
                            <td style={{ color: '#0F172A', fontWeight: 600, fontSize: '12px', padding: '10px 14px' }}>
                              <div>{staffName}</div>
                              {staffUid && (
                                <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace', fontWeight: 500, marginTop: '2px' }}>
                                  ID: {staffUid}
                                </div>
                              )}
                            </td>

                            {/* 3. New Member Name */}
                            <td style={{ color: '#0F172A', fontSize: '12px', padding: '10px 14px' }}>
                              <div style={{ fontWeight: 600 }}>{memberName}</div>
                              {t.member_id && (
                                <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                                  ID: {t.member_id}
                                </div>
                              )}
                            </td>

                            {/* 4. Staff Designation */}
                            <td style={{ padding: '10px 14px' }}>
                              <span className="badge badge-blue" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>
                                {designation}
                              </span>
                            </td>

                            {/* 5. Amount */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A', fontSize: '13px', whiteSpace: 'nowrap', padding: '10px 14px' }}>
                              +{formatINR(t.amount)}
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* All-Time Account Balances Summary Footer */}
            <div style={{
              background: '#F8FAFC',
              padding: '14px 18px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ color: '#64748B' }}>
                All-time accumulated bonus: <strong style={{ color: '#7C3AED' }}>{formatINR(selectedStaff.total_bonus)}</strong> · 
                Paid out via payroll: <strong style={{ color: '#0F172A' }}>{formatINR(selectedStaff.total_paid_out)}</strong>
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#16A34A',
                background: '#DCFCE7',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid #BBF7D0'
              }}>
                Available for Next Salary Cycle: {formatINR(selectedStaff.available_balance)}
              </div>
            </div>

          </div>
        </Modal>
      )}

    </div>
  )
}
