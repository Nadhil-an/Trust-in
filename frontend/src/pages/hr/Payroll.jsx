import React, { useState, useEffect, useCallback } from "react"
import { hrApi, accountsApi } from "../../api"
import {
  LoadingState,
  EmptyState,
  PageHeader,
  FilterBar,
  Modal,
  AmountDisplay,
  formatINR,
  ConfirmModal,
  useSecretDelete,
  SecretDeleteBanner,
} from "../../components/shared"
import { format } from "date-fns"
import html2pdf from "html2pdf.js"
import toast from "react-hot-toast"

const CURRENT_MONTH = new Date().getMonth() + 1
const CURRENT_YEAR = new Date().getFullYear()

const DEFAULT_GEN_FORM = {
  employee: "",
  month: CURRENT_MONTH,
  year: CURRENT_YEAR,
  salary_structure: "",
  working_days: 30,
  present_days: 0,
  absent_days: 0,
  leave_days: 0,
  basic_salary: 0,
  hra: 0,
  ta: 0,
  other_allowances: 0,
  pf_deduction: 0,
  other_deductions: 0,
  collection_excess: 0,
  collection_shortage: 0,
  donation_bonus: 0,
  membership_bonus: 0,
  total_bonus: 0,
  bonus_history: [],
  collection_history: [],
  payment_method: "BANK",
  remarks: "",
}

