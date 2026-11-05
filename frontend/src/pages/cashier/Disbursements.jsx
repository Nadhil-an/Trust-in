import React, { useState, useEffect, useCallback } from "react"
import { cashierApi } from "../../api"
import { AmountDisplay, LoadingState, EmptyState, PageHeader, FilterBar, ConfirmModal, useSecretDelete, SecretDeleteBanner } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"

export default function DisbursementList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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
    itemName: 'payout record',
    onDelete: async (itemsToDelete) => {
      for (const it of itemsToDelete) {
        if (cashierApi.deleteDisbursement) {
          await cashierApi.deleteDisbursement(it.id);
        }
      }
    },
    reload: () => load(),
  });

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await cashierApi.disbursements({search}); setItems(res.data.results || res.data) }
    catch (_) { toast.error("Load failed") } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  return (
    <div>
      <PageHeader title="Payout History" subtitle="All completed payouts" />
      <div className="data-card">
        <FilterBar search={search} onSearch={setSearch} />
        <SecretDeleteBanner
          secretDeleteMode={secretDeleteMode}
          selectedRowIds={selectedRowIds}
          onDeleteSelected={() => confirmDeleteSelected(items)}
          itemName="payout records"
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
                <th>Payout ID</th><th>Request No</th><th>Purpose</th><th>Amount</th><th>Receiver</th><th>Method</th><th>Voucher</th><th>Paid By</th><th>Date</th></tr></thead>
              <tbody>
                {items.length===0 ? <tr><td colSpan={9}><EmptyState icon="💸" title="No payouts" /></td></tr>
                  : items.map(d=>(
                  <tr key={d.id} style={{ background: selectedRowIds.includes(d.id) ? '#FEF2F2' : undefined }}>
                    {secretDeleteMode && (
                      <td style={{ textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRowIds.includes(d.id)}
                          onChange={(ev) => toggleSelectRow(d.id, ev)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    <td className="td-mono">{d.disbursement_id}</td>
                    <td className="td-mono">{d.request_number}</td>
                    <td>{d.request_purpose}</td>
                    <td><AmountDisplay amount={d.amount_disbursed} type="debit" /></td>
                    <td>{d.receiver_name}</td>
                    <td><span className="badge badge-gray">{d.payment_method}</span></td>
                    <td>{d.voucher_number || "-"}</td>
                    <td>{d.disbursed_by?.full_name || "-"}</td>
                    <td style={{fontSize:12,color:"var(--gray-500)"}}>{d.date ? format(new Date(d.date),"dd MMM yyyy") : "-"}</td>
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
        message={`Are you sure you want to permanently delete ${deleteConfirmModal.items.length} payout record(s) from the database? This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Permanently Delete"}
        isDanger={true}
      />
    </div>
  )
}
