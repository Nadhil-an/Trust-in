// pages/data-entry/MaterialOutward.jsx — Stock Management: Material Outward Entry
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { managerApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const INITIAL_FORM = () => ({
  date: format(new Date(), 'yyyy-MM-dd'),
  item: '',
  quantity: '',
  unit_value: '',
  reference_number: '',
  dispatched_to: '',
  remarks: '',
})

export default function MaterialOutward() {
  const [items, setItems] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterItem, setFilterItem] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  // Dispatch Modal
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM())
  const [saving, setSaving] = useState(false)

  // Edit & Delete State
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txnRes, invRes] = await Promise.all([
        managerApi.inventoryTransactions.list({
          search: search || undefined,
          transaction_type: 'OUTWARD',
          item: filterItem || undefined,
          date: dateFilter || undefined,
        }),
        managerApi.inventory.list({ is_active: true }),
      ])
      const txns = txnRes.data.results || txnRes.data || []
      const invs = invRes.data.results || invRes.data || []
      setItems(txns)
      setInventoryItems(invs)
    } catch {
      toast.error('Failed to load material outward entries')
    } finally {
      setLoading(false)
    }
  }, [search, filterItem, dateFilter])

  useEffect(() => {
    load()
  }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  // Selected item object in Dispatch Modal
  const selectedInventoryItem = useMemo(() => {
    if (!form.item) return null
    return inventoryItems.find((inv) => String(inv.id) === String(form.item)) || null
  }, [form.item, inventoryItems])

  // When selected item changes, auto-populate unit_value if not manually set
  const handleItemSelect = (itemId) => {
    const found = inventoryItems.find((inv) => String(inv.id) === String(itemId))
    setForm((f) => ({
      ...f,
      item: itemId,
      unit_value: found?.unit_value ? String(found.unit_value) : f.unit_value,
    }))
  }

  // Selected item object in Edit Modal
  const editInventoryItem = useMemo(() => {
    if (!editForm?.item) return null
    return inventoryItems.find((inv) => String(inv.id) === String(editForm.item)) || null
  }, [editForm, inventoryItems])

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Save New Dispatch
  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.item) return toast.error('Please select an inventory item')
    const qty = parseInt(form.quantity, 10)
    if (isNaN(qty) || qty <= 0) return toast.error('Please enter a valid quantity greater than 0')

    const available = selectedInventoryItem?.quantity_available || 0
    if (qty > available) {
      return toast.error(`Insufficient stock! Only ${available} ${selectedInventoryItem?.unit || 'units'} available.`)
    }
    if (!form.dispatched_to.trim()) {
      return toast.error('Please enter recipient/beneficiary in "Dispatched To"')
    }

    const unitVal = parseFloat(form.unit_value) || (selectedInventoryItem?.unit_value ? parseFloat(selectedInventoryItem.unit_value) : 0)
    const totalAmount = qty * unitVal

    setSaving(true)
    try {
      await managerApi.inventoryTransactions.create({
        item: form.item,
        transaction_type: 'OUTWARD',
        source_type: 'OUTWARD',
        date: form.date,
        quantity: qty,
        unit_value: unitVal,
        total_amount: totalAmount,
        dispatched_to: form.dispatched_to.trim(),
        reference_number: form.reference_number.trim(),
        remarks: form.remarks.trim(),
      })

      toast.success(`Dispatched ${qty} ${selectedInventoryItem?.unit || 'pcs'} of ${selectedInventoryItem?.item_name || 'item'}! Stock updated.`)
      setShowModal(false)
      setForm(INITIAL_FORM())
      window.dispatchEvent(new Event('dashboard-refresh'))
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Save Edited Dispatch
  const handleEditSave = async (e) => {
    e.preventDefault()
    const qty = parseInt(editForm.quantity, 10)
    if (isNaN(qty) || qty <= 0) return toast.error('Enter a valid quantity')

    // Allowed quantity ceiling: currently available + quantity already deducted by this transaction
    const currentlyAvailable = editInventoryItem?.quantity_available || 0
    const originalQty = parseInt(editForm.original_quantity || editForm.quantity, 10)
    const maxAllowed = currentlyAvailable + originalQty

    if (qty > maxAllowed) {
      return toast.error(`Cannot dispatch ${qty}. Maximum available is ${maxAllowed}.`)
    }

    setSavingEdit(true)
    try {
      const unitVal = parseFloat(editForm.unit_value) || 0
      const totalAmount = qty * unitVal
      await managerApi.inventoryTransactions.update(editForm.id, {
        quantity: qty,
        unit_value: unitVal,
        total_amount: totalAmount,
        date: editForm.date,
        reference_number: editForm.reference_number,
        dispatched_to: editForm.dispatched_to,
        remarks: editForm.remarks,
      })
      toast.success('Outward entry updated successfully! Stock recalculated.')
      setEditForm(null)
      window.dispatchEvent(new Event('dashboard-refresh'))
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed')
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete Dispatch
  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await managerApi.inventoryTransactions.delete(deleteId)
      toast.success('Entry deleted and stock restored!')
      setDeleteId(null)
      window.dispatchEvent(new Event('dashboard-refresh'))
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // Aggregated Stats
  const totalQuantity = useMemo(() => items.reduce((s, i) => s + parseInt(i.quantity || 0, 10), 0), [items])
  const totalValue = useMemo(() => items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0), [items])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* Page Header */}
      <PageHeader
        title="📤 Material Outward Entry"
        subtitle="Stock Management • Record distribution, dispatch, and outward stock movements"
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-yellow" style={{ fontSize: 13, padding: '6px 14px' }}>
            Total Dispatched: <strong>{totalQuantity}</strong>
          </span>
          <span className="badge badge-green" style={{ fontSize: 13, padding: '6px 14px' }}>
            Dispatched Value: <strong>{formatINR(totalValue)}</strong>
          </span>
          <button className="btn btn-primary" onClick={() => { setForm(INITIAL_FORM()); setShowModal(true) }}>
            + Dispatch Material
          </button>
        </div>
      </PageHeader>

      {/* Main Content Card */}
      <div className="data-card">
        {/* Filters */}
        <FilterBar search={search} onSearch={setSearch}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: '220px', minWidth: 180 }}
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
            >
              <option value="">All Materials & Stock Items</option>
              {inventoryItems.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.item_name} ({inv.category}) — {inv.quantity_available} {inv.unit}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="form-control"
              style={{ width: '160px' }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by Entry Date"
            />

            {(filterItem || dateFilter || search) && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => {
                  setSearch('')
                  setFilterItem('')
                  setDateFilter('')
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </FilterBar>

        {/* Data Table */}
        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>SERIAL / REF NO</th>
                  <th>ITEM & CATEGORY</th>
                  <th>QTY & UNIT</th>
                  <th>CURRENT STOCK</th>
                  <th>UNIT VALUE</th>
                  <th>TOTAL VALUE</th>
                  <th>DISPATCHED TO</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        icon="📤"
                        title="No material outward entries found"
                        subtitle="Click '+ Dispatch Material' to record stock given out or distributed"
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((i) => {
                    const matchingInv = inventoryItems.find((inv) => inv.id === i.item || inv.item_name === i.item_name)
                    const availableNow = matchingInv ? matchingInv.quantity_available : (i.item_quantity_available ?? '—')
                    const unitName = i.item_unit || matchingInv?.unit || 'pcs'
                    const categoryName = i.item_category || matchingInv?.category || 'General'

                    return (
                      <tr key={i.id}>
                        {/* Date */}
                        <td style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {i.date ? format(new Date(i.date), 'dd MMM yyyy') : format(new Date(i.created_at), 'dd MMM yyyy')}
                        </td>

                        {/* Transaction ID & Ref No */}
                        <td>
                          <span className="td-mono" style={{ fontSize: 11, fontWeight: 600, color: '#1E3A8A' }}>
                            {i.transaction_id}
                          </span>
                          {i.reference_number && (
                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                              Ref: {i.reference_number}
                            </div>
                          )}
                        </td>

                        {/* Item & Category */}
                        <td>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            {i.item_name || matchingInv?.item_name || 'Unknown Item'}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <span className="badge badge-gray" style={{ fontSize: 10, padding: '2px 6px' }}>
                              {categoryName}
                            </span>
                            <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 6px' }}>
                              {unitName}
                            </span>
                          </div>
                        </td>

                        {/* Quantity Dispatched */}
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: '#DC2626',
                              backgroundColor: '#FEE2E2',
                              padding: '3px 8px',
                              borderRadius: 6,
                              display: 'inline-block',
                            }}
                          >
                            -{i.quantity} {unitName}
                          </span>
                        </td>

                        {/* Current Available Stock */}
                        <td>
                          <span
                            className={availableNow > 0 ? 'badge badge-green' : 'badge badge-red'}
                            style={{ fontSize: 11, fontWeight: 600 }}
                          >
                            {availableNow} {unitName} in stock
                          </span>
                        </td>

                        {/* Unit Value */}
                        <td style={{ fontSize: 12, color: '#4B5563' }}>
                          {i.unit_value ? formatINR(i.unit_value) : '—'}
                        </td>

                        {/* Total Value */}
                        <td style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
                          {i.total_amount ? formatINR(i.total_amount) : '—'}
                        </td>

                        {/* Dispatched To */}
                        <td style={{ fontWeight: 500, color: '#1F2937' }}>
                          {i.dispatched_to || '—'}
                        </td>

                        {/* Remarks */}
                        <td style={{ maxWidth: 200, fontSize: 12, color: '#6B7280' }}>
                          {i.remarks || '—'}
                        </td>

                        {/* Actions */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-icon text-primary"
                            style={{ padding: 5 }}
                            onClick={() =>
                              setEditForm({
                                ...i,
                                original_quantity: i.quantity,
                                date: i.date || format(new Date(i.created_at), 'yyyy-MM-dd'),
                              })
                            }
                            title="Edit Entry"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-icon text-danger"
                            style={{ padding: 5, marginLeft: 6 }}
                            onClick={() => setDeleteId(i.id)}
                            title="Delete Entry"
                          >
                            🗑️
                          </button>
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

      {/* DISPATCH MATERIAL MODAL */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="📤 Dispatch Material / Stock Outward"
        size="modal-md"
      >
        <form onSubmit={handleSave}>
          <div className="form-grid-2">
            {/* Date */}
            <div className="form-group">
              <label className="form-label required">Dispatch Date</label>
              <input
                className="form-control"
                type="date"
                required
                value={form.date}
                onChange={(e) => setF('date', e.target.value)}
              />
            </div>

            {/* Reference Number */}
            <div className="form-group">
              <label className="form-label">Reference / Challan No.</label>
              <input
                className="form-control"
                placeholder="e.g. OUT-2026-001 or DC-892"
                value={form.reference_number}
                onChange={(e) => setF('reference_number', e.target.value)}
              />
            </div>

            {/* Item Selector */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Select Item (From Inward Stock)</label>
              <select
                className="form-control"
                required
                value={form.item}
                onChange={(e) => handleItemSelect(e.target.value)}
                style={{ fontSize: 14 }}
              >
                <option value="">-- Choose Stock Item to Dispatch --</option>
                {inventoryItems.map((inv) => (
                  <option key={inv.id} value={inv.id} disabled={inv.quantity_available <= 0}>
                    {inv.item_name} [{inv.category}] — Available: {inv.quantity_available} {inv.unit}
                    {inv.quantity_available <= 0 ? ' (Out of stock)' : ''}
                    {inv.unit_value ? ` | Rate: ₹${inv.unit_value}` : ''}
                  </option>
                ))}
              </select>

              {/* Selected Item Info Card */}
              {selectedInventoryItem && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: selectedInventoryItem.quantity_available > 0 ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${selectedInventoryItem.quantity_available > 0 ? '#BBF7D0' : '#FECACA'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <strong>{selectedInventoryItem.item_name}</strong>
                    <span style={{ color: '#4B5563', marginLeft: 8 }}>({selectedInventoryItem.category})</span>
                  </div>
                  <div>
                    Available Stock:{' '}
                    <strong style={{ color: selectedInventoryItem.quantity_available > 0 ? '#15803D' : '#B91C1C', fontSize: 14 }}>
                      {selectedInventoryItem.quantity_available} {selectedInventoryItem.unit}
                    </strong>
                    {selectedInventoryItem.unit_value && (
                      <span style={{ marginLeft: 12, color: '#374151' }}>
                        Unit Rate: <strong>₹{selectedInventoryItem.unit_value}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="form-group">
              <label className="form-label required">
                Quantity Dispatched {selectedInventoryItem ? `(${selectedInventoryItem.unit})` : ''}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  max={selectedInventoryItem ? selectedInventoryItem.quantity_available : undefined}
                  step="1"
                  required
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setF('quantity', e.target.value)}
                />
                {selectedInventoryItem && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#6B7280',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {selectedInventoryItem.unit}
                  </span>
                )}
              </div>

              {/* Quantity live indicator */}
              {selectedInventoryItem && form.quantity && (
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {parseInt(form.quantity, 10) > selectedInventoryItem.quantity_available ? (
                    <span style={{ color: '#DC2626', fontWeight: 600 }}>
                      ⚠️ Exceeds available stock ({selectedInventoryItem.quantity_available} {selectedInventoryItem.unit})!
                    </span>
                  ) : (
                    <span style={{ color: '#059669' }}>
                      Remaining stock after dispatch: <strong>{selectedInventoryItem.quantity_available - parseInt(form.quantity, 10)} {selectedInventoryItem.unit}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Unit Rate & Computed Total */}
            <div className="form-group">
              <label className="form-label">
                Unit Value (₹)
                {form.quantity && form.unit_value ? (
                  <span style={{ float: 'right', color: '#059669', fontWeight: 600 }}>
                    Total: {formatINR(parseInt(form.quantity || 0, 10) * parseFloat(form.unit_value || 0))}
                  </span>
                ) : null}
              </label>
              <input
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                placeholder="Rate per unit"
                value={form.unit_value}
                onChange={(e) => setF('unit_value', e.target.value)}
              />
            </div>

            {/* Dispatched To */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label required">Dispatched To (Beneficiary / Organization / Camp)</label>
              <input
                className="form-control"
                required
                placeholder="e.g. Flood Relief Camp A, Beneficiary: Ramesh Kumar, or Branch Office"
                value={form.dispatched_to}
                onChange={(e) => setF('dispatched_to', e.target.value)}
              />
            </div>

            {/* Remarks */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Remarks / Purpose</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Distribution purpose, authorization notes, or camp location..."
                value={form.remarks}
                onChange={(e) => setF('remarks', e.target.value)}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer" style={{ padding: 0, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                saving ||
                (selectedInventoryItem &&
                  form.quantity &&
                  parseInt(form.quantity, 10) > selectedInventoryItem.quantity_available)
              }
            >
              {saving ? 'Recording Dispatch...' : 'Confirm & Dispatch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={!!editForm} onClose={() => setEditForm(null)} title="✏️ Edit Outward Entry" size="modal-md">
        {editForm && (
          <form onSubmit={handleEditSave}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label required">Date</label>
                <input
                  className="form-control"
                  type="date"
                  required
                  value={editForm.date || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">
                  Quantity Dispatched ({editInventoryItem?.unit || 'units'})
                </label>
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={editForm.quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Value (₹)</label>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={editForm.unit_value || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit_value: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reference No.</label>
                <input
                  className="form-control"
                  value={editForm.reference_number || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, reference_number: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label required">Dispatched To</label>
                <input
                  className="form-control"
                  required
                  value={editForm.dispatched_to || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, dispatched_to: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={editForm.remarks || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: 0, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditForm(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion" size="modal-sm">
        <div style={{ padding: '10px 0 20px', fontSize: 14, color: '#4B5563', lineHeight: '1.5' }}>
          Are you sure you want to delete this outward entry? The stock quantity will automatically be returned back to active inventory.
        </div>
        <div className="modal-footer" style={{ padding: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            style={{ backgroundColor: '#DC2626', color: 'white', border: 'none' }}
          >
            {deleting ? 'Deleting...' : 'Delete & Restore Stock'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
