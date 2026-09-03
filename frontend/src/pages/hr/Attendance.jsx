import React, { useState, useEffect, useCallback } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
export default function AttendancePage() {
  const [records, setRecords] = useState([])
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(format(new Date(),"yyyy-MM-dd"))
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkData, setBulkData] = useState([])
  const [previewImage, setPreviewImage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, oRes] = await Promise.all([hrApi.attendance.list({date}), hrApi.officers.list({})])
      setRecords(aRes.data.results || aRes.data)
      setOfficers(oRes.data.results || oRes.data)
      const bd = (oRes.data.results || oRes.data).map(o=>{
        const existing = (aRes.data.results || aRes.data).find(a=>a.employee===o.id)
        return { employee:o.id, name:o.full_name, status:existing?.status||"PRESENT", remarks:existing?.remarks||"" }
      })
      setBulkData(bd)
    } catch (_) { console.error(_); toast.error("Load failed: " + (_.message || "Unknown error")) } finally { setLoading(false) }
  }, [date])
  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleBulkSave = async () => {
    setSaving(true)
    try { await hrApi.attendance.bulk({records: bulkData.map(b=>({...b, date}))}); toast.success("Attendance saved."); setShowModal(false); load() }
    catch (_) { toast.error("Save failed") } finally { setSaving(false) }
  }

  const formatTime = (timeString) => {
    if (!timeString) return "-";
    const [h, m] = timeString.split(":");
    let hr = parseInt(h, 10);
    const ampm = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    return `${hr}:${m} ${ampm}`;
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Daily attendance management">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: '#E0E7FF', color: '#4338CA', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', border: '1px solid #C7D2FE', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>👥</span> Present Today: {records.filter(r => r.status === 'PRESENT').length} / {records.length || officers.length}
          </div>
          <input className="form-control" type="date" style={{width:160}} value={date} onChange={e=>setDate(e.target.value)} />
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}>Mark Attendance</button>
        </div>
      </PageHeader>
      <div className="data-card">
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Date</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Remarks</th><th>Check In Proof</th><th>Check Out Proof</th></tr></thead>
              <tbody>
                {records.length===0 ? <tr><td colSpan={8}><EmptyState icon="✅" title="No attendance marked for this date" /></td></tr>
                  : records.map(r=>(
                    <tr key={r.id}>
                      <td>{r.employee_name}</td>
                      <td>{r.date}</td>
                      <td><span className={`badge ${r.status==="PRESENT"?"badge-green":r.status==="ABSENT"?"badge-red":"badge-yellow"}`}>{r.status}</span></td>
                      <td>
                        <div style={{fontWeight:500}}>{formatTime(r.check_in)}</div>
                      </td>
                      <td>
                        <div style={{fontWeight:500}}>{formatTime(r.check_out)}</div>
                      </td>
                      <td>{r.remarks||"-"}</td>
                      <td>
                        {r.check_in_photo && (
                          <div style={{display:'flex', alignItems:'center', gap: 6}}>
                            <img src={r.check_in_photo} alt="in" onClick={() => setPreviewImage(r.check_in_photo)} style={{width:28, height:28, borderRadius:4, objectFit:'cover', border:'1px solid #e5e7eb', cursor: 'zoom-in'}} />
                            {r.check_in_location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.check_in_location)}`} target="_blank" rel="noreferrer" style={{fontSize:10, color:'#3b82f6', maxWidth:120, lineHeight:'1.2', textDecoration: 'underline'}} title="View on Google Maps">📍 {r.check_in_location}</a>}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.check_out_photo && (
                          <div style={{display:'flex', alignItems:'center', gap: 6}}>
                            <img src={r.check_out_photo} alt="out" onClick={() => setPreviewImage(r.check_out_photo)} style={{width:28, height:28, borderRadius:4, objectFit:'cover', border:'1px solid #e5e7eb', cursor: 'zoom-in'}} />
                            {r.check_out_location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.check_out_location)}`} target="_blank" rel="noreferrer" style={{fontSize:10, color:'#3b82f6', maxWidth:120, lineHeight:'1.2', textDecoration: 'underline'}} title="View on Google Maps">📍 {r.check_out_location}</a>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <Modal isOpen={true} onClose={()=>setShowModal(false)} title={`Mark Attendance — ${date}`} size="modal-xl"
          footer={<><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleBulkSave} disabled={saving}>{saving?"Saving...":"Save Attendance"}</button></>}>
          <div style={{maxHeight:400,overflowY:"auto"}}>
            <table style={{width:"100%"}}>
              <thead><tr><th style={{padding:"8px 12px",background:"var(--gray-50)"}}>Employee</th><th style={{padding:"8px 12px",background:"var(--gray-50)"}}>Status</th><th style={{padding:"8px 12px",background:"var(--gray-50)"}}>Remarks</th></tr></thead>
              <tbody>
                {bulkData.map((b,i)=>(
                  <tr key={b.employee} style={{borderBottom:"1px solid var(--gray-100)"}}>
                    <td style={{padding:"8px 12px"}}>{b.name}</td>
                    <td style={{padding:"8px 12px"}}>
                      <select className="form-control" style={{width:120}} value={b.status}
                        onChange={e=>{const nb=[...bulkData];nb[i]={...nb[i],status:e.target.value};setBulkData(nb)}}>
                        {["PRESENT","ABSENT","HALF_DAY","LEAVE","LATE"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{padding:"8px 12px"}}>
                      <input className="form-control" value={b.remarks}
                        onChange={e=>{const nb=[...bulkData];nb[i]={...nb[i],remarks:e.target.value};setBulkData(nb)}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {previewImage && (
        <Modal isOpen={true} onClose={()=>setPreviewImage(null)} title="Photo Proof" size="modal-md">
          <div style={{textAlign: 'center', padding: '10px 0'}}>
            <img src={previewImage} alt="Preview" style={{maxWidth: '100%', maxHeight: '70vh', borderRadius: 8}} />
          </div>
        </Modal>
      )}
    </div>
  )
}
