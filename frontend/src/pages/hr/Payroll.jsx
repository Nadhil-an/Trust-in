import React, { useState, useEffect, useCallback } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal, AmountDisplay, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function PayrollPage() {
  const [items, setItems] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState(8) // Default to August
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  
  const [genModal, setGenModal] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editAttendance, setEditAttendance] = useState(false)
  
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const [genForm, setGenForm] = useState({
    employee: "",
    month: currentMonth,
    year: currentYear,
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
  })

  const load = useCallback(async () => {
    setLoading(true)
    try { 
      const [res, empRes] = await Promise.all([
        hrApi.payroll.list({
          search,
          status: statusFilter,
          month: monthFilter,
          year: yearFilter
        }),
        hrApi.officers.list()
      ])
      setItems(res.data.results || res.data)
      setEmployees(empRes.data.results || empRes.data)
    }
    catch (_) {} finally { setLoading(false) }
  }, [search, statusFilter, monthFilter, yearFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const loadPayrollData = async () => {
    if (!genForm.employee || !genForm.month || !genForm.year) return
    setGenLoading(true)
    try {
      const res = await hrApi.officers.payrollData(genForm.employee, { month: genForm.month, year: genForm.year })
      const data = res.data
      
      const structure = data.salary_structure
      const att = data.attendance
      const workingDays = 30 // standard assumption, can be adjusted
      const present = att.present
      
      let computedBasic = Number(structure.basic_salary)
      
      // Auto logic for Part Time/Daily Wage vs Full Time
      if (['PART_TIME', 'DAILY_WAGE', 'CONTRACT'].includes(data.employment_type)) {
        computedBasic = computedBasic * present
      } 
      // For FULL_TIME, user requested manual adjustment, so it defaults to full Basic Salary

      setGenForm(f => ({
        ...f,
        salary_structure: structure.id,
        present_days: present,
        absent_days: att.absent,
        leave_days: att.leave,
        basic_salary: computedBasic,
        hra: Number(structure.hra),
        ta: Number(structure.ta),
        other_allowances: Number(structure.other_allowances),
        pf_deduction: Number(structure.pf_deduction), // User requested fixed amount first
        other_deductions: 0, // Reset advance/other deductions for manual input
      }))
      
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load payroll data")
    } finally {
      setGenLoading(false)
    }
  }

  // Load data automatically when employee, month or year changes
  useEffect(() => {
    if (genModal && genForm.employee) {
      loadPayrollData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genForm.employee, genForm.month, genForm.year])

  const handleGenChange = (k, v) => {
    setGenForm(f => ({ ...f, [k]: v }))
  }

  const grossSalary = Number(genForm.basic_salary) + Number(genForm.hra) + Number(genForm.ta) + Number(genForm.other_allowances)
  const netSalary = grossSalary - Number(genForm.pf_deduction) - Number(genForm.other_deductions)

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!genForm.salary_structure) {
      toast.error("Please load employee payroll data first.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...genForm,
        gross_salary: grossSalary,
        net_salary: netSalary,
        status: 'APPROVED' // Auto-approve upon generation
      }
      await hrApi.payroll.create(payload)
      toast.success("Payroll generated successfully!")
      setGenModal(false)
      load()
    } catch (err) {
      const apiError = err.response?.data?.non_field_errors?.[0];
      if (apiError && apiError.includes('unique set')) {
        toast.error("Payroll has already been generated for this employee in the selected month & year.");
      } else {
        toast.error(apiError || "Failed to generate payroll");
      }
    } finally {
      setSaving(false)
    }
  }

  const openGenerateModal = () => {
    setGenForm({
      employee: "", month: currentMonth, year: currentYear, salary_structure: "",
      working_days: 30, present_days: 0, absent_days: 0, leave_days: 0,
      basic_salary: 0, hra: 0, ta: 0, other_allowances: 0, pf_deduction: 0, other_deductions: 0,
    })
    setGenModal(true)
  }

  return (
    <div>
      <PageHeader title="Salary & Payroll" subtitle="Monthly payroll management">
        <button className="btn btn-primary" onClick={openGenerateModal}>+ Generate Payroll</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select className="filter-select" style={{ width: '130px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="APPROVED">Pending</option>
            <option value="PAID">Paid</option>
          </select>
          <select className="filter-select" style={{ width: '130px' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="">All Months</option>
            {Array.from({length:12}).map((_,i) => <option key={i+1} value={i+1}>{format(new Date(2020, i, 1), 'MMMM')}</option>)}
          </select>
          <input type="number" className="filter-select" style={{ width: '80px' }} placeholder="Year" value={yearFilter} onChange={e => setYearFilter(e.target.value)} />
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payroll ID</th><th>Employee</th><th>Month/Year</th><th>Basic</th><th>Gross</th><th>Net Salary</th><th>Status</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={7}><EmptyState icon="💰" title="No payroll records" /></td></tr>
                  : items.map(p=>(<tr key={p.id}>
                    <td className="td-mono">{p.payroll_id}</td>
                    <td>{p.employee_name}</td>
                    <td>{p.month}/{p.year}</td>
                    <td><AmountDisplay amount={p.basic_salary} /></td>
                    <td><AmountDisplay amount={p.gross_salary} /></td>
                    <td><AmountDisplay amount={p.net_salary} type="neutral" /></td>
                    <td><span className={`badge ${p.status==="PAID"?"badge-green":p.status==="APPROVED"?"badge-yellow":"badge-gray"}`}>{p.status==="APPROVED"?"PENDING":p.status}</span></td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>



      {genModal && (
        <Modal isOpen={true} onClose={()=>setGenModal(false)} title="Generate Monthly Payroll" size="modal-lg"
          footer={<>
            <button className="btn btn-secondary" onClick={()=>setGenModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="gen-form" type="submit" disabled={saving || genLoading}>{saving?"Generating...":"Generate Payroll"}</button>
          </>}>
          <form id="gen-form" onSubmit={handleGenerate}>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label required">Employee</label>
                <select className="form-control" required value={genForm.employee} onChange={e=>handleGenChange("employee", e.target.value)}>
                  <option value="">Select Employee...</option>
                  {employees.filter(e => e.status === 'ACTIVE').map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Month</label>
                <select className="form-control" required value={genForm.month} onChange={e=>handleGenChange("month", e.target.value)}>
                  {Array.from({length:12}).map((_,i) => <option key={i+1} value={i+1}>{format(new Date(2020, i, 1), 'MMMM')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Year</label>
                <input className="form-control" type="number" required value={genForm.year} onChange={e=>handleGenChange("year", e.target.value)} />
              </div>
            </div>

            {genLoading ? <div style={{padding: '20px', textAlign: 'center'}}><LoadingState /></div> : (
              genForm.salary_structure ? (
                <>
                  <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '15px', margin: 0, color: 'var(--gray-800)', fontWeight: '600' }}>Attendance Summary</h4>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={(e) => { e.preventDefault(); setEditAttendance(!editAttendance) }}>
                        {editAttendance ? 'Done Editing' : 'Edit Attendance'}
                      </button>
                    </div>
                    
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div className="form-grid-4">
                        <div className="form-group">
                          <label className="form-label" style={{color: '#475569'}}>Working Days</label>
                          {editAttendance ? 
                            <input type="number" className="form-control" value={genForm.working_days} onChange={e=>handleGenChange("working_days", e.target.value)} /> :
                            <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>{genForm.working_days}</div>
                          }
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{color: '#475569'}}>Present Days</label>
                          {editAttendance ? 
                            <input type="number" className="form-control" value={genForm.present_days} onChange={e=>handleGenChange("present_days", e.target.value)} /> :
                            <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#10b981' }}>{genForm.present_days}</div>
                          }
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{color: '#475569'}}>Absent Days</label>
                          {editAttendance ? 
                            <input type="number" className="form-control" value={genForm.absent_days} readOnly style={{background: '#e2e8f0', color: '#475569'}} /> :
                            <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#ef4444' }}>{genForm.absent_days}</div>
                          }
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{color: '#475569'}}>Leave Days</label>
                          {editAttendance ? 
                            <input type="number" className="form-control" value={genForm.leave_days} readOnly style={{background: '#e2e8f0', color: '#475569'}} /> :
                            <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f59e0b' }}>{genForm.leave_days}</div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--gray-200)', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-700)' }}>Earnings</h4>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Basic Salary <small style={{color:'var(--gray-500)', fontWeight:'normal'}}>(Adjust if needed)</small></label>
                        <input type="number" step="0.01" className="form-control" value={genForm.basic_salary} onChange={e=>handleGenChange("basic_salary", e.target.value)} />
                      </div>
                      <div className="form-group"><label className="form-label">HRA</label><input type="number" step="0.01" className="form-control" value={genForm.hra} onChange={e=>handleGenChange("hra", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">TA</label><input type="number" step="0.01" className="form-control" value={genForm.ta} onChange={e=>handleGenChange("ta", e.target.value)} /></div>
                      <div className="form-group"><label className="form-label">Other Allowances</label><input type="number" step="0.01" className="form-control" value={genForm.other_allowances} onChange={e=>handleGenChange("other_allowances", e.target.value)} /></div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--gray-200)', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-700)' }}>Deductions</h4>
                    <div className="form-grid-2">
                      <div className="form-group"><label className="form-label">PF Deduction</label><input type="number" step="0.01" className="form-control" value={genForm.pf_deduction} onChange={e=>handleGenChange("pf_deduction", e.target.value)} /></div>
                      <div className="form-group">
                        <label className="form-label" style={{color: 'var(--danger-color)'}}>Advance Salary / Other Deductions</label>
                        <input type="number" step="0.01" className="form-control" value={genForm.other_deductions} onChange={e=>handleGenChange("other_deductions", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem', background: 'var(--primary-50)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', textTransform: 'uppercase' }}>Gross Salary</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatINR(grossSalary)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', textTransform: 'uppercase' }}>Net Payable Salary</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{formatINR(netSalary)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--gray-500)' }}>
                  Select an employee to load their salary structure.
                </div>
              )
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
