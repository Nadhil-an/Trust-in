import React, { useState, useCallback, useEffect } from 'react'
import { managerApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  item: '',
  transaction_type: 'INWARD',
  quantity: '',
  reference_number: '',
  remarks: '',
}

export default function MaterialInward() {
  const [items, setItems] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // New Item State
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [newItemForm, setNewItemForm] = useState({ item_name: '', category: 'EQUIPMENT', unit: 'pcs' })
  const [creatingItem, setCreatingItem] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txnRes, invRes] = await Promise.all([
        managerApi.inventoryTransactions.list({ search, transaction_type: 'INWARD' }),
        managerApi.inventory.list({ is_active: true })
      ])
      setItems(txnRes.data.results || txnRes.data)
      setInventoryItems(invRes.data.results || invRes.data)
    } catch { toast.error('Failed to load material inward entries') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.item) return toast.error('Please select an item')
    if (!form.quantity || parseInt(form.quantity) <= 0) return toast.error('Enter a valid quantity')
    setSaving(true)
    try {
      await managerApi.inventoryTransactions.create(form)
      toast.success('Material inward entry recorded!')
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

  const handleSelectChange = (e) => {
    const val = e.target.value
    if (val === 'ADD_NEW') {
      setShowNewItemModal(true)
    } else {
      setF('item', val)
    }
  }

  const handleCreateNewItem = async (e) => {
    e.preventDefault()
    if (!newItemForm.item_name) return toast.error('Enter item name')
    setCreatingItem(true)
    try {
      const res = await managerApi.inventory.create(newItemForm)
      toast.success('Item created successfully!')
      // Refresh inventory list and select the new item
      const invRes = await managerApi.inventory.list({ is_active: true })
      setInventoryItems(invRes.data.results || invRes.data)
      setF('item', res.data.id) // Select it automatically
      setShowNewItemModal(false)
      setNewItemForm({ item_name: '', category: 'EQUIPMENT', unit: 'pcs' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create item')
    } finally {
      setCreatingItem(false)
    }
  }

  const totalQuantity = items.reduce((s, i) => s + parseInt(i.quantity || 0), 0)

  return (
    <div>
      <PageHeader title="📦 Material Inward Entry" subtitle="Record incoming materials, equipment, and goods to inventory">
        <span className="badge badge-blue" style={{ fontSize: 13, padding: '6px 14px' }}>Total Items Inward: {totalQuantity}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Receive Material</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Transaction ID</th><th>Item Name</th>
                <th>Quantity Received</th><th>Reference No.</th><th>Remarks</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon="📦" title="No material inward entries" subtitle="Click '+ Receive Material' to add stock" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.created_at), 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.transaction_id}</td>
                      <td style={{ fontWeight: 600 }}>{i.item_name}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{i.quantity} {i.item_unit}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ maxWidth: 200 }}>{i.remarks || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Receive Material" size="modal-md">
        <form onSubmit={handleSave} onKeyDown={handleKeyDown}>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Inventory Item</label>
              <select className="form-control" required value={form.item} onChange={handleSelectChange}>
                <option value="">-- Select Item --</option>
                <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>+ Add New Item...</option>
                {inventoryItems.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.item_name} ({inv.category})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Quantity Received</label>
              <input className="form-control" type="number" min="1" step="1" required value={form.quantity} onChange={e => setF('quantity', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Reference No.</label>
              <input className="form-control" value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} placeholder="e.g., GRN-123" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} placeholder="Any additional details..." />
            </div>
          </div>
          <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Inward'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showNewItemModal} onClose={() => setShowNewItemModal(false)} title="Create New Item" size="modal-sm">
        <form onSubmit={handleCreateNewItem}>
          <div className="form-group mb-3">
            <label className="form-label required">Item Name</label>
            <input className="form-control" required value={newItemForm.item_name} onChange={e => setNewItemForm(f => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Oxygen Cylinder" />
          </div>
          <div className="form-group mb-3">
            <label className="form-label required">Category</label>
            <select className="form-control" value={newItemForm.category} onChange={e => setNewItemForm(f => ({ ...f, category: e.target.value }))}>
              <option value="EQUIPMENT">Equipment / Mobility Aids</option>
              <option value="MEDICINE">Medicine</option>
              <option value="FOOD">Food Supplies</option>
              <option value="CLOTHING">Clothing</option>
              <option value="EDUCATION">Educational Materials</option>
              <option value="CONSTRUCTION">Construction Materials</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="form-group mb-4">
            <label className="form-label required">Unit</label>
            <input className="form-control" required value={newItemForm.unit} onChange={e => setNewItemForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. pcs, kg, box" />
          </div>
          <div className="modal-footer" style={{ padding: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowNewItemModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creatingItem}>{creatingItem ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
