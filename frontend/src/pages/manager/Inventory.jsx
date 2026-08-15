import React, { useState, useEffect, useCallback } from 'react'
import { managerApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { LoadingState, EmptyState, PageHeader, FilterBar, Modal } from '../../components/shared'
import toast from 'react-hot-toast'

const CATEGORIES = ['MEDICINE', 'EQUIPMENT', 'FOOD', 'CLOTHING', 'EDUCATION', 'CONSTRUCTION', 'OTHER']
const CATEGORY_ICONS = { MEDICINE: '💊', EQUIPMENT: '🦽', FOOD: '🍚', CLOTHING: '👗', EDUCATION: '📚', CONSTRUCTION: '🏗️', OTHER: '📦' }

const CategoryBadge = ({ cat }) => {
  const colors = {
    MEDICINE: { bg: '#FEE2E2', color: '#DC2626' },
    EQUIPMENT: { bg: '#DBEAFE', color: '#2563EB' },
    FOOD: { bg: '#D1FAE5', color: '#059669' },
    CLOTHING: { bg: '#EDE9FE', color: '#7C3AED' },
    EDUCATION: { bg: '#FEF3C7', color: '#D97706' },
    CONSTRUCTION: { bg: '#F3F4F6', color: '#374151' },
    OTHER: { bg: '#F9FAFB', color: '#6B7280' },
  }
  const { bg, color } = colors[cat] || colors.OTHER
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    }}>
      {CATEGORY_ICONS[cat]} {cat.replace(/_/g, ' ')}
    </span>
  )
}

const StockBar = ({ qty }) => {
  const level = qty === 0 ? 'out' : qty <= 5 ? 'low' : 'ok'
  const colors = { out: '#EF4444', low: '#F59E0B', ok: '#10B981' }
  const labels = { out: 'Out of Stock', low: 'Low Stock', ok: 'In Stock' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      color: colors[level], fontWeight: 700, fontSize: 12,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[level], display: 'inline-block' }} />
      {labels[level]} ({qty})
    </span>
  )
}

