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
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkData, setBulkData] = useState([])
  const [previewImage, setPreviewImage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, oRes] = await Promise.all([hrApi.attendance.list({date}), hrApi.officers.list({})])
      const attendanceData = aRes.data.results || aRes.data;
      const officersData = (oRes.data.results || oRes.data).filter(o => 
        o.status !== 'INACTIVE' && 
        o.status !== 'TERMINATED' && 
        (String(o.role).toUpperCase() === 'STAFF' || String(o.designation).toUpperCase() === 'STAFF')
      );
      setOfficers(officersData)
      
      const compositeRecords = officersData.map(o => {
        const existing = attendanceData.find(a => a.employee === o.id || a.employee_name?.toLowerCase() === o.full_name?.toLowerCase());
        if (existing) {
          return { ...existing, status: existing.status || 'PRESENT', employee_name: o.full_name };
        } else {
          let isAbsent = false;
          const [year, month, day] = date.split('-');
          const selectedDate = new Date(year, month - 1, day);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          if (selectedDate < today) {
             isAbsent = true;
          } else if (selectedDate.getTime() === today.getTime()) {
             if (now.getHours() >= 17) { // 5 PM or later
                isAbsent = true;
             }
          }

          return {
            id: `unmarked-${o.id}`,
            employee: o.id,
            employee_name: o.full_name,
            date: date,
            status: isAbsent ? 'ABSENT' : 'NOT MARKED',
            check_in: null,
            check_out: null,
            remarks: '-',
          }
        }
      });
      setRecords(compositeRecords);

      const bd = officersData.map(o=>{
        const existing = compositeRecords.find(a=>a.employee===o.id)
        return { employee:o.id, name:o.full_name, status: existing.status === 'NOT MARKED' ? 'ABSENT' : existing.status, remarks:existing?.remarks==="-" ? "" : (existing?.remarks||"") }
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

  const filteredRecords = records.filter(r => 
    (r.employee_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Daily attendance management">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: '#E0E7FF', color: '#4338CA', padding: '8px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', border: '1px solid #C7D2FE', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>👥</span> Present Today: {records.filter(r => r.status === 'PRESENT').length} / {records.length || officers.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--gray-300)', borderRadius: '6px', padding: '6px 12px' }}>
            <span style={{ fontSize: 14 }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: 120, fontSize: 14 }}
            />
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
                {filteredRecords.length===0 ? <tr><td colSpan={8}><EmptyState icon="✅" title="No attendance found for this search" /></td></tr>
                  : filteredRecords.map(r=>(
                    <tr key={r.id}>
                      <td style={{ textTransform: 'capitalize' }}>{r.employee_name}</td>
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
                    <td style={{padding:"8px 12px", textTransform: 'capitalize'}}>{b.name}</td>
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
