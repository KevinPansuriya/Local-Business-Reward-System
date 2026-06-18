// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import { userLogin, userSignup, forgotPasswordCustomer, resetPasswordCustomer, startWebAuthnAuthentication, finishWebAuthnAuthentication, trackEvent, getUtmFromUrl } from "./api";
import { startAuthentication } from "@simplewebauthn/browser";
import CustomerApp from "./CustomerApp";
import StoreApp from "./StoreApp";
import AdminApp from "./AdminApp";

function App() {
    const getStored = (key) => (typeof window !== "undefined" ? window.localStorage.getItem(key) : null);
    const [mode, setMode] = useState(() => getStored("cc_mode") || "customer");
    const [token, setToken] = useState(() => {
        const storedMode = getStored("cc_mode") || "customer";
        if (storedMode === "admin") {
            return getStored("cc_admin_token") || "";
        }
        return getStored("cc_customer_token") || "";
    });
    const [entityId, setEntityId] = useState(() => {
        const raw = getStored("cc_customer_id");
        return raw ? Number(raw) : null;
    });
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [dob, setDob] = useState("");
    const [dobInputFocused, setDobInputFocused] = useState(false);
    const [password, setPassword] = useState("");
    const [showSignup, setShowSignup] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetCode, setResetCode] = useState("");
    const [resetRequested, setResetRequested] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [faceIDLoading, setFaceIDLoading] = useState(false);
    const pageViewSentRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("cc_mode", mode);
    }, [mode]);

    // Check URL for mode parameter on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const urlMode = urlParams.get("mode");
            if (urlMode === "store" || urlMode === "customer" || urlMode === "admin") {
                setMode(urlMode);
            }
        }
    }, []);

    // Track page_view once when customer login screen is shown (no token)
    useEffect(() => {
        if (typeof window === "undefined" || mode !== "customer" || token) return;
        if (pageViewSentRef.current) return;
        pageViewSentRef.current = true;
        const utm = getUtmFromUrl();
        trackEvent("page_view", { ...utm, payload: { app: "customer" } });
    }, [mode, token]);

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
            if (typeof window !== "undefined") {
                window.localStorage.setItem("cc_customer_token", res.token);
                window.localStorage.setItem("cc_customer_id", String(res.userId));
            }
        } catch (e) {
            setErr(e.message);
            setToken("");
            setEntityId(null);
            if (typeof window !== "undefined") {
                window.localStorage.removeItem("cc_customer_token");
                window.localStorage.removeItem("cc_customer_id");
            }
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
        const utm = getUtmFromUrl();
        try {
            const res = await userSignup(
                phone,
                email,
                password,
                name,
                null,
                null,
                null,
                null,
                null,
                null,
                dob,
                "web",
                utm.utm_source,
                utm.utm_medium,
                utm.utm_campaign
            );
            setToken(res.token);
            setEntityId(res.userId);
            if (typeof window !== "undefined") {
                window.localStorage.setItem("cc_customer_token", res.token);
                window.localStorage.setItem("cc_customer_id", String(res.userId));
            }
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
            setSuccessMsg(res.message || "Reset code sent to your phone number");
            setResetRequested(true);
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
            const res = await resetPasswordCustomer(phone, resetCode, newPassword);
            setSuccessMsg(res.message || "Password reset successfully. You can now login.");
            setTimeout(() => {
                setShowForgotPassword(false);
                setResetCode("");
                setResetRequested(false);
                setNewPassword("");
                setConfirmPassword("");
            }, 2000);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

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
        if (typeof window !== "undefined") {
            window.localStorage.removeItem("cc_customer_token");
            window.localStorage.removeItem("cc_customer_id");
            window.localStorage.removeItem("cc_customer_active_tab");
            window.localStorage.removeItem("cc_customer_settings_section");
        }
    };

    return (
        <div style={appContainer}>
            {mode !== "admin" && (
                <header style={header}>
                    <div style={headerButtons}>
                        <button
                            style={{
                                ...modeButton,
                                backgroundColor: mode === "customer" ? "var(--cc-primary)" : "var(--cc-surface-2)",
                                color: mode === "customer" ? "white" : "var(--cc-text)",
                            }}
                            onClick={() => {
                                setMode("customer");
                                setToken("");
                                setEntityId(null);
                                setErr("");
                                setPhone("");
                                setEmail("");
                                setName("");
                                setDob("");
                                setPassword("");
                                setShowSignup(false);
                                if (typeof window !== "undefined") {
                                    window.localStorage.removeItem("cc_customer_token");
                                    window.localStorage.removeItem("cc_customer_id");
                                    window.localStorage.removeItem("cc_customer_active_tab");
                                    window.localStorage.removeItem("cc_customer_settings_section");
                                }
                            }}
                        >
                            Customer
                        </button>
                        <button
                            style={{
                                ...modeButton,
                                backgroundColor: mode === "store" ? "var(--cc-primary)" : "var(--cc-surface-2)",
                                color: mode === "store" ? "white" : "var(--cc-text)",
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
                                backgroundColor: mode === "admin" ? "var(--cc-primary)" : "var(--cc-surface-2)",
                                color: mode === "admin" ? "white" : "var(--cc-text)",
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
                    <div style={logoBlock}>
                        <strong style={logo}>CityCircle</strong>
                        <span style={logoTagline}>The Trusted Circle for Local Shops.</span>
                    </div>
                    {(mode === "customer" && token) || (mode === "store" && (typeof window !== "undefined" && (window.sessionStorage.getItem("cc_store_token") || window.localStorage.getItem("cc_store_token")))) ? (
                        <button
                            style={headerLogout}
                            onClick={() => {
                                if (mode === "customer") {
                                    handleLogout();
                                } else if (mode === "store") {
                                    // Clear store token
                                    if (typeof window !== "undefined") {
                                        window.sessionStorage.removeItem("cc_store_token");
                                        window.localStorage.removeItem("cc_store_token");
                                        window.localStorage.removeItem("cc_store_active_tab");
                                    }
                                    // Reload to reset StoreApp state
                                    window.location.reload();
                                }
                            }}
                        >
                            Logout
                        </button>
                    ) : null}
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
                        <h3 style={{ marginTop: 0 }}>
                            {showForgotPassword
                                ? "Reset Password"
                                : showSignup
                                    ? "Customer Signup"
                                    : "Customer Login"}
                        </h3>
                        {(!showSignup || showForgotPassword) && (
                            <input
                                style={input}
                                type="tel"
                                placeholder="Phone Number (required)"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    setErr("");
                                }}
                                onKeyPress={(e) =>
                                    e.key === "Enter" &&
                                    (showForgotPassword ? handleForgotPassword() : showSignup ? handleSignup() : handleLogin())
                                }
                            />
                        )}
                        {!showForgotPassword && showSignup && (
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
                                <input
                                    style={input}
                                    type="tel"
                                    placeholder="Phone Number (required)"
                                    value={phone}
                                    onChange={(e) => {
                                        setPhone(e.target.value);
                                        setErr("");
                                    }}
                                />
                                <input
                                    style={input}
                                    type={dobInputFocused || dob ? "date" : "text"}
                                    placeholder="Birthdate (MM/DD/YYYY)"
                                    value={dob}
                                    onFocus={() => setDobInputFocused(true)}
                                    onBlur={() => setDobInputFocused(false)}
                                    onChange={(e) => {
                                        setDob(e.target.value);
                                        setErr("");
                                    }}
                                />
                            </>
                        )}

                        {!showForgotPassword && (
                            <input
                                style={input}
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setErr("");
                                }}
                                onKeyPress={(e) =>
                                    e.key === "Enter" && (showSignup ? handleSignup() : handleLogin())
                                }
                            />
                        )}

                        {showForgotPassword && (
                            <>
                                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    <button
                                        style={primaryButton}
                                        onClick={handleForgotPassword}
                                        disabled={loading}
                                    >
                                        {loading ? "Sending..." : "Send SMS Code"}
                                    </button>
                                </div>
                                {resetRequested && (
                                    <>
                                        <input
                                            style={input}
                                            type="text"
                                            placeholder="6-digit code"
                                            value={resetCode}
                                            onChange={(e) => setResetCode(e.target.value)}
                                        />
                                        <input
                                            style={input}
                                            type="password"
                                            placeholder="New password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                        <input
                                            style={input}
                                            type="password"
                                            placeholder="Confirm new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                        <button
                                            style={primaryButton}
                                            onClick={handleResetPassword}
                                            disabled={loading}
                                        >
                                            {loading ? "Resetting..." : "Reset Password"}
                                        </button>
                                    </>
                                )}
                            </>
                        )}

                        {!showForgotPassword && (
                            <>
                                <div style={buttonGroup}>
                                    <button
                                        style={primaryButton}
                                        onClick={showSignup ? handleSignup : handleLogin}
                                        disabled={loading || faceIDLoading}
                                    >
                                        {loading
                                            ? showSignup
                                                ? "Signing up..."
                                                : "Logging in..."
                                            : showSignup
                                                ? "Sign Up"
                                                : "Login"}
                                    </button>
                                </div>
                                {!showSignup && (
                                    <div style={{ marginTop: 12 }}>
                                        <button
                                            style={{ ...primaryButton, backgroundColor: "var(--cc-success)", width: "100%" }}
                                            onClick={handleFaceIDLogin}
                                            disabled={loading || faceIDLoading}
                                        >
                                            {faceIDLoading ? "Authenticating..." : "🔐 Login with Face ID"}
                                        </button>
                                        <p style={{ fontSize: 11, color: "var(--cc-muted)", marginTop: 8, textAlign: "center" }}>
                                            Use Face ID (iPhone) or Face Unlock (Samsung) for quick login
                                        </p>
                                    </div>
                                )}
                                <div style={{ marginTop: 12, textAlign: "center" }}>
                                    <button
                                        style={{ ...linkButton }}
                                        onClick={() => {
                                            if (!showSignup) trackEvent("signup_started", getUtmFromUrl());
                                            setShowSignup(!showSignup);
                                            setErr("");
                                        }}
                                    >
                                        {showSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
                                    </button>
                                </div>
                                {!showSignup && (
                                    <div style={{ marginTop: 8, textAlign: "center" }}>
                                        <button
                                            style={linkButton}
                                            onClick={() => {
                                                setShowForgotPassword(true);
                                                setResetRequested(false);
                                                setResetCode("");
                                                setNewPassword("");
                                                setConfirmPassword("");
                                                setErr("");
                                                setSuccessMsg("");
                                            }}
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {showForgotPassword && (
                            <div style={{ marginTop: 12, textAlign: "center" }}>
                                <button
                                    style={linkButton}
                                    onClick={() => {
                                        setShowForgotPassword(false);
                                        setResetRequested(false);
                                        setResetCode("");
                                        setNewPassword("");
                                        setConfirmPassword("");
                                        setErr("");
                                        setSuccessMsg("");
                                    }}
                                >
                                    Back to login
                                </button>
                            </div>
                        )}

                        {successMsg && <p style={{ ...successText }}>{successMsg}</p>}
                        {err && <p style={errorText}>{err}</p>}
                    </div>
                )}
                {mode === "customer" && token && null}

                {mode === "customer" && token && (
                    <>
                        <CustomerApp token={token} onLogout={handleLogout} />
                    </>
                )}

                {mode === "store" && <StoreApp onStoreToken={(token) => {
                    // Handle store token changes
                    if (!token && typeof window !== "undefined") {
                        window.sessionStorage.removeItem("cc_store_token");
                        window.localStorage.removeItem("cc_store_token");
                        window.localStorage.removeItem("cc_store_active_tab");
                    }
                }} />}
                    </>
                )}
            </main>
        </div>
    );
}

const appContainer = {
    fontFamily: "system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
    backgroundColor: "var(--cc-bg)",
};

const header = {
    padding: "16px 20px",
    borderBottom: "1px solid var(--cc-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "var(--cc-surface)",
    boxShadow: "var(--cc-shadow-sm)",
    flexWrap: "wrap",
    gap: 12,
};

const headerButtons = {
    display: "flex",
    gap: 8,
};

const modeButton = {
    padding: "8px 16px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
};

const logo = {
    fontSize: 18,
    color: "var(--cc-text)",
    fontWeight: 600,
};

const logoBlock = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
};

