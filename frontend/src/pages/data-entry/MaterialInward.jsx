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
  const [filterItem, setFilterItem] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // New Item State
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [newItemForm, setNewItemForm] = useState({ item_name: '', category: 'EQUIPMENT' })
  const [creatingItem, setCreatingItem] = useState(false)
  const [isCustomCategory, setIsCustomCategory] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txnRes, invRes] = await Promise.all([
        managerApi.inventoryTransactions.list({ search, transaction_type: 'INWARD', item: filterItem || undefined }),
        managerApi.inventory.list({ is_active: true })
      ])
      setItems(txnRes.data.results || txnRes.data)
      setInventoryItems(invRes.data.results || invRes.data)
    } catch { toast.error('Failed to load material inward entries') }
    finally { setLoading(false) }
  }, [search, filterItem])

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

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editForm.quantity || parseInt(editForm.quantity) <= 0) return toast.error('Enter a valid quantity')
    setSavingEdit(true)
    try {
      await managerApi.inventoryTransactions.update(editForm.id, {
        quantity: editForm.quantity,
        reference_number: editForm.reference_number,
        remarks: editForm.remarks
      })
      toast.success('Entry updated successfully!')
      setEditForm(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed')
    } finally { setSavingEdit(false) }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await managerApi.inventoryTransactions.delete(deleteId)
      toast.success('Entry deleted successfully!')
      setDeleteId(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed')
    } finally {
      setDeleting(false)
    }
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
      setIsCustomCategory(false)
      setNewItemForm({ item_name: '', category: 'EQUIPMENT' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create item')
    } finally {
      setCreatingItem(false)
    }
  }

  const totalAvailable = inventoryItems.reduce((s, inv) => s + (inv.quantity_available || 0), 0)

  return (
    <div>
      <PageHeader title="📦 Material Inward Entry" subtitle="Record incoming materials, equipment, and goods to inventory">
        <span className="badge badge-blue" style={{ fontSize: 13, padding: '6px 14px' }}>Total Current Stock: {totalAvailable}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Receive Material</button>
      </PageHeader>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select 
            className="form-control" 
            style={{ width: '200px' }} 
            value={filterItem} 
            onChange={e => setFilterItem(e.target.value)}
          >
            <option value="">All Materials</option>
            {inventoryItems.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.item_name}</option>
            ))}
          </select>
        </FilterBar>
        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Transaction ID</th><th>Item Name</th>
                <th>Quantity Received</th><th>Reference No.</th><th>Remarks</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={7}><EmptyState icon="📦" title="No material inward entries" subtitle="Click '+ Receive Material' to add stock" /></td></tr>
                  : items.map(i => (
                    <tr key={i.id}>
                      <td style={{ fontSize: 12 }}>{format(new Date(i.created_at), 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.transaction_id}</td>
                      <td style={{ fontWeight: 600 }}>{i.item_name || i.item?.item_name || 'Unknown'}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{i.quantity}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{i.reference_number || '—'}</td>
                      <td style={{ maxWidth: 200 }}>{i.remarks || '—'}</td>
                      <td>
                        <button className="btn btn-icon text-primary" style={{ padding: 4 }} onClick={() => setEditForm(i)} title="Edit Entry">✏️</button>
                        <button className="btn btn-icon text-danger" style={{ padding: 4, marginLeft: 4 }} onClick={() => setDeleteId(i.id)} title="Delete Entry">🗑️</button>
                      </td>
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

      <Modal isOpen={showNewItemModal} onClose={() => { setShowNewItemModal(false); setIsCustomCategory(false); }} title="Create New Item" size="modal-sm">
        <form onSubmit={handleCreateNewItem}>
          <div className="form-group mb-3">
            <label className="form-label required">Item Name</label>
            <input className="form-control" required value={newItemForm.item_name} onChange={e => setNewItemForm(f => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Oxygen Cylinder" />
          </div>
          <div className="form-group mb-4">
            <label className="form-label required">Category</label>
            {isCustomCategory ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input 
                  className="form-control" 
                  autoFocus
                  required 
                  value={newItemForm.category} 
                  onChange={e => setNewItemForm(f => ({ ...f, category: e.target.value.toUpperCase() }))} 
                  placeholder="e.g. ELECTRONICS" 
                />
                <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', fontSize: '14px', flexShrink: 0 }} onClick={() => {
                  setIsCustomCategory(false)
                  setNewItemForm(f => ({ ...f, category: 'EQUIPMENT' }))
                }} title="Remove custom category">
                  ✕ Close
                </button>
              </div>
            ) : (
              <select 
                className="form-control" 
                value={newItemForm.category} 
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setIsCustomCategory(true)
                    setNewItemForm(f => ({ ...f, category: '' }))
                  } else {
                    setNewItemForm(f => ({ ...f, category: e.target.value }))
                  }
                }}
              >
                <option value="EQUIPMENT">Equipment / Mobility Aids</option>
                <option value="MEDICINE">Medicine</option>
                <option value="FOOD">Food Supplies</option>
                <option value="CLOTHING">Clothing</option>
                <option value="EDUCATION">Educational Materials</option>
                <option value="CONSTRUCTION">Construction Materials</option>
                <option value="OTHER">Other</option>
                <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>+ Add New Category...</option>
              </select>
            )}
          </div>
          <div className="modal-footer" style={{ padding: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowNewItemModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creatingItem}>{creatingItem ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editForm} onClose={() => setEditForm(null)} title="Edit Inward Entry" size="modal-md">
        {editForm && (
          <form onSubmit={handleEditSave}>
            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label required">Quantity Received</label>
                <input className="form-control" type="number" min="1" step="1" required value={editForm.quantity} onChange={e => setEditForm(f => ({...f, quantity: e.target.value}))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Reference No.</label>
                <input className="form-control" value={editForm.reference_number || ''} onChange={e => setEditForm(f => ({...f, reference_number: e.target.value}))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Remarks</label>
                <textarea className="form-control" rows={2} value={editForm.remarks || ''} onChange={e => setEditForm(f => ({...f, remarks: e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditForm(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion" size="modal-sm">
        <div style={{ padding: '10px 0 20px', fontSize: 15, color: '#4B5563', lineHeight: '1.5' }}>
          Are you sure you want to delete this entry? This action cannot be undone and will automatically revert the inventory balance.
        </div>
        <div className="modal-footer" style={{ padding: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting} style={{ backgroundColor: '#DC2626', color: 'white', border: 'none' }}>
            {deleting ? 'Deleting...' : 'Delete Entry'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
