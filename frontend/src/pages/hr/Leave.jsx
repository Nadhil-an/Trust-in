import React, { useState, useEffect, useCallback } from "react";
import { hrApi } from "../../api";
import { LoadingState, EmptyState, PageHeader, Modal } from "../../components/shared";
import { useAuthStore } from "../../store/authStore";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function LeavePage() {
  const { user } = useAuthStore();
  const isManagerOrAdmin = user?.role === "MANAGER" || user?.role === "ADMIN";
  const isHR = user?.role === "HR";

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total_pending: 0,
    approved_this_month: 0,
    rejected_count: 0,
    total_count: 0,
  });
  const [loading, setLoading] = useState(true);

  // Dismissible policy banner
  const [policyDismissed, setPolicyDismissed] = useState(() => {
    try {
      return localStorage.getItem("leave_policy_dismissed") === "true";
    } catch (_) {
      return false;
    }
  });

  const handleDismissPolicy = () => {
    setPolicyDismissed(true);
    try {
      localStorage.setItem("leave_policy_dismissed", "true");
    } catch (_) {}
  };

  const handleRestorePolicy = () => {
    setPolicyDismissed(false);
    try {
      localStorage.removeItem("leave_policy_dismissed");
    } catch (_) {}
  };

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState(""); // '1'..'12'
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  // Modals
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { leave, action: 'approve' | 'reject' }
  const [rejectionReason, setRejectionReason] = useState("");
  const [acting, setActing] = useState(false);

  // Notes & Communication tab in details modal
  const [detailTab, setDetailTab] = useState("details"); // 'details' | 'notes' | 'communication' | 'audit'
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isDecisionNotice, setIsDecisionNotice] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (departmentFilter !== "ALL") params.department = departmentFilter;
      if (monthFilter) {
        params.month = monthFilter;
        params.year = yearFilter || new Date().getFullYear();
      }
      if (fromDateFilter) params.from_date = fromDateFilter;
      if (toDateFilter) params.to_date = toDateFilter;

      const res = await hrApi.leave.list(params);
      const data = res.data;
      if (data && data.results) {
        setItems(data.results);
        if (data.stats) setStats(data.stats);
      } else if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      toast.error("Failed to load leave records.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, monthFilter, yearFilter, fromDateFilter, toDateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization via websocket
  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener("dashboard-refresh", handleRefresh);
    return () => window.removeEventListener("dashboard-refresh", handleRefresh);
  }, [loadData]);

  // Reload selected leave details when updated
  const refreshSelectedLeave = async (id) => {
    try {
      const res = await hrApi.leave.get(id);
      setSelectedLeave(res.data);
    } catch (_) {}
  };

  // Manager Approve / Reject
  const handleManagerAction = async () => {
    if (!actionModal) return;
    const { leave, action } = actionModal;

    if (action === "reject" && !rejectionReason.trim()) {
      return toast.error("Rejection reason is mandatory.");
    }

    setActing(true);
    try {
      const payload = {
        action,
        reason: action === "reject" ? rejectionReason.trim() : "",
      };
      const res = await hrApi.leave.action(leave.id, payload);
      toast.success(res.data.message || `Leave ${action}d successfully.`);
      setActionModal(null);
      setRejectionReason("");
      loadData();
      if (selectedLeave && selectedLeave.id === leave.id) {
        refreshSelectedLeave(leave.id);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to process decision.";
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  // HR Add Internal Note
  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedLeave) return;
    setAddingNote(true);
    try {
      await hrApi.leave.addNote(selectedLeave.id, { note: newNote.trim() });
      toast.success("Internal note added.");
      setNewNote("");
      refreshSelectedLeave(selectedLeave.id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add note.");
    } finally {
      setAddingNote(false);
    }
  };

  // HR Send Communication Message to Staff
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedLeave) return;
    setSendingMessage(true);
    try {
      await hrApi.leave.sendCommunication(selectedLeave.id, {
        message: newMessage.trim(),
        is_decision_communicated: isDecisionNotice,
      });
      toast.success("Message sent to staff member.");
      setNewMessage("");
      setIsDecisionNotice(false);
      refreshSelectedLeave(selectedLeave.id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send message.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Unique departments for filter
  const departments = Array.from(new Set(items.map((i) => i.department).filter(Boolean)));

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader
        title="Staff Leave Management"
        subtitle="Manage leave applications, 15-day notice policies, monthly limits, and manager approvals."
      />

      {/* ── Policy Information Banner (Dismissible with X) ──────────── */}
      {!policyDismissed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            backgroundColor: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 12,
            padding: "12px 18px",
            marginBottom: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>📋</div>
            <div style={{ fontSize: 13, color: "#0369a1", lineHeight: "19px" }}>
              <strong>Staff Leave Policy:</strong> Standard monthly allowance is{" "}
              <strong>2 approved leave days</strong> per calendar month. Applications exceeding 2 days in any month must be
              submitted at least <strong>15 calendar days in advance</strong>. Only Managers & Admins can approve or reject
              leaves; HR can add notes and communicate decisions.
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissPolicy}
            title="Dismiss policy notice"
            aria-label="Close policy notice"
            style={{
              background: "transparent",
              border: "none",
              color: "#0284c7",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 700,
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#e0f2fe";
              e.currentTarget.style.color = "#0369a1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#0284c7";
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={handleRestorePolicy}
            style={{
              background: "none",
              border: "none",
              color: "#0284c7",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f9ff")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <span>📋</span> View Leave Policy
          </button>
        </div>
      )}

      {/* ── Stats Summary Cards ────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="data-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Pending Manager Review
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#b45309", marginTop: 4 }}>
            {stats.total_pending}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Awaiting manager decision</div>
        </div>

        <div className="data-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {monthFilter ? `Approved in ${format(new Date(Number(yearFilter) || 2026, Number(monthFilter) - 1, 1), "MMMM")}` : "Approved This Month"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#15803d", marginTop: 4 }}>
            {stats.approved_this_month}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Counts towards 2-day limit</div>
        </div>

        <div className="data-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Rejected
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
            {stats.rejected_count}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Staff can reapply for new dates</div>
        </div>

        <div className="data-card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total Applications
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0369a1", marginTop: 4 }}>
            {stats.total_count}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>All records preserved in history</div>
        </div>
      </div>

      {/* ── Main Data Table Card ──────────────────────────────────────── */}
      <div className="data-card" style={{ padding: 20 }}>
        {/* Filter Controls Row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 200 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by staff name, ID, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: 150 }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {departments.length > 0 && (
            <div style={{ minWidth: 150 }}>
              <select
                className="form-control"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Monthly Filtration */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              className="form-control"
              style={{ minWidth: 135 }}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              title="Filter by Month"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {format(new Date(2026, i, 1), "MMMM")}
                </option>
              ))}
            </select>
            {monthFilter && (
              <input
                type="number"
                className="form-control"
                style={{ width: 85 }}
                placeholder="Year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                title="Filter by Year"
                min="2020"
                max="2040"
              />
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              className="form-control"
              value={fromDateFilter}
              onChange={(e) => setFromDateFilter(e.target.value)}
              title="From date filter"
            />
            <span style={{ color: "#94a3b8" }}>–</span>
            <input
              type="date"
              className="form-control"
              value={toDateFilter}
              onChange={(e) => setToDateFilter(e.target.value)}
              title="To date filter"
            />
          </div>

          {(search || statusFilter !== "ALL" || departmentFilter !== "ALL" || monthFilter || fromDateFilter || toDateFilter) && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setDepartmentFilter("ALL");
                setMonthFilter("");
                setYearFilter(new Date().getFullYear());
                setFromDateFilter("");
                setToDateFilter("");
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Table Content */}
        {loading ? (
          <LoadingState />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Monthly Usage</th>
                  <th>Notice Period</th>
                  <th>Status</th>
                  <th>Manager Decision</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState icon="📅" title="No leave applications found" subtitle="No applications match the current filter criteria." />
                    </td>
                  </tr>
                ) : (
                  items.map((l) => {
                    const isExceeding = l.exceeds_monthly_limit;
                    const statusClass =
                      l.status === "APPROVED"
                        ? "badge-green"
                        : l.status === "REJECTED"
                        ? "badge-red"
                        : l.status === "PENDING"
                        ? "badge-yellow"
                        : "badge-gray";

                    return (
                      <tr key={l.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {(l.employee_name || "S")[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{l.employee_name}</div>
                              <div style={{ fontSize: 11.5, color: "#64748b" }}>
                                {l.staff_uid || l.employee_code} • {l.department}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="badge badge-blue">{l.leave_type}</span>
                          {l.is_half_day && (
                            <span style={{ fontSize: 10.5, color: "#7c3aed", display: "block", marginTop: 2, fontWeight: 600 }}>
                              Half Day ({l.half_day_session === "SECOND_HALF" ? "Afternoon" : "Morning"})
                            </span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>
                            {l.from_date ? format(new Date(l.from_date), "dd MMM yyyy") : "-"}
                          </div>
                          {l.from_date !== l.to_date && (
                            <div style={{ fontSize: 11.5, color: "#64748b" }}>
                              to {format(new Date(l.to_date), "dd MMM yyyy")}
                            </div>
                          )}
                        </td>

                        <td>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{l.total_days}d</span>
                        </td>

                        <td>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                            {l.approved_days_this_month} / 2.0d
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>approved this mo.</div>
                        </td>

                        <td>
                          {isExceeding ? (
                            <span
                              style={{
                                backgroundColor: "#fef3c7",
                                color: "#92400e",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              ⚠️ {l.notice_days}d notice
                            </span>
                          ) : (
                            <span style={{ fontSize: 11.5, color: "#475569" }}>
                              {l.notice_days}d notice
                            </span>
                          )}
                        </td>

                        <td>
                          <span className={`badge ${statusClass}`}>{l.status}</span>
                        </td>

                        <td>
                          {l.status === "APPROVED" && (
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: "#16a34a", fontWeight: 600 }}>Approved</span>
                              <div style={{ fontSize: 11, color: "#64748b" }}>
                                by {l.approved_by_name || "Manager"}
                              </div>
                            </div>
                          )}
                          {l.status === "REJECTED" && (
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: "#dc2626", fontWeight: 600 }}>Rejected</span>
                              <div style={{ fontSize: 11, color: "#64748b", maxWidth: 140, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={l.rejection_reason}>
                                {l.rejection_reason || "Reason given"}
                              </div>
                            </div>
                          )}
                          {l.status === "PENDING" && (
                            <span style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                              ⏳ Awaiting Decision
                            </span>
                          )}
                          {l.status === "CANCELLED" && (
                            <span style={{ fontSize: 12, color: "#64748b" }}>Cancelled by Staff</span>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setSelectedLeave(l);
                                setDetailTab("details");
                              }}
                            >
                              Details & Notes
                            </button>

                            {/* Manager/Admin Direct Action Buttons */}
                            {isManagerOrAdmin && l.status === "PENDING" && (
                              <>
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => {
                                    setActionModal({ leave: l, action: "approve" });
                                  }}
                                  title="Approve Leave"
                                >
                                  ✓
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => {
                                    setActionModal({ leave: l, action: "reject" });
                                    setRejectionReason("");
                                  }}
                                  title="Reject Leave"
                                >
                                  ✕
                                </button>
                              </>
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

      {/* ── Details & Communication Modal / Drawer ──────────────────── */}
      {selectedLeave && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLeave(null)}
          title={`Leave Request: ${selectedLeave.employee_name}`}
          footer={
            <button className="btn btn-secondary" onClick={() => setSelectedLeave(null)}>
              Close
            </button>
          }
        >
          {/* Modal Tab Bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: 16,
              gap: 8,
            }}
          >
            <button
              style={{
                padding: "8px 14px",
                border: "none",
                background: "none",
                fontWeight: detailTab === "details" ? 700 : 500,
                color: detailTab === "details" ? "#0284c7" : "#64748b",
                borderBottom: detailTab === "details" ? "2px solid #0284c7" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => setDetailTab("details")}
            >
              Application Details
            </button>
            <button
              style={{
                padding: "8px 14px",
                border: "none",
                background: "none",
                fontWeight: detailTab === "notes" ? 700 : 500,
                color: detailTab === "notes" ? "#0284c7" : "#64748b",
                borderBottom: detailTab === "notes" ? "2px solid #0284c7" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => setDetailTab("notes")}
            >
              HR Internal Notes ({selectedLeave.hr_notes?.length || 0})
            </button>
            <button
              style={{
                padding: "8px 14px",
                border: "none",
                background: "none",
                fontWeight: detailTab === "communication" ? 700 : 500,
                color: detailTab === "communication" ? "#0284c7" : "#64748b",
                borderBottom: detailTab === "communication" ? "2px solid #0284c7" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => setDetailTab("communication")}
            >
              Staff Communication ({selectedLeave.hr_communications?.length || 0})
            </button>
            <button
              style={{
                padding: "8px 14px",
                border: "none",
                background: "none",
                fontWeight: detailTab === "audit" ? 700 : 500,
                color: detailTab === "audit" ? "#0284c7" : "#64748b",
                borderBottom: detailTab === "audit" ? "2px solid #0284c7" : "2px solid transparent",
                cursor: "pointer",
              }}
              onClick={() => setDetailTab("audit")}
            >
              Audit Trail
            </button>
          </div>

          {/* TAB 1: DETAILS */}
          {detailTab === "details" && (
            <div>
              {/* Status Header Row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  backgroundColor: "#f8fafc",
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Status: </span>
                  <span
                    className={`badge ${
                      selectedLeave.status === "APPROVED"
                        ? "badge-green"
                        : selectedLeave.status === "REJECTED"
                        ? "badge-red"
                        : selectedLeave.status === "PENDING"
                        ? "badge-yellow"
                        : "badge-gray"
                    }`}
                  >
                    {selectedLeave.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Submitted: {selectedLeave.created_at ? format(new Date(selectedLeave.created_at), "dd MMM yyyy, hh:mm a") : "-"}
                </div>
              </div>

              {/* Grid Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Staff Member</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{selectedLeave.employee_name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{selectedLeave.staff_uid || selectedLeave.employee_code} • {selectedLeave.department}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Leave Type & Days</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                    {selectedLeave.leave_type} • {selectedLeave.total_days} Day(s)
                  </div>
                  {selectedLeave.is_half_day && (
                    <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>
                      Half Day Session: {selectedLeave.half_day_session}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Dates Requested</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>
                    {selectedLeave.from_date ? format(new Date(selectedLeave.from_date), "dd MMM yyyy") : "-"}
                    {selectedLeave.from_date !== selectedLeave.to_date && ` to ${format(new Date(selectedLeave.to_date), "dd MMM yyyy")}`}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Notice & Policy</div>
                  <div style={{ fontSize: 13, color: "#0f172a" }}>
                    {selectedLeave.notice_days} Calendar Days Advance Notice
                  </div>
                  {selectedLeave.exceeds_monthly_limit && (
                    <div style={{ fontSize: 11.5, color: "#b45309", fontWeight: 600 }}>
                      ⚠️ Exceeds 2-day limit (15d notice rule applied)
                    </div>
                  )}
                </div>
              </div>

              {/* Reason & Detailed Description */}
              <div style={{ marginBottom: 14, backgroundColor: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>Reason for Leave:</div>
                <div style={{ fontSize: 13.5, color: "#0f172a", marginTop: 2 }}>{selectedLeave.reason}</div>
              </div>

              {selectedLeave.description && (
                <div style={{ marginBottom: 14, backgroundColor: "#f8fafc", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>Detailed Description:</div>
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 2, whiteSpace: "pre-wrap" }}>
                    {selectedLeave.description}
                  </div>
                </div>
              )}

              {/* Decision Box */}
              <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                  MANAGER DECISION WORKFLOW
                </div>

                {selectedLeave.status === "APPROVED" && (
                  <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: 12, borderRadius: 8 }}>
                    <div style={{ color: "#15803d", fontWeight: 700 }}>✓ Approved by Manager</div>
                    <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                      Approved by: {selectedLeave.approved_by_name || "Manager"} on{" "}
                      {selectedLeave.approved_at ? format(new Date(selectedLeave.approved_at), "dd MMM yyyy, hh:mm a") : "-"}
                    </div>
                  </div>
                )}

                {selectedLeave.status === "REJECTED" && (
                  <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 8 }}>
                    <div style={{ color: "#b91c1c", fontWeight: 700 }}>✕ Rejected by Manager</div>
                    <div style={{ fontSize: 12.5, color: "#991b1b", marginTop: 4 }}>
                      <strong>Rejection Reason:</strong> {selectedLeave.rejection_reason}
                    </div>
                    <div style={{ fontSize: 11, color: "#7f1d1d", marginTop: 4 }}>
                      Decided by: {selectedLeave.approved_by_name || "Manager"} on{" "}
                      {selectedLeave.approved_at ? format(new Date(selectedLeave.approved_at), "dd MMM yyyy, hh:mm a") : "-"}
                    </div>
                  </div>
                )}

                {selectedLeave.status === "PENDING" && (
                  <div>
                    {isManagerOrAdmin ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <button
                          className="btn btn-success"
                          onClick={() => setActionModal({ leave: selectedLeave, action: "approve" })}
                        >
                          ✓ Approve Application
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            setActionModal({ leave: selectedLeave, action: "reject" });
                            setRejectionReason("");
                          }}
                        >
                          ✕ Reject Application
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          backgroundColor: "#fef3c7",
                          border: "1px solid #fde68a",
                          padding: 10,
                          borderRadius: 8,
                          fontSize: 12.5,
                          color: "#92400e",
                        }}
                      >
                        🔒 <strong>Approval Authority:</strong> Only Managers and Admins can approve or reject leave
                        applications. As HR, you can record internal notes or send communications to the staff member using the tabs above.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HR INTERNAL NOTES */}
          {detailTab === "notes" && (
            <div>
              <div
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fef3c7",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#92400e",
                  marginBottom: 14,
                }}
              >
                🔒 <strong>Confidential Internal Notes:</strong> These notes are visible strictly to HR and Managers. Staff members cannot see these notes.
              </div>

              {/* Add Note Input */}
              <div style={{ marginBottom: 18 }}>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Type an internal note regarding attendance, coverage, or policy review..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                >
                  {addingNote ? "Saving Note..." : "+ Add Internal Note"}
                </button>
              </div>

              {/* Notes List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(!selectedLeave.hr_notes || selectedLeave.hr_notes.length === 0) ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>
                    No internal HR notes recorded yet.
                  </div>
                ) : (
                  selectedLeave.hr_notes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{n.author_name}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {format(new Date(n.created_at), "dd MMM yyyy, hh:mm a")}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#0f172a" }}>{n.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STAFF COMMUNICATION */}
          {detailTab === "communication" && (
            <div>
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#166534",
                  marginBottom: 14,
                }}
              >
                📬 <strong>Staff Communication:</strong> Messages sent here are delivered directly to the staff member's mobile app and notification inbox.
              </div>

              {/* Send Communication Form */}
              <div style={{ marginBottom: 18 }}>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Communicate decision, request documentation, or provide instructions..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isDecisionNotice}
                      onChange={(e) => setIsDecisionNotice(e.target.checked)}
                    />
                    Mark as Official Decision Notice
                  </label>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                  >
                    {sendingMessage ? "Sending..." : "Send Message to Staff"}
                  </button>
                </div>
              </div>

              {/* Communications List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(!selectedLeave.hr_communications || selectedLeave.hr_communications.length === 0) ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>
                    No communication messages sent yet.
                  </div>
                ) : (
                  selectedLeave.hr_communications.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        backgroundColor: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0369a1" }}>
                          {c.sender_name} {c.is_decision_communicated && "(Official Decision Notice)"}
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          {format(new Date(c.created_at), "dd MMM yyyy, hh:mm a")} • {c.delivery_status}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#0f172a" }}>{c.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {detailTab === "audit" && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(!selectedLeave.audit_logs || selectedLeave.audit_logs.length === 0) ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>
                    No audit records found.
                  </div>
                ) : (
                  selectedLeave.audit_logs.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "#0284c7",
                          marginTop: 6,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>
                          {a.action} by {a.actor_name} ({a.actor_role})
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{a.details}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {format(new Date(a.created_at), "dd MMM, hh:mm a")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Manager Action Modal (Approve / Reject) ──────────────────── */}
      {actionModal && (
        <Modal
          isOpen={true}
          onClose={() => setActionModal(null)}
          title={`${actionModal.action === "approve" ? "Approve" : "Reject"} Leave Request`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setActionModal(null)}>
                Cancel
              </button>
              <button
                className={`btn ${actionModal.action === "approve" ? "btn-success" : "btn-danger"}`}
                onClick={handleManagerAction}
                disabled={acting}
              >
                {acting ? "Processing..." : `Confirm ${actionModal.action === "approve" ? "Approval" : "Rejection"}`}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13.5, marginBottom: 12 }}>
            Staff Member: <strong>{actionModal.leave.employee_name}</strong>
          </p>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
            Leave Dates: <strong>{actionModal.leave.from_date}</strong> to{" "}
            <strong>{actionModal.leave.to_date}</strong> ({actionModal.leave.total_days} Day(s))
          </p>

          {actionModal.action === "approve" && (
            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: 12, borderRadius: 8, fontSize: 12.5, color: "#166534" }}>
              ✓ Approving this request will automatically record attendance for the requested dates as <strong>LEAVE</strong> and notify the staff member immediately.
            </div>
          )}

          {actionModal.action === "reject" && (
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Rejection Reason <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Enter mandatory reason for rejecting this leave application..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                This reason will be preserved in the audit history and sent to the staff member so they can reapply if necessary.
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
