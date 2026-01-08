// src/AnalyticsDashboard.jsx
import React, { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fetchCustomerAnalytics, fetchStoreAnalytics, fetchSystemAnalytics } from "./api";
import io from "socket.io-client";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AnalyticsDashboard({ token, userRole, userId, storeId }) {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [period, setPeriod] = useState("30");
    const [realTimeUpdates, setRealTimeUpdates] = useState([]);
    const role = (userRole || "").toLowerCase();

    useEffect(() => {
        loadAnalytics();
        
        // Connect to WebSocket
        const socket = io("http://localhost:4000");
        
        socket.on("transaction", (data) => {
            setRealTimeUpdates((prev) => [data, ...prev].slice(0, 10));
            // Refresh analytics after a short delay
            setTimeout(loadAnalytics, 1000);
        });

        socket.on("redemption", (data) => {
            setRealTimeUpdates((prev) => [data, ...prev].slice(0, 10));
            setTimeout(loadAnalytics, 1000);
        });

        // Join store room if store user
        if (role === "store" && storeId) {
            socket.emit("join-store", storeId);
        }

        return () => {
            socket.disconnect();
        };
    }, [token, userRole, userId, storeId, period]);

    async function loadAnalytics() {
        try {
            setLoading(true);
            setError("");
            let data;
            if (role === "user" || role === "customer") {
                if (!token || !userId) throw new Error("Missing token/userId for customer analytics");
                console.log(`[AnalyticsDashboard] Loading customer analytics for userId: ${userId}, period: ${period}`);
                data = await fetchCustomerAnalytics(token, userId, period);
                console.log(`[AnalyticsDashboard] Received data:`, data);
            } else if (role === "store") {
                if (!token) throw new Error("Missing token for store analytics");
                data = await fetchStoreAnalytics(token, period);
            } else if (role === "admin") {
                data = await fetchSystemAnalytics();
            } else {
                throw new Error(`Unknown role: ${userRole}`);
            }
          
            setAnalytics(data);
        } catch (e) {
            console.error("[AnalyticsDashboard] Error loading analytics:", e);
            setError(e?.message || String(e));
            setAnalytics(null);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div style={card}><p>Loading analytics...</p></div>;
    if (error) return <div style={card}><p style={{ color: "red" }}>Error: {error}</p></div>;
    if (!analytics) {
        return (
          <div style={card}>
            <p>No analytics data returned.</p>
            <p style={{ fontSize: 12, color: "#666" }}>
              role={String(userRole)} userId={String(userId)} storeId={String(storeId)}
            </p>
          </div>
        );
      }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Period Selector */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ margin: 0 }}>Analytics Dashboard</h2>
                <select
                    style={select}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                >
                    <option value="0">All time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                </select>
            </div>

            {/* Real-time Updates */}
            {realTimeUpdates.length > 0 && (
                <div style={card}>
                    <h3 style={{ marginTop: 0 }}>Real-time Activity</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {realTimeUpdates.map((update, idx) => (
                            <div key={idx} style={updateCard}>
                                <strong>{update.type === "earn" ? "💰 Transaction" : "🔄 Redemption"}</strong>
                                {update.type === "earn" && (
                                    <>
                                        <span>{update.userName} earned {update.loopsEarned} Loops at {update.storeName}</span>
                                        <span style={{ fontSize: 11, color: "#666" }}>
                                            ${(update.amountCents / 100).toFixed(2)}
                                        </span>
                                    </>
                                )}
                                {update.type === "redemption" && (
                                    <span>User redeemed {update.loopsRedeemed} Loops</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overview KPIs */}
            {(role === "user" || role === "customer") && analytics.overview && (
                <>
                    <div style={kpiGrid}>
                        <KPICard
                            title="Total Transactions"
                            value={analytics.overview.total_transactions || 0}
                            subtitle={`${period} days`}
                        />
                        <KPICard
                            title="Total Spent"
                            value={`$${((analytics.overview.total_spent_cents || 0) / 100).toFixed(2)}`}
                            subtitle="All stores"
                        />
                        <KPICard
                            title="Loops Earned"
                            value={analytics.overview.total_loops_earned || 0}
                            subtitle={period === "0" ? "All time" : `Last ${period} days`}
                        />
                        <KPICard
                            title="Avg Transaction"
                            value={`$${((analytics.overview.avg_transaction_cents || 0) / 100).toFixed(2)}`}
                            subtitle="Per visit"
                        />
                        <KPICard
                            title="Stores Visited"
                            value={analytics.overview.unique_stores || 0}
                            subtitle="Unique locations"
                        />
                        <KPICard
                            title="Current Balance"
                            value={analytics.currentBalance || 0}
                            subtitle="Available Loops"
                        />
                    </div>

                    {/* Store Performance - Detailed View */}
                    {analytics.storeBreakdown && analytics.storeBreakdown.length > 0 && (
                        <div style={card}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Store Performance</h3>
                                <div style={{ fontSize: 13, color: "#6b7280" }}>
                                    {analytics.storeBreakdown.length} {analytics.storeBreakdown.length === 1 ? 'store' : 'stores'}
                                </div>
                            </div>
                            
                            {/* Store Cards Grid */}
                            <div style={storeGrid}>
                                {analytics.storeBreakdown
                                    .sort((a, b) => (b.total_spent_cents || 0) - (a.total_spent_cents || 0))
                                    .map((store, idx) => {
                                        const spent = (store.total_spent_cents || 0) / 100;
                                        const loops = store.total_loops_earned || 0;
                                        const visits = store.visit_count || 0;
                                        const avgSpent = visits > 0 ? spent / visits : 0;
                                        
                                        // Calculate percentage of total spending
                                        const totalSpent = analytics.storeBreakdown.reduce((sum, s) => sum + ((s.total_spent_cents || 0) / 100), 0);
                                        const percentage = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
                                        
                                        return (
                                            <div key={store.store_name || idx} style={storeCard}>
                                                <div style={storeCardHeader}>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}>
                                                            {store.store_name || "Unknown Store"}
                                                        </h4>
                                                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                                                            {store.category ? store.category.charAt(0).toUpperCase() + store.category.slice(1) : ""}
                                                        </div>
                                                    </div>
                                                    {idx === 0 && spent > 0 && (
                                                        <span style={topStoreBadge}>🏆 Top Store</span>
                                                    )}
                                                </div>
                                                
                                                <div style={storeCardBody}>
                                                    <div style={storeMetric}>
                                                        <div style={metricLabel}>Total Spent</div>
                                                        <div style={metricValue}>${spent.toFixed(2)}</div>
                                                        <div style={metricBar}>
                                                            <div 
                                                                style={{
                                                                    ...metricBarFill,
                                                                    width: `${Math.min(percentage, 100)}%`,
                                                                    backgroundColor: "#2563eb"
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={metricSubtext}>{percentage.toFixed(1)}% of total spending</div>
                                                    </div>
                                                    
                                                    <div style={storeMetric}>
                                                        <div style={metricLabel}>Loops Earned</div>
                                                        <div style={{ ...metricValue, color: "#10b981" }}>+{loops}</div>
                                                        <div style={metricSubtext}>
                                                            {visits > 0 ? `~${Math.round(loops / visits)} per visit` : "No visits"}
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={storeMetricRow}>
                                                        <div style={storeMetricSmall}>
                                                            <div style={metricLabelSmall}>Visits</div>
                                                            <div style={metricValueSmall}>{visits}</div>
                                                        </div>
                                                        <div style={storeMetricSmall}>
                                                            <div style={metricLabelSmall}>Avg per Visit</div>
                                                            <div style={metricValueSmall}>${avgSpent.toFixed(2)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                </>
            )}

            {/* Store Analytics */}
            {role === "store" && analytics.overview && (
                <>
                    <div style={kpiGrid}>
                        <KPICard
                            title="Unique Customers"
                            value={analytics.overview.unique_customers || 0}
                            subtitle={`${period} days`}
                        />
                        <KPICard
                            title="Total Transactions"
                            value={analytics.overview.total_transactions || 0}
                            subtitle="Completed"
                        />
                        <KPICard
                            title="Total Revenue"
                            value={`$${((analytics.overview.total_revenue_cents || 0) / 100).toFixed(2)}`}
                            subtitle={`${period} days`}
                        />
                        <KPICard
                            title="Loops Given"
                            value={analytics.overview.total_loops_given || 0}
                            subtitle="Awarded"
                        />
                        <KPICard
                            title="Avg Transaction"
                            value={`$${((analytics.overview.avg_transaction_cents || 0) / 100).toFixed(2)}`}
                            subtitle="Per customer"
                        />
                        <KPICard
                            title="Max Transaction"
                            value={`$${((analytics.overview.max_transaction_cents || 0) / 100).toFixed(2)}`}
                            subtitle="Single purchase"
                        />
                    </div>

                    {/* Daily Trend */}
                    {analytics.dailyTrend && analytics.dailyTrend.length > 0 && (
                        <div style={card}>
                            <h3 style={{ marginTop: 0 }}>Daily Performance</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={analytics.dailyTrend.map(d => ({
                                    ...d,
                                    revenue: (d.revenue_cents || 0) / 100,
                                    customers: d.customer_count || 0,
                                    transactions: d.transaction_count || 0
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis yAxisId="left" />
                                    <YAxis yAxisId="right" orientation="right" />
                                    <Tooltip />
                                    <Legend />
                                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#2563eb" name="Revenue ($)" />
                                    <Line yAxisId="right" type="monotone" dataKey="customers" stroke="#10b981" name="Customers" />
                                    <Line yAxisId="right" type="monotone" dataKey="transactions" stroke="#f59e0b" name="Transactions" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Top Customers */}
                    {analytics.topCustomers && analytics.topCustomers.length > 0 && (
                        <div style={card}>
                            <h3 style={{ marginTop: 0 }}>Top Customers</h3>
                            <div style={{ overflowX: "auto" }}>
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Customer</th>
                                            <th style={th}>Phone</th>
                                            <th style={th}>Visits</th>
                                            <th style={th}>Total Spent</th>
                                            <th style={th}>Loops Earned</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.topCustomers.map((c, idx) => (
                                            <tr key={idx}>
                                                <td style={td}>{c.user_name || c.name}</td>
                                                <td style={td}>{c.user_phone || c.email || "N/A"}</td>
                                                <td style={td}>{c.visit_count}</td>
                                                <td style={td}>${((c.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                <td style={td}>{c.total_loops_earned || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* System Analytics */}
            {role === "admin" && analytics.overview && (
                <>
                    <div style={kpiGrid}>
                        <KPICard
                            title="Total Users"
                            value={analytics.overview.total_users || 0}
                            subtitle="Registered"
                        />
                        <KPICard
                            title="Total Stores"
                            value={analytics.overview.total_stores || 0}
                            subtitle="Active"
                        />
                        <KPICard
                            title="Total Transactions"
                            value={analytics.overview.total_transactions || 0}
                            subtitle="All time"
                        />
                        <KPICard
                            title="Loops in Circulation"
                            value={analytics.overview.total_loops_in_circulation || 0}
                            subtitle="Current balance"
                        />
                        <KPICard
                            title="Total Loops Earned"
                            value={analytics.overview.total_loops_ever_earned || 0}
                            subtitle="All time"
                        />
                        <KPICard
                            title="Total Revenue"
                            value={`$${((analytics.overview.total_revenue_cents || 0) / 100).toFixed(2)}`}
                            subtitle="Platform-wide"
                        />
                    </div>

                    {/* Tier Distribution */}
                    {analytics.tierDistribution && (
                        <div style={card}>
                            <h3 style={{ marginTop: 0 }}>Tier Distribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={analytics.tierDistribution}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="count"
                                    >
                                        {analytics.tierDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Store Performance */}
                    {analytics.storePerformance && (
                        <div style={card}>
                            <h3 style={{ marginTop: 0 }}>Store Performance</h3>
                            <div style={{ overflowX: "auto" }}>
                                <table style={table}>
                                    <thead>
                                        <tr>
                                            <th style={th}>Store</th>
                                            <th style={th}>Category</th>
                                            <th style={th}>Zone</th>
                                            <th style={th}>Customers</th>
                                            <th style={th}>Transactions</th>
                                            <th style={th}>Revenue</th>
                                            <th style={th}>Loops Given</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.storePerformance.map((s, idx) => (
                                            <tr key={idx}>
                                                <td style={td}>{s.name}</td>
                                                <td style={td}>{s.category}</td>
                                                <td style={td}>{s.zone}</td>
                                                <td style={td}>{s.customer_count || 0}</td>
                                                <td style={td}>{s.transaction_count || 0}</td>
                                                <td style={td}>${((s.revenue_cents || 0) / 100).toFixed(2)}</td>
                                                <td style={td}>{s.loops_given || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function KPICard({ title, value, subtitle }) {
    return (
        <div style={kpiCard}>
            <div style={kpiTitle}>{title}</div>
            <div style={kpiValue}>{value}</div>
            <div style={kpiSubtitle}>{subtitle}</div>
        </div>
    );
}

const card = {
    border: "1px solid #e5e7eb",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const kpiGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
};

const kpiCard = {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    textAlign: "center",
};

const kpiTitle = {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
    fontWeight: 600,
};

const kpiValue = {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
};

const kpiSubtitle = {
    fontSize: 11,
    color: "#9ca3af",
};

const select = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
};

const updateCard = {
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    border: "1px solid #bae6fd",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
};

const table = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
};

const th = {
    textAlign: "left",
    padding: "12px 8px",
    borderBottom: "2px solid #e5e7eb",
    fontWeight: 600,
    color: "#374151",
    fontSize: 12,
    textTransform: "uppercase",
};

const td = {
    padding: "12px 8px",
    borderBottom: "1px solid #f3f4f6",
    color: "#6b7280",
};

const storeGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
};

const storeCard = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
    transition: "all 0.2s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const storeCardHeader = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #f3f4f6",
};

const topStoreBadge = {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 6,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontWeight: 600,
};

const storeCardBody = {
    display: "flex",
    flexDirection: "column",
    gap: 16,
};

const storeMetric = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
};

const metricLabel = {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

const metricValue = {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
};

const metricBar = {
    width: "100%",
    height: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
};

const metricBarFill = {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.3s ease",
};

const metricSubtext = {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
};

const storeMetricRow = {
    display: "flex",
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTop: "1px solid #f3f4f6",
};

const storeMetricSmall = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
};

const metricLabelSmall = {
    fontSize: 11,
    color: "#9ca3af",
};

const metricValueSmall = {
    fontSize: 16,
    fontWeight: 600,
    color: "#374151",
};
