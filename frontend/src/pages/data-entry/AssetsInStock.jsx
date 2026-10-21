// pages/data-entry/AssetsInStock.jsx — Stock Management: Assets in Stock
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi } from '../../api'
import { PageHeader, FilterBar, LoadingState, EmptyState, Modal, formatINR } from '../../components/shared'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function AssetsInStock() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('IN_STOCK') // 'ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'

  // Detail Modal
  const [selectedProduct, setSelectedProduct] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await managerApi.inventory.list({
        show_expired: true,
      })
      const list = res.data.results || res.data || []
      setItems(list)
    } catch {
      toast.error('Failed to load assets in stock')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Listen for real-time dashboard refreshes
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  // Extract unique categories present in current active stock
  const uniqueCategories = useMemo(() => {
    const map = new Map()
    items.forEach((i) => {
      const qty = parseInt(i.quantity_available || 0, 10)
      if (statusFilter === 'IN_STOCK' && qty <= 0) return
      if (statusFilter === 'LOW_STOCK' && (qty <= 0 || qty > 5)) return
      if (statusFilter === 'OUT_OF_STOCK' && qty !== 0) return

      const cat = (i.category || 'General').trim()
      map.set(cat, (map.get(cat) || 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items, statusFilter])

  const totalCategoryStockCount = useMemo(() => {
    return uniqueCategories.reduce((acc, [_, count]) => acc + count, 0)
  }, [uniqueCategories])

  // Filtered items based on search, categoryFilter, and statusFilter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const qty = parseInt(item.quantity_available || 0, 10)

      // Status Filter
      if (statusFilter === 'IN_STOCK' && qty <= 0) return false
      if (statusFilter === 'LOW_STOCK' && (qty <= 0 || qty > 5)) return false
      if (statusFilter === 'OUT_OF_STOCK' && qty !== 0) return false

      // Category Filter
      if (categoryFilter !== 'ALL') {
        const itemCat = (item.category || '').trim().toLowerCase()
        const selectedCat = categoryFilter.trim().toLowerCase()
        if (itemCat !== selectedCat) return false
      }

      // Search Query
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchName = (item.item_name || '').toLowerCase().includes(q)
        const matchCode = (item.item_code || '').toLowerCase().includes(q)
        const matchCat = (item.category || '').toLowerCase().includes(q)
        const matchDonor = (item.donor_name || '').toLowerCase().includes(q)
        const matchVendor = (item.vendor_name || '').toLowerCase().includes(q)
        const matchNotes = (item.notes || '').toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchCat && !matchDonor && !matchVendor && !matchNotes) {
          return false
        }
      }

      return true
    })
  }, [items, search, categoryFilter, statusFilter])

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let inStockItemsCount = 0
    let totalUnits = 0
    let totalValuation = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    items.forEach((item) => {
      const qty = parseInt(item.quantity_available || 0, 10)
      const val = parseFloat(item.unit_value || 0)
      if (qty > 0) {
        inStockItemsCount += 1
        totalUnits += qty
        totalValuation += qty * val
        if (qty <= 5) lowStockCount += 1
      } else {
        outOfStockCount += 1
      }
    })

    return { inStockItemsCount, totalUnits, totalValuation, lowStockCount, outOfStockCount }
  }, [items])

  // Stock status pill helper
  const getStockStatusPill = (qty) => {
    if (qty <= 0) {
      return (
        <span
          style={{
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          Out of Stock
        </span>
      )
    }
    if (qty <= 5) {
      return (
        <span
          style={{
            backgroundColor: '#FEF3C7',
            color: '#D97706',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          Low Stock ({qty})
        </span>
      )
    }
    return (
      <span
        style={{
          backgroundColor: '#DCFCE7',
          color: '#15803D',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 6,
        }}
      >
        In Stock ({qty})
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <PageHeader
        title="📦 Assets in Stock"
        subtitle="Stock Management • View currently available items, stock levels & product details"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/slt/entry/inward')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>📥</span> Add Inward / Purchase
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/slt/entry/material-outward')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>📤</span> Dispatch Material Outward
          </button>
        </div>
      </PageHeader>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="data-card" style={{ padding: '16px 20px', borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
            Active Stock Items
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E3A8A', marginTop: 4 }}>
            {metrics.inStockItemsCount}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Distinct products in warehouse</div>
        </div>

        <div className="data-card" style={{ padding: '16px 20px', borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
            Total Stock Quantity
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#065F46', marginTop: 4 }}>
            {metrics.totalUnits} <span style={{ fontSize: 14, fontWeight: 600 }}>units</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Units currently available</div>
        </div>

        <div className="data-card" style={{ padding: '16px 20px', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
            Total Asset Valuation
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#5B21B6', marginTop: 4 }}>
            {formatINR(metrics.totalValuation)}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Total holding value of stock</div>
        </div>

        <div className="data-card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
            Low Stock Alerts
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#92400E', marginTop: 4 }}>
            {metrics.lowStockCount}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Items with 5 or fewer units</div>
        </div>
      </div>

      {/* Filter and View Bar */}
      <div className="data-card" style={{ marginBottom: 16 }}>
        <FilterBar search={search} onSearch={setSearch}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Category Filter */}
            <select
              className="form-control"
              style={{ width: '220px', minWidth: 180 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories ({totalCategoryStockCount})</option>
              {uniqueCategories.map(([catName, count]) => (
                <option key={catName} value={catName}>
                  {catName} ({count})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="form-control"
              style={{ width: '170px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="IN_STOCK">In Stock (&gt; 0)</option>
              <option value="ALL">All Items (Inc. 0)</option>
              <option value="LOW_STOCK">Low Stock (≤ 5)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
            </select>
          </div>
        </FilterBar>

        {/* Quick Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid #F1F5F9',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginRight: 4,
            }}
          >
            Filter by Category:
          </span>

          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${categoryFilter === 'ALL' ? '#2563EB' : '#E2E8F0'}`,
              backgroundColor: categoryFilter === 'ALL' ? '#2563EB' : '#FFFFFF',
              color: categoryFilter === 'ALL' ? '#FFFFFF' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Categories ({totalCategoryStockCount})
          </button>

          {uniqueCategories.map(([catName, count]) => {
            const isSelected = categoryFilter.toLowerCase() === catName.toLowerCase()
            return (
              <button
                key={catName}
                type="button"
                onClick={() => setCategoryFilter(isSelected ? 'ALL' : catName)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: `1px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
                  backgroundColor: isSelected ? '#2563EB' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{catName}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#1D4ED8' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#64748B',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState />
      ) : filteredItems.length === 0 ? (
        <div className="data-card">
          <EmptyState
            icon="📦"
            title="No inventory assets found"
            subtitle="No items match your search or filter criteria. Add stock through Inward / Purchase entry."
          />
        </div>
      ) : (
        /* GRID / CARDS VIEW */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {filteredItems.map((item) => {
            const qty = parseInt(item.quantity_available || 0, 10)
            const unitVal = parseFloat(item.unit_value || 0)
            const totalWorth = qty * unitVal

            return (
              <div
                key={item.id}
                className="data-card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: 10,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  border: qty === 0 ? '1px solid #FECACA' : qty <= 5 ? '1px solid #FDE68A' : '1px solid #E5E7EB',
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* Top Badges */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <span className="td-mono" style={{ fontSize: 11, fontWeight: 700, color: '#4B5563' }}>
                      {item.item_code}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>
                        {item.category}
                      </span>
                      {getStockStatusPill(qty)}
                    </div>
                  </div>

                  {/* Image & Title */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.item_name}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          objectFit: 'cover',
                          border: '1px solid #E5E7EB',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          backgroundColor: '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          flexShrink: 0,
                        }}
                      >
                        📦
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3 }}>
                        {item.item_name}
                      </h3>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                        Source:{' '}
                        <span style={{ fontWeight: 600, color: '#374151' }}>
                          {item.source_type === 'PURCHASE' ? '🛒 Purchase' : '💝 Inward Donation'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock Quantity Highlight Box */}
                  <div
                    style={{
                      backgroundColor: qty > 0 ? '#F8FAFC' : '#FEF2F2',
                      border: `1px solid ${qty > 0 ? '#E2E8F0' : '#FECACA'}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                        Available In Stock
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          color: qty > 0 ? '#0F172A' : '#DC2626',
                          marginTop: 2,
                        }}
                      >
                        {qty}{' '}
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{item.unit}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                        Rate / Value
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                        {unitVal > 0 ? formatINR(unitVal) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Total: <strong>{totalWorth > 0 ? formatINR(totalWorth) : '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Contributor / Donor / Expiry Info */}
                  <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.5, marginBottom: 12 }}>
                    {item.donor_name && (
                      <div>
                        <strong>Donor:</strong> {item.donor_name}{' '}
                        {item.donor_phone && <span style={{ color: '#6B7280' }}>({item.donor_phone})</span>}
                      </div>
                    )}
                    {item.vendor_name && (
                      <div>
                        <strong>Vendor:</strong> {item.vendor_name}{' '}
                        {item.vendor_phone && <span style={{ color: '#6B7280' }}>({item.vendor_phone})</span>}
                      </div>
                    )}
                    {item.expiry_date && (
                      <div style={{ marginTop: 2 }}>
                        <strong>Expiry:</strong>{' '}
                        <span
                          style={{
                            fontWeight: 600,
                            color: new Date(item.expiry_date) < new Date() ? '#DC2626' : '#15803D',
                          }}
                        >
                          {format(new Date(item.expiry_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    onClick={() => setSelectedProduct(item)}
                  >
                    🔍 Details
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    disabled={qty <= 0}
                    onClick={() => navigate('/slt/entry/material-outward')}
                  >
                    📤 Dispatch
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PRODUCT INFORMATION DETAIL MODAL */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title="📦 Product & Asset Details"
        size="modal-md"
      >
        {selectedProduct && (
          <div>
            {/* Header / Basic Specs */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                paddingBottom: 16,
                borderBottom: '1px solid #E5E7EB',
                marginBottom: 16,
              }}
            >
              {selectedProduct.image ? (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.item_name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    objectFit: 'cover',
                    border: '1px solid #D1D5DB',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    backgroundColor: '#F3F4F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                  }}
                >
                  📦
                </div>
              )}

              <div>
                <span className="td-mono" style={{ fontSize: 12, fontWeight: 700, color: '#1E3A8A' }}>
                  {selectedProduct.item_code}
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '2px 0 6px' }}>
                  {selectedProduct.item_name}
                </h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="badge badge-gray">{selectedProduct.category}</span>
                  {getStockStatusPill(selectedProduct.quantity_available)}
                </div>
              </div>
            </div>

            {/* Key Information Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <div style={{ padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                  Quantity Available Right Now
                </span>
                <strong style={{ fontSize: 18, color: '#0F172A' }}>
                  {selectedProduct.quantity_available} {selectedProduct.unit}
                </strong>
              </div>

              <div style={{ padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                  Unit Rate / Total Asset Value
                </span>
                <strong style={{ fontSize: 15, color: '#059669' }}>
                  {selectedProduct.unit_value ? formatINR(selectedProduct.unit_value) : '—'} / unit
                </strong>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Total:{' '}
                  <strong>
                    {formatINR(
                      (parseInt(selectedProduct.quantity_available, 10) || 0) *
                        (parseFloat(selectedProduct.unit_value) || 0)
                    )}
                  </strong>
                </div>
              </div>

              <div style={{ padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                  Source Entry Type
                </span>
                <strong style={{ color: '#334155' }}>
                  {selectedProduct.source_type === 'PURCHASE' ? '🛒 Purchase Entry' : '💝 Inward Donation Entry'}
                </strong>
              </div>

              <div style={{ padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>
                  Expiry Date
                </span>
                <strong
                  style={{
                    color:
                      selectedProduct.expiry_date && new Date(selectedProduct.expiry_date) < new Date()
                        ? '#DC2626'
                        : '#334155',
                  }}
                >
                  {selectedProduct.expiry_date
                    ? format(new Date(selectedProduct.expiry_date), 'dd MMMM yyyy')
                    : 'N/A (Non-perishable)'}
                </strong>
              </div>
            </div>

            {/* Donor / Vendor Details Section */}
            {(selectedProduct.donor_name || selectedProduct.vendor_name) && (
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 13,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>
                  {selectedProduct.donor_name ? 'Donor / Contributor Information' : 'Vendor / Supplier Information'}
                </div>
                {selectedProduct.donor_name && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div>
                      <strong>Name:</strong> {selectedProduct.donor_name}
                    </div>
                    <div>
                      <strong>Phone:</strong> {selectedProduct.donor_phone || '—'}
                    </div>
                    {selectedProduct.donor_member && (
                      <div>
                        <strong>Member ID:</strong> {selectedProduct.donor_member}
                      </div>
                    )}
                    {selectedProduct.donor_job && (
                      <div>
                        <strong>Occupation:</strong> {selectedProduct.donor_job}
                      </div>
                    )}
                    {selectedProduct.donor_address && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <strong>Address:</strong> {selectedProduct.donor_address}
                      </div>
                    )}
                  </div>
                )}
                {selectedProduct.vendor_name && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div>
                      <strong>Vendor:</strong> {selectedProduct.vendor_name}
                    </div>
                    <div>
                      <strong>Phone:</strong> {selectedProduct.vendor_phone || '—'}
                    </div>
                    {selectedProduct.vendor_address && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <strong>Address:</strong> {selectedProduct.vendor_address}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes / Description */}
            {selectedProduct.notes && (
              <div style={{ marginBottom: 16, fontSize: 13 }}>
                <span style={{ color: '#64748B', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Remarks / Notes:
                </span>
                <div
                  style={{
                    backgroundColor: '#F9FAFB',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid #F3F4F6',
                    color: '#374151',
                  }}
                >
                  {selectedProduct.notes}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="modal-footer" style={{ padding: 0, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedProduct.quantity_available <= 0}
                onClick={() => {
                  setSelectedProduct(null)
                  navigate('/slt/entry/material-outward')
                }}
              >
                📤 Dispatch Material Outward
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
