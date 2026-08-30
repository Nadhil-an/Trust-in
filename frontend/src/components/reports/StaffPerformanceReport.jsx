import React, { useState, useEffect } from 'react'
import { reportsApi } from '../../api'
import { LoadingState } from '../shared'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'

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

export default function StaffPerformanceReport({ initialPeriod = 'weekly', onClose }) {
  const [period, setPeriod] = useState(initialPeriod)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
    const element = document.getElementById('printable-area')
    if (!element) return
    setDownloading(true)
    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `SreeLakshmi_Staff_Performance_Report_${period}.pdf`,
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

  const summary = reportData?.summary || { total_donation: 0, total_leads: 0, total_enquiries: 0 }
  const staffList = reportData?.staff_performance || []

  // Max value for horizontal bar scaling
  const maxBarValue = Math.max(...staffList.map(s => s.donation || s.leads || 1), 1)

  return (
    <div style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', padding: '20px 10px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      
      {/* Printable Report Wrapper Container */}
      <div className="printable-report-wrapper" style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 850, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.2)', position: 'relative' }}>
        
        {/* Controls - Hidden during Printing */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Period:</span>
            <button
              onClick={() => handlePeriodChange('weekly')}
              style={{
                padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
                background: period === 'weekly' ? '#2563EB' : '#F3F4F6', color: period === 'weekly' ? 'white' : '#4B5563',
                transition: 'all 0.2s'
              }}
            >
              📅 Weekly
            </button>
            <button
              onClick={() => handlePeriodChange('monthly')}
              style={{
                padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
                background: period === 'monthly' ? '#2563EB' : '#F3F4F6', color: period === 'monthly' ? 'white' : '#4B5563',
                transition: 'all 0.2s'
              }}
            >
              📆 Monthly
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <button onClick={() => fetchReport(fromDate, toDate, period)} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: 12, background: '#2563EB', color: 'white', fontWeight: 600 }}>Apply</button>
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
          <div id="printable-area" style={{ background: 'white', padding: '10px 0' }}>

            {/* ── COMPANY LOGO & NAME HEADER ─────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
              <img src="/logo-only.png" alt="SreeLakshmi Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1E4DB7', letterSpacing: -0.5, lineHeight: 1.1 }}>
                  SreeLakshmi Charity Trust
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Official Staff Performance Report
                </div>
              </div>
            </div>

            {/* ── REPORT TITLE ────────────────────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1 style={{ fontSize: 40, fontWeight: 900, color: '#2563EB', margin: 0, letterSpacing: -1, lineHeight: 1.1 }}>
                {period === 'weekly' ? 'Weekly PR Report' : 'Monthly PR Report'}
              </h1>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#374151', marginTop: 4, fontFamily: 'sans-serif' }}>
                Direct Intraction Chart
              </div>
            </div>

            {/* ── DYNAMIC REPORTING PERIOD STRIP ────────────── */}
            <div style={{
              background: 'linear-gradient(90deg, #4A7CD6, #3B82F6)',
              borderRadius: 30, padding: '12px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: 'white', fontWeight: 600, fontSize: 14, marginBottom: 28,
            }}>
              <div>
                Reporting Period: <span style={{ fontWeight: 800 }}>{formatDateDisplay(fromDate, reportData?.from_date)}</span> to <span style={{ fontWeight: 800 }}>{formatDateDisplay(toDate, reportData?.to_date)}</span>
              </div>
              <div>
                Prepared By: <span style={{ fontWeight: 800 }}>{reportData?.prepared_by || 'HR And Accounts'}</span>
              </div>
            </div>

            {/* ── TOP METRICS CARDS ───────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, textAlign: 'center', marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Total Donation</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#16A34A' }}>
                  {summary.total_donation ? summary.total_donation.toLocaleString('en-IN') : '0'}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', padding: '0 10px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Total Leads</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#16A34A' }}>
                  {summary.total_leads ? summary.total_leads.toLocaleString('en-IN') : '0'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Total Enquiries</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#16A34A' }}>
                  {summary.total_enquiries ? summary.total_enquiries.toLocaleString('en-IN') : '0'}
                </div>
              </div>
            </div>

            {/* ── HORIZONTAL BAR CHART ───────────────────────── */}
            <div style={{ border: '2px solid #93C5FD', borderRadius: 24, padding: '24px 28px', marginBottom: 32, background: '#FAFAFA' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2937', marginBottom: 20 }}>
                Performar by Content Type
              </div>

              {staffList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>No staff performance records found for this period</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {staffList.slice(0, 5).map((staff, idx) => {
                    const val = staff.donation || staff.leads || 0
                    const widthPct = Math.min(100, Math.max(12, (val / maxBarValue) * 85))
                    return (
                      <div key={staff.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 80, fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'right' }}>
                          {staff.name.split(' ')[0]}
                        </div>
                        <div style={{ flex: 1, height: 28, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            height: '100%', width: `${widthPct}%`,
                            background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
                            borderRadius: '0 4px 4px 0', transition: 'width 0.6s ease'
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* X-Axis markings */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingLeft: 96, fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                <span>0</span>
                <span>2,000</span>
                <span>4,000</span>
                <span>6,000</span>
                <span>8,000</span>
                <span>10,000</span>
                <span>12,000</span>
                <span>14,000</span>
              </div>
            </div>

            {/* ── PERFORMANCE TABLE ───────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
                Performance by Platform:
              </div>

              {/* Table Header Pill */}
              <div style={{
                background: '#3B82F6', borderRadius: 20, padding: '10px 20px',
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 1.8fr 1.2fr',
                color: 'white', fontWeight: 700, fontSize: 12, textTransform: 'capitalize',
                marginBottom: 12
              }}>
                <div>Platform</div>
                <div style={{ textAlign: 'right' }}>Donation</div>
                <div style={{ textAlign: 'center' }}>Growth</div>
                <div style={{ textAlign: 'center' }}>Engagement Rate</div>
                <div style={{ textAlign: 'right' }}>Month Ratio</div>
              </div>

              {/* Table Body Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffList.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>No staff members with role = STAFF recorded</div>
                ) : staffList.map((staff, idx) => (
                  <div key={staff.id || idx} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 1.8fr 1.2fr',
                    padding: '8px 20px', alignItems: 'center', fontSize: 15, fontWeight: 700, color: '#111827'
                  }}>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>{staff.name}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>
                      {staff.donation ? staff.donation.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                    </div>
                    <div style={{ textAlign: 'center', color: '#1E4DB7', fontWeight: 700 }}>{staff.growth}</div>
                    <div style={{ textAlign: 'center', color: '#1F2937', fontWeight: 700 }}>{staff.engagement_rate}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>{staff.month_ratio}</div>
                  </div>
                ))}
              </div>

              <div style={{ height: 2, background: '#3B82F6', marginTop: 16, borderRadius: 2 }} />
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
          .printable-report-wrapper, #printable-area, #printable-area * {
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
