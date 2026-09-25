import React, { useState, useEffect, useCallback } from "react"
import { hrApi, accountsApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal, AmountDisplay, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function PayrollPage() {
  // ── State ──────────────────────────────────────────────────────────
  const [items, setItems] = useState([])
  const [employees, setEmployees] = useState([])
  const [recentAdvances, setRecentAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [selectedSlip, setSelectedSlip] = useState(null)

  // ── Data Loading ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, empRes, expRes] = await Promise.all([
        hrApi.payroll.list({ search, status: statusFilter, month: monthFilter, year: yearFilter }),
        hrApi.officers.list(),
        accountsApi.expenses.list({ category: "SALARY ADVANCE", limit: 300 }).catch(() => ({ data: [] })),
      ])
      setItems(res.data.results || res.data)
      setEmployees(empRes.data.results || empRes.data)

      const advances = (expRes.data.results || expRes.data || []).filter((a) => {
        if (a.status === "CANCELLED") return false
        if (!a.date) return false
        const d = new Date(a.date)
        return (d.getMonth() + 1) == monthFilter && d.getFullYear() == yearFilter
      })
      setRecentAdvances(advances)
    } catch (_) {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, monthFilter, yearFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener("dashboard-refresh", handleRefresh)
    return () => window.removeEventListener("dashboard-refresh", handleRefresh)
  }, [load])

  // ── Unified Table Data ─────────────────────────────────────────────
  const unifiedItems = React.useMemo(() => {
    return employees.map((emp) => {
      // Check if a generated payroll exists for this employee
      const payroll = items.find((p) => p.employee === emp.id || p.employee_name === emp.full_name)
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

      // No generated payroll — build from advances
      const empAdvances = recentAdvances.filter(
        (a) => (a.payee || "").toLowerCase() === emp.full_name.toLowerCase()
      )
      const advanceTotal = empAdvances.reduce((sum, a) => sum + Number(a.amount), 0)
      const basic = emp.salary_structure ? Number(emp.salary_structure.basic_salary) : 0
      const balance = basic - advanceTotal

      // Only show if they have received an advance
      if (advanceTotal === 0) return null

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
    .filter(Boolean) // remove nulls (employees with no payroll and no advance)
    .filter((item) => {
      if (search && !item.employee_name.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter && item.status !== statusFilter) return false
      return true
    })
  }, [employees, items, recentAdvances, monthFilter, yearFilter, search, statusFilter])

  // ── Print Slip ─────────────────────────────────────────────────────
  const handlePrint = () => {
    const printContent = document.getElementById("printable-slip").innerHTML
    const originalContent = document.body.innerHTML
    document.body.innerHTML = printContent
    window.print()
    document.body.innerHTML = originalContent
    window.location.reload()
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Salary & Payroll" subtitle="Monthly payroll management" />

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

        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payroll ID</th>
                  <th>Employee</th>
                  <th>Month/Year</th>
                  <th>Basic Salary</th>
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
                    <tr key={p.id}>
                      <td className="td-mono">{p.payroll_id}</td>
                      <td>{p.employee_name}</td>
                      <td>{p.month}/{p.year}</td>
                      <td>
                        <AmountDisplay amount={p.basic_salary} />
                      </td>
                      <td style={{ color: p.advance_salary > 0 ? "#ef4444" : "inherit" }}>
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

      {/* Salary Slip Modal */}
      {selectedSlip && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSlip(null)}
          title="Salary Slip"
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setSelectedSlip(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>
                🖨️ Print Slip
              </button>
            </>
          }
        >
          <div id="printable-slip" style={{ padding: "20px", fontFamily: "Arial, sans-serif", color: "#1e293b" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "15px" }}>
              <h2 style={{ margin: "0 0 5px 0", color: "#0f172a" }}>Sree Lakshmi Charitable Trust</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Salary Slip for {format(new Date(2020, selectedSlip.month - 1, 1), "MMMM")} {selectedSlip.year}
              </p>
            </div>

            {/* Employee Info */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px", fontSize: "14px" }}>
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
              {/* Earnings */}
              <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "8px", padding: "15px" }}>
                <h4 style={{ margin: "0 0 15px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>Earnings</h4>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Basic Salary</span><span>{formatINR(selectedSlip.basic_salary)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>HRA</span><span>{formatINR(selectedSlip.hra)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>TA</span><span>{formatINR(selectedSlip.ta)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Other Allowances</span><span>{formatINR(selectedSlip.other_allowances)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #e2e8f0", fontWeight: "bold" }}>
                  <span>Gross Salary</span><span>{formatINR(selectedSlip.gross_salary)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: "8px", padding: "15px" }}>
                <h4 style={{ margin: "0 0 15px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>Deductions</h4>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>PF Deduction</span><span>{formatINR(selectedSlip.pf_deduction)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#ef4444" }}>
                  <span>Salary Advance</span><span>{formatINR(selectedSlip.other_deductions)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #e2e8f0", fontWeight: "bold" }}>
                  <span>Total Deductions</span>
                  <span>{formatINR(Number(selectedSlip.pf_deduction) + Number(selectedSlip.other_deductions))}</span>
                </div>
              </div>
            </div>

            {/* Net Payable */}
            <div style={{ marginTop: "25px", background: "#f8fafc", padding: "15px 20px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #bfdbfe" }}>
              <span style={{ fontSize: "16px", fontWeight: "bold", color: "#1e293b" }}>Net Payable Salary</span>
              <span style={{ fontSize: "24px", fontWeight: "900", color: "#1d4ed8" }}>{formatINR(selectedSlip.net_salary)}</span>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "12px" }}>
              <div>
                <hr style={{ width: "150px", borderTop: "1px solid #94a3b8", margin: "0 0 5px 0" }} />
                Employer Signature
              </div>
              <div style={{ textAlign: "right" }}>
                <hr style={{ width: "150px", borderTop: "1px solid #94a3b8", margin: "0 0 5px 0" }} />
                Employee Signature
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
