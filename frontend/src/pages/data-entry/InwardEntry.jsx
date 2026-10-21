// pages/data-entry/InwardEntry.jsx — Stock Management: Inward (Donations) & Purchase Entry
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { managerApi, accountsApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import PaymentMethodSelector from '../../components/PaymentMethodSelector'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const DEFAULT_CATEGORIES = [
  'Food / Groceries',
  'Medical Relief',
  'Clothing & Textiles',
  'Child Education',
  'Equipment & Machinery',
  'Furniture & Fixtures',
  'Construction Materials',
  'Disability Aids & Wheelchairs',
  'General Stock',
]

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'pcs', label: 'Quantity / Pieces (pcs)' },
  { value: 'pkt', label: 'Packets (pkt)' },
  { value: 'box', label: 'Boxes (box)' },
  { value: 'litre', label: 'Litres (L)' },
  { value: 'metre', label: 'Meters (m)' },
  { value: 'bag', label: 'Bags / Sacks' },
]

export default function InwardEntry() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL') // 'ALL', 'INWARD', 'PURCHASE'

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [entryType, setEntryType] = useState('INWARD') // 'INWARD' (default) or 'PURCHASE'
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [saving, setSaving] = useState(false)

  // Custom Categories
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Form State
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    serial_number: '',
    // Donor Details (for Inward)
    donor_name: '',
    donor_phone: '',
    donor_address: '',
    donor_member: '',
    donor_job: '',
    // Vendor Details (for Purchase)
    vendor_name: '',
    vendor_phone: '',
    vendor_address: '',
    // Item Details
    item_name: '',
    category: 'Food / Groceries',
    unit: 'kg',
    quantity: '',
    unit_value: '',
    expiry_date: '',
    // Payment & Reference
    payment_method: 'CASH',
    account_type: 'CASH',
    reference_number: '',
    remarks: '',
  })

  const [itemPhoto, setItemPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Reset form when opening modal
  const openNewEntryModal = (type = 'INWARD') => {
    setEntryType(type)
    setShowMoreDetails(false)
    setItemPhoto(null)
    setPhotoPreview(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      serial_number: type === 'INWARD' ? `INW-${year}-${rand}` : `PUR-${year}-${rand}`,
      donor_name: '',
      donor_phone: '',
      donor_address: '',
      donor_member: '',
      donor_job: '',
      vendor_name: '',
      vendor_phone: '',
      vendor_address: '',
      item_name: '',
      category: categories[0] || 'Food / Groceries',
      unit: 'kg',
      quantity: '',
      unit_value: '',
      expiry_date: '',
      payment_method: 'CASH',
      account_type: 'CASH',
      reference_number: '',
      remarks: '',
    })
    setShowModal(true)
  }

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Auto calculate total
  const calculatedTotal = useMemo(() => {
    const q = parseFloat(form.quantity) || 0
    const v = parseFloat(form.unit_value) || 0
    return q * v
  }, [form.quantity, form.unit_value])

  const isFoodItem = useMemo(() => {
    const cat = (form.category || '').toLowerCase()
    return cat.includes('food') || cat.includes('grocer') || cat.includes('meal') || cat.includes('grain')
  }, [form.category])

  // Load Transactions List
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { search }
      if (dateFilter) params.date = dateFilter
      if (typeFilter !== 'ALL') params.type = typeFilter

      const res = await managerApi.stockInwardPurchase.list(params)
      setItems(res.data.results || res.data || [])
    } catch {
      // Fallback to accountsApi.income if endpoint fails
      try {
        const iRes = await accountsApi.income.list({ search, source: 'INWARD', date: dateFilter || undefined })
        const list = (iRes.data.results || iRes.data || []).map((x) => ({
          id: x.id,
          date: x.date,
          reference_number: x.reference_number || `INW-${x.id}`,
          source_type: 'INWARD',
          donor_name: x.donor_name,
          donor_phone: x.phone,
          item: { item_name: x.purpose || 'Inward Stock', unit: 'pcs', category: 'General' },
          quantity: 1,
          unit_value: x.amount,
          total_amount: x.amount,
          payment_method: x.payment_method,
        }))
        setItems(list)
      } catch {
        toast.error('Failed to load stock inward & purchase entries')
      }
    } finally {
      setLoading(false)
    }
  }, [search, dateFilter, typeFilter])

  useEffect(() => {
    load()
  }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  // Handle Image File selection
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setItemPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  // Handle Add New Category
  const handleAddCategory = (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return toast.error('Enter category name')
    const trimmed = newCategoryName.trim()
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed])
      setF('category', trimmed)
      toast.success(`Category "${trimmed}" added!`)
    }
    setNewCategoryName('')
    setShowNewCategoryModal(false)
  }

  // Handle Save Inward or Purchase
  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.item_name.trim()) {
      return toast.error('Please enter the Item Name')
    }

    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) {
      return toast.error('Please enter a valid Quantity')
    }

    const val = parseFloat(form.unit_value)
    if (isNaN(val) || val < 0) {
      return toast.error('Please enter a valid unit value/price')
    }

    if (entryType === 'INWARD') {
      if (!form.donor_name.trim()) {
        return toast.error('Please enter the Donor Name')
      }
      if (isFoodItem && !form.expiry_date) {
        return toast.error('Expiry Date is required for Food items!')
      }
    } else {
      // PURCHASE
      if (!form.vendor_name.trim()) {
        return toast.error('Please enter the Vendor / Supplier Name')
      }
    }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('entry_type', entryType)
      fd.append('date', form.date)
      fd.append('reference_number', form.serial_number || form.reference_number)
      fd.append('item_name', form.item_name)
      fd.append('category', form.category)
      fd.append('unit', form.unit)
      fd.append('quantity', String(qty))
      fd.append('unit_value', String(val))
      fd.append('total_amount', String(calculatedTotal))
      fd.append('payment_method', form.payment_method)
      fd.append('account_type', form.account_type)
      fd.append('remarks', form.remarks || '')

      if (form.expiry_date) {
        fd.append('expiry_date', form.expiry_date)
      }

      if (entryType === 'INWARD') {
        fd.append('donor_name', form.donor_name)
        fd.append('donor_phone', form.donor_phone || '')
        fd.append('donor_address', form.donor_address || '')
        fd.append('donor_member', form.donor_member || '')
        fd.append('donor_job', form.donor_job || '')
      } else {
        fd.append('vendor_name', form.vendor_name)
        fd.append('vendor_phone', form.vendor_phone || '')
        fd.append('vendor_address', form.vendor_address || '')
      }

      if (itemPhoto) {
        fd.append('image', itemPhoto)
      }

      await managerApi.stockInwardPurchase.create(fd)
      toast.success(
        entryType === 'INWARD'
          ? 'Stock Inward (Donation) entry recorded & inventory updated!'
          : 'Stock Purchase entry recorded & inventory increased!'
      )
      setShowModal(false)
      load()
    } catch (err) {
      const data = err.response?.data
      let msg = 'Failed to save entry.'
      if (data) {
        if (data.detail) msg = data.detail
        else if (data.error) msg = data.error
        else if (typeof data === 'object') msg = Object.values(data).flat().join(' | ')
      }
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Summary Metrics
  const totalAmount = items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
  const inwardCount = items.filter((i) => i.source_type === 'INWARD').length
  const purchaseCount = items.filter((i) => i.source_type === 'PURCHASE').length

  return (
    <div>
      <PageHeader
        title="📦 Stock Management — Inward & Purchase"
        subtitle="Manage incoming donated stock and purchased inventory items"
      >
        <span className="badge badge-blue" style={{ fontSize: 13, padding: '6px 14px' }}>
          Total Value: {formatINR(totalAmount)}
        </span>
        <button className="btn btn-primary" onClick={() => openNewEntryModal('INWARD')}>
          + New Inward / Purchase Entry
        </button>
      </PageHeader>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 18, borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>TOTAL ENTRIES</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{items.length}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Inward & Purchase receipts</div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>INWARD (DONATIONS)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>{inwardCount}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Contributed by donors</div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>PURCHASE ENTRIES</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{purchaseCount}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Procured from vendors</div>
        </div>

        <div className="card" style={{ padding: 18, borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600 }}>TOTAL STOCK VALUE</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6', marginTop: 4 }}>{formatINR(totalAmount)}</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Available for trust aid</div>
        </div>
      </div>

      <div className="data-card">
        {/* Filter bar with Inward / Purchase filter tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'ALL', label: 'All Entries' },
              { id: 'INWARD', label: '📥 Inward (Donations)' },
              { id: 'PURCHASE', label: '🛒 Purchases' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${typeFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTypeFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="date"
              className="form-control"
              style={{ width: 150 }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by entry date"
            />
            {dateFilter && (
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDateFilter('')}>
                Clear Date
              </button>
            )}
            <input
              type="text"
              placeholder="Search item, donor, vendor, ref..."
              className="form-control"
              style={{ width: 240 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Serial / Ref No</th>
                  <th>Type</th>
                  <th>Donor / Vendor</th>
                  <th>Item & Category</th>
                  <th>Qty & Unit</th>
                  <th>Unit Value</th>
                  <th>Total Amount</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon="📦"
                        title="No stock entries recorded yet"
                        subtitle="Click '+ New Inward / Purchase Entry' to add donated or purchased stock."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((i) => {
                    const isPurch = i.source_type === 'PURCHASE'
                    const todayStr = format(new Date(), 'yyyy-MM-dd')
                    const isExpired = i.expiry_date && i.expiry_date < todayStr

                    return (
                      <tr key={i.id || i.transaction_id}>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>
                          {i.date ? format(new Date(i.date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="td-mono" style={{ fontSize: 12 }}>
                          {i.reference_number || i.transaction_id || '—'}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: isPurch ? '#fef3c7' : '#e0f2fe',
                              color: isPurch ? '#b45309' : '#0369a1',
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            {isPurch ? '🛒 Purchase' : '📥 Inward'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            {isPurch ? i.vendor_name || 'Vendor' : i.donor_name || 'Donor'}
                          </div>
                          {(i.donor_phone || i.vendor_phone) && (
                            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                              📞 {i.donor_phone || i.vendor_phone}
                            </div>
                          )}
                          {i.donor_member && (
                            <span className="badge badge-gray" style={{ fontSize: 10, marginTop: 2 }}>
                              Member: {i.donor_member}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {i.item?.item_name || i.item_name || '—'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                            {i.item?.category || i.category || 'General'}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          {i.quantity || 1} {i.item?.unit || i.unit || 'pcs'}
                        </td>
                        <td style={{ fontSize: 12 }}>{formatINR(i.unit_value || 0)}</td>
                        <td style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>
                          {formatINR(i.total_amount || 0)}
                        </td>
                        <td>
                          {i.expiry_date ? (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: isExpired ? '#fee2e2' : '#f0fdf4',
                                color: isExpired ? '#dc2626' : '#15803d',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {isExpired ? '⚠️ Expired: ' : 'Exp: '}
                              {format(new Date(i.expiry_date), 'dd MMM yyyy')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Entry Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Stock Entry (Inward / Purchase)"
        size="modal-lg"
      >
        <form onSubmit={handleSave}>
          {/* Top Mode Segmented Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: 4,
              borderRadius: 12,
              marginBottom: 20,
              gap: 6,
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: entryType === 'INWARD' ? '#0284c7' : 'transparent',
                color: entryType === 'INWARD' ? '#ffffff' : '#64748b',
                boxShadow: entryType === 'INWARD' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                transition: 'all 0.2s',
              }}
              onClick={() => {
                setEntryType('INWARD')
                const year = new Date().getFullYear()
                const rand = Math.floor(1000 + Math.random() * 9000)
                setF('serial_number', `INW-${year}-${rand}`)
              }}
            >
              <span>📥</span> Inward Entry (Donation)
            </button>

            <button
              type="button"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: entryType === 'PURCHASE' ? '#0284c7' : 'transparent',
                color: entryType === 'PURCHASE' ? '#ffffff' : '#64748b',
                boxShadow: entryType === 'PURCHASE' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                transition: 'all 0.2s',
              }}
              onClick={() => {
                setEntryType('PURCHASE')
                const year = new Date().getFullYear()
                const rand = Math.floor(1000 + Math.random() * 9000)
                setF('serial_number', `PUR-${year}-${rand}`)
              }}
            >
              <span>🛒</span> Purchase Entry (Vendor)
            </button>
          </div>

          <div className="form-grid-2">
            {/* 1. Date (Defaults to today, saves on that date) */}
            <div className="form-group">
              <label className="form-label required">Date of Entry</label>
              <input
                className="form-control"
                type="date"
                required
                value={form.date}
                onChange={(e) => setF('date', e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                Entry will be stored in this selected date
              </span>
            </div>

            {/* 2. Serial / Bill Number */}
            <div className="form-group">
              <label className="form-label required">
                {entryType === 'INWARD' ? 'Serial Number' : 'Bill / Invoice / Serial No.'}
              </label>
              <input
                className="form-control"
                required
                value={form.serial_number}
                onChange={(e) => setF('serial_number', e.target.value)}
                placeholder={entryType === 'INWARD' ? 'e.g. INW-2026-0001' : 'e.g. INV-9872 / PUR-001'}
              />
            </div>

            {/* ── INWARD MODE SPECIFIC FIELDS ── */}
            {entryType === 'INWARD' && (
              <>
                {/* Add Donator */}
                <div className="form-group">
                  <label className="form-label required">Add Donator (Donor Name)</label>
                  <input
                    className="form-control"
                    required
                    value={form.donor_name}
                    onChange={(e) => setF('donor_name', e.target.value)}
                    placeholder="Enter donor / contributor name"
                  />
                </div>

                {/* Phone Number */}
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-control"
                    value={form.donor_phone}
                    onChange={(e) => setF('donor_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                  />
                </div>

                {/* Other Details + Button */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <button
                    type="button"
                    style={{
                      background: '#f8fafc',
                      border: '1px dashed #94a3b8',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0284c7',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onClick={() => setShowMoreDetails((prev) => !prev)}
                  >
                    <span>{showMoreDetails ? '−' : '+'}</span>
                    {showMoreDetails ? 'Hide Other Details' : 'Other Details + (More Information: Address, Member, Job)'}
                  </button>
                </div>

                {showMoreDetails && (
                  <div
                    style={{
                      gridColumn: 'span 2',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: 16,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 14,
                    }}
                  >
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Donor Address</label>
                      <input
                        className="form-control"
                        value={form.donor_address}
                        onChange={(e) => setF('donor_address', e.target.value)}
                        placeholder="House no, street, city..."
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Member ID / Reference</label>
                      <input
                        className="form-control"
                        value={form.donor_member}
                        onChange={(e) => setF('donor_member', e.target.value)}
                        placeholder="Member ID if trust member"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Job / Occupation</label>
                      <input
                        className="form-control"
                        value={form.donor_job}
                        onChange={(e) => setF('donor_job', e.target.value)}
                        placeholder="e.g. Business, Teacher, Doctor..."
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── PURCHASE MODE SPECIFIC FIELDS ── */}
            {entryType === 'PURCHASE' && (
              <>
                <div className="form-group">
                  <label className="form-label required">Vendor / Supplier Name</label>
                  <input
                    className="form-control"
                    required
                    value={form.vendor_name}
                    onChange={(e) => setF('vendor_name', e.target.value)}
                    placeholder="Enter vendor / store / business name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-control"
                    value={form.vendor_phone}
                    onChange={(e) => setF('vendor_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Vendor contact number"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Vendor Address</label>
                  <input
                    className="form-control"
                    value={form.vendor_address}
                    onChange={(e) => setF('vendor_address', e.target.value)}
                    placeholder="Shop address, market, town..."
                  />
                </div>
              </>
            )}

            {/* ── ITEM DETAILS (FOR BOTH MODES) ── */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <div style={{ height: 1, backgroundColor: '#e2e8f0', margin: '8px 0' }} />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0284c7', marginBottom: 8 }}>
                ITEM INFORMATION
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Item Name</label>
              <input
                className="form-control"
                required
                value={form.item_name}
                onChange={(e) => setF('item_name', e.target.value)}
                placeholder="e.g. Rice (Ponni), Blanket, Wheelchair..."
              />
            </div>

            {/* Category with inline + button */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label required" style={{ margin: 0 }}>Category</label>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowNewCategoryModal(true)}
                >
                  + Add Category
                </button>
              </div>
              <select
                className="form-control"
                value={form.category}
                onChange={(e) => setF('category', e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Dropdown (qty / kilogram / etc) */}
            <div className="form-group">
              <label className="form-label required">Unit of Measure</label>
              <select className="form-control" value={form.unit} onChange={(e) => setF('unit', e.target.value)}>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="form-group">
              <label className="form-label required">Quantity ({form.unit})</label>
              <input
                className="form-control"
                type="number"
                min="0.01"
                step="any"
                required
                value={form.quantity}
                onChange={(e) => setF('quantity', e.target.value)}
                placeholder="e.g. 50"
              />
            </div>

            {/* Value (Stock value amount per unit) */}
            <div className="form-group">
              <label className="form-label required">
                {entryType === 'INWARD' ? 'Stock Value per Unit (₹)' : 'Unit Price / Value (₹)'}
              </label>
              <input
                className="form-control"
                type="number"
                min="0.01"
                step="any"
                required
                value={form.unit_value}
                onChange={(e) => setF('unit_value', e.target.value)}
                placeholder="e.g. 60.00"
              />
            </div>

            {/* Total = Qty x Value (Grand Total) */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>
                {entryType === 'INWARD' ? 'Total Stock Value (₹)' : 'Grand Total (₹)'}
              </label>
              <div
                style={{
                  height: 42,
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#059669',
                }}
              >
                {formatINR(calculatedTotal)}
                <span style={{ fontSize: 11, color: 'var(--gray-500)', marginLeft: 8, fontWeight: 500 }}>
                  ({form.quantity || 0} {form.unit} × ₹{form.unit_value || 0})
                </span>
              </div>
            </div>

            {/* Expiry Date (Optional, required if food) */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Expiry Date {isFoodItem ? '(Required for Food)' : '(Optional)'}</span>
                {isFoodItem && (
                  <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>⚠️ Food Expiry</span>
                )}
              </label>
              <input
                className="form-control"
                type="date"
                required={isFoodItem}
                value={form.expiry_date}
                onChange={(e) => setF('expiry_date', e.target.value)}
              />
              <span style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>
                Expired items are automatically removed from active stock
              </span>
            </div>

            {/* Item Photo (for Purchase or Inward) */}
            <div className="form-group">
              <label className="form-label">
                {entryType === 'PURCHASE' ? 'Item Photo / Bill Receipt' : 'Item Photo (Optional)'}
              </label>
              <input className="form-control" type="file" accept="image/*" onChange={handlePhotoChange} />
              {photoPreview && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Payment Method</label>
              <PaymentMethodSelector
                value={form.payment_method}
                onChange={(v) => setF('payment_method', v)}
                options={['CASH', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE', 'UPI']}
              />
            </div>

            {/* Remarks */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Remarks / Notes</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.remarks}
                onChange={(e) => setF('remarks', e.target.value)}
                placeholder="Additional notes, batch number, condition..."
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: 0, marginTop: 18 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving & Updating Stock...' : `Save ${entryType === 'INWARD' ? 'Inward' : 'Purchase'} Entry`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inline Modal to Add New Category */}
      <Modal
        isOpen={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        title="Add New Stock Category"
        size="modal-sm"
      >
        <form onSubmit={handleAddCategory}>
          <div className="form-group">
            <label className="form-label required">Category Name</label>
            <input
              className="form-control"
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Diapers, Baby Food, Medical Kits..."
            />
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowNewCategoryModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Category
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
