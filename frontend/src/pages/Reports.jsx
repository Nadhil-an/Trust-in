import React, { useState } from "react"
import { reportsApi } from "../api"
import { PageHeader, downloadBlob } from "../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function ReportsPage() {
  const [params, setParams] = useState({ start_date:format(new Date(new Date().getFullYear(), new Date().getMonth(), 1),"yyyy-MM-dd"), end_date:format(new Date(),"yyyy-MM-dd"), format:"pdf" })
  const [loading, setLoading] = useState(false)

  const downloadReport = async (apiFn, name) => {
    setLoading(true)
    try {
      const res = await apiFn(params)
      downloadBlob(res, `${name}_${format(new Date(), "yyyyMMdd")}.${params.format}`)
      toast.success(`${name} downloaded.`)
    } catch (_) { toast.error(`Failed to generate ${name}`) } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="Reports & Exports" subtitle="Generate PDF and Excel reports" />
      <div className="data-card" style={{padding:24}}>
        <div className="form-grid-3" style={{marginBottom:32}}>
          <div className="form-group"><label className="form-label">Start Date</label>
            <input className="form-control" type="date" value={params.start_date} onChange={e=>setParams(p=>({...p,start_date:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">End Date</label>
            <input className="form-control" type="date" value={params.end_date} onChange={e=>setParams(p=>({...p,end_date:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">Format</label>
            <select className="form-control" value={params.format} onChange={e=>setParams(p=>({...p,format:e.target.value}))}>
              <option value="pdf">PDF Document (.pdf)</option><option value="excel">Excel Spreadsheet (.xlsx)</option></select></div>
        </div>
        <div style={{display:"grid",gap:16,gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))"}}>
          {[
            ["Assessment Requests", reportsApi.requests, "📋", "All manager assessment requests"],
            ["Cash Book", reportsApi.cashBook, "💵", "Cash receipts and payments"],
            ["Income Report", reportsApi.income, "📥", "All income and donations"],
            ["Expense Report", reportsApi.expenses, "📤", "All expenses and outflows"],
            ["Members Directory", reportsApi.members, "👥", "Trust members and volunteers"],
            ["Payroll Report", reportsApi.payroll, "💰", "Salary and payroll records"],
            ["Transaction Register", reportsApi.transactions, "🔄", "Complete combined transaction log"]
          ].map(([title, fn, icon, desc])=>(
            <div key={title} style={{border:"1px solid var(--gray-200)",borderRadius:8,padding:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:24}}>{icon}</span><h3 style={{margin:0,fontSize:15}}>{title}</h3>
                </div>
                <p style={{margin:0,fontSize:13,color:"var(--gray-500)"}}>{desc}</p>
              </div>
              <button className="btn btn-secondary" disabled={loading} onClick={()=>downloadReport(fn, title.replace(/ /g,"_"))}>
                {loading ? "..." : `Get ${params.format.toUpperCase()}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
