import React, { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { hrApi, coreApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const init = { 
  username: "",
  full_name: "",
  role: "HR",
  email: "",
  phone: "",
  date_of_birth: "",
  is_active: true,
  password: "",
  designation: "",
  department: "",
  employment_type: "FULL_TIME",
  status: "ACTIVE",
  joining_date: format(new Date(), "yyyy-MM-dd"),
  basic_salary: 0,
  hra: 0,
  ta: 0,
  other_allowances: 0,
  pf_deduction: 0
}

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
  const [showPass, setShowPass] = useState(false)
  const [platform, setPlatform] = useState("WEB")

  const webRoles = ["MANAGER","ACCOUNTANT","HR","ADMIN", "DATA_ENTRY"]
  const mobileRoles = ["STAFF", "MEMBER", "FIELD_ASSESSMENT_OFFICER", "ASSESSMENT_CALCULATION_OFFICER", "GENERAL_ENQUIRY_OFFICER"]

  const handlePlatformChange = (p) => {
    setPlatform(p);
    setForm(f => ({ ...f, role: p === "WEB" ? webRoles[0] : mobileRoles[0] }));
  }

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
      const { basic_salary, hra, ta, other_allowances, pf_deduction, username, full_name, role, email, phone, is_active, password, user_id, ...officerData } = form
      
      const userData = {
        username: username || (phone ? phone : undefined),
        full_name,
        role: role || "HR",
        email: email || "",
        phone: phone || "",
        date_of_birth: form.date_of_birth || undefined,
        is_active: is_active ?? true,
      }
      if (password) userData.password = password;

      let employeeId = selected ? selected.id : null;
      let targetUserId = user_id || selected?.user_id;

      if (selected) {
        if (targetUserId) {
          try {
            await coreApi.users.update(targetUserId, userData)
          } catch (_) {}
        }
        await hrApi.officers.update(selected.id, {
          full_name,
          email,
          phone,
          date_of_birth: form.date_of_birth || null,
          designation: role || form.designation || "Staff",
          status: is_active ? "ACTIVE" : "INACTIVE",
          ...officerData
        })
      } else {
        await coreApi.users.create(userData)
        const officersRes = await hrApi.officers.list({ search: full_name })
        const createdOfficer = (officersRes.data.results || officersRes.data)?.[0]
        if (createdOfficer) {
          employeeId = createdOfficer.id
        }
      }
      
      if (employeeId && (basic_salary > 0 || hra > 0 || ta > 0 || other_allowances > 0 || pf_deduction > 0)) {
        await hrApi.salaryStructures.create({
          employee: employeeId,
          basic_salary: basic_salary || 0,
          hra: hra || 0,
          ta: ta || 0,
          other_allowances: other_allowances || 0,
          pf_deduction: pf_deduction || 0,
          effective_from: format(new Date(), "yyyy-MM-dd")
        })
      }
      
      toast.success("Saved."); setShowModal(false); load()
    } catch (err) { 
      toast.error(err.response?.data?.username?.[0] || err.response?.data?.error || "Save failed") 
    } finally { 
      setSaving(false) 
    }
  }
  
  const openViewModal = (o) => {
    setViewItem(o)
    setGraphDays(7)
    setGraphData([])
    setShowViewModal(true)
  }

  return (
    <div>
      <PageHeader title={employmentTypeFilter === 'FULL_TIME' ? "Full-Time Staff" : "Staff Members"} subtitle="Staff and employees">
        <button className="btn btn-primary" onClick={()=>{
          setSelected(null);
          setPlatform("WEB");
          setShowPass(false);
          setForm(init);
          setShowModal(true);
        }}>+ Add Staff Member</button>
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
                        const isMobile = mobileRoles.includes(o.designation) || mobileRoles.includes(o.role);
                        setPlatform(isMobile ? "MOBILE" : "WEB");
                        setShowPass(false);
                        setForm({
                          ...o,
                          username: o.username || o.employee_id || "",
                          role: o.role || (webRoles.concat(mobileRoles).includes(o.designation) ? o.designation : "HR"),
                          phone: o.phone || "",
                          email: o.email || "",
                          is_active: o.status !== "INACTIVE",
                          password: "",
                          basic_salary: ss.basic_salary || 0,
                          hra: ss.hra || 0,
                          ta: ss.ta || 0,
                          other_allowances: ss.other_allowances || 0,
                          pf_deduction: ss.pf_deduction || 0
                        });
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
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={selected?"Edit Staff Member":"Add User"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" form="usr-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="usr-form" onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label required">Username</label>
              <input className="form-control" required value={form.username} onChange={e=>F("username", e.target.value)} disabled={!!selected} />
            </div>
            <div className="form-group">
              <label className="form-label required">Full Name</label>
              <input className="form-control" required value={form.full_name} onChange={e=>F("full_name", e.target.value)} />
            </div>
            <div className="form-group" style={{marginBottom: 16}}>
              <label className="form-label">System Access Type</label>
              <div style={{display: 'flex', gap: '8px', background: 'var(--gray-100)', padding: '4px', borderRadius: '8px', width: 'fit-content'}}>
                <button type="button" onClick={() => handlePlatformChange('WEB')} style={{padding: '6px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem', background: platform === 'WEB' ? '#fff' : 'transparent', color: platform === 'WEB' ? 'var(--primary-600)' : 'var(--gray-600)', boxShadow: platform === 'WEB' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>Web Portal</button>
                <button type="button" onClick={() => handlePlatformChange('MOBILE')} style={{padding: '6px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem', background: platform === 'MOBILE' ? '#fff' : 'transparent', color: platform === 'MOBILE' ? 'var(--primary-600)' : 'var(--gray-600)', boxShadow: platform === 'MOBILE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>Mobile App</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required">Role</label>
              <select className="form-control" value={form.role} onChange={e=>F("role", e.target.value)}>
                {(platform === 'WEB' ? webRoles : mobileRoles).map(r=><option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e=>F("email", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password {selected?"(leave blank to keep current)":""}</label>
              <div style={{position:'relative'}}>
                <input className="form-control" type={showPass?"text":"password"} required={!selected} value={form.password} onChange={e=>F("password", e.target.value)} minLength={6} style={{paddingRight:40}} />
                <button type="button" onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'var(--gray-500)',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {showPass ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
            <div className="form-group" style={{marginTop:16}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={form.is_active} onChange={e=>F("is_active", e.target.checked)} />
                <span>Active Account</span>
              </label>
            </div>
            
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--gray-200)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-700)' }}>Salary & Employee Details</h4>
              <div className="form-grid-3">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone || ""} onChange={e=>F("phone", e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
                <div className="form-group"><label className="form-label">Date of Birth</label><input className="form-control" type="date" value={form.date_of_birth || ""} onChange={e=>F("date_of_birth", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={form.department || ""} onChange={e=>F("department", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Joining Date</label><input className="form-control" type="date" value={form.joining_date || ""} onChange={e=>F("joining_date", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Basic Salary</label><input type="number" step="0.01" className="form-control" value={form.basic_salary || 0} onChange={e=>F("basic_salary", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">HRA</label><input type="number" step="0.01" className="form-control" value={form.hra || 0} onChange={e=>F("hra", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">TA</label><input type="number" step="0.01" className="form-control" value={form.ta || 0} onChange={e=>F("ta", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Other Allowances</label><input type="number" step="0.01" className="form-control" value={form.other_allowances || 0} onChange={e=>F("other_allowances", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">PF Deduction</label><input type="number" step="0.01" className="form-control" value={form.pf_deduction || 0} onChange={e=>F("pf_deduction", e.target.value)} /></div>
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
              const ss = viewItem.salary_structure || {};
              const isMobile = mobileRoles.includes(viewItem.designation) || mobileRoles.includes(viewItem.role);
              setPlatform(isMobile ? "MOBILE" : "WEB");
              setShowPass(false);
              setForm({
                ...viewItem,
                username: viewItem.username || viewItem.employee_id || "",
                role: viewItem.role || (webRoles.concat(mobileRoles).includes(viewItem.designation) ? viewItem.designation : "HR"),
                phone: viewItem.phone || "",
                email: viewItem.email || "",
                date_of_birth: viewItem.date_of_birth || "",
                is_active: viewItem.status !== "INACTIVE",
                password: "",
                basic_salary: ss.basic_salary || 0,
                hra: ss.hra || 0,
                ta: ss.ta || 0,
                other_allowances: ss.other_allowances || 0,
                pf_deduction: ss.pf_deduction || 0
              });
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
            <div><strong style={{display:'block', fontSize:'0.75rem', color:'#6b7280', textTransform:'uppercase'}}>Date of Birth</strong><div>{viewItem.date_of_birth ? format(new Date(viewItem.date_of_birth), "dd MMM yyyy") : '-'}</div></div>
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
