import React, { useState, useCallback, useEffect, useMemo } from "react"
import { hrApi } from "../../api"
import { LoadingState, EmptyState, PageHeader, Modal } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { isValidPhone, isValidEmail } from "../../utils/validators"

const init = {
  full_name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  blood_group: "O+",
  occupation: "",
  address: "",
  skills: "",
  availability: "WEEKENDS",
  joining_date: format(new Date(), "yyyy-MM-dd"),
  status: "ACTIVE",
  notes: ""
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

export default function Volunteers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL") // ALL, PENDING, ACTIVE, REJECTED

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewItem, setViewItem] = useState(null)
  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)

  // Document/Aadhaar Preview Modal
  const [proofPreviewModal, setProofPreviewModal] = useState({ open: false, url: '', name: '' })

  // Rejection Reason Modal
  const [rejectModal, setRejectModal] = useState({ open: false, item: null, reason: '' })
  const [rejecting, setRejecting] = useState(false)

  // Approval Loading state
  const [approvingId, setApprovingId] = useState(null)

  // Secret delete mode state (Ctrl + Shift + Q)
  const [secretDeleteMode, setSecretDeleteMode] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState([])
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, items: [] })
  const [deleting, setDeleting] = useState(false)

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hrApi.volunteers.list({ search })
      setItems(res.data.results || res.data)
    } catch (_) {
      toast.error("Failed to load volunteers")
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  // Real-time synchronization
  useEffect(() => {
    const handleRefresh = () => load()
    window.addEventListener('dashboard-refresh', handleRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleRefresh)
  }, [load])

  // Secret key combination: Ctrl + Shift + Q
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        setSecretDeleteMode((prev) => {
          const next = !prev;
          if (next) {
            toast('🚨 Secret Delete Mode ENABLED. Select rows or click Delete to permanently erase data.', {
              id: 'secret-delete-mode',
              icon: '🗑️',
              duration: 4000,
              style: {
                borderRadius: '8px',
                background: '#18181B',
                color: '#EF4444',
                fontWeight: '700',
                border: '1px solid #DC2626'
              }
            });
          } else {
            toast.success('Secret Delete Mode DISABLED', { id: 'secret-delete-mode' });
          }
          return next;
        });
        setSelectedRowIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSelectRow = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filtered) => {
    if (selectedRowIds.length === filtered.length && filtered.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filtered.map(i => i.id));
    }
  };

  const handlePermanentDelete = async () => {
    const itemsToDelete = deleteConfirmModal.items || [];
    if (itemsToDelete.length === 0) return;
    setDeleting(true);
    try {
      for (const item of itemsToDelete) {
        await hrApi.volunteers.delete(item.id);
      }
      toast.success(
        itemsToDelete.length === 1
          ? `Volunteer "${itemsToDelete[0].full_name}" permanently deleted.`
          : `${itemsToDelete.length} volunteers permanently deleted.`
      );
      setSelectedRowIds(prev => prev.filter(id => !itemsToDelete.some(it => it.id === id)));
      setDeleteConfirmModal({ open: false, items: [] });
      load();
    } catch (err) {
      toast.error('Failed to delete: ' + (err.response?.data?.error || err.message || 'Server error'));
    } finally {
      setDeleting(false);
    }
  };

  // ERP Action: Approve Volunteer Application
  const handleApprove = async (volunteer) => {
    if (!volunteer) return;
    setApprovingId(volunteer.id);
    try {
      await hrApi.volunteers.approve(volunteer.id);
      toast.success(`🎉 ${volunteer.full_name} (${volunteer.volunteer_id}) has been APPROVED as an official Volunteer! Mobile notification sent.`);
      load();
      if (showViewModal) setShowViewModal(false);
    } catch (err) {
      toast.error("Failed to approve application: " + (err.response?.data?.detail || err.message));
    } finally {
      setApprovingId(null);
    }
  };

  // ERP Action: Reject Volunteer Application
  const handleRejectConfirm = async () => {
    const item = rejectModal.item;
    if (!item) return;
    setRejecting(true);
    try {
      await hrApi.volunteers.reject(item.id, { reason: rejectModal.reason });
      toast.success(`Application for ${item.full_name} has been rejected.`);
      setRejectModal({ open: false, item: null, reason: '' });
      load();
      if (showViewModal) setShowViewModal(false);
    } catch (err) {
      toast.error("Failed to reject application: " + (err.response?.data?.detail || err.message));
    } finally {
      setRejecting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email");

    setSaving(true)
    try {
      if (selected) await hrApi.volunteers.update(selected.id, form)
      else await hrApi.volunteers.create(form)
      toast.success("Saved volunteer details.");
      setShowModal(false);
      load();
    } catch (_) {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  // Summary Metrics
  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter(v => v.status === "PENDING").length;
    const active = items.filter(v => v.status === "ACTIVE").length;
    const rejected = items.filter(v => v.status === "REJECTED" || v.status === "INACTIVE" || v.status === "SUSPENDED").length;
    return { total, pending, active, rejected };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "PENDING") return item.status === "PENDING";
      if (statusFilter === "ACTIVE") return item.status === "ACTIVE";
      if (statusFilter === "REJECTED") return item.status === "REJECTED" || item.status === "INACTIVE" || item.status === "SUSPENDED";
      return true;
    });
  }, [items, statusFilter]);

  return (
    <div style={{ paddingBottom: '2.5rem' }}>
      {/* Page Header */}
      <PageHeader
        title="Volunteers Management"
        subtitle="Review volunteer applications, verify Aadhaar proofs, approve volunteers, and issue digital cards."
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={load} title="Refresh records">
            🔄 Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSelected(null);
              setForm(init);
              setShowModal(true);
            }}
          >
            + Add Volunteer
          </button>
        </div>
      </PageHeader>

      {/* Standard ERP KPI Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Volunteers */}
        <div
          onClick={() => setStatusFilter("ALL")}
          style={{
            backgroundColor: '#FFFFFF',
            border: statusFilter === "ALL" ? '2px solid #0284C7' : '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
              Total Applicants
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
              {stats.total}
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#F0F9FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🙋
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => setStatusFilter("PENDING")}
          style={{
            backgroundColor: '#FFFBEB',
            border: statusFilter === "PENDING" ? '2px solid #D97706' : '1px solid #FDE68A',
            borderRadius: 12,
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              Pending Approvals
              {stats.pending > 0 && (
                <span style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: 10,
                  padding: '2px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 800
                }}>
                  {stats.pending} NEW
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#92400E', marginTop: 4 }}>
              {stats.pending}
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            ⏳
          </div>
        </div>

        {/* Active Volunteers */}
        <div
          onClick={() => setStatusFilter("ACTIVE")}
          style={{
            backgroundColor: '#F0FDF4',
            border: statusFilter === "ACTIVE" ? '2px solid #16A34A' : '1px solid #BBF7D0',
            borderRadius: 12,
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase' }}>
              Active Volunteers
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#166534', marginTop: 4 }}>
              {stats.active}
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#DCFCE7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            ✅
          </div>
        </div>

        {/* Rejected / Other */}
        <div
          onClick={() => setStatusFilter("REJECTED")}
          style={{
            backgroundColor: '#FFFFFF',
            border: statusFilter === "REJECTED" ? '2px solid #64748B' : '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '1rem 1.25rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
              Rejected / Inactive
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#475569', marginTop: 4 }}>
              {stats.rejected}
            </div>
          </div>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🚫
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="data-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
        {/* Secret Permanent Deletion Alert Banner */}
        {secretDeleteMode && (
          <div style={{
            background: 'linear-gradient(90deg, #FEF2F2 0%, #FFF1F2 100%)',
            border: '1.5px dashed #EF4444',
            borderRadius: 10,
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>🚨</span>
              <div>
                <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.9rem', letterSpacing: 0.5 }}>
                  SECRET PERMANENT DATABASE DELETION MODE ACTIVE
                </div>
                <div style={{ fontSize: '0.8rem', color: '#7F1D1D', marginTop: 2 }}>
                  Records deleted here are <strong>permanently purged</strong> from the database. Press <code>Ctrl + Shift + Q</code> again to exit.
                </div>
              </div>
            </div>

            {selectedRowIds.length > 0 && (
              <button
                className="btn"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '7px 16px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
                  cursor: 'pointer'
                }}
                onClick={() => setDeleteConfirmModal({
                  open: true,
                  items: items.filter(i => selectedRowIds.includes(i.id))
                })}
              >
                <span>🗑️</span>
                <span>Permanently Delete Selected ({selectedRowIds.length})</span>
              </button>
            )}
          </div>
        )}

        {/* Filter Navigation Tabs + Search Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '1rem'
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter("ALL")}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === "ALL" ? '#0F172A' : '#F1F5F9',
                color: statusFilter === "ALL" ? '#FFFFFF' : '#475569',
              }}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === "PENDING" ? '#D97706' : '#FEF3C7',
                color: statusFilter === "PENDING" ? '#FFFFFF' : '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              ⏳ Pending ({stats.pending})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === "ACTIVE" ? '#16A34A' : '#DCFCE7',
                color: statusFilter === "ACTIVE" ? '#FFFFFF' : '#166534',
              }}
            >
              ✅ Active ({stats.active})
            </button>
            <button
              onClick={() => setStatusFilter("REJECTED")}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === "REJECTED" ? '#64748B' : '#F1F5F9',
                color: statusFilter === "REJECTED" ? '#FFFFFF' : '#475569',
              }}
            >
              Rejected ({stats.rejected})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ minWidth: 260 }}>
            <input
              type="text"
              placeholder="Search by ID, name, phone, blood group..."
              className="form-control"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '7px 12px' }}
            />
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {secretDeleteMode && (
                    <th style={{ width: 44, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.length === filteredItems.length && filteredItems.length > 0}
                        onChange={() => toggleSelectAll(filteredItems)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                        title="Select All"
                      />
                    </th>
                  )}
                  <th>ID</th>
                  <th>Volunteer / Applicant</th>
                  <th>Contact Info</th>
                  <th>Blood Group</th>
                  <th>Occupation</th>
                  <th>Address Proof</th>
                  <th>Status</th>
                  <th>Applied On</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={secretDeleteMode ? 10 : 9}>
                      <EmptyState
                        icon="🙋"
                        title={statusFilter === "PENDING" ? "No pending volunteer applications" : "No volunteers found"}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(v => {
                    const isRowSelected = selectedRowIds.includes(v.id);
                    const isPending = v.status === "PENDING";
                    const isActive = v.status === "ACTIVE";
                    const isRejected = v.status === "REJECTED";

                    return (
                      <tr
                        key={v.id}
                        onClick={() => {
                          if (secretDeleteMode) {
                            toggleSelectRow(v.id);
                          } else {
                            setViewItem(v);
                            setShowViewModal(true);
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isRowSelected ? '#FEF2F2' : isPending ? '#FFFDF5' : undefined
                        }}
                        className="hover-row"
                      >
                        {secretDeleteMode && (
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={(e) => toggleSelectRow(v.id, e)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {/* ID */}
                        <td className="td-mono" style={{ fontWeight: 700, color: isPending ? '#D97706' : '#0284C7' }}>
                          {v.volunteer_id}
                        </td>

                        {/* Volunteer Name & Photo */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {v.photo ? (
                              <img
                                src={v.photo}
                                alt={v.full_name}
                                style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover', border: '1px solid #CBD5E1' }}
                              />
                            ) : (
                              <div style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: isPending ? '#FEF3C7' : '#E0F2FE',
                                color: isPending ? '#B45309' : '#0284C7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}>
                                {v.full_name ? v.full_name.charAt(0).toUpperCase() : 'V'}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: '#0F172A' }}>{v.full_name}</div>
                              {v.skills ? (
                                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{v.skills}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{v.phone}</div>
                          {v.email ? (
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{v.email}</div>
                          ) : null}
                        </td>

                        {/* Blood Group */}
                        <td>
                          {v.blood_group ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              backgroundColor: '#FEE2E2',
                              color: '#991B1B',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: '0.75rem',
                              fontWeight: 800
                            }}>
                              🩸 {v.blood_group}
                            </span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>

                        {/* Occupation */}
                        <td style={{ fontSize: '0.82rem', color: '#334155' }}>
                          {v.occupation || v.availability || '-'}
                        </td>

                        {/* Address Proof / Aadhaar */}
                        <td onClick={e => e.stopPropagation()}>
                          {v.address_proof ? (
                            <button
                              className="btn btn-sm"
                              style={{
                                backgroundColor: '#F0FDF4',
                                color: '#166534',
                                border: '1px solid #BBF7D0',
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: 'pointer'
                              }}
                              onClick={() => setProofPreviewModal({
                                open: true,
                                url: v.address_proof,
                                name: `${v.full_name} - Aadhaar / Address Proof`
                              })}
                            >
                              📄 View Aadhaar
                            </button>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>No proof</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          {isPending ? (
                            <span style={{
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              padding: '4px 10px',
                              borderRadius: 12,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              ⏳ PENDING APPROVAL
                            </span>
                          ) : isActive ? (
                            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              ✅ ACTIVE
                            </span>
                          ) : isRejected ? (
                            <span style={{
                              backgroundColor: '#FEE2E2',
                              color: '#991B1B',
                              padding: '4px 10px',
                              borderRadius: 12,
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              ❌ REJECTED
                            </span>
                          ) : (
                            <span className="badge badge-gray">{v.status}</span>
                          )}
                        </td>

                        {/* Applied Date */}
                        <td style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          {v.created_at ? format(new Date(v.created_at), "dd MMM yyyy") : format(new Date(v.joining_date), "dd MMM yyyy")}
                        </td>

                        {/* ERP Actions */}
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            {isPending && (
                              <>
                                <button
                                  className="btn btn-sm"
                                  disabled={approvingId === v.id}
                                  style={{
                                    backgroundColor: '#16A34A',
                                    color: '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    border: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleApprove(v)}
                                >
                                  {approvingId === v.id ? 'Approving...' : '✓ Approve'}
                                </button>
                                <button
                                  className="btn btn-sm"
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#DC2626',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    border: '1px solid #FECACA',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => setRejectModal({ open: true, item: v, reason: '' })}
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setViewItem(v);
                                setShowViewModal(true);
                              }}
                            >
                              View Details
                            </button>

                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setSelected(v);
                                setForm({ ...v });
                                setShowModal(true);
                              }}
                            >
                              Edit
                            </button>

                            {secretDeleteMode && (
                              <button
                                className="btn btn-sm"
                                style={{
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                                onClick={() => setDeleteConfirmModal({ open: true, items: [v] })}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={selected ? `Edit Volunteer (${selected.volunteer_id})` : "Add New Volunteer"}
          size="modal-lg"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" form="vol-form" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Details"}
              </button>
            </>
          }
        >
          <form id="vol-form" onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label required">Full Name</label>
                <input
                  className="form-control"
                  required
                  value={form.full_name}
                  onChange={e => F("full_name", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Phone Number</label>
                <input
                  className="form-control"
                  required
                  value={form.phone}
                  onChange={e => F("phone", e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-control"
                  type="email"
                  value={form.email}
                  onChange={e => F("email", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.date_of_birth || ''}
                  onChange={e => F("date_of_birth", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select
                  className="form-control"
                  value={form.blood_group || 'O+'}
                  onChange={e => F("blood_group", e.target.value)}
                >
                  {BLOOD_GROUPS.map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Occupation / Profession</label>
                <input
                  className="form-control"
                  value={form.occupation || ''}
                  onChange={e => F("occupation", e.target.value)}
                  placeholder="e.g. Engineer, Teacher, Student"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Joining / Application Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.joining_date}
                  onChange={e => F("joining_date", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={form.status}
                  onChange={e => F("status", e.target.value)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PENDING">PENDING</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Residential Address</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.address || ''}
                onChange={e => F("address", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Skills & Specializations</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.skills || ''}
                onChange={e => F("skills", e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Comprehensive View / Details Modal */}
      {showViewModal && viewItem && (
        <Modal
          isOpen={true}
          onClose={() => setShowViewModal(false)}
          title={`Volunteer Profile — ${viewItem.full_name} (${viewItem.volunteer_id})`}
          size="modal-lg"
          footer={
            <>
              {viewItem.status === "PENDING" && (
                <>
                  <button
                    className="btn btn-sm"
                    style={{
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                    disabled={approvingId === viewItem.id}
                    onClick={() => handleApprove(viewItem)}
                  >
                    {approvingId === viewItem.id ? 'Approving...' : '✓ Approve Volunteer Application'}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      fontWeight: 700,
                      border: '1px solid #FECACA',
                      padding: '8px 14px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setRejectModal({ open: true, item: viewItem, reason: '' });
                    }}
                  >
                    Reject Application
                  </button>
                </>
              )}

              {secretDeleteMode && (
                <button
                  className="btn btn-sm"
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    marginRight: 'auto',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowViewModal(false);
                    setDeleteConfirmModal({ open: true, items: [viewItem] });
                  }}
                >
                  🗑️ Permanently Delete
                </button>
              )}

              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Close
              </button>

              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowViewModal(false);
                  setSelected(viewItem);
                  setForm({ ...viewItem });
                  setShowModal(true);
                }}
              >
                Edit Volunteer
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Profile Summary */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              backgroundColor: '#F8FAFC',
              padding: '1rem',
              borderRadius: 10,
              border: '1px solid #E2E8F0'
            }}>
              {viewItem.photo ? (
                <img
                  src={viewItem.photo}
                  alt={viewItem.full_name}
                  style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover', border: '2px solid #0284C7' }}
                />
              ) : (
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#E0F2FE',
                  color: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 800
                }}>
                  {viewItem.full_name ? viewItem.full_name.charAt(0).toUpperCase() : 'V'}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                    {viewItem.full_name}
                  </h3>
                  <span className="td-mono" style={{ backgroundColor: '#E2E8F0', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700 }}>
                    {viewItem.volunteer_id}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 4 }}>
                  {viewItem.occupation || 'Volunteer Applicant'} • Joined {viewItem.joining_date}
                </div>
                <div style={{ marginTop: 6 }}>
                  {viewItem.status === "PENDING" ? (
                    <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}>
                      ⏳ APPLICATION PENDING APPROVAL
                    </span>
                  ) : viewItem.status === "ACTIVE" ? (
                    <span className="badge badge-green">✅ OFFICIAL VOLUNTEER (ACTIVE)</span>
                  ) : (
                    <span className="badge badge-gray">{viewItem.status}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Grid Information */}
            <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Phone Number</strong>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{viewItem.phone || '-'}</div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Email Address</strong>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{viewItem.email || '-'}</div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Blood Group</strong>
                <div style={{ fontWeight: 700, color: '#DC2626' }}>🩸 {viewItem.blood_group || 'N/A'}</div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Date of Birth</strong>
                <div style={{ fontWeight: 600 }}>{viewItem.date_of_birth || '-'}</div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Occupation</strong>
                <div style={{ fontWeight: 600 }}>{viewItem.occupation || '-'}</div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Total Hours Contributed</strong>
                <div style={{ fontWeight: 700, color: '#16A34A' }}>{viewItem.total_hours || '0.0'} hrs</div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase' }}>Residential Address</strong>
                <div style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, fontSize: '0.88rem' }}>
                  {viewItem.address || '-'}
                </div>
              </div>

              {/* Address Proof / Aadhaar Section */}
              <div style={{ gridColumn: '1 / -1' }}>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                  Attached Address Proof / Aadhaar Card
                </strong>
                {viewItem.address_proof ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.4rem' }}>📄</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534' }}>
                          Aadhaar / Identity Proof Document Attached
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#15803D' }}>Click below to preview or verify</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setProofPreviewModal({
                        open: true,
                        url: viewItem.address_proof,
                        name: `${viewItem.full_name} - Aadhaar Document`
                      })}
                    >
                      🔍 View Document
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: 10, backgroundColor: '#F1F5F9', borderRadius: 6, fontSize: '0.85rem', color: '#64748B' }}>
                    No identity or address document uploaded.
                  </div>
                )}
              </div>

              {viewItem.rejection_reason ? (
                <div style={{ gridColumn: '1 / -1', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 6, border: '1px solid #FECACA' }}>
                  <strong style={{ display: 'block', fontSize: '0.75rem', color: '#991B1B', textTransform: 'uppercase' }}>Rejection Reason</strong>
                  <div style={{ fontSize: '0.85rem', color: '#B91C1C', marginTop: 2 }}>{viewItem.rejection_reason}</div>
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      )}

      {/* Aadhaar / Document Preview Modal */}
      {proofPreviewModal.open && (
        <Modal
          isOpen={true}
          onClose={() => setProofPreviewModal({ open: false, url: '', name: '' })}
          title={proofPreviewModal.name || "Aadhaar Card / Address Proof Preview"}
          size="modal-lg"
          footer={
            <>
              <a
                href={proofPreviewModal.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                🔗 Open Original in New Tab
              </a>
              <button
                className="btn btn-primary"
                onClick={() => setProofPreviewModal({ open: false, url: '', name: '' })}
              >
                Close Preview
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center', maxHeight: '70vh', overflowY: 'auto', padding: '0.5rem' }}>
            <img
              src={proofPreviewModal.url}
              alt="Proof Document"
              style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
          </div>
        </Modal>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal.open && (
        <Modal
          isOpen={true}
          onClose={() => !rejecting && setRejectModal({ open: false, item: null, reason: '' })}
          title={`Reject Volunteer Application — ${rejectModal.item?.full_name}`}
          size="modal-md"
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={rejecting}
                onClick={() => setRejectModal({ open: false, item: null, reason: '' })}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={rejecting}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={handleRejectConfirm}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </>
          }
        >
          <div>
            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: 12 }}>
              Please specify the reason for rejecting <strong>{rejectModal.item?.full_name}</strong>'s application. This will be sent as a notification to the applicant.
            </p>
            <div className="form-group">
              <label className="form-label required">Reason for Rejection</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Incomplete address proof / Aadhaar image unclear. Please re-upload with clear photo."
                value={rejectModal.reason}
                onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Permanent Deletion Confirmation Modal */}
      {deleteConfirmModal.open && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setDeleteConfirmModal({ open: false, items: [] })}
          title="⚠️ Confirm Permanent Database Deletion"
          size="modal-md"
          footer={
            <>
              <button
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirmModal({ open: false, items: [] })}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={deleting}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={handlePermanentDelete}
              >
                {deleting ? 'Purging from Database...' : 'Permanently Delete Now'}
              </button>
            </>
          }
        >
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              color: '#991B1B',
              fontSize: '0.85rem'
            }}>
              <strong>WARNING:</strong> This action is completely permanent and cannot be reversed. The selected record(s) will be completely removed from the database.
            </div>

            <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 8, fontWeight: 600 }}>
              Are you sure you want to delete the following {deleteConfirmModal.items.length === 1 ? 'volunteer' : `${deleteConfirmModal.items.length} volunteers`}?
            </p>

            <ul style={{ maxHeight: 180, overflowY: 'auto', paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#4B5563' }}>
              {deleteConfirmModal.items.map(it => (
                <li key={it.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{it.full_name}</span> (ID: <span className="td-mono">{it.volunteer_id}</span>, Phone: {it.phone})
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
