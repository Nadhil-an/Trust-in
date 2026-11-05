import React, { useState, useEffect, useCallback } from "react"
import { accountsApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, ConfirmModal, useSecretDelete, SecretDeleteBanner } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function TransactionList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  const {
    secretDeleteMode,
    selectedRowIds,
    deleteConfirmModal,
    setDeleteConfirmModal,
    deleting,
    toggleSelectRow,
    toggleSelectAll,
    confirmDeleteSelected,
    confirmDeleteOne,
    handlePermanentDelete,
  } = useSecretDelete({
    items,
    itemName: 'transaction record',
    onDelete: async (itemsToDelete) => {
      for (const it of itemsToDelete) {
        if (accountsApi.transactions.delete) {
          await accountsApi.transactions.delete(it.id);
        }
      }
    },
    reload: load,
  });

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await accountsApi.transactions.list({search, transaction_type:typeFilter}); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search, typeFilter])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  return (
    <div>
      <PageHeader title="Transaction Register" subtitle="Complete financial transaction history" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch}>
          <select className="filter-select" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {["INCOME","EXPENSE","DISBURSEMENT","SALARY","TRANSFER"].map(t=><option key={t}>{t}</option>)}
          </select>
        </FilterBar>
        <SecretDeleteBanner
          secretDeleteMode={secretDeleteMode}
          selectedRowIds={selectedRowIds}
          onDeleteSelected={() => confirmDeleteSelected(items)}
          itemName="transactions"
        />

        {loading ? <LoadingState /> : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                {secretDeleteMode && (
                  <th style={{ width: 44, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedRowIds.length === items.length && items.length > 0}
                      onChange={() => toggleSelectAll(items)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </th>
                )}
                <th>Txn ID</th><th>Date</th><th>Type</th><th>Description</th><th>Debit (₹)</th><th>Credit (₹)</th><th>Account</th><th>Reference</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={8}><EmptyState icon="📋" title="No transactions" /></td></tr>
                  : items.map(t=>(
                  <tr key={t.id} style={{ background: selectedRowIds.includes(t.id) ? '#FEF2F2' : undefined }}>
                    {secretDeleteMode && (
                      <td style={{ textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRowIds.includes(t.id)}
                          onChange={(ev) => toggleSelectRow(t.id, ev)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    <td className="td-mono">{t.transaction_id}</td>
                    <td>{t.date ? format(new Date(t.date),"dd MMM yyyy") : "-"}</td>
                    <td><span className="badge badge-blue">{t.transaction_type}</span></td>
                    <td>{t.description}</td>
                    <td>{t.debit ? <AmountDisplay amount={t.debit} type="debit" /> : "-"}</td>
                    <td>{t.credit ? <AmountDisplay amount={t.credit} type="credit" /> : "-"}</td>
                    <td><span className="badge badge-gray">{t.account_type}</span></td>
                    <td className="td-mono" style={{fontSize:11}}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span>{t.reference_id || "-"}</span>
                        {secretDeleteMode && (
                          <button
                            className="btn btn-sm"
                            style={{ backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: 11, padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                            onClick={(ev) => confirmDeleteOne(t, ev)}
                          >
                            Delete
                          </button>
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
      <ConfirmModal
        isOpen={deleteConfirmModal.open}
        onClose={() => !deleting && setDeleteConfirmModal({ open: false, items: [] })}
        onConfirm={handlePermanentDelete}
        title="⚠️ Confirm Permanent Database Deletion"
        message={`Are you sure you want to permanently delete ${deleteConfirmModal.items.length} transaction record(s) from the database? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Permanently Delete"}
        isDanger={true}
      />
    </div>
  )
}
