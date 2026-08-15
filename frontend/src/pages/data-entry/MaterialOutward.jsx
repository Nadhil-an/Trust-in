import React, { useState, useCallback, useEffect } from 'react'
import { managerApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  item: '',
  transaction_type: 'OUTWARD',
  quantity: '',
  reference_number: '',
  remarks: '',
}

export default function MaterialOutward() {
  const [items, setItems] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txnRes, invRes] = await Promise.all([
        managerApi.inventoryTransactions.list({ search, transaction_type: 'OUTWARD' }),
        managerApi.inventory.list({ is_active: true })
      ])
      setItems(txnRes.data.results || txnRes.data)
      setInventoryItems(invRes.data.results || invRes.data)
    } catch { toast.error('Failed to load material outward entries') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.item) return toast.error('Please select an item')
    if (!form.quantity || parseInt(form.quantity) <= 0) return toast.error('Enter a valid quantity')
    
    // Check if enough stock is available
    const selectedItem = inventoryItems.find(inv => inv.id === form.item)
    if (selectedItem && parseInt(form.quantity) > selectedItem.quantity_available) {
      return toast.error(`Insufficient stock! Only ${selectedItem.quantity_available} available.`)
    }

    setSaving(true)
    try {
      await managerApi.inventoryTransactions.create(form)
      toast.success('Material outward entry recorded!')
      setShowModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault()
      const form = e.target.form
      const index = Array.prototype.indexOf.call(form, e.target)
      if (form.elements[index + 1]) {
        form.elements[index + 1].focus()
      }
    }
  }

  const totalQuantity = items.reduce((s, i) => s + parseInt(i.quantity || 0), 0)

  return (
    <div>
      <PageHeader title="📤 Material Outward Entry" subtitle="Record distribution and dispatch of inventory items">
        <span className="badge badge-yellow" style={{ fontSize: 13, padding: '6px 14px' }}>Total Items Outward: {totalQuantity}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Dispatch Material</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Transaction ID</th><th>Item Name</th>
                <th>Quantity Dispatched</th><th>Reference No.</th><th>Remarks</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon="📤" title="No material outward entries" subtitle="Click '+ Dispatch Material' to record one" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.created_at), 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.transaction_id}</td>
                      <td style={{ fontWeight: 600 }}>{i.item_name}</td>
                      <td style={{ fontWeight: 700, color: '#D97706' }}>{i.quantity} {i.item_unit}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ maxWidth: 200 }}>{i.remarks || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Dispatch Material" size="modal-md">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Inventory Item</label>
              <select className="form-control" required value={form.item} onChange={e => setF('item', e.target.value)}>
                <option value="">-- Select Item --</option>
                {inventoryItems.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.item_name} ({inv.category}) — {inv.quantity_available} {inv.unit} available
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Quantity Dispatched</label>
              <input className="form-control" type="number" min="1" step="1" required value={form.quantity} onChange={e => setF('quantity', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Reference No.</label>
              <input className="form-control" value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} placeholder="e.g., DIS-123" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} placeholder="Issued to, reason, etc..." />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Outward'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
