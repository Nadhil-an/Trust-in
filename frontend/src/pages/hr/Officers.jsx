import React, { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const init = { full_name:"", designation:"", department:"", employment_type:"FULL_TIME", phone:"", email:"", joining_date:format(new Date(),"yyyy-MM-dd"), status:"ACTIVE", basic_salary: 0, hra: 0, ta: 0, other_allowances: 0, pf_deduction: 0 }

export default function Officers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const employmentTypeFilter = searchParams.get('employment_type') || ''
  
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)

  // Salary state
  const [salaryModal, setSalaryModal] = useState(null)
  const [salaryForm, setSalaryForm] = useState({ basic_salary: 0, hra: 0, ta: 0, other_allowances: 0, pf_deduction: 0, other_deductions: 0, effective_from: format(new Date(), "yyyy-MM-dd") })
  const [savingSalary, setSavingSalary] = useState(false)
  
  // Graph state
  const [graphData, setGraphData] = useState([])
  const [graphDays, setGraphDays] = useState(7)
  const [graphLoading, setGraphLoading] = useState(false)

  const F = (k,v) => setForm(f=>({...f,[k]:v}))
  
  const load = useCallback(async () => {
    setLoading(true)
    const params = { search }
    if (employmentTypeFilter) params.employment_type = employmentTypeFilter
    
    try { const res = await hrApi.officers.list(params); setItems(res.data.results || res.data) }
    catch (_) {} finally { setLoading(false) }
  }, [search, employmentTypeFilter])
  
  useEffect(() => { load() }, [load])

  const fetchGraphData = async (officerId, days) => {
    setGraphLoading(true)
    try {
      const res = await hrApi.officers.attendanceGraph(officerId, { days })
      setGraphData(res.data.history || [])
    } catch (_) {
      toast.error("Failed to load attendance graph")
    } finally {
      setGraphLoading(false)
    }
  }

  // Reload graph when days filter changes
  useEffect(() => {
    if (showViewModal && viewItem?.id) {
      fetchGraphData(viewItem.id, graphDays)
    }
  }, [graphDays, showViewModal, viewItem?.id])

  const handleSave = async (e) => {
    e.preventDefault()
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");
    
    setSaving(true)
    try {
      const { basic_salary, hra, ta, other_allowances, pf_deduction, ...officerData } = form
      let employeeId = selected ? selected.id : null;
      
      if (selected) {
        await hrApi.officers.update(selected.id, officerData)
      } else {
        const res = await hrApi.officers.create(officerData)
        employeeId = res.data.id
      }
      
      await hrApi.salaryStructures.create({
        employee: employeeId,
        basic_salary: basic_salary || 0,
        hra: hra || 0,
        ta: ta || 0,
        other_allowances: other_allowances || 0,
        pf_deduction: pf_deduction || 0,
        effective_from: format(new Date(), "yyyy-MM-dd")
      })
      
      toast.success("Saved."); setShowModal(false); load()
    } catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }
  
  const openViewModal = (o) => {
    setViewItem(o)
    setGraphDays(7) // Reset to 7 days
    setGraphData([])
    setShowViewModal(true)
  }

  return (
    <div>
      <PageHeader title={employmentTypeFilter === 'FULL_TIME' ? "Full-Time Staff" : "Staff Members"} subtitle="Staff and employees">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setForm(init);setShowModal(true)}}>+ Add Staff Member</button>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select 
            className="filter-select" 
            style={{ width: '200px' }} 
            value={employmentTypeFilter} 
            onChange={(e) => {
              if (e.target.value) searchParams.set('employment_type', e.target.value)
              else searchParams.delete('employment_type')
              setSearchParams(searchParams)
            }}
          >
            <option value="">All Employment Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="PART_TIME">Part Time</option>
            <option value="CONTRACT">Contract</option>
            <option value="DAILY_WAGE">Daily Wage</option>
          </select>
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Emp ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Type</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="👨‍💼" title="No staff members" /></td></tr>
                  : items.map(o=>(<tr key={o.id} onClick={()=>openViewModal(o)} style={{cursor: 'pointer'}} className="hover-row"><td className="td-mono">{o.employee_id}</td><td>{o.full_name}</td><td>{o.designation}</td><td>{o.department}</td><td><span className="badge badge-blue">{o.employment_type}</span></td><td>{o.joining_date ? format(new Date(o.joining_date),"dd MMM yyyy") : "-"}</td><td><span className={`badge ${o.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{o.status}</span></td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={(e)=>{
                        e.stopPropagation(); 
                        setSelected(o);
                        const ss = o.salary_structure || {};
                        setForm({...o, basic_salary: ss.basic_salary || 0, hra: ss.hra || 0, ta: ss.ta || 0, other_allowances: ss.other_allowances || 0, pf_deduction: ss.pf_deduction || 0});
                        setShowModal(true)
                      }}>Edit</button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={selected?"Edit Staff Member":"Add Staff Member"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" form="off-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="off-form" onSubmit={handleSave}>
            <div className="form-grid-3">
              <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" required value={form.full_name} onChange={e=>F("full_name",e.target.value)} /></div>
              <div className="form-group"><label className="form-label required">Designation</label><input className="form-control" required value={form.designation} onChange={e=>F("designation",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={form.department} onChange={e=>F("department",e.target.value)} /></div>
              <div className="form-group"><label className="form-label required">Phone</label><input className="form-control" required value={form.phone} onChange={e=>F("phone",e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>F("email",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Joining Date</label><input className="form-control" type="date" value={form.joining_date} onChange={e=>F("joining_date",e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Employment Type</label><select className="form-control" value={form.employment_type} onChange={e=>F("employment_type",e.target.value)}>{["FULL_TIME","PART_TIME","CONTRACT","DAILY_WAGE"].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e=>F("status",e.target.value)}>{["ACTIVE","INACTIVE","TERMINATED"].map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--gray-200)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-700)' }}>Salary Definition</h4>
              <div className="form-grid-3">
                <div className="form-group"><label className="form-label required">Basic Salary</label><input type="number" step="0.01" className="form-control" required value={form.basic_salary} onChange={e=>F("basic_salary", e.target.value)} /></div>
                {form.employment_type === "FULL_TIME" && (
                  <>
                    <div className="form-group"><label className="form-label">HRA</label><input type="number" step="0.01" className="form-control" value={form.hra} onChange={e=>F("hra", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">TA</label><input type="number" step="0.01" className="form-control" value={form.ta} onChange={e=>F("ta", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Other Allowances</label><input type="number" step="0.01" className="form-control" value={form.other_allowances} onChange={e=>F("other_allowances", e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">PF Deduction</label><input type="number" step="0.01" className="form-control" value={form.pf_deduction} onChange={e=>F("pf_deduction", e.target.value)} /></div>
                  </>
                )}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Details View Modal */}
      {showViewModal && viewItem && (
        <Modal isOpen={true} onClose={()=>setShowViewModal(false)} title="Staff Member Details" size="modal-lg"
          footer={<>
            <button className="btn btn-secondary" onClick={()=>setShowViewModal(false)}>Close</button>
            <button className="btn btn-primary" onClick={() => {
              setShowViewModal(false);
              setSelected(viewItem);
              setForm({...viewItem});
              setShowModal(true);
            }}>Edit Staff Member</button>
          </>}>
          <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '24px' }}>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Emp ID</strong><div>{viewItem.employee_id || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Full Name</strong><div>{viewItem.full_name || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Designation</strong><div>{viewItem.designation || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Department</strong><div>{viewItem.department || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Phone</strong><div>{viewItem.phone || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Email</strong><div>{viewItem.email || '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Joining Date</strong><div>{viewItem.joining_date ? format(new Date(viewItem.joining_date), "dd MMM yyyy") : '-'}</div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Employment Type</strong><div><span className="badge badge-blue">{viewItem.employment_type || '-'}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Status</strong><div><span className={`badge ${viewItem.status==="ACTIVE"?"badge-green":"badge-gray"}`}>{viewItem.status}</span></div></div>
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Basic Salary</strong><div>{viewItem.salary_structure ? `₹${Number(viewItem.salary_structure.basic_salary).toLocaleString('en-IN')}` : 'Not Set'}</div></div>
          </div>
          
          <hr style={{ borderTop: '1px solid var(--gray-200)', margin: '20px 0' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0 }}>Attendance History</h4>
            <select 
              className="form-control" 
              style={{ width: 120, padding: '4px 8px', fontSize: '0.875rem' }} 
              value={graphDays} 
              onChange={e => setGraphDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={15}>Last 15 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          
          {graphLoading ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingState /></div> : (
            <div style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} style={{ fontSize: '0.75rem' }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: '0.75rem' }} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }} 
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.875rem' }} 
                    formatter={(value, name, props) => [props.payload.status, 'Status']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {graphData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.status === 'PRESENT' ? '#16A34A' : entry.status === 'HALF_DAY' ? '#D97706' : entry.status === 'NOT_MARKED' ? '#9CA3AF' : '#DC2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Modal>
      )}

    </div>
  )
}
