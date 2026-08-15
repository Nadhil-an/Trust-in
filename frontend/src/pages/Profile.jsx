import React, { useState } from "react"
import { authApi } from "../api"
import { useAuthStore } from "../store/authStore"
import { PageHeader } from "../components/shared"
import toast from "react-hot-toast"

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [form, setForm] = useState({ full_name: user?.full_name||"", email: user?.email||"", phone: user?.phone||"" })
  const [passForm, setPassForm] = useState({ current_password:"", new_password:"", confirm_password:"" })
  const [saving, setSaving] = useState(false)
  const [passSaving, setPassSaving] = useState(false)

  const handleUpdate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await authApi.updateProfile(form)
      updateUser(res.data)
      toast.success("Profile updated.")
    } catch (_) { toast.error("Failed to update profile.") } finally { setSaving(false) }
  }

  const handlePass = async (e) => {
    e.preventDefault()
    if (passForm.new_password !== passForm.confirm_password) return toast.error("Passwords don't match")
    setPassSaving(true)
    try {
      await authApi.changePassword({ old_password:passForm.current_password, new_password:passForm.new_password })
      toast.success("Password changed.")
      setPassForm({ current_password:"", new_password:"", confirm_password:"" })
    } catch (err) { toast.error(err.response?.data?.error || "Failed to change password") } finally { setPassSaving(false) }
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account settings" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, maxWidth: 1000 }}>
        <div className="data-card" style={{padding:24}}>
        <h3 style={{marginTop:0,marginBottom:16,fontSize:16}}>Personal Information</h3>
        <form onSubmit={handleUpdate}>
          <div className="form-group"><label className="form-label">Username (Read Only)</label><input className="form-control" value={user?.username||""} disabled /></div>
          <div className="form-group"><label className="form-label">Role (Read Only)</label><input className="form-control" value={user?.role||""} disabled /></div>
          <div className="form-group"><label className="form-label required">Full Name</label><input className="form-control" required value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label required">Phone</label><input className="form-control" required value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value.replace(/\D/g, '').slice(0, 10)}))} /></div>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?"Saving...":"Update Profile"}</button>
        </form>
      </div>

      <div className="data-card" style={{padding:24}}>
        <h3 style={{marginTop:0,marginBottom:16,fontSize:16}}>Change Password</h3>
        <form onSubmit={handlePass}>
          <div className="form-group"><label className="form-label required">Current Password</label><input className="form-control" type="password" required value={passForm.current_password} onChange={e=>setPassForm(f=>({...f,current_password:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label required">New Password</label><input className="form-control" type="password" required minLength={6} value={passForm.new_password} onChange={e=>setPassForm(f=>({...f,new_password:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label required">Confirm New Password</label><input className="form-control" type="password" required minLength={6} value={passForm.confirm_password} onChange={e=>setPassForm(f=>({...f,confirm_password:e.target.value}))} /></div>
          <button className="btn btn-secondary" type="submit" disabled={passSaving}>{passSaving?"Changing...":"Change Password"}</button>
        </form>
      </div>
      </div>
    </div>
  )
}
