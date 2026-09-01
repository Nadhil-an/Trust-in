import React, { useState, useEffect, useCallback } from "react"
import { coreApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, Modal, ConfirmModal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

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

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ username:"", full_name:"", role:"HR", email:"", phone:"", is_active:true, password:"" })
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [platform, setPlatform] = useState("WEB")

  const webRoles = ["MANAGER","ACCOUNTANT","HR","ADMIN", "DATA_ENTRY"]
  const mobileRoles = ["STAFF", "MEMBER", "FIELD_ASSESSMENT_OFFICER", "ASSESSMENT_CALCULATION_OFFICER", "GENERAL_ENQUIRY_OFFICER"]

  const handlePlatformChange = (p) => {
    setPlatform(p);
    setForm(f => ({ ...f, role: p === "WEB" ? webRoles[0] : mobileRoles[0] }));
  }

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await coreApi.users.list(); setUsers(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setModalError(null);
    try {
      if (selected) await coreApi.users.update(selected.id, form)
      else await coreApi.users.create(form)
      toast.success("Saved."); setModalError(null); setShowModal(false); load()
    } catch (err) {
      const errorMsg = extractErrorMessage(err, "Save failed");
      setModalError(errorMsg);
      toast.error(errorMsg);
    } finally { setSaving(false) }
  }

  const executeDelete = async () => {
    if (!userToDelete) return
    try { await coreApi.users.delete(userToDelete); toast.success("Deleted"); load() }
    catch (_) { toast.error("Delete failed") }
    setUserToDelete(null)
  }

  return (
    <div>
      <PageHeader title="User Management" subtitle="System access and roles">
        <button className="btn btn-primary" onClick={()=>{setSelected(null);setModalError(null);setForm({username:"",full_name:"",role:"HR",email:"",phone:"",is_active:true,password:""});setShowModal(true)}}>+ Add User</button>
      </PageHeader>
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
              <tbody>
                {users.length===0 ? <tr><td colSpan={7}><EmptyState icon="👤" title="No users" /></td></tr>
                  : users.map(u=>(<tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.full_name}</td>
                    <td><span className="badge badge-blue">{u.role}</span></td>
                    <td>{u.email||"-"}</td>
                    <td><span className={`badge ${u.is_active?"badge-green":"badge-gray"}`}>{u.is_active?"Active":"Inactive"}</span></td>
                    <td style={{fontSize:12,color:"var(--gray-500)"}}>{u.last_login?format(new Date(u.last_login),"dd MMM yy, HH:mm"):"-"}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={()=>{setSelected(u);setModalError(null);setForm({...u,password:""});setShowModal(true)}}>Edit</button>{" "}
                      {u.username!=="admin" && <button className="btn btn-sm btn-danger" onClick={()=>setUserToDelete(u.id)}>Delete</button>}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>{setShowModal(false); setModalError(null);}} title={selected?"Edit User":"Add User"}
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
                    Unable to Save User
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
            <div className="form-group"><label className="form-label required">Username</label><input className="form-control" required value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value.toLowerCase()}))} disabled={!!selected} autoCapitalize="none" autoCorrect="off" spellCheck="false" /></div>
            <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" required value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} /></div>
            <div className="form-group" style={{marginBottom: 16}}>
              <label className="form-label">System Access Type</label>
              <div style={{display: 'flex', gap: '8px', background: 'var(--gray-100)', padding: '4px', borderRadius: '8px', width: 'fit-content'}}>
                <button type="button" onClick={() => handlePlatformChange('WEB')} style={{padding: '6px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem', background: platform === 'WEB' ? '#fff' : 'transparent', color: platform === 'WEB' ? 'var(--primary-600)' : 'var(--gray-600)', boxShadow: platform === 'WEB' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>Web Portal</button>
                <button type="button" onClick={() => handlePlatformChange('MOBILE')} style={{padding: '6px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem', background: platform === 'MOBILE' ? '#fff' : 'transparent', color: platform === 'MOBILE' ? 'var(--primary-600)' : 'var(--gray-600)', boxShadow: platform === 'MOBILE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>Mobile App</button>
              </div>
            </div>
            <div className="form-group"><label className="form-label required">Role</label><select className="form-control" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{(platform === 'WEB' ? webRoles : mobileRoles).map(r=><option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value.toLowerCase()}))} autoCapitalize="none" autoCorrect="off" spellCheck="false" /></div>
            <div className="form-group"><label className="form-label">Password {selected?"(leave blank to keep current)":""}</label><div style={{position:'relative'}}><input className="form-control" type={showPass?"text":"password"} required={!selected} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} minLength={6} style={{paddingRight:40}} autoCapitalize="none" autoCorrect="off" spellCheck="false" /><button type="button" onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'var(--gray-500)',padding:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{showPass ? <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}</button></div></div>
            <div className="form-group" style={{marginTop:16}}><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} /> <span>Active Account</span></label></div>
          </form>
        </Modal>
      )}
      <ConfirmModal 
        isOpen={!!userToDelete} 
        onClose={() => setUserToDelete(null)} 
        onConfirm={executeDelete} 
        title="Delete User"
        message="Are you sure you want to delete this user? They will immediately lose access to the system."
      />
    </div>
  )
}