function InventoryForm({ onClose, onSaved, initial = null }) {
  const [form, setForm] = useState(initial || {
    item_name: '', category: 'MEDICINE', description: '',
    unit: 'pcs', quantity_available: 0, unit_value: 0, is_active: true, notes: '',
  })
  const [saving, setSaving] = useState(false)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (initial) {
        await managerApi.inventory.update(initial.id, form)
        toast.success('Inventory item updated.')
      } else {
        await managerApi.inventory.create(form)
        toast.success('Inventory item added.')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-2">
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label required">Item Name</label>
          <input className="form-control" required value={form.item_name}
            onChange={e => setF('item_name', e.target.value)} placeholder="e.g. Wheelchair Standard Model" />
        </div>
        <div className="form-group">
          <label className="form-label required">Category</label>
          <select className="form-control" value={form.category} onChange={e => setF('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required">Unit</label>
          <input className="form-control" required value={form.unit}
            onChange={e => setF('unit', e.target.value)} placeholder="e.g. pcs, kg, box, set" />
        </div>
        <div className="form-group">
          <label className="form-label required">Quantity Available</label>
          <input className="form-control" type="number" min="0" required value={form.quantity_available}
            onChange={e => setF('quantity_available', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Unit Value (₹)</label>
          <input className="form-control" type="number" min="0" step="0.01" value={form.unit_value}
            onChange={e => setF('unit_value', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-control" rows={2} value={form.description}
          onChange={e => setF('description', e.target.value)} placeholder="Optional description..." />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-control" rows={2} value={form.notes}
          onChange={e => setF('notes', e.target.value)} placeholder="Storage location, supplier, expiry info..." />
      </div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} />
          <span className="form-label" style={{ margin: 0 }}>Active (visible to ACO)</span>
        </label>
      </div>
      <div className="modal-footer" style={{ padding: 0, marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : (initial ? 'Update Item' : 'Add to Inventory')}
        </button>
      </div>
    </form>
  )
}

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const { user } = useAuthStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await managerApi.inventory.list({ search, category: catFilter })
      setItems(res.data.results || res.data)
    } catch (_) { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }, [search, catFilter])

  useEffect(() => { load() }, [load])

  const handleAdjust = async () => {
    if (!adjustItem) return
    const newQty = parseInt(adjustQty)
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Please enter a valid quantity.')
      return
    }
    setAdjusting(true)
    try {
      await managerApi.inventory.update(adjustItem.id, { quantity_available: newQty })
      toast.success(`Stock updated to ${newQty} ${adjustItem.unit}`)
      setAdjustItem(null)
      setAdjustQty('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed.')
    } finally {
      setAdjusting(false)
    }
  }

  // Summary stats
  const totalItems = items.length
  const inStockItems = items.filter(i => i.quantity_available > 0).length
  const lowStockItems = items.filter(i => i.quantity_available > 0 && i.quantity_available <= 5).length
  const outOfStockItems = items.filter(i => i.quantity_available === 0).length
  const totalValue = items.reduce((s, i) => s + (i.quantity_available * parseFloat(i.unit_value || 0)), 0)

  const isManager = ['MANAGER', 'ADMIN'].includes(user?.role)

  return (
    <div>
      <PageHeader
        title="Charity Inventory"
        subtitle="View items available for distribution to beneficiaries"
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Items', value: totalItems, icon: '📦', color: '#3B82F6', bg: '#DBEAFE' },
          { label: 'In Stock', value: inStockItems, icon: '✅', color: '#10B981', bg: '#D1FAE5' },
          { label: 'Low Stock', value: lowStockItems, icon: '⚠️', color: '#F59E0B', bg: '#FEF3C7' },
          { label: 'Out of Stock', value: outOfStockItems, icon: '❌', color: '#EF4444', bg: '#FEE2E2' },
          { label: 'Stock Value', value: `₹${totalValue.toFixed(0)}`, icon: '💰', color: '#8B5CF6', bg: '#EDE9FE' },
        ].map(c => (
          <div key={c.label} style={{
            background: c.bg, borderRadius: 12, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${c.color}30`,
          }}>
            <span style={{ fontSize: 22 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: c.color, fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace(/_/g, ' ')}</option>)}
          </select>
        </FilterBar>

        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit Value</th>
                  <th>Stock Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="📦" title="No inventory items" subtitle="Add items to track charity stock" /></td></tr>
                ) : items.map(item => (
                  <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }}>
                    <td className="td-mono" style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.item_code}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                      {item.description && (
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{item.description.slice(0, 60)}</div>
                      )}
                    </td>
                    <td><CategoryBadge cat={item.category} /></td>
                    <td style={{ fontWeight: 800, fontSize: 16, color: item.quantity_available === 0 ? '#EF4444' : 'var(--gray-900)' }}>
                      {item.quantity_available}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.unit}</td>
                    <td style={{ fontWeight: 600 }}>
                      {parseFloat(item.unit_value) > 0 ? `₹${parseFloat(item.unit_value).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td><StockBar qty={item.quantity_available} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {isManager && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setAdjustItem(item); setAdjustQty(String(item.quantity_available)) }}
                          >Adjust Stock</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        size="modal-md"
      >
        <InventoryForm
          key={editItem?.id || 'new'}
          initial={editItem}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      </Modal>

      {/* Stock Adjustment Modal */}
      {adjustItem && (
        <Modal
          isOpen={true}
          onClose={() => { setAdjustItem(null); setAdjustQty('') }}
          title={`Adjust Stock — ${adjustItem.item_name}`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setAdjustItem(null); setAdjustQty('') }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdjust} disabled={adjusting}>
                {adjusting ? 'Updating...' : 'Update Stock'}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16 }}>
            Current quantity: <strong>{adjustItem.quantity_available} {adjustItem.unit}</strong>
          </p>
          <div className="form-group">
            <label className="form-label required">New Quantity ({adjustItem.unit})</label>
            <input
              className="form-control"
              type="number" min="0"
              value={adjustQty}
              onChange={e => setAdjustQty(e.target.value)}
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
