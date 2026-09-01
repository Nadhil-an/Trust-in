import React, { useState, useEffect } from 'react'
import { reportsApi } from '../../api'
import { LoadingState } from '../shared'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts'

const formatDateDisplay = (dateStr, fallbackStr) => {
  if (!dateStr) return fallbackStr || 'N/A'
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parts[0]
      const monthIdx = parseInt(parts[1], 10) - 1
      const day = parts[2]
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
      if (months[monthIdx]) {
        return `${day} ${months[monthIdx]} ${year}`
      }
    }
    return fallbackStr || dateStr
  } catch {
    return fallbackStr || dateStr
  }
}

export default function StaffPerformanceFilter({ initialPeriod = 'daily', onClose }) {
  const [period, setPeriod] = useState(initialPeriod)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  const fetchReport = async (fDate = fromDate, tDate = toDate, targetPeriod = period) => {
    setLoading(true)
    try {
      const params = { period: targetPeriod }
      if (fDate) params.from_date = fDate
      if (tDate) params.to_date = tDate
      const res = await reportsApi.staffPerformance(params)
      setReportData(res.data)
    } catch (err) {
      toast.error('Failed to load performance report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(fromDate, toDate, period)
  }, [])

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod)
    setFromDate('')
    setToDate('')
    fetchReport('', '', newPeriod)
  }

  const handleDateChange = (type, val) => {
    let newFrom = fromDate
    let newTo = toDate
    if (type === 'from') {
      newFrom = val
      setFromDate(val)
    } else {
      newTo = val
      setToDate(val)
    }
    fetchReport(newFrom, newTo, period)
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-area-filter')
    if (!element) return
    setDownloading(true)
    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Staff_Performance_${period}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }
      await html2pdf().set(opt).from(element).save()
      toast.success('PDF downloaded successfully!')
    } catch (err) {
      toast.error('Failed to generate PDF report')
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const staffList = (reportData?.staff_performance || []).filter(s => 
    selectedStaffId ? s.id === selectedStaffId : true
  )

  return (
    <div style={{ background: '#f9fafb', minHeight: '100%', padding: '20px' }}>
      
      {/* Printable Report Wrapper Container */}
      <div className="printable-report-wrapper" style={{ background: 'white', borderRadius: 20, width: '100%', padding: 32, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', position: 'relative' }}>
        
        {/* Controls - Hidden during Printing */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Filter:</span>
            <button
              onClick={() => handlePeriodChange('daily')}
              style={{
                padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
                background: period === 'daily' ? '#16A34A' : '#F3F4F6', color: period === 'daily' ? 'white' : '#4B5563',
                transition: 'all 0.2s'
              }}
            >
              🌞 Daily
            </button>
            <button
              onClick={() => handlePeriodChange('weekly')}
              style={{
                padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
                background: period === 'weekly' ? '#16A34A' : '#F3F4F6', color: period === 'weekly' ? 'white' : '#4B5563',
                transition: 'all 0.2s'
              }}
            >
              📅 Weekly
            </button>
            <button
              onClick={() => handlePeriodChange('monthly')}
              style={{
                padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
                background: period === 'monthly' ? '#16A34A' : '#F3F4F6', color: period === 'monthly' ? 'white' : '#4B5563',
                transition: 'all 0.2s'
              }}
            >
              📆 Monthly
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, minWidth: 180, fontWeight: 600, color: '#374151' }}
            >
              <option value="">All Staff Members</option>
              {(reportData?.staff_performance || []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div style={{ width: 1, height: 24, background: '#E5E7EB', margin: '0 4px' }} />
            <input
              type="date"
              value={fromDate}
              onChange={e => handleDateChange('from', e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => handleDateChange('to', e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12 }}
            />
            <button onClick={() => fetchReport(fromDate, toDate, period)} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: 12, background: '#16A34A', color: 'white', fontWeight: 600 }}>Apply</button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDownloadPDF} disabled={downloading} className="btn btn-success" style={{ padding: '8px 16px', background: '#10B981', color: 'white', fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
              {downloading ? '⌛ Exporting...' : '📥 Download PDF'}
            </button>
            <button onClick={handlePrint} className="btn btn-primary" style={{ padding: '8px 16px', background: '#2563EB', color: 'white', fontWeight: 700, borderRadius: 10 }}>
              🖨️ Print
            </button>
            {onClose && (
              <button onClick={onClose} className="btn btn-secondary" style={{ borderRadius: 10 }}>
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60 }}><LoadingState /></div>
        ) : (
          <div id="printable-area-filter" style={{ background: 'white', padding: '10px 0' }}>

            {/* ── COMPANY LOGO & NAME HEADER ─────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
              <img src="/logo-only.png" alt="SreeLakshmi Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#16A34A', letterSpacing: -0.5, lineHeight: 1.1 }}>
                  SreeLakshmi Charity Trust
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Staff Performance Metrics
                </div>
              </div>
            </div>

            {/* ── REPORT TITLE ────────────────────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1 style={{ fontSize: 32, fontWeight: 900, color: '#111827', margin: 0, letterSpacing: -1, lineHeight: 1.1, textTransform: 'capitalize' }}>
                {period} Performance Report
              </h1>
            </div>

            {/* ── DYNAMIC REPORTING PERIOD STRIP ────────────── */}
            <div style={{
              background: 'linear-gradient(90deg, #22C55E, #16A34A)',
              borderRadius: 30, padding: '12px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: 'white', fontWeight: 600, fontSize: 14, marginBottom: 28,
            }}>
              <div>
                Reporting Period: <span style={{ fontWeight: 800 }}>{formatDateDisplay(fromDate, reportData?.from_date)}</span> to <span style={{ fontWeight: 800 }}>{formatDateDisplay(toDate, reportData?.to_date)}</span>
              </div>
              <div>
                Generated on: <span style={{ fontWeight: 800 }}>{new Date().toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            {/* ── PERFORMANCE TABLE ───────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
                Performance Breakdown
              </div>

              {/* Table Header Pill */}
              <div style={{
                background: '#F3F4F6', borderRadius: 12, padding: '12px 20px',
                display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr',
                color: '#4B5563', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5,
                marginBottom: 12, border: '1px solid #E5E7EB'
              }}>
                <div>Staff Name</div>
                <div style={{ textAlign: 'center' }}>Attendance</div>
                <div style={{ textAlign: 'right' }}>Donations (₹)</div>
                <div style={{ textAlign: 'center' }}>Membership Leads</div>
                <div style={{ textAlign: 'right' }}>Total Amount (₹)</div>
              </div>

              {/* Table Body Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {staffList.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 30, border: '1px dashed #D1D5DB', borderRadius: 12 }}>
                    No staff performance records found for this period.
                  </div>
                ) : staffList.map((staff, idx) => {
                  const isExpanded = expandedRow === staff.id || selectedStaffId === staff.id;
                  
                  return (
                  <div key={staff.id || idx} style={{
                    background: isExpanded ? '#EEF2FF' : (idx % 2 === 0 ? 'white' : '#F9FAFB'),
                    border: isExpanded ? '1px solid #C7D2FE' : '1px solid #F3F4F6', 
                    borderRadius: 8,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: isExpanded ? '0 4px 12px rgba(79, 70, 229, 0.1)' : 'none'
                  }}>
                    <div 
                      onClick={() => setExpandedRow(isExpanded ? null : staff.id)}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr',
                        padding: '14px 20px', alignItems: 'center', fontSize: 15, fontWeight: 600, color: '#111827',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#6B7280', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                        {staff.name}
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ 
                          background: staff.attendance_days > 0 ? '#DCFCE7' : '#FEE2E2', 
                          color: staff.attendance_days > 0 ? '#16A34A' : '#DC2626',
                          padding: '4px 10px', borderRadius: 12, fontSize: 13, fontWeight: 700
                        }}>
                          {staff.attendance_days} days
                        </span>
                      </div>
                      
                      <div style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                        {staff.donation ? staff.donation.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                      </div>
                      
                      <div style={{ textAlign: 'center', color: '#1E4DB7', fontWeight: 800, fontSize: 16 }}>
                        {staff.membership_leads || 0}
                      </div>
                      
                      <div style={{ textAlign: 'right', fontWeight: 800, color: '#111827', fontSize: 16 }}>
                        {staff.total_amount ? staff.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                      </div>
                    </div>
                    
                    {/* Expanded Graph Section */}
                    {isExpanded && (
                      <div style={{ padding: '20px 30px', background: 'white', borderTop: '1px solid #E5E7EB', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#4B5563', marginBottom: 16 }}>Financial Performance (₹)</div>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={[
                              { name: 'Donations', value: staff.donation || 0, fill: '#10B981' },
                              { name: 'Total Amount', value: staff.total_amount || 0, fill: '#3B82F6' }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#6B7280' }} />
                              <YAxis tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000) + 'k' : val}`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Amount']} />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                <LabelList dataKey="value" position="top" formatter={(val) => `₹${val.toLocaleString('en-IN')}`} style={{ fontSize: 11, fontWeight: 700, fill: '#4B5563' }} />
                                {
                                  [0, 1].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#3B82F6'} />
                                  ))
                                }
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#4B5563', marginBottom: 16 }}>Engagement Metrics</div>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart layout="vertical" data={[
                              { name: 'Attendance (Days)', value: staff.attendance_days || 0, fill: '#F59E0B' },
                              { name: 'Membership Leads', value: staff.membership_leads || 0, fill: '#8B5CF6' }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#6B7280' }} />
                              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={40}>
                                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#4B5563' }} />
                                {
                                  [0, 1].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#F59E0B' : '#8B5CF6'} />
                                  ))
                                }
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Print Styles Injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-report-wrapper, #printable-area-filter, #printable-area-filter * {
            visibility: visible !important;
          }
          .printable-report-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