const logoTagline = {
    fontSize: 11,
    color: "var(--cc-muted)",
    letterSpacing: "0.2px",
};

const headerLogout = {
    padding: "6px 12px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    background: "var(--cc-surface)",
    color: "var(--cc-text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
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
    color: "var(--cc-text)",
};

const loginBox = {
    border: "1px solid var(--cc-border)",
    padding: 20,
    borderRadius: "var(--cc-radius-md)",
    maxWidth: 400,
    backgroundColor: "var(--cc-surface)",
    boxShadow: "var(--cc-shadow-sm)",
    marginBottom: 24,
};

const input = {
    display: "block",
    marginBottom: 12,
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
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
    borderRadius: "var(--cc-radius-sm)",
    border: "none",
    backgroundColor: "var(--cc-primary)",
    color: "white",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
};

const secondaryButton = {
    padding: "10px 20px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    backgroundColor: "var(--cc-surface-2)",
    color: "var(--cc-text)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
};

const infoText = {
    marginTop: 12,
    fontSize: 12,
    color: "var(--cc-muted)",
};

const errorText = {
    marginTop: 12,
    color: "var(--cc-danger)",
    fontSize: 13,
};

const successText = {
    marginTop: 12,
    color: "var(--cc-success)",
    fontSize: 13,
};

const linkButton = {
    background: "none",
    border: "none",
    color: "var(--cc-primary)",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
};

export default App;

