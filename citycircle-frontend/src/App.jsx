// src/App.jsx
import React, { useState } from "react";
import { userLogin, userSignup, forgotPasswordCustomer, resetPasswordCustomer, startWebAuthnAuthentication, finishWebAuthnAuthentication } from "./api";
import { startAuthentication } from "@simplewebauthn/browser";
import CustomerApp from "./CustomerApp";
import StoreMapView from "./StoreMapView";
import StoreApp from "./StoreApp";
import AdminApp from "./AdminApp";

function App() {
    const [mode, setMode] = useState("customer");
    const [token, setToken] = useState("");
    const [entityId, setEntityId] = useState(null);
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [password, setPassword] = useState("");
    const [showSignup, setShowSignup] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetToken, setResetToken] = useState(null);
    const [resetType, setResetType] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [faceIDLoading, setFaceIDLoading] = useState(false);

    const handleLogin = async () => {
        if (mode !== "customer") return;
        if (!phone || !password) {
            setErr("Phone number and password are required");
            return;
        }

        setErr("");
        setLoading(true);
        try {
            const res = await userLogin(phone, password);
            setToken(res.token);
            setEntityId(res.userId);
        } catch (e) {
            setErr(e.message);
            setToken("");
            setEntityId(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!phone || !password || !name) {
            setErr("Phone number, password, and name are required");
            return;
        }

        // Validate phone (max 10 digits)
        const cleanedPhone = phone.replace(/\D/g, '');
        if (cleanedPhone.length !== 10) {
            setErr("Phone number must be exactly 10 digits");
            return;
        }

        // Validate email if provided (must contain @)
        if (email && !email.includes("@")) {
            setErr("Email must contain @ symbol");
            return;
        }

        setErr("");
        setLoading(true);
        try {
            const res = await userSignup(phone, email, password, name, address);
            setToken(res.token);
            setEntityId(res.userId);
            setShowSignup(false);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!phone) {
            setErr("Phone number is required");
            return;
        }

        const cleanedPhone = phone.replace(/\D/g, '');
        if (cleanedPhone.length !== 10) {
            setErr("Phone number must be exactly 10 digits");
            return;
        }

        setErr("");
        setSuccessMsg("");
        setLoading(true);
        try {
            const res = await forgotPasswordCustomer(cleanedPhone);
            setSuccessMsg(res.message || "Password reset link sent to your phone number");
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            setErr("Both password fields are required");
            return;
        }

        if (newPassword.length < 6) {
            setErr("Password must be at least 6 characters");
            return;
        }

        if (newPassword !== confirmPassword) {
            setErr("Passwords do not match");
            return;
        }

        setErr("");
        setLoading(true);
        try {
            const res = await resetPasswordCustomer(resetToken, newPassword);
            setSuccessMsg(res.message || "Password reset successfully. You can now login.");
            setTimeout(() => {
                setShowForgotPassword(false);
                setResetToken(null);
                setNewPassword("");
                setConfirmPassword("");
            }, 2000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Check for reset token in URL on mount
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const type = urlParams.get('type');
        if (token && type === 'user') {
            setResetToken(token);
            setResetType(type);
            setShowForgotPassword(true);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleFaceIDLogin = async () => {
        if (mode !== "customer") return;
        
        // Phone number is required to identify which user's credentials to use
        // Show error if not entered (better UX than prompt)
        if (!phone || phone.trim() === "") {
            setErr("Please enter your phone number first, then click Login with Face ID");
            return;
        }

        const cleanedPhone = phone.replace(/\D/g, '');
        if (cleanedPhone.length !== 10) {
            setErr("Phone number must be exactly 10 digits");
            return;
        }

        setErr("");
        setFaceIDLoading(true);
        
        try {
            // Step 1: Get authentication options
            const options = await startWebAuthnAuthentication(cleanedPhone);
            
            // Validate options response
            if (!options) {
                throw new Error("No response from server. Please check if the backend server is running.");
            }
            
            if (options.error) {
                throw new Error(options.error);
            }
            
            if (!options.challenge) {
                console.error("Invalid options response:", options);
                throw new Error("Server returned invalid authentication options. Please try again.");
            }
            
            // Step 2: Authenticate using browser API
            const credential = await startAuthentication(options);
            
            // Step 3: Verify with server
            const result = await finishWebAuthnAuthentication(cleanedPhone, credential);
            
            if (result.verified && result.token) {
                setToken(result.token);
                setEntityId(result.userId);
            } else {
                setErr("Face ID authentication failed. Please try again or use password login.");
            }
        } catch (error) {
            console.error("Face ID login error:", error);
            
            // Check if HTTPS is required
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                setErr("WebAuthn/Face ID requires HTTPS. Please use ngrok or HTTPS connection. Current: " + window.location.protocol + "//" + window.location.host);
            } else if (error.name === "NotSupportedError") {
                setErr("WebAuthn is not supported in this browser. Please use a modern browser or use password login.");
            } else if (error.name === "NotAllowedError") {
                setErr("Face ID is not available or was cancelled. Please use password login.");
            } else if (error.message && error.message.includes("not set up")) {
                setErr("Facial recognition is not set up for this account. Please use password login.");
            } else {
                setErr(error.message || "Face ID authentication failed. Please use password login.");
            }
        } finally {
            setFaceIDLoading(false);
        }
    };

    const handleLogout = () => {
        setToken("");
        setEntityId(null);
    };

    return (
        <div style={appContainer}>
            {mode !== "admin" && (
                <header style={header}>
                    <div style={headerButtons}>
                        <button
                            style={{
                                ...modeButton,
                                backgroundColor: mode === "customer" ? "#2563eb" : "#f3f4f6",
                                color: mode === "customer" ? "white" : "#374151",
                            }}
                            onClick={() => {
                                setMode("customer");
                                setToken("");
                                setEntityId(null);
                                setErr("");
                                setPhone("");
                                setEmail("");
                                setName("");
                                setAddress("");
                                setPassword("");
                                setShowSignup(false);
                            }}
                        >
                            Customer
                        </button>
                        <button
                            style={{
                                ...modeButton,
                                backgroundColor: mode === "store" ? "#2563eb" : "#f3f4f6",
                                color: mode === "store" ? "white" : "#374151",
                            }}
                            onClick={() => {
                                setMode("store");
                                setToken("");
                                setEntityId(null);
                                setErr("");
                            }}
                        >
                            Store
                        </button>
                        <button
                            style={{
                                ...modeButton,
                                backgroundColor: mode === "admin" ? "#2563eb" : "#f3f4f6",
                                color: mode === "admin" ? "white" : "#374151",
                            }}
                            onClick={() => {
                                setMode("admin");
                                setToken("");
                                setEntityId(null);
                                setErr("");
                            }}
                        >
                            Admin
                        </button>
                    </div>
                    <strong style={logo}>CityCircle</strong>
                </header>
            )}

            <main style={main}>
                {mode === "admin" ? (
                    <AdminApp 
                        token={token} 
                        onToken={(newToken) => {
                            setToken(newToken);
                            setEntityId(null);
                        }} 
                    />
                ) : (
                    <>
                        <h1 style={title}>{mode === "customer" ? "Customer Portal" : "Store Portal"}</h1>

                {mode === "customer" && !token && (
                    <div style={loginBox}>
                        <h3 style={{ marginTop: 0 }}>{showSignup ? "Customer Signup" : "Customer Login"}</h3>
                        <input
                            style={input}
                            type="tel"
                            placeholder="Phone Number (required)"
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value);
                                setErr("");
                            }}
                            onKeyPress={(e) => e.key === "Enter" && (showSignup ? handleSignup() : handleLogin())}
                        />
                        {showSignup && (
                            <>
                                <input
                                    style={input}
                                    type="text"
                                    placeholder="Name (required)"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setErr("");
                                    }}
                                />
                                <input
                                    style={input}
                                    type="email"
                                    placeholder="Email (optional - for verification)"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setErr("");
                                    }}
                                />
                                <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0 0" }}>
                                    Email is optional but recommended for account recovery
                                </p>
                                <input
                                    style={input}
                                    type="text"
                                    placeholder="Address (optional)"
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(e.target.value);
                                        setErr("");
                                    }}
                                />
                            </>
                        )}
                        <input
                            style={input}
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setErr("");
                            }}
                            onKeyPress={(e) => e.key === "Enter" && (showSignup ? handleSignup() : handleLogin())}
                        />
                        <div style={buttonGroup}>
                            <button 
                                style={primaryButton} 
                                onClick={showSignup ? handleSignup : handleLogin} 
                                disabled={loading || faceIDLoading}
                            >
                                {loading ? (showSignup ? "Signing up..." : "Logging in...") : (showSignup ? "Sign Up" : "Login")}
                            </button>
                        </div>
                        {!showSignup && (
                            <div style={{ marginTop: 12 }}>
                                <button
                                    style={{ ...primaryButton, backgroundColor: "#10b981", width: "100%" }}
                                    onClick={handleFaceIDLogin}
                                    disabled={loading || faceIDLoading}
                                >
                                    {faceIDLoading ? "Authenticating..." : "🔐 Login with Face ID"}
                                </button>
                                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8, textAlign: "center" }}>
                                    Use Face ID (iPhone) or Face Unlock (Samsung) for quick login
                                </p>
                            </div>
                        )}
                        <div style={{ marginTop: 12, textAlign: "center" }}>
                            <button
                                style={{ ...linkButton }}
                                onClick={() => {
                                    setShowSignup(!showSignup);
                                    setErr("");
                                }}
                            >
                                {showSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
                            </button>
                        </div>
                        {err && <p style={errorText}>{err}</p>}
                    </div>
                )}
                {mode === "customer" && token && (
                    <div style={loginBox}>
                        <div style={buttonGroup}>
                            <button style={secondaryButton} onClick={handleLogout}>
                                Logout
                            </button>
                        </div>
                        {entityId && (
                            <p style={infoText}>
                                Logged in as customer ID: {entityId}
                            </p>
                        )}
                    </div>
                )}

                {mode === "customer" && token && (
                    <>
                        <CustomerApp token={token} />
                        <StoreMapView token={token} />
                    </>
                )}

                {mode === "store" && <StoreApp />}
                    </>
                )}
            </main>
        </div>
    );
}

const appContainer = {
    fontFamily: "system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
};

const header = {
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    flexWrap: "wrap",
    gap: 12,
};

const headerButtons = {
    display: "flex",
    gap: 8,
};

const modeButton = {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
};

const logo = {
    fontSize: 18,
    color: "#111827",
    fontWeight: 600,
};

const main = {
    padding: "20px",
    maxWidth: 1200,
    margin: "0 auto",
};

const title = {
    fontSize: "clamp(24px, 5vw, 32px)",
    marginTop: 0,
    marginBottom: 24,
    color: "#111827",
};

const loginBox = {
    border: "1px solid #e5e7eb",
    padding: 20,
    borderRadius: 12,
    maxWidth: 400,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    marginBottom: 24,
};

const input = {
    display: "block",
    marginBottom: 12,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 14,
    boxSizing: "border-box",
};

const buttonGroup = {
    display: "flex",
    gap: 8,
    marginTop: 8,
};

const primaryButton = {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const secondaryButton = {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
};

const infoText = {
    marginTop: 12,
    fontSize: 12,
    color: "#6b7280",
};

const errorText = {
    marginTop: 12,
    color: "#ef4444",
    fontSize: 13,
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

export default App;
