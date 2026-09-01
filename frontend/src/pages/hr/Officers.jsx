import React, { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { hrApi, coreApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal, ConfirmModal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const extractErrorMessage = (err, fallback = "Save failed") => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  
  if (err.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (data.non_field_errors) {
      return Array.isArray(data.non_field_errors) ? data.non_field_errors.join(', ') : String(data.non_field_errors);
    }
    
    // Extract field-specific object validation errors (e.g. { username: ["A user with that username already exists."] })
    const fieldMessages = [];
    Object.keys(data).forEach(field => {
      const val = data[field];
      const fieldLabel = field.replace(/_/g, ' ').toUpperCase();
      if (Array.isArray(val)) {
        fieldMessages.push(`${fieldLabel}: ${val.join(', ')}`);
      } else if (typeof val === 'string') {
        fieldMessages.push(`${fieldLabel}: ${val}`);
      }
    });
    
    if (fieldMessages.length > 0) {
      return fieldMessages.join(' | ');
    }
  }
  
  return err.message || fallback;
};

// Voucher Book sub-component — only shown when role=STAFF
function VoucherBookSection({ staffId, staffName, hideHeader }) {
  const [vb, setVb] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ 
    book_number: 0, voucher_start: 0, voucher_end: 0, current_voucher: 0,
    next_book_number: 0, next_voucher_start: 0, next_voucher_end: 0, next_current_voucher: 0
  })

  useEffect(() => {
    if (!staffId) return
    hrApi.vouchers.get(staffId).then(res => {
      setVb(res.data)
      setForm({
        book_number: res.data.book_number ?? 0,
        voucher_start: res.data.voucher_start ?? 0,
        voucher_end: res.data.voucher_end ?? 0,
        current_voucher: res.data.current_voucher ?? 0,
        next_book_number: res.data.next_book_number ?? 0,
        next_voucher_start: res.data.next_voucher_start ?? 0,
        next_voucher_end: res.data.next_voucher_end ?? 0,
        next_current_voucher: res.data.next_current_voucher ?? 0,
      })
    }).catch(() => {})
  }, [staffId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = 0;
      })
      
      const res = await hrApi.vouchers.update(staffId, payload)
      setVb(res.data)
      toast.success('Voucher book updated!')
    } catch (err) { 
      let errorMsg = 'Failed to update voucher book'
      if (err.response?.data) {
        if (typeof err.response.data === 'string') errorMsg = err.response.data
        else if (err.response.data.error) errorMsg = err.response.data.error
        else {
          const firstError = Object.values(err.response.data)[0]
          if (Array.isArray(firstError)) errorMsg = firstError[0]
          else if (typeof firstError === 'string') errorMsg = firstError
        }
      }
      toast.error(errorMsg) 
    }
    finally { setSaving(false) }
  }

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ marginTop: hideHeader ? '0' : '1.5rem', borderTop: hideHeader ? 'none' : '2px dashed #E0E7FF', paddingTop: hideHeader ? '0' : '1.5rem' }}>
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 20 }}>🎫</span>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E4DB7' }}>Voucher Book Assignment</h4>
          {vb && (
            <span style={{ fontSize: 11, background: '#EEF2FF', color: '#4338CA', fontWeight: 700, borderRadius: 20, padding: '2px 10px' }}>
              Current: #{vb.current_voucher ?? 0}
            </span>
          )}
        </div>
      )}
      {hideHeader && vb && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Staff: {staffName}</span>
          <span style={{ fontSize: 12, background: '#EEF2FF', color: '#4338CA', fontWeight: 700, borderRadius: 20, padding: '2px 10px' }}>
            Current: #{vb.current_voucher ?? 0}
          </span>
        </div>
      )}
      <div style={{ background: '#F8FAFF', border: '1px solid #C7D7FE', borderRadius: 12, padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Book Number</label>
            <input className="form-control" type="number" min="0" value={form.book_number}
              onChange={e => F('book_number', e.target.value)}
              style={{ fontSize: 13 }} placeholder="0" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Voucher Start</label>
            <input className="form-control" type="number" min="0" value={form.voucher_start}
              onChange={e => F('voucher_start', e.target.value)}
              style={{ fontSize: 13 }} placeholder="0" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Voucher End</label>
            <input className="form-control" type="number" min="0" value={form.voucher_end}
              onChange={e => F('voucher_end', e.target.value)}
              style={{ fontSize: 13 }} placeholder="0" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Current Voucher</label>
            <input className="form-control" type="number" min="0" value={form.current_voucher}
              onChange={e => F('current_voucher', e.target.value)}
              style={{ fontSize: 13 }} placeholder="0" />
          </div>
        </div>
        
        <div style={{ marginTop: 24, marginBottom: 12, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
          <h5 style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#4B5563', fontWeight: 600 }}>Queued Book (Next)</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Book Number</label>
              <input className="form-control" type="number" min="0" value={form.next_book_number}
                onChange={e => F('next_book_number', e.target.value)}
                style={{ fontSize: 13 }} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Voucher Start</label>
              <input className="form-control" type="number" min="0" value={form.next_voucher_start}
                onChange={e => F('next_voucher_start', e.target.value)}
                style={{ fontSize: 13 }} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Voucher End</label>
              <input className="form-control" type="number" min="0" value={form.next_voucher_end}
                onChange={e => F('next_voucher_end', e.target.value)}
                style={{ fontSize: 13 }} placeholder="0" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Current Voucher</label>
              <input className="form-control" type="number" min="0" value={form.next_current_voucher}
                onChange={e => F('next_current_voucher', e.target.value)}
                style={{ fontSize: 13 }} placeholder="0" />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '6px 18px', fontSize: 13 }}
          >
            {saving ? 'Saving...' : '💾 Save Voucher Book'}
          </button>
          {vb && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vb.book_number > 0 ? (
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  Book {vb.book_number} · Vouchers {vb.voucher_start}–{vb.voucher_end}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>No voucher book assigned yet</span>
              )}
              {vb.next_book_number > 0 && (
                <span style={{ fontSize: 11, color: '#D97706', fontWeight: 500 }}>
                  Queued: Book {vb.next_book_number} ({vb.next_voucher_start}–{vb.next_voucher_end}){vb.next_current_voucher ? ` · Current: #${vb.next_current_voucher}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const formatRole = (role) => {
  if (!role) return "-";
  if (role.toUpperCase() === 'HR') return 'HR';
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

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
  basic_salary: "",
  hra: 0,
  ta: 0,
  other_allowances: 0,
  pf_deduction: 0
}

export default function Officers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const employmentTypeFilter = searchParams.get('employment_type') || ''
  const roleFilter = searchParams.get('designation') || ''
  
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [platform, setPlatform] = useState("WEB")

  // Voucher modal state
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [voucherStaff, setVoucherStaff] = useState(null)
  const [showBatchVoucherModal, setShowBatchVoucherModal] = useState(false)

  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [terminationReason, setTerminationReason] = useState('')
  const [reactivating, setReactivating] = useState(false)
  const [showTerminated, setShowTerminated] = useState(false)

  const [reactivateStaff, setReactivateStaff] = useState(null);
  const [reactivatePassword, setReactivatePassword] = useState('123456');
  const [reactivateError, setReactivateError] = useState(null);

  const handleConfirmReactivate = async (e) => {
    if (e) e.preventDefault();
    if (!reactivateStaff || !reactivatePassword.trim()) {
      setReactivateError("Password is required.");
      return;
    }
    if (reactivating) return;
    setReactivating(true);
    setReactivateError(null);
    try {
      await hrApi.officers.reactivate(reactivateStaff.id, { password: reactivatePassword });
      toast.success(`Staff member "${reactivateStaff.full_name}" reactivated successfully! Password set to: ${reactivatePassword}`, { duration: 5000 });
      setReactivateStaff(null);
      load();
    } catch (err) {
      setReactivateError(err.response?.data?.error || "Failed to reactivate staff member");
    } finally {
      setReactivating(false);
    }
  };

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
    const params = { search, status: showTerminated ? 'INACTIVE' : 'ACTIVE' }
    if (employmentTypeFilter) params.employment_type = employmentTypeFilter
    if (roleFilter) params.designation = roleFilter
    
    try {
      const res = await hrApi.officers.list(params);
      const listData = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : []);
      setItems(listData);
    }
    catch (_) {} finally { setLoading(false) }
  }, [search, employmentTypeFilter, roleFilter, showTerminated])
  
  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

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
    setModalError(null)

    if (form.phone && !isValidPhone(form.phone)) {
      const msg = "Enter a valid 10-digit phone number";
      setModalError(msg);
      return toast.error(msg);
    }
    if (form.email && !isValidEmail(form.email)) {
      const msg = "Enter a valid email address";
      setModalError(msg);
      return toast.error(msg);
    }
    
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
      
      toast.success("Staff member saved successfully.");
      setModalError(null);
      setShowModal(false);
      load();
    } catch (err) { 
      const errorMsg = extractErrorMessage(err, "Save failed");
      setModalError(errorMsg);
      toast.error(errorMsg);
    } finally { 
      setSaving(false) 
    }
  }

  const handleDelete = async (e) => {
    if (e) e.preventDefault();
    if (!deleteId || deleting) return;
    setDeleting(true)
    try {
      await hrApi.officers.delete(deleteId, { termination_reason: terminationReason })
      toast.success("Staff member deleted successfully")
      setDeleteId(null)
      setTerminationReason('')
      load()
    } catch (_) {
      toast.error("Failed to delete staff member")
    } finally {
      setDeleting(false)
    }
  }
  
  const handleReactivate = async (id) => {
    const password = window.prompt("Enter a new password for the reactivated account:", "123456");
    if (!password) return;

    if (reactivating) return;
    setReactivating(true);
    try {
      await hrApi.officers.reactivate(id, { password });
      toast.success(`Staff member reactivated! Password set to: ${password}`, { duration: 5000 });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reactivate staff member");
    } finally {
      setReactivating(false);
    }
  }

  const openViewModal = (o) => {
    setViewItem(o)
    setGraphDays(7)
    fetchGraphData(o.id, 7)
    setShowViewModal(true)
  }

  return (
    <div>
      <PageHeader title={employmentTypeFilter === 'FULL_TIME' ? "Full-Time Staff" : "Staff Members"} subtitle="Staff and employees">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ color: '#4F46E5', borderColor: '#C7D2FE', background: '#EEF2FF', fontWeight: 600 }} onClick={() => setShowBatchVoucherModal(true)}>🎫 Manage Vouchers</button>
          <button className="btn btn-primary" onClick={()=>{
            setSelected(null);
            setPlatform("WEB");
            setShowPass(false);
            setModalError(null);
            setForm(init);
            setShowModal(true);
          }}>+ Add Staff Member</button>
        </div>
      </PageHeader>
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select 
            className="filter-select" 
            style={{ width: '200px' }} 
            value={roleFilter} 
            onChange={(e) => {
              if (e.target.value) searchParams.set('designation', e.target.value)
              else searchParams.delete('designation')
              setSearchParams(searchParams)
            }}
          >
            <option value="">All Roles</option>
            {[...webRoles, ...mobileRoles].map(r => <option key={r} value={r}>{formatRole(r)}</option>)}
          </select>
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
          <select
            className="filter-select"
            style={{ width: '180px', background: showTerminated ? '#FEF2F2' : '#F0FDF4', color: showTerminated ? '#991B1B' : '#166534', fontWeight: 600 }}
            value={showTerminated ? 'INACTIVE' : 'ACTIVE'}
            onChange={(e) => setShowTerminated(e.target.value === 'INACTIVE')}
          >
            <option value="ACTIVE">Active Staff</option>
            <option value="INACTIVE">Terminated Staff</option>
          </select>
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Emp ID</th><th>Name</th><th>Role</th><th>Department</th><th>Type</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="👨‍💼" title="No staff members" /></td></tr>
                  : items.map(o=>(<tr key={o.id} onClick={()=>openViewModal(o)} style={{cursor: 'pointer'}} className="hover-row"><td className="td-mono">{o.employee_id}</td><td>{o.full_name}</td><td>{formatRole(o.designation)}</td><td>{o.department}</td><td><span className="badge badge-blue">{o.employment_type}</span></td><td>{o.joining_date ? format(new Date(o.joining_date),"dd MMM yyyy") : "-"}</td><td><span className="badge" style={{ backgroundColor: (o.status === 'INACTIVE' || o.status === 'TERMINATED') ? '#FEF2F2' : '#ECFDF5', color: (o.status === 'INACTIVE' || o.status === 'TERMINATED') ? '#991B1B' : '#166534', border: (o.status === 'INACTIVE' || o.status === 'TERMINATED') ? '1px solid #FCA5A5' : '1px solid #A7F3D0', fontWeight: 700 }}>{(o.status === 'INACTIVE' || o.status === 'TERMINATED') ? 'TERMINATED' : 'ACTIVE'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(o.role === 'STAFF' || o.designation === 'STAFF' || o.designation === 'Staff') && (
                          <button className="btn btn-sm btn-secondary" style={{ color: '#4F46E5', borderColor: '#C7D2FE', background: '#EEF2FF' }} onClick={(e)=>{
                            e.stopPropagation();
                            setVoucherStaff(o);
                            setShowVoucherModal(true);
                          }}>Voucher</button>
                        )}
                        {o.status === 'INACTIVE' || o.status === 'TERMINATED' ? (
                          <button className="btn btn-sm btn-primary" style={{ background: '#10B981', borderColor: '#10B981', fontWeight: 600 }} onClick={(e)=>{
                            e.stopPropagation();
                            setReactivateStaff(o);
                            setReactivatePassword('123456');
                            setReactivateError(null);
                          }}>
                            Reactivate
                          </button>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-secondary" onClick={(e)=>{
                              e.stopPropagation(); 
                              setSelected(o);
                              const ss = o.salary_structure || {};
                              const isMobile = mobileRoles.includes(o.designation) || mobileRoles.includes(o.role);
                              setPlatform(isMobile ? "MOBILE" : "WEB");
                              setShowPass(false);
                              setModalError(null);
                              setForm({
                                ...o,
                                username: o.username || o.employee_id || "",
                                role: o.role || (webRoles.concat(mobileRoles).includes(o.designation) ? o.designation : "HR"),
                                phone: o.phone || "",
                                email: o.email || "",
                                is_active: o.status !== "INACTIVE",
                                password: "",
                                basic_salary: ss.basic_salary || "",
                                hra: ss.hra || 0,
                                ta: ss.ta || 0,
                                other_allowances: ss.other_allowances || 0,
                                pf_deduction: ss.pf_deduction || 0
                              });
                              setShowModal(true)
                            }}>Edit</button>
                            <button className="btn btn-sm btn-secondary" style={{ color: '#EF4444', borderColor: '#FEE2E2', background: '#FEF2F2' }} onClick={(e)=>{
                              e.stopPropagation();
                              setDeleteId(o.id);
                            }}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>{setShowModal(false); setModalError(null);}} title={selected?"Edit Staff Member":"Add User"} size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={()=>{setShowModal(false); setModalError(null);}}>Cancel</button><button className="btn btn-primary" form="usr-form" type="submit" disabled={saving}>{saving?"Saving...":"Save"}</button></>}>
          <form id="usr-form" onSubmit={handleSave}>
            {modalError && (
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderLeft: '4px solid #EF4444',
                color: '#991B1B',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}>
                <span style={{ fontSize: '20px', lineHeight: 1 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: '14px', marginBottom: '3px', color: '#7F1D1D' }}>
                    Unable to Save Staff Member
                  </strong>
                  <span style={{ lineHeight: 1.4, display: 'block', whiteSpace: 'pre-wrap' }}>{modalError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError(null)}
                  style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0 }}
                >
                  &times;
                </button>
              </div>
            )}
            <div className="form-group">
              <label className="form-label required">Username</label>
              <input className="form-control" required value={form.username} onChange={e=>F("username", e.target.value.toLowerCase())} disabled={!!selected} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
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
              <input className="form-control" type="email" value={form.email} onChange={e=>F("email", e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
            </div>
            <div className="form-group">
              <label className="form-label">Password {selected?"(leave blank to keep current)":""}</label>
              <div style={{position:'relative'}}>
                <input className="form-control" type={showPass?"text":"password"} required={!selected} value={form.password} onChange={e=>F("password", e.target.value)} minLength={6} style={{paddingRight:40}} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
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
                
                {/* Salary Components */}
                <div className="form-group"><label className="form-label">Basic Salary</label><input type="number" step="0.01" className="form-control" value={form.basic_salary} onChange={e=>F("basic_salary", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">HRA</label><input type="number" step="0.01" className="form-control" value={form.hra} onChange={e=>F("hra", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">TA</label><input type="number" step="0.01" className="form-control" value={form.ta} onChange={e=>F("ta", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Other Allowances</label><input type="number" step="0.01" className="form-control" value={form.other_allowances} onChange={e=>F("other_allowances", e.target.value)} /></div>
                <div className="form-group"><label className="form-label">PF Deduction</label><input type="number" step="0.01" className="form-control" value={form.pf_deduction} onChange={e=>F("pf_deduction", e.target.value)} /></div>
              </div>
            </div>

            {/* Voucher Book — only for STAFF role */}
            {form.role === 'STAFF' && selected && (
              <VoucherBookSection
                staffId={selected.user_id || selected.id}
                staffName={form.full_name}
              />
            )}
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
                basic_salary: ss.basic_salary || "",
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

          {(viewItem.status === 'INACTIVE' || viewItem.status === 'TERMINATED') && viewItem.termination_reason && (
            <div style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginTop: -8, marginBottom: 16 }}>
              <strong style={{display:'block', fontSize:'0.75rem', color:'#991B1B', textTransform:'uppercase', marginBottom: 4}}>Termination Reason</strong>
              <div style={{ fontSize: '0.875rem', color: '#7F1D1D' }}>{viewItem.termination_reason}</div>
            </div>
          )}
          
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

      {/* Dedicated Voucher Book Modal */}
      {showVoucherModal && voucherStaff && (
        <Modal isOpen={true} onClose={()=>setShowVoucherModal(false)} title="Voucher Book Assignment" size="modal-md"
          footer={<button className="btn btn-secondary" onClick={()=>setShowVoucherModal(false)}>Close</button>}>
          <VoucherBookSection 
            staffId={voucherStaff.user_id || voucherStaff.id} 
            staffName={voucherStaff.full_name} 
            hideHeader={true} 
          />
        </Modal>
      )}

      {/* Batch Voucher Sidebar */}
      {showBatchVoucherModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            backgroundColor: '#fff',
            height: '100%',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.3s ease-out forwards'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #E5E7EB'
            }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>Manage Staff Vouchers</h2>
              <button onClick={() => setShowBatchVoucherModal(false)} style={{
                background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6B7280'
              }}>&times;</button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Designation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter(o => o.role === 'STAFF' || o.designation === 'STAFF' || o.designation === 'Staff').map(o => (
                      <tr key={o.id}>
                        <td>{o.full_name}</td>
                        <td>{formatRole(o.designation)}</td>
                        <td>
                          <button className="btn btn-sm btn-secondary" style={{ color: '#4F46E5', borderColor: '#C7D2FE', background: '#EEF2FF' }} onClick={() => {
                            setVoucherStaff(o);
                            setShowVoucherModal(true);
                          }}>Assign</button>
                        </td>
                      </tr>
                    ))}
                    {items.filter(o => o.role === 'STAFF' || o.designation === 'STAFF' || o.designation === 'Staff').length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#6B7280' }}>No staff members found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Styled Reactivation Modal */}
      {reactivateStaff && (
        <Modal 
          isOpen={true} 
          onClose={() => setReactivateStaff(null)} 
          title="Reactivate Staff Member"
          size="modal-md"
          footer={
            <>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setReactivateStaff(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: '#10B981', borderColor: '#10B981', fontWeight: 600 }}
                onClick={handleConfirmReactivate}
                disabled={reactivating}
              >
                {reactivating ? 'Reactivating...' : 'Reactivate Staff'}
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: 26 }}>
              🔄
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 18, color: '#111827', fontWeight: 700 }}>
              Reactivate {reactivateStaff.full_name}
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              Employee ID: <strong style={{ color: '#374151' }}>{reactivateStaff.employee_id}</strong>
            </p>
          </div>

          {reactivateError && (
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              ⚠️ {reactivateError}
            </div>
          )}

          <form onSubmit={handleConfirmReactivate}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required" style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Set Account Login Password
              </label>
              <input 
                type="text"
                className="form-control" 
                required 
                value={reactivatePassword} 
                onChange={e => setReactivatePassword(e.target.value)} 
                placeholder="Enter new password"
                style={{ fontSize: 15, padding: '10px 14px' }}
                autoFocus
              />
              <span style={{ fontSize: 12, color: '#6B7280', marginTop: 6, display: 'block' }}>
                This password will restore mobile and web system access for this staff member.
              </span>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <Modal 
          isOpen={true} 
          onClose={() => {
            setDeleteId(null);
            setTerminationReason('');
          }} 
          title="Terminate Staff Member"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setDeleteId(null); setTerminationReason(''); }}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: '#EF4444', borderColor: '#EF4444' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Terminating...' : 'Terminate'}
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: 26 }}>
              ⚠️
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 18, color: '#111827', fontWeight: 700 }}>
              Are you sure?
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              This will deactivate their account and log them out of all devices.
            </p>
          </div>

          <form onSubmit={handleDelete}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Reason for Termination (Optional)
              </label>
              <textarea 
                className="form-control" 
                rows="3"
                value={terminationReason} 
                onChange={e => setTerminationReason(e.target.value)} 
                placeholder="Briefly describe why this staff member is being terminated..."
                style={{ fontSize: 14, padding: '10px 14px', resize: 'vertical' }}
                autoFocus
              ></textarea>
            </div>
          </form>
        </Modal>
      )}

    </div>
  )
}
