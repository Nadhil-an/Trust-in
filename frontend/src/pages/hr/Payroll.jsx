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

  // View Slip
  const [selectedSlip, setSelectedSlip] = useState(null)
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
          return {
            isGenerated: true,
            id: payroll.id,
            payroll_id: payroll.payroll_id,
            employee_name: payroll.employee_name,
            month: payroll.month,
            year: payroll.year,
            basic_salary: payroll.basic_salary,
            advance_salary: payroll.other_deductions || 0,
            balance_salary: payroll.net_salary,
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
          payroll_id: "N/A",
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
          net_salary: balance,
          status: "PAID",
          remarks: "",
        }

        return {
          isGenerated: false,
          id: "UNGEN-" + emp.id,
          payroll_id: "-",
          employee_name: emp.full_name,
          month: monthFilter,
          year: yearFilter,
          basic_salary: basic,
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

  // ── Print Slip ─────────────────────────────────────────────────────
  const handlePrint = () => {
    const printContent = document.getElementById("printable-slip").innerHTML
    const original = document.body.innerHTML
    document.body.innerHTML = printContent
    window.print()
    document.body.innerHTML = original
    window.location.reload()
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Salary & Payroll" subtitle="Monthly payroll management">
        <button className="btn btn-primary" onClick={openGenerateModal}>
          + Generate Payroll
        </button>
      </PageHeader>

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
                  <th>Bonus (10%+30%)</th>
                  <th>Advance Salary</th>
                  <th>Balance Salary</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
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
                      <td>{p.employee_name}</td>
                      <td>
                        {p.month}/{p.year}
                      </td>
                      <td>
                        <AmountDisplay amount={p.basic_salary} />
                      </td>
                      <td style={{ color: '#9333EA', fontWeight: 600 }}>
                        +{formatINR(p.original?.total_bonus || (Number(p.original?.donation_bonus || 0) + Number(p.original?.membership_bonus || 0)))}
                      </td>
                      <td
                        style={{
                          color: p.advance_salary > 0 ? "#ef4444" : "inherit",
                        }}
                      >
                        <AmountDisplay amount={p.advance_salary} />
                      </td>
                      <td style={{ fontWeight: "bold" }}>
                        <AmountDisplay amount={p.balance_salary} type="neutral" />
                      </td>
                      <td>
                        <span className="badge badge-green">PAID</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setSelectedSlip(p.original)}
                          style={{ fontSize: "12px", padding: "4px 8px" }}
                        >
                          👁️ View Slip
                        </button>
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
                className="btn btn-secondary"
                onClick={() => setSelectedSlip(null)}
              >
                Close
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print Slip
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