export default function PayrollPage() {
  // ── State ──────────────────────────────────────────────────────────
  const [items, setItems] = useState([])
  const [employees, setEmployees] = useState([])
  const [recentAdvances, setRecentAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState(CURRENT_MONTH)
  const [yearFilter, setYearFilter] = useState(CURRENT_YEAR)

  // View Slip & Export
  const [selectedSlip, setSelectedSlip] = useState(null)
  const [downloadingSlip, setDownloadingSlip] = useState(false)
  const [allPayrollModalOpen, setAllPayrollModalOpen] = useState(false)
  const [downloadingAllPDF, setDownloadingAllPDF] = useState(false)
  const [bonusModalOpen, setBonusModalOpen] = useState(false)
  const [staffBonusList, setStaffBonusList] = useState([])
  const [loadingBonus, setLoadingBonus] = useState(false)


  // Generate Payroll modal
  const [genModal, setGenModal] = useState(false)
  const [genForm, setGenForm] = useState(DEFAULT_GEN_FORM)
  const [genLoading, setGenLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editAttendance, setEditAttendance] = useState(false)

  // ── Data Loading ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, empRes, expRes] = await Promise.all([
        hrApi.payroll.list({
          search,
          status: statusFilter,
          month: monthFilter,
          year: yearFilter,
        }),
        hrApi.officers.list(),
        accountsApi.expenses
          .list({ category: "SALARY ADVANCE", limit: 300 })
          .catch(() => ({ data: [] })),
      ])
      setItems(res.data.results || res.data)
      setEmployees(empRes.data.results || empRes.data)

      const advances = (expRes.data.results || expRes.data || []).filter((a) => {
        if (a.status === "CANCELLED") return false
        if (!a.date) return false
        const d = new Date(a.date)
        return (
          d.getMonth() + 1 == monthFilter && d.getFullYear() == yearFilter
        )
      })
      setRecentAdvances(advances)
    } catch (_) {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, monthFilter, yearFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener("dashboard-refresh", handleRefresh)
    return () => window.removeEventListener("dashboard-refresh", handleRefresh)
  }, [load])

  // ── Unified Table Rows ─────────────────────────────────────────────
  const unifiedItems = React.useMemo(() => {
    return employees
      .map((emp) => {
        const payroll = items.find(
          (p) => p.employee === emp.id || p.employee_name === emp.full_name
        )
        if (payroll) {
          const donBonus = Number(payroll.donation_bonus || 0)
          const memBonus = Number(payroll.membership_bonus || 0)
          const totBonus = Number(payroll.total_bonus || (donBonus + memBonus))
          return {
            isGenerated: true,
            id: payroll.id,
            payroll_id: payroll.payroll_id,
            employee_name: payroll.employee_name,
            month: payroll.month,
            year: payroll.year,
            basic_salary: Number(payroll.basic_salary || 0),
            donation_bonus: donBonus,
            membership_bonus: memBonus,
            total_bonus: totBonus,
            advance_salary: Number(payroll.other_deductions || 0),
            balance_salary: Number(payroll.net_salary || 0),
            status: payroll.status,
            original: payroll,
          }
        }

        // Not generated — check advances
        const empAdvances = recentAdvances.filter(
          (a) =>
            (a.payee || "").toLowerCase() === emp.full_name.toLowerCase()
        )
        const advanceTotal = empAdvances.reduce(
          (sum, a) => sum + Number(a.amount),
          0
        )

        if (advanceTotal === 0) return null // hide if no advance and no payroll

        const basic = emp.salary_structure
          ? Number(emp.salary_structure.basic_salary)
          : 0
        const balance = basic - advanceTotal

        const mockOriginal = {
          id: "UNGEN-" + emp.id,
          payroll_id: "UNGENERATED",
          employee_name: emp.full_name,
          month: monthFilter,
          year: yearFilter,
          basic_salary: basic,
          gross_salary: basic,
          hra: 0,
          ta: 0,
          other_allowances: 0,
          pf_deduction: 0,
          other_deductions: advanceTotal,
          donation_bonus: 0,
          membership_bonus: 0,
          total_bonus: 0,
          net_salary: balance,
          status: "UNGENERATED",
          remarks: "Pending payroll generation",
        }

        return {
          isGenerated: false,
          id: "UNGEN-" + emp.id,
          payroll_id: "-",
          employee_name: emp.full_name,
          month: monthFilter,
          year: yearFilter,
          basic_salary: basic,
          donation_bonus: 0,
          membership_bonus: 0,
          total_bonus: 0,
          advance_salary: advanceTotal,
          balance_salary: balance,
          status: "UNGENERATED",
          original: mockOriginal,
        }
      })
      .filter(Boolean)
      .filter((item) => {
        if (
          search &&
          !item.employee_name.toLowerCase().includes(search.toLowerCase())
        )
          return false
        if (statusFilter && item.status !== statusFilter) return false
        return true
      })
  }, [employees, items, recentAdvances, monthFilter, yearFilter, search, statusFilter])

  const {
    secretDeleteMode,
    selectedRowIds,
    deleteConfirmModal,
    setDeleteConfirmModal,
    deleting,
    toggleSelectRow,
    toggleSelectAll,
    confirmDeleteSelected,
    confirmDeleteOne,
    handlePermanentDelete,
  } = useSecretDelete({
    items: unifiedItems,
    itemName: 'payroll record',
    onDelete: async (itemsToDelete) => {
      for (const it of itemsToDelete) {
        if (it.id && it.status !== 'NOT_GENERATED') {
          await hrApi.payroll.delete(it.id);
        }
      }
    },
    reload: () => load(),
  });

  // ── Generate Payroll Logic ─────────────────────────────────────────
  const openGenerateModal = () => {
    setGenForm(DEFAULT_GEN_FORM)
    setEditAttendance(false)
    setGenModal(true)
  }

  const handleGenChange = (key, value) => {
    setGenForm((prev) => ({ ...prev, [key]: value }))
  }

  // Auto-load payroll data when employee/month/year changes inside modal
  useEffect(() => {
    if (!genModal || !genForm.employee || !genForm.month || !genForm.year)
      return

    let cancelled = false
    const fetchData = async () => {
      setGenLoading(true)
      try {
        const res = await hrApi.officers.payrollData(genForm.employee, {
          month: genForm.month,
          year: genForm.year,
        })
        if (cancelled) return
        const data = res.data
        const structure = data.salary_structure
        const att = data.attendance

        let computedBasic = Number(structure.basic_salary)
        if (
          ["PART_TIME", "DAILY_WAGE", "CONTRACT"].includes(data.employment_type)
        ) {
          computedBasic = computedBasic * att.present
        }

        setGenForm((prev) => ({
          ...prev,
          salary_structure: structure.id,
          present_days: att.present,
          absent_days: att.absent,
          leave_days: att.leave,
          basic_salary: computedBasic,
          hra: Number(structure.hra),
          ta: Number(structure.ta),
          other_allowances: Number(structure.other_allowances),
          pf_deduction: Number(structure.pf_deduction),
          other_deductions: data.salary_advance_taken || 0,
          collection_excess: Number(data.collection_excess || 0),
          collection_shortage: Number(data.collection_shortage || 0),
          donation_bonus: Number(data.donation_bonus || 0),
          membership_bonus: Number(data.membership_bonus || 0),
          total_bonus: Number(data.total_bonus || (Number(data.donation_bonus || 0) + Number(data.membership_bonus || 0))),
          bonus_history: data.bonus_history || [],
          collection_history: data.collection_history || [],
        }))
      } catch (err) {
        if (!cancelled)
          toast.error(
            err.response?.data?.error || "Failed to load employee data"
          )
      } finally {
        if (!cancelled) setGenLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genForm.employee, genForm.month, genForm.year, genModal])

  const grossSalary =
    Number(genForm.basic_salary) +
    Number(genForm.hra) +
    Number(genForm.ta) +
    Number(genForm.other_allowances)

  const totalBonus =
    Number(genForm.donation_bonus || 0) +
    Number(genForm.membership_bonus || 0)

  const totalDeductions =
    Number(genForm.pf_deduction) +
    Number(genForm.other_deductions) +
    Number(genForm.collection_shortage || 0)

  const netSalary =
    grossSalary +
    Number(genForm.collection_excess || 0) +
    totalBonus -
    totalDeductions

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!genForm.salary_structure) {
      toast.error("Please select an employee to load salary data first.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        employee: genForm.employee,
        month: genForm.month,
        year: genForm.year,
        salary_structure: genForm.salary_structure,
        working_days: genForm.working_days,
        present_days: genForm.present_days,
        absent_days: genForm.absent_days,
        leave_days: genForm.leave_days,
        basic_salary: Number(genForm.basic_salary),
        hra: Number(genForm.hra),
        ta: Number(genForm.ta),
        other_allowances: Number(genForm.other_allowances),
        gross_salary: grossSalary,
        pf_deduction: Number(genForm.pf_deduction),
        other_deductions: Number(genForm.other_deductions),
        collection_excess: Number(genForm.collection_excess || 0),
        collection_shortage: Number(genForm.collection_shortage || 0),
        donation_bonus: Number(genForm.donation_bonus || 0),
        membership_bonus: Number(genForm.membership_bonus || 0),
        total_bonus: totalBonus,
        net_salary: netSalary,
        payment_method: genForm.payment_method,
        remarks: genForm.remarks,
        status: "APPROVED",
      }
      await hrApi.payroll.create(payload)
      toast.success("Payroll generated successfully!")
      setGenModal(false)
      load()
    } catch (err) {
      const apiError = err.response?.data?.non_field_errors?.[0]
      if (apiError && apiError.includes("unique set")) {
        toast.error(
          "Payroll already generated for this employee in the selected month & year."
        )
      } else {
        toast.error(apiError || "Failed to generate payroll")
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Staff Bonus Modal Loader ──────────────────────────────────────
  const openBonusModal = async () => {
    setBonusModalOpen(true)
    setLoadingBonus(true)
    try {
      const res = await hrApi.staffBonus.all()
      setStaffBonusList(res.data || [])
    } catch (_) {
      toast.error("Failed to load staff bonus records")
    } finally {
      setLoadingBonus(false)
    }
  }

  // ── Print & PDF Handlers ───────────────────────────────────────────
  const handlePrintSlip = () => {
    window.print()
  }

  const handleDownloadSlipPDF = async (slipToExport) => {
    const slip = slipToExport || selectedSlip
    if (!slip) return
    const element = document.getElementById("printable-slip")
    if (!element) return
    setDownloadingSlip(true)
    try {
      const empName = (slip.employee_name || "Staff").replace(/[^a-zA-Z0-9_-]/g, "_")
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Salary_Slip_${empName}_${slip.month}_${slip.year}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }
      await html2pdf().set(opt).from(element).save()
      toast.success("Salary slip PDF downloaded successfully!")
    } catch (err) {
      toast.error("Failed to generate PDF slip")
    } finally {
      setDownloadingSlip(false)
    }
  }

  const handleDownloadAllPayrollPDF = async () => {
    const element = document.getElementById("printable-all-payroll")
    if (!element) return
    setDownloadingAllPDF(true)
    try {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: `SreeLakshmi_Payroll_Register_${monthFilter || "All"}_${yearFilter}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
      }
      await html2pdf().set(opt).from(element).save()
      toast.success("Complete payroll PDF downloaded successfully!")
    } catch (err) {
      toast.error("Failed to generate full payroll PDF")
    } finally {
      setDownloadingAllPDF(false)
    }
  }

  // Summary Metrics for the current view
  const totalBasicAll = unifiedItems.reduce((acc, it) => acc + Number(it.basic_salary || 0), 0)
  const totalBonusAll = unifiedItems.reduce(
    (acc, it) => acc + Number(it.total_bonus || it.original?.total_bonus || (Number(it.original?.donation_bonus || 0) + Number(it.original?.membership_bonus || 0)) || 0),
    0
  )
  const totalAdvanceDeductionsAll = unifiedItems.reduce(
    (acc, it) => acc + Number(it.advance_salary || it.original?.other_deductions || 0),
    0
  )
  const totalNetAll = unifiedItems.reduce(
    (acc, it) => acc + Number(it.balance_salary || it.original?.net_salary || 0),
    0
  )

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Salary & Payroll" subtitle="Monthly payroll management, incentives, and slips">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={openBonusModal}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            🎁 Bonus & Inc. Ledger
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setAllPayrollModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            📄 Export All (PDF)
          </button>
          <button
            className="btn btn-primary"
            onClick={openGenerateModal}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            + Generate Payroll
          </button>
        </div>
      </PageHeader>

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Basic Salary</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", marginTop: "4px" }}>
            {formatINR(totalBasicAll)}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{unifiedItems.length} Staff on record</div>
        </div>

        <div style={{ background: "#faf5ff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e9d5ff", boxShadow: "0 1px 3px rgba(126,34,206,0.05)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#7e22ce", textTransform: "uppercase" }}>
            🎁 Bonus & Incentives
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#6b21a8", marginTop: "4px" }}>
            +{formatINR(totalBonusAll)}
          </div>
          <div style={{ fontSize: "11px", color: "#a855f7", marginTop: "4px" }}>10% Donation + 30% Member</div>
        </div>

        <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Advances & Deductions</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#ef4444", marginTop: "4px" }}>
            -{formatINR(totalAdvanceDeductionsAll)}
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Advances, short & PF</div>
        </div>

        <div style={{ background: "#f0fdf4", padding: "18px 20px", borderRadius: "12px", border: "1px solid #bbf7d0", boxShadow: "0 1px 3px rgba(22,163,74,0.05)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#15803d", textTransform: "uppercase" }}>Net Disbursed Salary</div>
          <div style={{ fontSize: "22px", fontWeight: "900", color: "#166534", marginTop: "4px" }}>
            {formatINR(totalNetAll)}
          </div>
          <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>Basic + Bonus - Deductions</div>
        </div>
      </div>

      {/* ── Main Table ── */}
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select
            className="filter-select"
            style={{ width: "130px" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="UNGENERATED">Ungenerated</option>
            <option value="APPROVED">Pending</option>
            <option value="PAID">Paid</option>
          </select>

          <select
            className="filter-select"
            style={{ width: "130px" }}
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All Months</option>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {format(new Date(2020, i, 1), "MMMM")}
              </option>
            ))}
          </select>

          <input
            type="number"
            className="filter-select"
            style={{ width: "80px" }}
            placeholder="Year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          />
        </FilterBar>

        <SecretDeleteBanner
          secretDeleteMode={secretDeleteMode}
          selectedRowIds={selectedRowIds}
          onDeleteSelected={() => confirmDeleteSelected(unifiedItems)}
          itemName="payroll records"
        />

        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {secretDeleteMode && (
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.length === unifiedItems.length && unifiedItems.length > 0}
                        onChange={() => toggleSelectAll(unifiedItems)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th>Payroll ID</th>
                  <th>Employee</th>
                  <th>Month/Year</th>
                  <th>Basic Salary</th>
                  <th style={{ color: "#16a34a" }}>Donation Comm. (10%)</th>
                  <th style={{ color: "#7c3aed" }}>Member Bonus (30%)</th>
                  <th style={{ color: "#6b21a8" }}>Total Bonus & Comm.</th>
                  <th>Advance / Shortage</th>
                  <th>Net Payable Salary</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center", minWidth: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {unifiedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon="💰" title="No payroll records" />
                    </td>
                  </tr>
                ) : (
                  unifiedItems.map((p) => (
                    <tr key={p.id} style={{ background: selectedRowIds.includes(p.id) ? '#FEF2F2' : undefined }}>
                      {secretDeleteMode && (
                        <td style={{ textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(p.id)}
                            onChange={(ev) => toggleSelectRow(p.id, ev)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      <td className="td-mono">{p.payroll_id}</td>
                      <td style={{ fontWeight: 600 }}>{p.employee_name}</td>
                      <td>
                        {p.month}/{p.year}
                      </td>
                      <td>
                        <AmountDisplay amount={p.basic_salary} />
                      </td>
                      <td style={{ color: "#16a34a", fontWeight: 600 }}>
                        +{formatINR(p.donation_bonus || p.original?.donation_bonus || 0)}
                      </td>
                      <td style={{ color: "#7c3aed", fontWeight: 600 }}>
                        +{formatINR(p.membership_bonus || p.original?.membership_bonus || 0)}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: "#faf5ff",
                            color: "#6b21a8",
                            fontWeight: 700,
                            fontSize: "12px",
                            border: "1px solid #e9d5ff",
                          }}
                        >
                          +{formatINR(p.total_bonus || p.original?.total_bonus || ((p.donation_bonus || 0) + (p.membership_bonus || 0)))}
                        </span>
                      </td>
                      <td
                        style={{
                          color: p.advance_salary > 0 ? "#ef4444" : "inherit",
                        }}
                      >
                        <AmountDisplay amount={p.advance_salary} />
                      </td>
                      <td style={{ fontWeight: "800", color: "#1d4ed8" }}>
                        <AmountDisplay amount={p.balance_salary} type="neutral" />
                      </td>
                      <td>
                        {p.status === "PAID" ? (
                          <span className="badge badge-green">PAID</span>
                        ) : p.status === "APPROVED" ? (
                          <span className="badge badge-blue">PENDING</span>
                        ) : (
                          <span className="badge badge-gray">UNGENERATED</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setSelectedSlip(p.original)}
                            style={{ fontSize: "12px", padding: "4px 8px" }}
                            title="View Salary Slip"
                          >
                            👁️ View Slip
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setSelectedSlip(p.original)
                              setTimeout(() => handleDownloadSlipPDF(p.original), 200)
                            }}
                            style={{ fontSize: "12px", padding: "4px 8px", color: "#2563eb", borderColor: "#bfdbfe" }}
                            title="Download PDF Salary Slip"
                          >
                            📥 PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Salary Slip Modal ── */}
      {selectedSlip && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSlip(null)}
          title="Salary Slip"
          size="modal-lg"
          footer={
            <>
              <button
                className="btn btn-secondary no-print"
                onClick={() => setSelectedSlip(null)}
              >
                Close
              </button>
              <button className="btn btn-secondary no-print" onClick={handlePrintSlip}>
                🖨️ Print Slip
              </button>
              <button
                className="btn btn-primary no-print"
                onClick={() => handleDownloadSlipPDF(selectedSlip)}
                disabled={downloadingSlip}
              >
                {downloadingSlip ? "Generating PDF..." : "📥 Download PDF Slip"}
              </button>
            </>
          }
        >
          <div
            id="printable-slip"
            style={{
              padding: "20px",
              fontFamily: "Arial, sans-serif",
              color: "#1e293b",
            }}
          >
            {/* Header */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "20px",
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: "15px",
              }}
            >
              <h2 style={{ margin: "0 0 5px 0", color: "#0f172a" }}>
                Sree Lakshmi Charitable Trust
              </h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Salary Slip for{" "}
                {format(new Date(2020, selectedSlip.month - 1, 1), "MMMM")}{" "}
                {selectedSlip.year}
              </p>
            </div>

            {/* Info Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "25px",
                fontSize: "14px",
              }}
            >
              <div>
                <p style={{ margin: "4px 0" }}>
                  <strong>Employee Name:</strong> {selectedSlip.employee_name}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Payroll ID:</strong> {selectedSlip.payroll_id}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Status:</strong> {selectedSlip.status}
                </p>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div style={{ display: "flex", gap: "20px" }}>
              <div
                style={{
                  flex: 1,
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 15px 0",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "8px",
                  }}
                >
                  Earnings
                </h4>
                {[
                  ["Basic Salary", selectedSlip.basic_salary],
                  ["HRA", selectedSlip.hra],
                  ["TA", selectedSlip.ta],
                  ["Other Allowances", selectedSlip.other_allowances],
                  ...(Number(selectedSlip.collection_excess || 0) > 0
                    ? [["Collection Excess (Credit)", selectedSlip.collection_excess]]
                    : []),
                  ...(Number(selectedSlip.donation_bonus || 0) > 0
                    ? [["Donation Bonus (10%)", selectedSlip.donation_bonus]]
                    : []),
                  ...(Number(selectedSlip.membership_bonus || 0) > 0
                    ? [["Membership Bonus (30%)", selectedSlip.membership_bonus]]
                    : []),
                ].map(([label, val]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span>{label}</span>
                    <span>{formatINR(val)}</span>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "15px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e2e8f0",
                    fontWeight: "bold",
                  }}
                >
                  <span>Gross Salary</span>
                  <span>{formatINR(selectedSlip.gross_salary)}</span>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 15px 0",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "8px",
                  }}
                >
                  Deductions
                </h4>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>PF Deduction</span>
                  <span>{formatINR(selectedSlip.pf_deduction)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    color: "#ef4444",
                  }}
                >
                  <span>Salary Advance</span>
                  <span>{formatINR(selectedSlip.other_deductions)}</span>
                </div>
                {Number(selectedSlip.collection_shortage || 0) > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      color: "#dc2626",
                    }}
                  >
                    <span>Collection Shortage (Debit)</span>
                    <span>{formatINR(selectedSlip.collection_shortage)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "15px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e2e8f0",
                    fontWeight: "bold",
                  }}
                >
                  <span>Total Deductions</span>
                  <span>
                    {formatINR(
                      Number(selectedSlip.pf_deduction || 0) +
                        Number(selectedSlip.other_deductions || 0) +
                        Number(selectedSlip.collection_shortage || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Bonus & Commission Breakdown History */}
            {selectedSlip.bonus_history && selectedSlip.bonus_history.length > 0 && (
              <div
                style={{
                  marginTop: "20px",
                  border: "1px solid #e9d5ff",
                  borderRadius: "8px",
                  padding: "15px",
                  background: "#faf5ff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "14px", color: "#6b21a8", fontWeight: "700" }}>
                    🎁 Staff Bonus & Incentive Ledger Breakdown
                  </h4>
                  <span style={{ fontSize: "12px", color: "#7e22ce", fontWeight: "600" }}>
                    Total Credited: +{formatINR(selectedSlip.total_bonus || (Number(selectedSlip.donation_bonus || 0) + Number(selectedSlip.membership_bonus || 0)))}
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#f3e8ff", borderBottom: "1.5px solid #d8b4fe", textAlign: "left" }}>
                        <th style={{ padding: "6px 8px" }}>Date</th>
                        <th style={{ padding: "6px 8px" }}>Incentive Category</th>
                        <th style={{ padding: "6px 8px" }}>Description / Reference</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Amount Credited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlip.bonus_history.map((bh, idx) => (
                        <tr key={bh.id || idx} style={{ borderBottom: "1px solid #f3e8ff" }}>
                          <td style={{ padding: "6px 8px", color: "#64748b" }}>{bh.created_at ? bh.created_at.slice(0, 10) : "-"}</td>
                          <td style={{ padding: "6px 8px", fontWeight: "600", color: "#6b21a8" }}>{bh.bonus_type_display || bh.bonus_type}</td>
                          <td style={{ padding: "6px 8px", color: "#475569" }}>{bh.description || bh.member_name || bh.income_id || "-"}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "700", color: "#16a34a" }}>
                            +{formatINR(bh.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Collection Reconciliation History */}
            {selectedSlip.collection_history && selectedSlip.collection_history.length > 0 && (
              <div
                style={{
                  marginTop: "20px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "14px", color: "#1e293b", fontWeight: "700" }}>
                    Daily Collection Reconciliation Ledger
                  </h4>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {selectedSlip.collection_history.length} records in {format(new Date(selectedSlip.year, selectedSlip.month - 1, 1), "MMM yyyy")}
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1", textAlign: "left" }}>
                        <th style={{ padding: "6px 8px" }}>Date</th>
                        <th style={{ padding: "6px 8px" }}>Voucher No</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>System Expected</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Office Submitted</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Adjustment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlip.collection_history.map((row) => {
                        const diff = Number(row.excess_less || 0);
                        const isExcess = diff > 0;
                        const isShort = diff < 0;
                        return (
                          <tr key={row.id || row.date} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "6px 8px", fontWeight: "500" }}>{row.date}</td>
                            <td style={{ padding: "6px 8px", color: "#64748b" }}>{row.voucher_range || row.entry_code}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatINR(row.total_expected)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatINR(row.total_submitted)}</td>
                            <td
                              style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: "700",
                                color: isExcess ? "#16a34a" : isShort ? "#dc2626" : "#64748b",
                              }}
                            >
                              {isExcess ? `+${formatINR(diff)} (Excess)` : isShort ? `-${formatINR(Math.abs(diff))} (Shortage)` : "₹0 (Matched)"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #cbd5e1", fontWeight: "700", background: "#f8fafc" }}>
                        <td colSpan={2} style={{ padding: "8px" }}>Monthly Discrepancy Total</td>
                        <td colSpan={2} style={{ padding: "8px", textAlign: "right", color: "#64748b" }}>
                          Credit: +{formatINR(selectedSlip.collection_excess || 0)} | Debit: -{formatINR(selectedSlip.collection_shortage || 0)}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            textAlign: "right",
                            fontSize: "13px",
                            color: (Number(selectedSlip.collection_excess || 0) - Number(selectedSlip.collection_shortage || 0)) >= 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {(Number(selectedSlip.collection_excess || 0) - Number(selectedSlip.collection_shortage || 0)) >= 0
                            ? `+${formatINR(Number(selectedSlip.collection_excess || 0) - Number(selectedSlip.collection_shortage || 0))}`
                            : `-${formatINR(Math.abs(Number(selectedSlip.collection_excess || 0) - Number(selectedSlip.collection_shortage || 0)))}`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Net Payable */}
            <div
              style={{
                marginTop: "25px",
                background: "#f8fafc",
                padding: "15px 20px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #bfdbfe",
              }}
            >
              <span style={{ fontSize: "16px", fontWeight: "bold", color: "#1e293b" }}>
                Net Payable Salary
              </span>
              <span style={{ fontSize: "24px", fontWeight: "900", color: "#1d4ed8" }}>
                {formatINR(selectedSlip.net_salary)}
              </span>
            </div>

            {/* Signatures */}
            <div
              style={{
                marginTop: "40px",
                display: "flex",
                justifyContent: "space-between",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              <div>
                <hr
                  style={{
                    width: "150px",
                    borderTop: "1px solid #94a3b8",
                    margin: "0 0 5px 0",
                  }}
                />
                Employer Signature
              </div>
              <div style={{ textAlign: "right" }}>
                <hr
                  style={{
                    width: "150px",
                    borderTop: "1px solid #94a3b8",
                    margin: "0 0 5px 0",
                  }}
                />
                Employee Signature
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Generate Payroll Modal ── */}
      {genModal && (
        <Modal
          isOpen={true}
          onClose={() => setGenModal(false)}
          title="Generate Monthly Payroll"
          size="modal-lg"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setGenModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                form="gen-form"
                type="submit"
                disabled={saving || genLoading}
              >
                {saving ? "Generating..." : "Generate Payroll"}
              </button>
            </>
          }
        >
          <form id="gen-form" onSubmit={handleGenerate}>
            {/* Row 1: Employee / Month / Year */}
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label required">Employee</label>
                <select
                  className="form-control"
                  required
                  value={genForm.employee}
                  onChange={(e) => handleGenChange("employee", e.target.value)}
                >
                  <option value="">Select Employee...</option>
                  {employees
                    .filter((e) => e.status === "ACTIVE")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Month</label>
                <select
                  className="form-control"
                  required
                  value={genForm.month}
                  onChange={(e) => handleGenChange("month", e.target.value)}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {format(new Date(2020, i, 1), "MMMM")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Year</label>
                <input
                  className="form-control"
                  type="number"
                  required
                  value={genForm.year}
                  onChange={(e) => handleGenChange("year", e.target.value)}
                />
              </div>
            </div>

            {/* Loading / Data Section */}
            {genLoading ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <LoadingState />
              </div>
            ) : genForm.salary_structure ? (
              <>
                {/* Attendance Summary */}
                <div style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "15px",
                        margin: 0,
                        color: "var(--gray-800)",
                        fontWeight: "600",
                      }}
                    >
                      Attendance Summary
                    </h4>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setEditAttendance((v) => !v)}
                    >
                      {editAttendance ? "Done Editing" : "Edit Attendance"}
                    </button>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "16px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div className="form-grid-4">
                      {[
                        {
                          key: "working_days",
                          label: "Working Days",
                          color: "#1e293b",
                          editable: true,
                        },
                        {
                          key: "present_days",
                          label: "Present Days",
                          color: "#10b981",
                          editable: true,
                        },
                        {
                          key: "absent_days",
                          label: "Absent Days",
                          color: "#ef4444",
                          editable: false,
                        },
                        {
                          key: "leave_days",
                          label: "Leave Days",
                          color: "#f59e0b",
                          editable: false,
                        },
                      ].map(({ key, label, color, editable }) => (
                        <div className="form-group" key={key}>
                          <label
                            className="form-label"
                            style={{ color: "#475569" }}
                          >
                            {label}
                          </label>
                          {editAttendance && editable ? (
                            <input
                              type="number"
                              className="form-control"
                              value={genForm[key]}
                              onChange={(e) =>
                                handleGenChange(key, e.target.value)
                              }
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: "1.125rem",
                                fontWeight: "600",
                                color,
                              }}
                            >
                              {genForm[key]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Earnings */}
                <div
                  style={{
                    borderTop: "1px solid var(--gray-200)",
                    paddingTop: "1rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "14px",
                      marginBottom: "12px",
                      color: "var(--gray-700)",
                      fontWeight: "600",
                    }}
                  >
                    Earnings
                  </h4>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        Basic Salary{" "}
                        <small
                          style={{
                            color: "var(--gray-500)",
                            fontWeight: "normal",
                          }}
                        >
                          (Adjust if needed)
                        </small>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.basic_salary}
                        onChange={(e) =>
                          handleGenChange("basic_salary", e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">HRA</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.hra}
                        onChange={(e) => handleGenChange("hra", e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">TA</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.ta}
                        onChange={(e) => handleGenChange("ta", e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Other Allowances</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.other_allowances}
                        onChange={(e) =>
                          handleGenChange("other_allowances", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Bonus & Commission */}
                <div
                  style={{
                    borderTop: "1px solid #e9d5ff",
                    background: "#faf5ff",
                    borderRadius: "8px",
                    padding: "16px",
                    marginTop: "1rem",
                    border: "1px solid #d8b4fe",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h4
                      style={{
                        fontSize: "14px",
                        margin: 0,
                        color: "#6b21a8",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      🎁 Bonus & Commission (Added to Salary)
                    </h4>
                    <span
                      style={{
                        fontSize: "11px",
                        background: "#f3e8ff",
                        color: "#7e22ce",
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: "12px",
                        border: "1px solid #d8b4fe",
                      }}
                    >
                      10% Donation + 30% Membership
                    </span>
                  </div>
                  <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#7e22ce" }}>
                    Auto-calculated commission for this staff member during {format(new Date(genForm.year, genForm.month - 1, 1), "MMMM yyyy")}. You can review or adjust amounts before generating payroll.
                  </p>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" style={{ color: "#16a34a", fontWeight: "600" }}>
                        Donation Bonus / Commission (10%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.donation_bonus}
                        onChange={(e) => handleGenChange("donation_bonus", e.target.value)}
                        placeholder="0.00"
                      />
                      <small style={{ color: "#64748b", fontSize: "11px" }}>
                        ₹100 per ₹1,000 donation collected
                      </small>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: "#7c3aed", fontWeight: "600" }}>
                        Membership Bonus / Commission (30%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.membership_bonus}
                        onChange={(e) => handleGenChange("membership_bonus", e.target.value)}
                        placeholder="0.00"
                      />
                      <small style={{ color: "#64748b", fontSize: "11px" }}>
                        ₹30 per ₹100 new member enrollment fee
                      </small>
                    </div>
                  </div>

                  {/* Total Bonus & Commission highlight pill */}
                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#ffffff",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: "1px dashed #c084fc",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#6b21a8" }}>
                      Total Bonus & Commission Credited to Salary:
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: "800", color: "#7e22ce" }}>
                      +{formatINR(totalBonus)}
                    </span>
                  </div>

                  {/* Mini ledger of transactions if available */}
                  {genForm.bonus_history && genForm.bonus_history.length > 0 && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid #f3e8ff", paddingTop: "8px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#6b21a8", marginBottom: "6px" }}>
                        Breakdown of {genForm.bonus_history.length} Commission Events:
                      </div>
                      <div style={{ maxHeight: "120px", overflowY: "auto", fontSize: "11px", background: "#ffffff", borderRadius: "6px", padding: "6px 8px", border: "1px solid #e9d5ff" }}>
                        {genForm.bonus_history.map((bh, idx) => (
                          <div key={bh.id || idx} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: idx < genForm.bonus_history.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                            <span style={{ color: "#475569" }}>
                              {bh.bonus_type_display || bh.bonus_type}: {bh.description || (bh.member_name ? `Member: ${bh.member_name}` : `Receipt: ${bh.income_id}`)}
                            </span>
                            <span style={{ fontWeight: "700", color: "#7e22ce" }}>
                              +{formatINR(bh.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Deductions */}
                <div
                  style={{
                    borderTop: "1px solid var(--gray-200)",
                    paddingTop: "1rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "14px",
                      marginBottom: "12px",
                      color: "var(--gray-700)",
                      fontWeight: "600",
                    }}
                  >
                    Deductions
                  </h4>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">PF Deduction</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.pf_deduction}
                        onChange={(e) =>
                          handleGenChange("pf_deduction", e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label
                        className="form-label"
                        style={{ color: "var(--danger-color)" }}
                      >
                        Advance Salary / Other Deductions
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.other_deductions}
                        onChange={(e) =>
                          handleGenChange("other_deductions", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Collection Reconciliation Discrepancy Adjustments */}
                <div
                  style={{
                    borderTop: "1px solid var(--gray-200)",
                    paddingTop: "1rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h4
                      style={{
                        fontSize: "14px",
                        margin: 0,
                        color: "var(--gray-700)",
                        fontWeight: "600",
                      }}
                    >
                      Collection Reconciliation Adjustments (Promoter Registry)
                    </h4>
                    <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                      Auto-computed from daily submissions
                    </span>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" style={{ color: "#16a34a", fontWeight: "600" }}>
                        Collection Excess (+ Added to Salary)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.collection_excess}
                        onChange={(e) =>
                          handleGenChange("collection_excess", e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: "#ef4444", fontWeight: "600" }}>
                        Collection Shortage (- Deducted from Salary)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={genForm.collection_shortage}
                        onChange={(e) =>
                          handleGenChange("collection_shortage", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Bar */}
                <div
                  style={{
                    position: "sticky",
                    bottom: "-15px",
                    zIndex: 10,
                    marginTop: "1.5rem",
                    background: "#f8fafc",
                    padding: "16px 24px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    borderTop: "4px solid var(--primary-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 -10px 25px -5px rgba(0,0,0,0.1)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--gray-500)",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Basic Salary
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "var(--gray-800)",
                      }}
                    >
                      {formatINR(genForm.basic_salary)}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#7e22ce",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Bonus & Commission
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#7e22ce",
                      }}
                    >
                      +{formatINR(totalBonus)}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--gray-500)",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Deductions & Shortage
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "var(--danger-color)",
                      }}
                    >
                      - {formatINR(totalDeductions)}
                    </div>
                  </div>
                  {(Number(genForm.collection_excess || 0) > 0) && (
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#16a34a",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                        }}
                      >
                        Excess Credit
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "bold",
                          color: "#16a34a",
                        }}
                      >
                        + {formatINR(genForm.collection_excess)}
                      </div>
                    </div>
                  )}
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--primary-700)",
                        textTransform: "uppercase",
                        fontWeight: 800,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Pending Salary
                    </div>
                    <div
                      style={{
                        fontSize: "26px",
                        fontWeight: "900",
                        color: "var(--primary-800)",
                      }}
                    >
                      {formatINR(netSalary)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              genForm.employee && (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "var(--gray-500)",
                  }}
                >
                  Select an employee to load their salary structure.
                </div>
              )
            )}
          </form>
        </Modal>
      )}
      {/* ── Staff Bonus & Commission Management Modal ── */}
      <Modal
        open={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
        title="Staff Bonus & Commission Ledger (10% Donation + 30% Member)"
        width={850}
      >
        <div style={{ marginBottom: 16, background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: 8, padding: '12px 16px' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#7E22CE', fontSize: 14 }}>Salary Bonus & Commission Policy</h4>
          <p style={{ margin: 0, fontSize: 12, color: '#6B21A8', lineHeight: 1.5 }}>
            • <strong>Donation Bonus:</strong> 10% (₹100 per ₹1,000) allocated to staff bonus account for eligible donations.<br />
            • <strong>Membership Bonus:</strong> 30% (₹30 per ₹100) credited to respective staff bonus account upon new member registration.<br />
            • Both bonuses are tracked separately and automatically added during monthly salary processing.
          </p>
        </div>

        {loadingBonus ? (
          <LoadingState />
        ) : staffBonusList.length === 0 ? (
          <EmptyState icon="🎁" title="No staff bonus accounts found" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Staff Name</th>
                  <th>Donation Bonus (10%)</th>
                  <th>Member Bonus (30%)</th>
                  <th>Total Accumulated</th>
                  <th>Paid via Salary</th>
                  <th>Available Balance</th>
                </tr>
              </thead>
              <tbody>
                {staffBonusList.map((sb) => (
                  <tr key={sb.staff_uid}>
                    <td className="td-mono">{sb.staff_uid || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{sb.name}</td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>+{formatINR(sb.donation_bonus)}</td>
                    <td style={{ color: '#7c3aed', fontWeight: 600 }}>+{formatINR(sb.membership_bonus)}</td>
                    <td style={{ fontWeight: 700, color: '#9333ea' }}>{formatINR(sb.total_bonus)}</td>
                    <td style={{ color: '#64748b' }}>{formatINR(sb.total_paid_out)}</td>
                    <td style={{ fontWeight: 800, color: '#15803d' }}>{formatINR(sb.available_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
      {/* ── Monthly Payroll Register Modal (All Page PDF & Print) ── */}
      {allPayrollModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setAllPayrollModalOpen(false)}
          title="Monthly Payroll Register (All Staff PDF & Print)"
          size="modal-xl"
          footer={
            <>
              <button
                className="btn btn-secondary no-print"
                onClick={() => setAllPayrollModalOpen(false)}
              >
                Close
              </button>
              <button
                className="btn btn-secondary no-print"
                onClick={() => window.print()}
              >
                🖨️ Print Sheet
              </button>
              <button
                className="btn btn-primary no-print"
                onClick={handleDownloadAllPayrollPDF}
                disabled={downloadingAllPDF}
              >
                {downloadingAllPDF ? "Generating PDF..." : "📥 Download Full PDF"}
              </button>
            </>
          }
        >
          <div
            id="printable-all-payroll"
            className="printable-all-container"
            style={{
              padding: "24px",
              background: "#ffffff",
              fontFamily: "Arial, sans-serif",
              color: "#1e293b",
            }}
          >
            {/* Organization Header */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #0284c7", paddingBottom: "14px", marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 4px 0", color: "#0f172a", fontSize: "22px", fontWeight: "800" }}>
                Sree Lakshmi Charitable Trust
              </h2>
              <p style={{ margin: "0 0 4px 0", color: "#475569", fontSize: "13px" }}>
                Reg. No: 123/2018 | Kozhikode, Kerala, India
              </p>
              <h3 style={{ margin: "8px 0 0 0", color: "#0284c7", fontSize: "16px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
                Monthly Payroll Register & Commission Statement — {format(new Date(yearFilter || CURRENT_YEAR, (monthFilter || CURRENT_MONTH) - 1, 1), "MMMM yyyy")}
              </h3>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                Generated on {format(new Date(), "dd MMMM yyyy, hh:mm a")} | Total Records: {unifiedItems.length}
              </div>
            </div>

            {/* Metrics Summary Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Total Basic Salary</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b" }}>{formatINR(totalBasicAll)}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#7e22ce", fontWeight: "700", textTransform: "uppercase" }}>Total Bonus & Comm.</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#6b21a8" }}>+{formatINR(totalBonusAll)}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#dc2626", fontWeight: "700", textTransform: "uppercase" }}>Advances & Deductions</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#dc2626" }}>-{formatINR(totalAdvanceDeductionsAll)}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#15803d", fontWeight: "700", textTransform: "uppercase" }}>Net Disbursed</div>
                <div style={{ fontSize: "16px", fontWeight: "900", color: "#166534" }}>{formatINR(totalNetAll)}</div>
              </div>
            </div>

            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "#0f172a", color: "#ffffff", textAlign: "left" }}>
                  <th style={{ padding: "8px 6px" }}>#</th>
                  <th style={{ padding: "8px 6px" }}>Payroll ID</th>
                  <th style={{ padding: "8px 6px" }}>Staff Name</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Basic</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Donation Comm. (10%)</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Member Bonus (30%)</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Total Bonus</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Deductions</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Net Salary</th>
                  <th style={{ padding: "8px 6px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {unifiedItems.map((row, idx) => (
                  <tr key={row.id || idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ padding: "6px" }}>{idx + 1}</td>
                    <td style={{ padding: "6px", fontFamily: "monospace" }}>{row.payroll_id}</td>
                    <td style={{ padding: "6px", fontWeight: "600" }}>{row.employee_name}</td>
                    <td style={{ padding: "6px", textAlign: "right" }}>{formatINR(row.basic_salary)}</td>
                    <td style={{ padding: "6px", textAlign: "right", color: "#16a34a" }}>
                      +{formatINR(row.donation_bonus || row.original?.donation_bonus || 0)}
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", color: "#7c3aed" }}>
                      +{formatINR(row.membership_bonus || row.original?.membership_bonus || 0)}
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", fontWeight: "700", color: "#6b21a8" }}>
                      +{formatINR(row.total_bonus || row.original?.total_bonus || ((row.donation_bonus || 0) + (row.membership_bonus || 0)))}
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", color: "#dc2626" }}>
                      -{formatINR(row.advance_salary || row.original?.other_deductions || 0)}
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", fontWeight: "800", color: "#0f172a" }}>
                      {formatINR(row.balance_salary || row.original?.net_salary || 0)}
                    </td>
                    <td style={{ padding: "6px", textAlign: "center" }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: row.status === "PAID" ? "#dcfce7" : row.status === "APPROVED" ? "#dbeafe" : "#f1f5f9", color: row.status === "PAID" ? "#166534" : row.status === "APPROVED" ? "#1e40af" : "#64748b" }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: "800", borderTop: "2px solid #0f172a" }}>
                  <td colSpan={3} style={{ padding: "8px 6px" }}>GRAND TOTALS ({unifiedItems.length} STAFF)</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{formatINR(totalBasicAll)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "#16a34a" }}>
                    +{formatINR(unifiedItems.reduce((acc, it) => acc + Number(it.donation_bonus || it.original?.donation_bonus || 0), 0))}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "#7c3aed" }}>
                    +{formatINR(unifiedItems.reduce((acc, it) => acc + Number(it.membership_bonus || it.original?.membership_bonus || 0), 0))}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "#6b21a8" }}>+{formatINR(totalBonusAll)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "#dc2626" }}>-{formatINR(totalAdvanceDeductionsAll)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", fontSize: "13px" }}>{formatINR(totalNetAll)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "11px" }}>
              <div>
                <hr style={{ width: "160px", borderTop: "1px solid #94a3b8", margin: "0 0 5px 0" }} />
                Prepared By (HR Officer)
              </div>
              <div style={{ textAlign: "center" }}>
                <hr style={{ width: "160px", borderTop: "1px solid #94a3b8", margin: "0 0 5px 0" }} />
                Verified By (Accountant)
              </div>
              <div style={{ textAlign: "right" }}>
                <hr style={{ width: "160px", borderTop: "1px solid #94a3b8", margin: "0 0 5px 0" }} />
                Approved By (Managing Trustee)
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Print Styles Injection ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-slip, #printable-slip *,
          #printable-all-payroll, #printable-all-payroll * {
            visibility: visible !important;
          }
          #printable-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 20px !important;
            margin: 0 !important;
            background: white !important;
          }
          #printable-all-payroll {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 20px !important;
            margin: 0 !important;
            background: white !important;
          }
        }
      `}</style>

      <ConfirmModal
        isOpen={deleteConfirmModal.open}
        onClose={() => !deleting && setDeleteConfirmModal({ open: false, items: [] })}
        onConfirm={handlePermanentDelete}
        title="⚠️ Confirm Permanent Database Deletion"
        message={`Are you sure you want to permanently delete ${deleteConfirmModal.items.length} payroll record(s) from the database? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Permanently Delete"}
        isDanger={true}
      />
    </div>
  )
}
