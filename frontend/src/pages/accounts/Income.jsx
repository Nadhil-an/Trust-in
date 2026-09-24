import React, { useState, useCallback, useEffect } from "react"
import { accountsApi, cashierApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, Modal, formatINR } from "../../components/shared"
import PaymentMethodSelector from "../../components/PaymentMethodSelector"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isPositiveNumber } from "../../utils/validators"

const TODAY = format(new Date(), "yyyy-MM-dd")

export default function IncomeList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState(TODAY)
  const [methodFilter, setMethodFilter] = useState("ALL")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ source:"", date: TODAY, amount:"", donor_name:"", phone:"", address:"", purpose:"", payment_method:"CASH", account_type:"CASH", reference_number:"", remarks:"" })
  const [saving, setSaving] = useState(false)

  const handleOpenModal = () => {
    setForm({ source:"", date: TODAY, amount:"", donor_name:"", phone:"", address:"", purpose:"", payment_method:"CASH", account_type:"CASH", reference_number:"", remarks:"" })
    setShowModal(true)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page_size: 5000 }
      if (search) params.search = search
      if (dateFilter) params.date = dateFilter
      if (methodFilter !== "ALL") params.account_type = methodFilter

      const iRes = await accountsApi.income.list(params)
      setItems(iRes.data.results || iRes.data)
    } catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, dateFilter, methodFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number")
    if (!isPositiveNumber(form.amount)) return toast.error("Amount must be a positive number")

    setSaving(true)
    try {
      // 1. Save income record (multipart required)
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
      await accountsApi.income.create(fd)

      toast.success("Income recorded!")
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed")
    } finally { setSaving(false) }
  }

  // Donation summary should exactly match Day Book's mobile_totals (incomes created by STAFF)
  const isDonation = (i) => i.created_by_role === 'STAFF'
  const donationItems = items.filter(isDonation)
  const nonDonationItems = items.filter(i => !isDonation(i))
  const donationTotal = donationItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0)
  const total = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0)
  const cashTotal = donationItems.filter(i => (i.account_type || '').toUpperCase() === 'CASH').reduce((s, i) => s + parseFloat(i.amount || 0), 0)
  const onlineTotal = donationItems.filter(i => (i.account_type || '').toUpperCase() === 'BANK').reduce((s, i) => s + parseFloat(i.amount || 0), 0)

  return (
    <div>
      <PageHeader title="Income Records" subtitle="All income and donations">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleOpenModal}>+ Add Income</button>
        </div>
      </PageHeader>

      <div className="data-card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 150px)' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--gray-200)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}><FilterBar search={search} onSearch={setSearch} /></div>
          <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          {dateFilter && (
            <button className="btn btn-secondary btn-sm" onClick={() => setDateFilter("")}>Clear Date</button>
          )}
          <select className="form-control" style={{ width: 'auto' }} value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK">Online / Bank</option>
          </select>
        </div>

        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Breakdown</th>
                  <th>Total Amount</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon="📥" title="No income records" /></td></tr>
                ) : (
                  <>
                    {/* ONE summary row for all donations */}
                    {(cashTotal > 0 || onlineTotal > 0) && (
                      <tr style={{ background: '#f0fdf4', borderLeft: '4px solid #16a34a' }}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>
                          {dateFilter ? format(new Date(dateFilter), 'dd MMM yyyy') : '—'}
                        </td>
                        <td style={{ fontWeight: 800, color: '#15803d', fontSize: 15, letterSpacing: '1px' }}>
                          DONATION
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                              Cash: <strong style={{ color: '#15803d' }}>{formatINR(cashTotal)}</strong>
                            </span>
                            <span style={{ color: '#d1d5db' }}>+</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                              Online: <strong style={{ color: '#1d4ed8' }}>{formatINR(onlineTotal)}</strong>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 900, color: '#15803d', fontSize: 18 }}>
                            {formatINR(donationTotal)}
                          </span>
                        </td>
                        <td><span className="badge badge-green" style={{ fontSize: 11 }}>DONATION</span></td>
                      </tr>
                    )}

                    {/* Non-donation income rows shown individually */}
                    {nonDonationItems.map(i => (
                      <tr key={i.id}>
                        <td style={{ fontWeight: 500 }}>{i.date ? format(new Date(i.date), "dd MMM yyyy") : "—"}</td>
                        <td style={{ fontWeight: 600 }}>{i.donor_name || i.source}</td>
                        <td><span className="badge badge-blue" style={{ fontSize: 11 }}>{i.source}</span></td>
                        <td><AmountDisplay amount={i.amount} type="credit" /></td>
                        <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{i.payment_method}</span></td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Total footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-200)', background: 'var(--gray-50)', position: 'sticky', bottom: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 24 }}>
          {donationItems.length > 0 && (
            <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
              Donation: {formatINR(donationTotal)}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-600)' }}>Total Income:</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-700)' }}>{formatINR(total)}</span>
        </div>
      </div>

      {showModal && (
        <Modal isOpen={true} onClose={() => setShowModal(false)} title="Add Income Record" size="modal-lg"
          footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" form="income-form" type="submit" disabled={saving}>{saving ? "Saving..." : "Save & Sync to Day Book"}</button></>}>
          <form id="income-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              {[["source","Income Source","text",null],
                ["date","Date","date",null],["amount","Amount (₹)","number",null],["donor_name","Donor/Payer Name","text",null],
                ["phone","Phone","text",null],["payment_method","Payment Method","select",["CASH","CHEQUE","DD","NEFT","RTGS","IMPS","UPI"]],
                ["account_type","Account Type","select",["CASH","BANK"]],["reference_number","Reference Number","text",null]].map(([k,l,t,opts]) => (
                <div className="form-group" key={k}>
                  <label className={`form-label ${["date","amount"].includes(k) ? "required" : ""}`}>{l}</label>
                  {k === "payment_method" ? (
                    <PaymentMethodSelector value={form[k]} onChange={v => setForm(f => ({...f,[k]:v,account_type:v==="CASH"?"CASH":"BANK"}))} options={opts} />
                  ) : t === "select" ? (
                    <select className="form-control" name={k} value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))}>
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="form-control" type={t} name={k} value={form[k]} onChange={e => setForm(f => ({...f,[k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value}))} required={["date","amount"].includes(k)} />
                  )}
                </div>
              ))}
              <div className="form-group"><label className="form-label">Address</label>
                <textarea className="form-control" name="address" rows={2} value={form.address} onChange={e => setForm(f => ({...f,address:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Purpose</label>
              <textarea className="form-control" name="purpose" rows={2} value={form.purpose} onChange={e => setForm(f => ({...f,purpose:e.target.value}))} /></div>
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', marginTop: 8 }}>
              ℹ️ This income will automatically be added to the <strong>Day Book Credit</strong> section for the selected date.
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
