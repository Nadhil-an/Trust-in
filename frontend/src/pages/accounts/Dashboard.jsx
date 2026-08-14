import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { accountsApi, cashierApi } from "../../api"
import { LoadingState, formatINR } from "../../components/shared"
import { format } from "date-fns"
import toast from "react-hot-toast"
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

// ── Minimal stat block ───────────────────────────────────
function StatBlock({ label, value, sub, color = "#6366f1", small, onClick }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      border: "1px solid #f0f0f4",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px" }}>
        {label}
      </span>
      <span style={{ fontSize: small ? 20 : 24, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: color, fontWeight: 500 }}>{sub}</span>}
      {onClick && <span style={{ fontSize: 11, color: "#9ca3af", marginTop: "auto", paddingTop: 4 }}>Click to view details →</span>}
    </div>
  )
}

// ── Custom tooltip for charts ─────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "10px 14px", fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
    }}>
      <div style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: p.color }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
          <span style={{ color: "#6b7280" }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: "#111827" }}>{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AccountsDashboard() {
  const [data, setData] = useState({ accounts: null, cashier: null })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const [accRes, cashRes] = await Promise.all([
        accountsApi.dashboard(),
        cashierApi.dashboard()
      ])
      setData({ accounts: accRes.data, cashier: cashRes.data })
    } catch (_) {
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener("dashboard-refresh", h)
    return () => window.removeEventListener("dashboard-refresh", h)
  }, [])

  if (loading) return <LoadingState />
  const acc = data.accounts || {}
  const cash = data.cashier || {}

  // Build chart data from available stats
  const balanceData = [
    { name: "Cash", value: acc.cash_balance || 0, fill: "#6366f1" },
    { name: "Bank", value: acc.bank_balance || 0, fill: "#10b981" },
  ]

  const monthData = [
    { name: "Money In", value: acc.income_this_month || 0 },
    { name: "Money Out", value: acc.expenses_this_month || 0 },
  ]

  const netPositive = (acc.net_this_month || 0) >= 0

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Overview</h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "2px 0 0" }}>
            {format(new Date(), "EEEE, dd MMMM yyyy")}
          </p>
        </div>
        {cash.pending_requests > 0 && (
          <button
            onClick={() => navigate("/cashier/pending")}
            style={{
              background: "#6366f1", color: "#fff", border: "none",
              borderRadius: 10, padding: "9px 18px", fontSize: 13,
              fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            ⚡ {cash.pending_requests} Pending Payout{cash.pending_requests > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Top 3 key numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
        <div 
          onClick={() => navigate('/accounts/overview')}
          style={{ cursor: "pointer", transition: "transform 0.1s" }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "none"}
        >
          <StatBlock
            label="Total Balance"
            value={formatINR(acc.total_balance)}
            sub="Cash + Bank"
            color="#6366f1"
            onClick={() => navigate('/accounts/overview')}
          />
        </div>
        <div 
          onClick={() => navigate('/accounts/income')}
          style={{ cursor: "pointer", transition: "transform 0.1s" }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "none"}
        >
          <StatBlock
            label="Money Received"
            value={formatINR(acc.today_income)}
            sub="Today"
            color="#10b981"
            onClick={() => navigate('/accounts/income')}
          />
        </div>
        <div 
          onClick={() => navigate('/accounts/expenses')}
          style={{ cursor: "pointer", transition: "transform 0.1s" }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "none"}
        >
          <StatBlock
            label="Money Spent"
            value={formatINR(acc.today_expense)}
            sub="Today"
            color="#ef4444"
            onClick={() => navigate('/accounts/expenses')}
          />
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Balance Breakdown Bar Chart */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "20px 22px",
          border: "1px solid #f0f0f4", boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Where is the money?</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Cash vs Bank balance</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={balanceData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Balance" radius={[6, 6, 0, 0]}>
                {balanceData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Income vs Expense Chart */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "20px 22px",
          border: "1px solid #f0f0f4", boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>This Month</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Money received vs spent</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                {monthData.map((entry, index) => (
                  <Cell key={index} fill={index === 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
