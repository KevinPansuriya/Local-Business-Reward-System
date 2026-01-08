// src/AdminApp.jsx
import React, { useState, useEffect } from "react";
import { 
    adminLogin, 
    adminSignup, 
    fetchAdminMe, 
    fetchSystemAnalytics,
    fetchAdminUsers,
    fetchAdminUserDetails,
    updateAdminUser,
    deleteAdminUser,
    fetchAdminStores,
    fetchAdminStoreDetails,
    updateAdminStore,
    deleteAdminStore,
    fetchStoreCustomers,
    fetchUserStores
} from "./api";

export default function AdminApp({ token, onToken }) {
    const [adminToken, setAdminToken] = useState(token || "");
    const [adminInfo, setAdminInfo] = useState(null);
    const [systemStats, setSystemStats] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    
    // Login/signup state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showSignup, setShowSignup] = useState(false);
    
    // Active tab
    const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'users' | 'stores' | 'analytics'
    
    // User Management state
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersSearch, setUsersSearch] = useState("");
    const [usersPage, setUsersPage] = useState(1);
    const [usersPagination, setUsersPagination] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [editingUser, setEditingUser] = useState(false);
    const [userEditForm, setUserEditForm] = useState({ name: "", email: "", address: "", plan: "" });
    
    // Store Management state
    const [stores, setStores] = useState([]);
    const [storesLoading, setStoresLoading] = useState(false);
    const [storesSearch, setStoresSearch] = useState("");
    const [storesPage, setStoresPage] = useState(1);
    const [storesPagination, setStoresPagination] = useState(null);
    const [selectedStore, setSelectedStore] = useState(null);
    const [storeDetails, setStoreDetails] = useState(null);
    const [editingStore, setEditingStore] = useState(false);
    const [storeEditForm, setStoreEditForm] = useState({ name: "", email: "", phone: "", category: "", zone: "", base_discount_percent: "", address: "" });
    const [storeCustomers, setStoreCustomers] = useState([]);
    const [storeCustomersLoading, setStoreCustomersLoading] = useState(false);
    const [showStoreCustomers, setShowStoreCustomers] = useState(false);
    const [customDiscountValue, setCustomDiscountValue] = useState("");
    const [userStores, setUserStores] = useState([]);
    const [userStoresLoading, setUserStoresLoading] = useState(false);
    const [showUserStores, setShowUserStores] = useState(false);
    
    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, id: null, name: null });
    
    // Filtering and sorting state
    const [usersSortBy, setUsersSortBy] = useState("id");
    const [usersSortOrder, setUsersSortOrder] = useState("desc");
    const [usersFilterPlan, setUsersFilterPlan] = useState("");
    const [storesSortBy, setStoresSortBy] = useState("id");
    const [storesSortOrder, setStoresSortOrder] = useState("desc");
    const [storesFilterCategory, setStoresFilterCategory] = useState("");
    const [storesFilterZone, setStoresFilterZone] = useState("");

    useEffect(() => {
        if (!adminToken) return;
        
        async function load() {
            try {
                setErr("");
                setLoading(true);
                const { admin } = await fetchAdminMe(adminToken);
                setAdminInfo(admin);
                
                // Load system analytics
                const analytics = await fetchSystemAnalytics(adminToken);
                setSystemStats(analytics);
            } catch (e) {
                setErr(e.message);
                setAdminToken("");
                if (onToken) onToken("");
            } finally {
                setLoading(false);
            }
        }
        
        load();
    }, [adminToken, onToken]);
    
    // Load users when Users tab is active
    useEffect(() => {
        if (adminToken && activeTab === "users") {
            loadUsers();
        }
    }, [adminToken, activeTab, usersPage, usersSearch]);
    
    // Load stores when Stores tab is active
    useEffect(() => {
        if (adminToken && activeTab === "stores") {
            loadStores();
        }
    }, [adminToken, activeTab, storesPage, storesSearch]);
    
    const loadUsers = async () => {
        if (!adminToken) return;
        setUsersLoading(true);
        try {
            const data = await fetchAdminUsers(adminToken, { search: usersSearch, page: usersPage, limit: 50 });
            setUsers(data.users || []);
            setUsersPagination(data.pagination || null);
        } catch (e) {
            console.error("Failed to load users:", e);
            setErr(e.message);
        } finally {
            setUsersLoading(false);
        }
    };
    
    const loadStores = async () => {
        if (!adminToken) return;
        setStoresLoading(true);
        try {
            const data = await fetchAdminStores(adminToken, { search: storesSearch, page: storesPage, limit: 50 });
            setStores(data.stores || []);
            setStoresPagination(data.pagination || null);
        } catch (e) {
            console.error("Failed to load stores:", e);
            setErr(e.message);
        } finally {
            setStoresLoading(false);
        }
    };
    
    const handleViewUser = async (userId) => {
        if (!adminToken) return;
        try {
            const data = await fetchAdminUserDetails(adminToken, userId);
            setSelectedUser(userId);
            setUserDetails(data);
            setUserEditForm({
                name: data.user?.name || "",
                email: data.user?.email || "",
                address: data.user?.address || "",
                plan: data.user?.plan || "STARTER"
            });
        } catch (e) {
            setErr(e.message);
        }
    };
    
    const handleViewStore = async (storeId) => {
        if (!adminToken) return;
        try {
            const data = await fetchAdminStoreDetails(adminToken, storeId);
            setSelectedStore(storeId);
            setStoreDetails(data);
            const discount = data.store?.base_discount_percent || 0;
            setStoreEditForm({
                name: data.store?.name || "",
                email: data.store?.email || "",
                phone: data.store?.phone || "",
                category: data.store?.category || "",
                zone: data.store?.zone || "",
                base_discount_percent: discount,
                address: data.store?.address || ""
            });
            // Set custom discount value if not in standard list
            if (!["0", "1", "2", "3", "4", "5", "10", "15", "20", "25"].includes(String(discount))) {
                setCustomDiscountValue(String(discount));
            } else {
                setCustomDiscountValue("");
            }
        } catch (e) {
            setErr(e.message);
        }
    };
    
    const handleViewStoreCustomers = async (storeId) => {
        if (!adminToken) return;
        setStoreCustomersLoading(true);
        setShowStoreCustomers(true);
        try {
            const data = await fetchStoreCustomers(adminToken, storeId);
            setStoreCustomers(data.customers || []);
        } catch (e) {
            setErr(e.message);
            setStoreCustomers([]);
        } finally {
            setStoreCustomersLoading(false);
        }
    };
    
    const handleViewUserStores = async (userId) => {
        if (!adminToken) return;
        setUserStoresLoading(true);
        setShowUserStores(true);
        try {
            const data = await fetchUserStores(adminToken, userId);
            setUserStores(data.stores || []);
        } catch (e) {
            setErr(e.message);
            setUserStores([]);
        } finally {
            setUserStoresLoading(false);
        }
    };
    
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!adminToken || !selectedUser) return;
        setLoading(true);
        try {
            await updateAdminUser(adminToken, selectedUser, userEditForm);
            setEditingUser(false);
            await handleViewUser(selectedUser); // Reload user details
            await loadUsers(); // Reload users list
            setSuccessMsg("User updated successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleUpdateStore = async (e) => {
        e.preventDefault();
        if (!adminToken || !selectedStore) return;
        setLoading(true);
        try {
            await updateAdminStore(adminToken, selectedStore, storeEditForm);
            setEditingStore(false);
            await handleViewStore(selectedStore); // Reload store details
            await loadStores(); // Reload stores list
            setSuccessMsg("Store updated successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteUser = async () => {
        if (!adminToken || !deleteConfirm.id) return;
        setLoading(true);
        try {
            await deleteAdminUser(adminToken, deleteConfirm.id);
            setDeleteConfirm({ show: false, type: null, id: null, name: null });
            if (selectedUser === deleteConfirm.id) {
                setSelectedUser(null);
                setUserDetails(null);
            }
            await loadUsers();
            setSuccessMsg("User deleted successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteStore = async () => {
        if (!adminToken || !deleteConfirm.id) return;
        setLoading(true);
        try {
            await deleteAdminStore(adminToken, deleteConfirm.id);
            setDeleteConfirm({ show: false, type: null, id: null, name: null });
            if (selectedStore === deleteConfirm.id) {
                setSelectedStore(null);
                setStoreDetails(null);
            }
            await loadStores();
            setSuccessMsg("Store deleted successfully");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const exportUsersToCSV = () => {
        const headers = ["ID", "Name", "Phone", "Email", "Plan", "Loops Balance", "Total Loops Earned", "Address"];
        const rows = users.map(u => [
            u.id,
            u.name || "",
            u.phone || "",
            u.email || "",
            u.plan || "",
            u.loops_balance || 0,
            u.total_loops_earned || 0,
            u.address || ""
        ]);
        
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `users_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccessMsg("Users exported to CSV");
        setTimeout(() => setSuccessMsg(""), 3000);
    };
    
    const exportStoresToCSV = () => {
        const headers = ["ID", "Name", "Category", "Zone", "Email", "Phone", "Discount %", "Address"];
        const rows = stores.map(s => [
            s.id,
            s.name || "",
            s.category || "",
            s.zone || "",
            s.email || "",
            s.phone || "",
            s.base_discount_percent || 0,
            s.address || ""
        ]);
        
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `stores_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccessMsg("Stores exported to CSV");
        setTimeout(() => setSuccessMsg(""), 3000);
    };
    
    // Sort and filter functions
    const sortedAndFilteredUsers = () => {
        let result = [...users];
        
        // Filter by plan
        if (usersFilterPlan) {
            result = result.filter(u => u.plan === usersFilterPlan);
        }
        
        // Sort
        result.sort((a, b) => {
            let aVal = a[usersSortBy] || "";
            let bVal = b[usersSortBy] || "";
            
            // Handle numeric values
            if (usersSortBy === "id" || usersSortBy === "loops_balance" || usersSortBy === "total_loops_earned") {
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
            }
            
            if (usersSortOrder === "asc") {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
        
        return result;
    };
    
    const sortedAndFilteredStores = () => {
        let result = [...stores];
        
        // Filter by category
        if (storesFilterCategory) {
            result = result.filter(s => s.category === storesFilterCategory);
        }
        
        // Filter by zone
        if (storesFilterZone) {
            result = result.filter(s => s.zone === storesFilterZone);
        }
        
        // Sort
        result.sort((a, b) => {
            let aVal = a[storesSortBy] || "";
            let bVal = b[storesSortBy] || "";
            
            // Handle numeric values
            if (storesSortBy === "id" || storesSortBy === "base_discount_percent") {
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
            }
            
            if (storesSortOrder === "asc") {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
        
        return result;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setErr("Email and password are required");
            return;
        }
        
        setErr("");
        setLoading(true);
        try {
            const res = await adminLogin(email, password);
            setAdminToken(res.token);
            if (onToken) onToken(res.token);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (!email || !password || !name) {
            setErr("Email, password, and name are required");
            return;
        }
        
        if (password.length < 8) {
            setErr("Password must be at least 8 characters");
            return;
        }
        
        setErr("");
        setLoading(true);
        try {
            const res = await adminSignup(email, password, name);
            setAdminToken(res.token);
            if (onToken) onToken(res.token);
            setShowSignup(false);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setAdminToken("");
        setAdminInfo(null);
        setSystemStats(null);
        setEmail("");
        setPassword("");
        setName("");
        if (onToken) onToken("");
    };

    if (!adminToken) {
        return (
            <div style={loginContainer}>
                <div style={loginBox}>
                    <h2 style={{ marginTop: 0, marginBottom: 24 }}>Admin Portal</h2>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>
                        {showSignup ? "Create Admin Account" : "Admin Login"}
                    </h3>
                    
                    <form onSubmit={showSignup ? handleSignup : handleLogin}>
                        {showSignup && (
                            <input
                                style={input}
                                type="text"
                                placeholder="Full Name (required)"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setErr("");
                                }}
                                required
                            />
                        )}
                        <input
                            style={input}
                            type="email"
                            placeholder="Email Address (required)"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setErr("");
                            }}
                            required
                        />
                        <input
                            style={input}
                            type="password"
                            placeholder="Password (required)"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setErr("");
                            }}
                            required
                            minLength={showSignup ? 8 : 6}
                        />
                        {showSignup && (
                            <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 16px 0" }}>
                                Password must be at least 8 characters
                            </p>
                        )}
                        
                        <button
                            style={primaryButton}
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (showSignup ? "Creating..." : "Logging in...") : (showSignup ? "Create Account" : "Login")}
                        </button>
                    </form>
                    
                    <div style={{ marginTop: 16, textAlign: "center" }}>
                        <button
                            style={linkButton}
                            onClick={() => {
                                setShowSignup(!showSignup);
                                setErr("");
                            }}
                        >
                            {showSignup ? "Already have an account? Login" : "Need an admin account? Sign up"}
                        </button>
                    </div>
                    
                    {err && <p style={errorText}>{err}</p>}
                </div>
            </div>
        );
    }

    if (loading && !adminInfo) {
        return (
            <div style={container}>
                <p>Loading admin dashboard...</p>
            </div>
        );
    }

    return (
        <div style={container}>
            <header style={header}>
                <div style={headerContent}>
                    <h1 style={title}>Admin Dashboard</h1>
                    <div style={headerActions}>
                        {adminInfo && (
                            <span style={userInfo}>Welcome, {adminInfo.name}</span>
                        )}
                        <button style={logoutButton} onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
                
                {/* Tab Navigation */}
                <div style={tabs}>
                    <button
                        style={{ ...tabButton, ...(activeTab === "dashboard" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        Dashboard
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "analytics" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("analytics")}
                    >
                        Analytics
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "users" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("users")}
                    >
                        Users
                    </button>
                    <button
                        style={{ ...tabButton, ...(activeTab === "stores" ? activeTabStyle : {}) }}
                        onClick={() => setActiveTab("stores")}
                    >
                        Stores
                    </button>
                </div>
            </header>

            <main style={main}>
                {activeTab === "dashboard" && (
                    <div>
                        <h2 style={sectionTitle}>System Overview</h2>
                        {systemStats && systemStats.overview && (
                            <div style={statsGrid}>
                                <div style={statCard}>
                                    <h3 style={statValue}>{systemStats.overview.total_users || 0}</h3>
                                    <p style={statLabel}>Total Users</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{systemStats.overview.total_stores || 0}</h3>
                                    <p style={statLabel}>Total Stores</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{systemStats.overview.total_transactions || 0}</h3>
                                    <p style={statLabel}>Total Transactions</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>${((systemStats.overview.total_revenue_cents || 0) / 100).toFixed(2)}</h3>
                                    <p style={statLabel}>Total Revenue</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{(systemStats.overview.total_loops_in_circulation || 0).toLocaleString()}</h3>
                                    <p style={statLabel}>Loops in Circulation</p>
                                </div>
                                <div style={statCard}>
                                    <h3 style={statValue}>{(systemStats.overview.total_loops_ever_earned || 0).toLocaleString()}</h3>
                                    <p style={statLabel}>Total Loops Earned</p>
                                </div>
                            </div>
                        )}
                        
                        {systemStats && systemStats.transactionGrowth && systemStats.transactionGrowth.length > 0 && (
                            <div style={card}>
                                <h3 style={cardTitle}>Recent Activity (Last 30 Days)</h3>
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Date</th>
                                                <th style={th}>Transactions</th>
                                                <th style={th}>New Customers</th>
                                                <th style={th}>Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {systemStats.transactionGrowth.slice(0, 10).map((day, idx) => (
                                                <tr key={idx}>
                                                    <td style={td}>{new Date(day.date).toLocaleDateString()}</td>
                                                    <td style={td}>{day.transaction_count}</td>
                                                    <td style={td}>{day.new_customers}</td>
                                                    <td style={td}>${((day.revenue_cents || 0) / 100).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "analytics" && (
                    <div>
                        <h2 style={sectionTitle}>System Analytics</h2>
                        
                        {/* Overview Cards */}
                        {systemStats && systemStats.overview && (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 30 }}>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Total Users</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#2563eb" }}>
                                            {systemStats.overview.total_users?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Total Stores</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#10b981" }}>
                                            {systemStats.overview.total_stores?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Total Transactions</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#f59e0b" }}>
                                            {systemStats.overview.total_transactions?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Loops in Circulation</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#8b5cf6" }}>
                                            {systemStats.overview.total_loops_in_circulation?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Total Loops Earned</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#ec4899" }}>
                                            {systemStats.overview.total_loops_ever_earned?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Total Revenue</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#ef4444" }}>
                                            ${((systemStats.overview.total_revenue_cents || 0) / 100).toFixed(2)}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Gift Cards Issued</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#06b6d4" }}>
                                            {systemStats.overview.total_gift_cards_issued?.toLocaleString() || 0}
                                        </p>
                                        <p style={{ margin: "5px 0 0 0", fontSize: 12, color: "#6b7280" }}>
                                            {systemStats.overview.active_gift_cards || 0} active
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Active Customers (30d)</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#14b8a6" }}>
                                            {systemStats.overview.active_customers_30d?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, color: "#111827" }}>Gift Card Value</h3>
                                        <p style={{ margin: 0, fontSize: 32, fontWeight: "bold", color: "#f97316" }}>
                                            ${((systemStats.overview.total_gift_card_value || 0)).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Transaction Growth */}
                                {systemStats.transactionGrowth && systemStats.transactionGrowth.length > 0 && (
                                    <div style={{ ...card, marginBottom: 30 }}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>Transaction Growth (Last 30 Days)</h3>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={table}>
                                                <thead>
                                                    <tr>
                                                        <th style={th}>Date</th>
                                                        <th style={th}>Transactions</th>
                                                        <th style={th}>New Customers</th>
                                                        <th style={th}>Revenue</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {systemStats.transactionGrowth.slice(0, 15).map((day, idx) => (
                                                        <tr key={idx}>
                                                            <td style={td}>{new Date(day.date).toLocaleDateString()}</td>
                                                            <td style={td}>{day.transaction_count}</td>
                                                            <td style={td}>{day.new_customers}</td>
                                                            <td style={td}>${((day.revenue_cents || 0) / 100).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Store Performance */}
                                {systemStats.storePerformance && systemStats.storePerformance.length > 0 && (
                                    <div style={{ ...card, marginBottom: 30 }}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>Store Performance</h3>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={table}>
                                                <thead>
                                                    <tr>
                                                        <th style={th}>Store Name</th>
                                                        <th style={th}>Category</th>
                                                        <th style={th}>Zone</th>
                                                        <th style={th}>Customers</th>
                                                        <th style={th}>Transactions</th>
                                                        <th style={th}>Revenue</th>
                                                        <th style={th}>Loops Given</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {systemStats.storePerformance.map((store, idx) => (
                                                        <tr key={idx}>
                                                            <td style={td}>{store.name}</td>
                                                            <td style={td}>{store.category}</td>
                                                            <td style={td}>{store.zone}</td>
                                                            <td style={td}>{store.customer_count}</td>
                                                            <td style={td}>{store.transaction_count}</td>
                                                            <td style={td}>${((store.revenue_cents || 0) / 100).toFixed(2)}</td>
                                                            <td style={td}>{store.loops_given?.toLocaleString() || 0}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Tier Distribution */}
                                {systemStats.tierDistribution && systemStats.tierDistribution.length > 0 && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>User Tier Distribution</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            {systemStats.tierDistribution.map((tier, idx) => (
                                                <div key={idx} style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                    <p style={{ margin: "0 0 5px 0", fontSize: 14, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                        {tier.tier}
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#111827" }}>
                                                        {tier.count}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Transaction Metrics */}
                                {systemStats.transactionMetrics && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>Transaction Metrics (Last 30 Days)</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Average Transaction
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#2563eb" }}>
                                                    ${((systemStats.transactionMetrics.avg_transaction_cents || 0) / 100).toFixed(2)}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Min Transaction
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#10b981" }}>
                                                    ${((systemStats.transactionMetrics.min_transaction_cents || 0) / 100).toFixed(2)}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Max Transaction
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#f59e0b" }}>
                                                    ${((systemStats.transactionMetrics.max_transaction_cents || 0) / 100).toFixed(2)}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Active Days
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#8b5cf6" }}>
                                                    {systemStats.transactionMetrics.active_days || 0}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Redemption Stats */}
                                {systemStats.redemptionStats && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>Loops Redemption Rate</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Earned
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#10b981" }}>
                                                    {(systemStats.redemptionStats.total_earned || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Redeemed
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#ef4444" }}>
                                                    {(systemStats.redemptionStats.total_redeemed || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Redemption Rate
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#8b5cf6" }}>
                                                    {systemStats.redemptionStats.total_earned > 0 
                                                        ? ((systemStats.redemptionStats.total_redeemed / systemStats.redemptionStats.total_earned) * 100).toFixed(1)
                                                        : 0}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Top Stores by Revenue */}
                                {systemStats.topStoresByRevenue && systemStats.topStoresByRevenue.length > 0 && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>Top Stores by Revenue (Last 30 Days)</h3>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={table}>
                                                <thead>
                                                    <tr>
                                                        <th style={th}>Store Name</th>
                                                        <th style={th}>Category</th>
                                                        <th style={th}>Transactions</th>
                                                        <th style={th}>Total Revenue</th>
                                                        <th style={th}>Avg Transaction</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {systemStats.topStoresByRevenue.map((store, idx) => (
                                                        <tr key={idx}>
                                                            <td style={td}>{store.name}</td>
                                                            <td style={td}>{store.category}</td>
                                                            <td style={td}>{store.transaction_count}</td>
                                                            <td style={td}><strong>${((store.revenue_cents || 0) / 100).toFixed(2)}</strong></td>
                                                            <td style={td}>${((store.avg_transaction_cents || 0) / 100).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Customer Retention */}
                                {systemStats.retentionStats && (
                                    <div style={card}>
                                        <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#111827" }}>Customer Retention (Last 30 Days)</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Total Active Customers
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#2563eb" }}>
                                                    {systemStats.retentionStats.total_active_customers || 0}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Returning Customers
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#10b981" }}>
                                                    {systemStats.retentionStats.returning_customers || 0}
                                                </p>
                                            </div>
                                            <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                    Retention Rate
                                                </p>
                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#8b5cf6" }}>
                                                    {systemStats.retentionStats.total_active_customers > 0 
                                                        ? ((systemStats.retentionStats.returning_customers / systemStats.retentionStats.total_active_customers) * 100).toFixed(1)
                                                        : 0}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(!systemStats || !systemStats.overview) && (
                            <div style={card}>
                                <p style={{ color: "#6b7280" }}>Loading analytics data...</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "users" && (
                    <div>
                        <h2 style={sectionTitle}>User Management</h2>
                        
                        {/* Search and Filters */}
                        <div style={card}>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                                <input
                                    style={{ ...input, flex: "1 1 300px" }}
                                    type="text"
                                    placeholder="Search users by name, phone, or email..."
                                    value={usersSearch}
                                    onChange={(e) => {
                                        setUsersSearch(e.target.value);
                                        setUsersPage(1);
                                    }}
                                />
                                <select
                                    style={{ ...input, flex: "0 0 150px" }}
                                    value={usersFilterPlan}
                                    onChange={(e) => setUsersFilterPlan(e.target.value)}
                                >
                                    <option value="">All Plans</option>
                                    <option value="STARTER">STARTER</option>
                                    <option value="BASIC">BASIC</option>
                                    <option value="PLUS">PLUS</option>
                                    <option value="PREMIUM">PREMIUM</option>
                                </select>
                                <select
                                    style={{ ...input, flex: "0 0 120px" }}
                                    value={usersSortBy}
                                    onChange={(e) => setUsersSortBy(e.target.value)}
                                >
                                    <option value="id">Sort By</option>
                                    <option value="name">Name</option>
                                    <option value="loops_balance">Loops</option>
                                    <option value="total_loops_earned">Total Earned</option>
                                </select>
                                <button
                                    style={{ ...smallButton, flex: "0 0 80px" }}
                                    onClick={() => setUsersSortOrder(usersSortOrder === "asc" ? "desc" : "asc")}
                                >
                                    {usersSortOrder === "asc" ? "↑" : "↓"}
                                </button>
                                <button
                                    style={{ ...smallButton, flex: "0 0 100px", background: "#10b981", color: "white" }}
                                    onClick={exportUsersToCSV}
                                >
                                    Export CSV
                                </button>
                            </div>
                            {usersPagination && (
                                <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                                    Showing {sortedAndFilteredUsers().length} of {usersPagination.total} users (Page {usersPagination.page} of {usersPagination.totalPages})
                                </p>
                            )}
                        </div>
                        
                        {/* Users List */}
                        {usersLoading ? (
                            <div style={card}>
                                <p>Loading users...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div style={card}>
                                <p style={{ color: "#6b7280" }}>No users found.</p>
                            </div>
                        ) : (
                            <div style={card}>
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>ID</th>
                                                <th style={th}>Name</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Plan</th>
                                                <th style={th}>Loops</th>
                                                <th style={th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAndFilteredUsers().map((user) => (
                                                <tr key={user.id}>
                                                    <td style={td}>{user.id}</td>
                                                    <td style={td}>{user.name}</td>
                                                    <td style={td}>{user.phone}</td>
                                                    <td style={td}>{user.email || "-"}</td>
                                                    <td style={td}>{user.plan}</td>
                                                    <td style={td}>{user.loops_balance?.toLocaleString() || 0}</td>
                                                    <td style={td}>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                style={smallButton}
                                                                onClick={() => handleViewUser(user.id)}
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "#2563eb", color: "white" }}
                                                                onClick={() => handleViewUserStores(user.id)}
                                                            >
                                                                Stores
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "#ef4444", color: "white" }}
                                                                onClick={() => setDeleteConfirm({ show: true, type: "user", id: user.id, name: user.name })}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Pagination */}
                                {usersPagination && usersPagination.totalPages > 1 && (
                                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                                        <button
                                            style={smallButton}
                                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                                            disabled={usersPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: "8px 16px", fontSize: 14 }}>
                                            Page {usersPage} of {usersPagination.totalPages}
                                        </span>
                                        <button
                                            style={smallButton}
                                            onClick={() => setUsersPage(p => Math.min(usersPagination.totalPages, p + 1))}
                                            disabled={usersPage === usersPagination.totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* User Details Modal */}
                        {selectedUser && userDetails && (
                            <div style={modal}>
                                <div style={modalContent}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                        <h3 style={{ margin: 0 }}>User Details</h3>
                                        <button style={closeButton} onClick={() => { setSelectedUser(null); setUserDetails(null); setEditingUser(false); }}>
                                            ×
                                        </button>
                                    </div>
                                    
                                    {!editingUser ? (
                                        <div>
                                            <div style={detailRow}>
                                                <strong>ID:</strong> {userDetails.user.id}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Name:</strong> {userDetails.user.name}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Phone:</strong> {userDetails.user.phone}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Email:</strong> {userDetails.user.email || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Address:</strong> {userDetails.user.address || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Plan:</strong> {userDetails.user.plan}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Loops Balance:</strong> {userDetails.user.loops_balance?.toLocaleString() || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Total Loops Earned:</strong> {userDetails.user.total_loops_earned?.toLocaleString() || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Transactions:</strong> {userDetails.stats?.transaction_count || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Total Spent:</strong> ${((userDetails.stats?.total_spent_cents || 0) / 100).toFixed(2)}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Stores Visited:</strong> {userDetails.stats?.stores_visited || 0}
                                            </div>
                                            
                                            {/* Store Visits with Loops Earned */}
                                            {userDetails.storeVisits && userDetails.storeVisits.length > 0 && (
                                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
                                                    <h4 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: 600, color: "#111827" }}>
                                                        Store Visits & Loops Earned
                                                    </h4>
                                                    <div style={{ overflowX: "auto" }}>
                                                        <table style={table}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={th}>Store Name</th>
                                                                    <th style={th}>Category</th>
                                                                    <th style={th}>Zone</th>
                                                                    <th style={th}>Visits</th>
                                                                    <th style={th}>Loops Earned</th>
                                                                    <th style={th}>Total Spent</th>
                                                                    <th style={th}>Last Visit</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {userDetails.storeVisits.map((visit, idx) => (
                                                                    <tr key={idx}>
                                                                        <td style={td}>{visit.store_name}</td>
                                                                        <td style={td}>{visit.category}</td>
                                                                        <td style={td}>{visit.zone}</td>
                                                                        <td style={td}>{visit.visit_count}</td>
                                                                        <td style={td}><strong>{visit.total_loops_earned?.toLocaleString() || 0}</strong></td>
                                                                        <td style={td}>${((visit.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                                        <td style={td}>{visit.last_visit_at ? new Date(visit.last_visit_at).toLocaleDateString() : "-"}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div style={{ marginTop: 20 }}>
                                                <button style={primaryButton} onClick={() => setEditingUser(true)}>
                                                    Edit User
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdateUser}>
                                            <label style={label}>Name</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={userEditForm.name}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, name: e.target.value })}
                                                required
                                            />
                                            <label style={label}>Email</label>
                                            <input
                                                style={input}
                                                type="email"
                                                value={userEditForm.email}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, email: e.target.value })}
                                            />
                                            <label style={label}>Address</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={userEditForm.address}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, address: e.target.value })}
                                            />
                                            <label style={label}>Plan</label>
                                            <select
                                                style={input}
                                                value={userEditForm.plan}
                                                onChange={(e) => setUserEditForm({ ...userEditForm, plan: e.target.value })}
                                            >
                                                <option value="STARTER">STARTER</option>
                                                <option value="BASIC">BASIC</option>
                                                <option value="PLUS">PLUS</option>
                                                <option value="PREMIUM">PREMIUM</option>
                                            </select>
                                            
                                            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                                                <button style={primaryButton} type="submit" disabled={loading}>
                                                    {loading ? "Saving..." : "Save Changes"}
                                                </button>
                                                <button style={secondaryButton} type="button" onClick={() => { setEditingUser(false); handleViewUser(selectedUser); }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "stores" && (
                    <div>
                        <h2 style={sectionTitle}>Store Management</h2>
                        
                        {/* Search and Filters */}
                        <div style={card}>
                            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                                <input
                                    style={{ ...input, flex: "1 1 300px" }}
                                    type="text"
                                    placeholder="Search stores by name, email, phone, or category..."
                                    value={storesSearch}
                                    onChange={(e) => {
                                        setStoresSearch(e.target.value);
                                        setStoresPage(1);
                                    }}
                                />
                                <select
                                    style={{ ...input, flex: "0 0 120px" }}
                                    value={storesFilterCategory}
                                    onChange={(e) => setStoresFilterCategory(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    <option value="coffee">Coffee</option>
                                    <option value="grocery">Grocery</option>
                                    <option value="restaurant">Restaurant</option>
                                    <option value="retail">Retail</option>
                                    <option value="barbershop">Barbershop</option>
                                    <option value="smoke">Smoke</option>
                                    <option value="liquor">Liquor</option>
                                    <option value="other">Other</option>
                                </select>
                                <input
                                    style={{ ...input, flex: "0 0 120px" }}
                                    type="text"
                                    placeholder="Filter by Zone"
                                    value={storesFilterZone}
                                    onChange={(e) => setStoresFilterZone(e.target.value)}
                                />
                                <select
                                    style={{ ...input, flex: "0 0 120px" }}
                                    value={storesSortBy}
                                    onChange={(e) => setStoresSortBy(e.target.value)}
                                >
                                    <option value="id">Sort By</option>
                                    <option value="name">Name</option>
                                    <option value="category">Category</option>
                                    <option value="zone">Zone</option>
                                    <option value="base_discount_percent">Discount</option>
                                </select>
                                <button
                                    style={{ ...smallButton, flex: "0 0 80px" }}
                                    onClick={() => setStoresSortOrder(storesSortOrder === "asc" ? "desc" : "asc")}
                                >
                                    {storesSortOrder === "asc" ? "↑" : "↓"}
                                </button>
                                <button
                                    style={{ ...smallButton, flex: "0 0 100px", background: "#10b981", color: "white" }}
                                    onClick={exportStoresToCSV}
                                >
                                    Export CSV
                                </button>
                            </div>
                            {storesPagination && (
                                <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                                    Showing {sortedAndFilteredStores().length} of {storesPagination.total} stores (Page {storesPagination.page} of {storesPagination.totalPages})
                                </p>
                            )}
                        </div>
                        
                        {/* Stores List */}
                        {storesLoading ? (
                            <div style={card}>
                                <p>Loading stores...</p>
                            </div>
                        ) : stores.length === 0 ? (
                            <div style={card}>
                                <p style={{ color: "#6b7280" }}>No stores found.</p>
                            </div>
                        ) : (
                            <div style={card}>
                                <div style={tableContainer}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>ID</th>
                                                <th style={th}>Name</th>
                                                <th style={th}>Category</th>
                                                <th style={th}>Zone</th>
                                                <th style={th}>Discount</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAndFilteredStores().map((store) => (
                                                <tr key={store.id}>
                                                    <td style={td}>{store.id}</td>
                                                    <td style={td}>{store.name}</td>
                                                    <td style={td}>{store.category}</td>
                                                    <td style={td}>{store.zone}</td>
                                                    <td style={td}>{store.base_discount_percent}%</td>
                                                    <td style={td}>{store.email || "-"}</td>
                                                    <td style={td}>{store.phone || "-"}</td>
                                                    <td style={td}>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                style={smallButton}
                                                                onClick={() => handleViewStore(store.id)}
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "#2563eb", color: "white" }}
                                                                onClick={() => handleViewStoreCustomers(store.id)}
                                                            >
                                                                Customers
                                                            </button>
                                                            <button
                                                                style={{ ...smallButton, background: "#ef4444", color: "white" }}
                                                                onClick={() => setDeleteConfirm({ show: true, type: "store", id: store.id, name: store.name })}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Pagination */}
                                {storesPagination && storesPagination.totalPages > 1 && (
                                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                                        <button
                                            style={smallButton}
                                            onClick={() => setStoresPage(p => Math.max(1, p - 1))}
                                            disabled={storesPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: "8px 16px", fontSize: 14 }}>
                                            Page {storesPage} of {storesPagination.totalPages}
                                        </span>
                                        <button
                                            style={smallButton}
                                            onClick={() => setStoresPage(p => Math.min(storesPagination.totalPages, p + 1))}
                                            disabled={storesPage === storesPagination.totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Store Details Modal */}
                        {selectedStore && storeDetails && (
                            <div style={modal}>
                                <div style={modalContent}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                        <h3 style={{ margin: 0 }}>Store Details</h3>
                                        <button style={closeButton} onClick={() => { setSelectedStore(null); setStoreDetails(null); setEditingStore(false); }}>
                                            ×
                                        </button>
                                    </div>
                                    
                                    {!editingStore ? (
                                        <div>
                                            <div style={detailRow}>
                                                <strong>ID:</strong> {storeDetails.store.id}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Name:</strong> {storeDetails.store.name}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Category:</strong> {storeDetails.store.category}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Zone:</strong> {storeDetails.store.zone}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Base Discount:</strong> {storeDetails.store.base_discount_percent}%
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Email:</strong> {storeDetails.store.email || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Phone:</strong> {storeDetails.store.phone || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Address:</strong> {storeDetails.store.address || "-"}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Transactions:</strong> {storeDetails.stats?.transaction_count || 0}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Total Revenue:</strong> ${((storeDetails.stats?.total_revenue_cents || 0) / 100).toFixed(2)}
                                            </div>
                                            <div style={detailRow}>
                                                <strong>Unique Customers:</strong> {storeDetails.stats?.unique_customers || 0}
                                            </div>
                                            
                                            {/* Customer Visit Stats */}
                                            {storeDetails.customerStats && storeDetails.customerStats.length > 0 && (
                                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
                                                    <h4 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: 600, color: "#111827" }}>
                                                        Unique Customers by Period
                                                    </h4>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                                                        {storeDetails.customerStats.map((stat, idx) => (
                                                            <div key={idx} style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                                <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                                    {stat.period === 'daily' ? 'Today' : stat.period === 'weekly' ? 'This Week' : stat.period === 'monthly' ? 'This Month' : 'This Year'}
                                                                </p>
                                                                <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#111827" }}>
                                                                    {stat.unique_customers || 0}
                                                                </p>
                                                                <p style={{ margin: "5px 0 0 0", fontSize: 11, color: "#9ca3af" }}>
                                                                    {stat.period_date}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Gift Card Stats */}
                                            {storeDetails.giftCardStats && (
                                                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
                                                    <h4 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: 600, color: "#111827" }}>
                                                        Gift Cards Issued
                                                    </h4>
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 15 }}>
                                                        <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Total Issued
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#2563eb" }}>
                                                                {storeDetails.giftCardStats.total_gift_cards_issued || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Active
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#10b981" }}>
                                                                {storeDetails.giftCardStats.active_gift_cards || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Physical
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#f59e0b" }}>
                                                                {storeDetails.giftCardStats.physical_gift_cards || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Digital
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#8b5cf6" }}>
                                                                {storeDetails.giftCardStats.digital_gift_cards || 0}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 15, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                                                            <p style={{ margin: "0 0 5px 0", fontSize: 12, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>
                                                                Total Value
                                                            </p>
                                                            <p style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: "#ef4444" }}>
                                                                ${((storeDetails.giftCardStats.total_gift_card_value || 0)).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div style={{ marginTop: 20 }}>
                                                <button style={primaryButton} onClick={() => setEditingStore(true)}>
                                                    Edit Store
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdateStore}>
                                            <label style={label}>Name</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={storeEditForm.name}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, name: e.target.value })}
                                                required
                                            />
                                            <label style={label}>Email</label>
                                            <input
                                                style={input}
                                                type="email"
                                                value={storeEditForm.email}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, email: e.target.value })}
                                            />
                                            <label style={label}>Phone</label>
                                            <input
                                                style={input}
                                                type="tel"
                                                value={storeEditForm.phone}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, phone: e.target.value })}
                                            />
                                            <label style={label}>Category</label>
                                            <select
                                                style={input}
                                                value={storeEditForm.category}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, category: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                <option value="coffee">Coffee</option>
                                                <option value="grocery">Grocery</option>
                                                <option value="restaurant">Restaurant</option>
                                                <option value="retail">Retail</option>
                                                <option value="barbershop">Barbershop</option>
                                                <option value="smoke">Smoke</option>
                                                <option value="liquor">Liquor</option>
                                                <option value="pharmacy">Pharmacy</option>
                                                <option value="gas">Gas</option>
                                                <option value="other">Other</option>
                                            </select>
                                            <label style={label}>Zone</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={storeEditForm.zone}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, zone: e.target.value })}
                                                required
                                            />
                                            <label style={label}>Base Discount %</label>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <select
                                                    style={{ ...input, flex: 1 }}
                                                    value={customDiscountValue !== "" ? "custom" : String(storeEditForm.base_discount_percent)}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === "custom") {
                                                            setCustomDiscountValue(storeEditForm.base_discount_percent || "");
                                                        } else {
                                                            setStoreEditForm({ ...storeEditForm, base_discount_percent: parseInt(val) || 0 });
                                                            setCustomDiscountValue("");
                                                        }
                                                    }}
                                                    required
                                                >
                                                    <option value="0">0%</option>
                                                    <option value="1">1%</option>
                                                    <option value="2">2%</option>
                                                    <option value="3">3%</option>
                                                    <option value="4">4%</option>
                                                    <option value="5">5%</option>
                                                    <option value="10">10%</option>
                                                    <option value="15">15%</option>
                                                    <option value="20">20%</option>
                                                    <option value="25">25%</option>
                                                    <option value="custom">Custom...</option>
                                                </select>
                                                {customDiscountValue !== "" || (storeEditForm.base_discount_percent && !["0", "1", "2", "3", "4", "5", "10", "15", "20", "25"].includes(String(storeEditForm.base_discount_percent))) ? (
                                                    <input
                                                        style={{ ...input, flex: 1, maxWidth: 150 }}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        placeholder="Enter %"
                                                        value={customDiscountValue !== "" ? customDiscountValue : storeEditForm.base_discount_percent}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            setCustomDiscountValue(e.target.value);
                                                            setStoreEditForm({ ...storeEditForm, base_discount_percent: val });
                                                        }}
                                                        required
                                                    />
                                                ) : null}
                                            </div>
                                            <label style={label}>Address</label>
                                            <input
                                                style={input}
                                                type="text"
                                                value={storeEditForm.address}
                                                onChange={(e) => setStoreEditForm({ ...storeEditForm, address: e.target.value })}
                                            />
                                            
                                            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                                                <button style={primaryButton} type="submit" disabled={loading}>
                                                    {loading ? "Saving..." : "Save Changes"}
                                                </button>
                                                <button style={secondaryButton} type="button" onClick={() => { setEditingStore(false); handleViewStore(selectedStore); }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {err && <p style={errorText}>{err}</p>}
                
                {/* User Stores Modal */}
                {showUserStores && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            ...card,
                            maxWidth: 1000,
                            maxHeight: "90vh",
                            margin: 20,
                            backgroundColor: "white",
                            overflow: "auto"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h3 style={{ margin: 0 }}>User Stores</h3>
                                <button style={closeButton} onClick={() => { setShowUserStores(false); setUserStores([]); }}>
                                    ×
                                </button>
                            </div>
                            
                            {userStoresLoading ? (
                                <p>Loading stores...</p>
                            ) : userStores.length === 0 ? (
                                <p style={{ color: "#6b7280" }}>No stores found for this user.</p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Store Name</th>
                                                <th style={th}>Category</th>
                                                <th style={th}>Zone</th>
                                                <th style={th}>Address</th>
                                                <th style={th}>Location</th>
                                                <th style={th}>Discount</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Visits</th>
                                                <th style={th}>Loops Earned</th>
                                                <th style={th}>Total Spent</th>
                                                <th style={th}>First Visit</th>
                                                <th style={th}>Last Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {userStores.map((store) => (
                                                <tr key={store.store_id}>
                                                    <td style={td}><strong>{store.store_name}</strong></td>
                                                    <td style={td}>{store.category}</td>
                                                    <td style={td}>{store.zone}</td>
                                                    <td style={td}>{store.store_address || "-"}</td>
                                                    <td style={td}>
                                                        {store.latitude && store.longitude 
                                                            ? `${store.latitude.toFixed(4)}, ${store.longitude.toFixed(4)}`
                                                            : "-"}
                                                    </td>
                                                    <td style={td}>{store.base_discount_percent}%</td>
                                                    <td style={td}>{store.store_email || "-"}</td>
                                                    <td style={td}>{store.store_phone || "-"}</td>
                                                    <td style={td}>{store.visit_count}</td>
                                                    <td style={td}><strong>{store.total_loops_earned?.toLocaleString() || 0}</strong></td>
                                                    <td style={td}>${((store.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                    <td style={td}>{store.first_visit_at ? new Date(store.first_visit_at).toLocaleDateString() : "-"}</td>
                                                    <td style={td}>{store.last_visit_at ? new Date(store.last_visit_at).toLocaleDateString() : "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Store Customers Modal */}
                {showStoreCustomers && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            ...card,
                            maxWidth: 900,
                            maxHeight: "90vh",
                            margin: 20,
                            backgroundColor: "white",
                            overflow: "auto"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <h3 style={{ margin: 0 }}>Store Customers</h3>
                                <button style={closeButton} onClick={() => { setShowStoreCustomers(false); setStoreCustomers([]); }}>
                                    ×
                                </button>
                            </div>
                            
                            {storeCustomersLoading ? (
                                <p>Loading customers...</p>
                            ) : storeCustomers.length === 0 ? (
                                <p style={{ color: "#6b7280" }}>No customers found for this store.</p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={table}>
                                        <thead>
                                            <tr>
                                                <th style={th}>Name</th>
                                                <th style={th}>Phone</th>
                                                <th style={th}>Email</th>
                                                <th style={th}>Plan</th>
                                                <th style={th}>Visits</th>
                                                <th style={th}>Loops Earned</th>
                                                <th style={th}>Total Spent</th>
                                                <th style={th}>Last Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {storeCustomers.map((customer) => (
                                                <tr key={customer.id}>
                                                    <td style={td}>{customer.name}</td>
                                                    <td style={td}>{customer.phone}</td>
                                                    <td style={td}>{customer.email || "-"}</td>
                                                    <td style={td}>{customer.plan}</td>
                                                    <td style={td}>{customer.visit_count}</td>
                                                    <td style={td}><strong>{customer.total_loops_earned?.toLocaleString() || 0}</strong></td>
                                                    <td style={td}>${((customer.total_spent_cents || 0) / 100).toFixed(2)}</td>
                                                    <td style={td}>{customer.last_visit_at ? new Date(customer.last_visit_at).toLocaleDateString() : "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Delete Confirmation Modal */}
                {deleteConfirm.show && (
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            ...card,
                            maxWidth: 500,
                            margin: 20,
                            backgroundColor: "white"
                        }}>
                            <h3 style={{ margin: "0 0 16px 0", fontSize: 20, color: "#111827" }}>
                                Confirm Delete
                            </h3>
                            <p style={{ margin: "0 0 24px 0", color: "#6b7280" }}>
                                Are you sure you want to delete {deleteConfirm.type === "user" ? "user" : "store"} <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
                            </p>
                            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                <button
                                    style={secondaryButton}
                                    onClick={() => setDeleteConfirm({ show: false, type: null, id: null, name: null })}
                                >
                                    Cancel
                                </button>
                                <button
                                    style={{ ...primaryButton, background: "#ef4444", color: "white" }}
                                    onClick={deleteConfirm.type === "user" ? handleDeleteUser : handleDeleteStore}
                                    disabled={loading}
                                >
                                    {loading ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// Styles
const container = {
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
};

const loginContainer = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "20px",
};

const loginBox = {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: "32px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    maxWidth: 400,
    width: "100%",
};

const input = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    marginBottom: 12,
    boxSizing: "border-box",
};

const primaryButton = {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "#2563eb",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const linkButton = {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
};

const errorText = {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
};

const header = {
    backgroundColor: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const headerContent = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 16,
};

const title = {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: "#111827",
};

const headerActions = {
    display: "flex",
    alignItems: "center",
    gap: 16,
};

const userInfo = {
    fontSize: 14,
    color: "#6b7280",
};

const logoutButton = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    backgroundColor: "#fff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
};

const tabs = {
    display: "flex",
    gap: 8,
    borderBottom: "2px solid #e5e7eb",
};

const tabButton = {
    padding: "12px 20px",
    border: "none",
    backgroundColor: "transparent",
    color: "#6b7280",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: "-2px",
    transition: "all 0.2s",
};

const activeTabStyle = {
    color: "#2563eb",
    borderBottom: "2px solid #2563eb",
};

const main = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 20px",
};

const sectionTitle = {
    fontSize: 20,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 20,
    color: "#111827",
};

const statsGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 32,
};

const statCard = {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    textAlign: "center",
};

const statValue = {
    fontSize: 32,
    fontWeight: 700,
    margin: "0 0 8px 0",
    color: "#111827",
};

const statLabel = {
    fontSize: 14,
    color: "#6b7280",
    margin: 0,
};

const card = {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    marginBottom: 24,
};

const cardTitle = {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 16,
    color: "#111827",
};

const tableContainer = {
    overflowX: "auto",
};

const table = {
    width: "100%",
    borderCollapse: "collapse",
};

const th = {
    padding: "12px",
    textAlign: "left",
    borderBottom: "2px solid #e5e7eb",
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
};

const td = {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
    color: "#111827",
};

const smallButton = {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    backgroundColor: "#fff",
    color: "#374151",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
};

const secondaryButton = {
    ...smallButton,
    padding: "10px 20px",
};

const modal = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
};

const modalContent = {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: "24px",
    maxWidth: 600,
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
};

const closeButton = {
    background: "none",
    border: "none",
    fontSize: 24,
    color: "#6b7280",
    cursor: "pointer",
    padding: 0,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const label = {
    display: "block",
    fontSize: 13,
    marginBottom: 4,
    fontWeight: 500,
    color: "#374151",
};

const detailRow = {
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
};
