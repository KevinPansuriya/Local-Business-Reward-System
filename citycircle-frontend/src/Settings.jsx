// src/Settings.jsx
import React, { useState, useEffect } from "react";
import { fetchUserMe, getWebAuthnStatus, startWebAuthnRegistration, finishWebAuthnRegistration, updateUserProfile } from "./api";
import { startRegistration } from "@simplewebauthn/browser";

export default function Settings({ token, user, onProfileUpdate }) {
    const [activeSection, setActiveSection] = useState("profile");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    // Profile form state
    const [name, setName] = useState(user?.name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [address, setAddress] = useState(user?.address || "");
    
    // WebAuthn state
    const [hasWebAuthn, setHasWebAuthn] = useState(false);
    const [webauthnLoading, setWebauthnLoading] = useState(false);
    const [webauthnError, setWebauthnError] = useState("");
    const [webauthnSuccess, setWebauthnSuccess] = useState("");

    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setEmail(user.email || "");
            setPhone(user.phone || "");
            setAddress(user.address || "");
        }
    }, [user]);

    useEffect(() => {
        if (!token) return;
        getWebAuthnStatus(token)
            .then((data) => {
                if (data && typeof data.hasCredentials === 'boolean') {
                    setHasWebAuthn(data.hasCredentials);
                } else {
                    setHasWebAuthn(false);
                }
            })
            .catch((err) => {
                console.warn("Could not check WebAuthn status:", err);
                setHasWebAuthn(false);
            });
    }, [token]);

    const handleSaveProfile = async () => {
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        
        setSaving(true);
        setError("");
        setSuccess("");
        
        try {
            // Update profile via API
            await updateUserProfile(token, { name, email, address });
            setSuccess("Profile updated successfully!");
            setEditing(false);
            if (onProfileUpdate) {
                const data = await fetchUserMe({ token, period: 30, storeId: "all" });
                onProfileUpdate(data.user);
            }
            setTimeout(() => setSuccess(""), 3000);
        } catch (e) {
            setError(e.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleRegisterWebAuthn = async () => {
        setWebauthnLoading(true);
        setWebauthnError("");
        setWebauthnSuccess("");
        
        try {
            const options = await startWebAuthnRegistration(token);
            
            if (!options || !options.challenge) {
                throw new Error("Server returned invalid registration options");
            }
            
            const credential = await startRegistration(options);
            const deviceName = navigator.userAgent.includes('iPhone') ? 'iPhone' : 
                              navigator.userAgent.includes('Android') ? 'Android' : 
                              'Device';
            
            await finishWebAuthnRegistration(token, credential, deviceName);
            setWebauthnSuccess("Face ID setup successful! You can now use it to login.");
            setHasWebAuthn(true);
        } catch (error) {
            console.error("WebAuthn registration error:", error);
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                setWebauthnError("WebAuthn requires HTTPS. Please use ngrok or HTTPS connection.");
            } else {
                setWebauthnError(error.message || "Failed to set up Face ID");
            }
        } finally {
            setWebauthnLoading(false);
        }
    };

    const card = {
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
    };

    const button = {
        padding: "12px 24px",
        borderRadius: 8,
        border: "none",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        background: "#2563eb",
        color: "#fff",
        transition: "all 0.2s"
    };

    const input = {
        width: "100%",
        padding: "12px 16px",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        fontSize: 14,
        marginBottom: 12
    };

    const sectionButton = {
        padding: "12px 20px",
        borderRadius: 8,
        border: "none",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        background: "transparent",
        color: "#6b7280",
        transition: "all 0.2s",
        marginRight: 8,
        marginBottom: 8
    };

    return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px" }}>
            <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 28, fontWeight: 700 }}>⚙️ Settings</h2>

            {/* Section Navigation */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", borderBottom: "2px solid #e5e7eb", paddingBottom: 12 }}>
                <button
                    style={{
                        ...sectionButton,
                        background: activeSection === "profile" ? "#2563eb" : "transparent",
                        color: activeSection === "profile" ? "#fff" : "#6b7280",
                        borderBottom: activeSection === "profile" ? "2px solid #2563eb" : "none"
                    }}
                    onClick={() => setActiveSection("profile")}
                >
                    👤 Profile
                </button>
                <button
                    style={{
                        ...sectionButton,
                        background: activeSection === "security" ? "#2563eb" : "transparent",
                        color: activeSection === "security" ? "#fff" : "#6b7280",
                        borderBottom: activeSection === "security" ? "2px solid #2563eb" : "none"
                    }}
                    onClick={() => setActiveSection("security")}
                >
                    🔒 Security
                </button>
            </div>

            {/* Profile Section */}
            {activeSection === "profile" && (
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Profile Information</h3>
                        {!editing && (
                            <button
                                style={{ ...button, background: "#059669", padding: "8px 16px", fontSize: 13 }}
                                onClick={() => setEditing(true)}
                            >
                                ✏️ Edit
                            </button>
                        )}
                    </div>

                    {error && <div style={{ padding: 12, background: "#fee2e2", color: "#991b1b", borderRadius: 8, marginBottom: 16 }}>{error}</div>}
                    {success && <div style={{ padding: 12, background: "#d1fae5", color: "#065f46", borderRadius: 8, marginBottom: 16 }}>{success}</div>}

                    {editing ? (
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Full Name</label>
                            <input
                                style={input}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Email</label>
                            <input
                                style={input}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Phone Number</label>
                            <input
                                style={{ ...input, background: "#f3f4f6", cursor: "not-allowed" }}
                                type="tel"
                                value={phone}
                                disabled
                                placeholder="Phone number (cannot be changed)"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" }}>Home Address</label>
                            <textarea
                                style={{ ...input, minHeight: 80, resize: "vertical" }}
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Enter your home address"
                            />

                            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                                <button
                                    style={button}
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "💾 Save Changes"}
                                </button>
                                <button
                                    style={{ ...button, background: "#6b7280" }}
                                    onClick={() => {
                                        setEditing(false);
                                        setError("");
                                        setSuccess("");
                                        if (user) {
                                            setName(user.name || "");
                                            setEmail(user.email || "");
                                            setAddress(user.address || "");
                                        }
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Full Name</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{user?.name || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Email</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{user?.email || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Phone Number</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{user?.phone || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Home Address</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{user?.address || "—"}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Security Section */}
            {activeSection === "security" && (
                <div style={card}>
                    <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 700 }}>Security Settings</h3>

                    {/* Face ID / Biometric Login */}
                    <div style={{ 
                        padding: 20, 
                        background: hasWebAuthn ? "#f0fdf4" : "#fef3c7", 
                        borderRadius: 12, 
                        border: `1px solid ${hasWebAuthn ? "#bbf7d0" : "#fcd34d"}`,
                        marginBottom: 20
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
                                    Facial Recognition (Face ID)
                                </div>
                                {hasWebAuthn ? (
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <span style={{ fontSize: 20 }}>✓</span>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
                                                Facial recognition is set up. You can use Face ID to login.
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: "#15803d", marginTop: 8 }}>
                                            On your next login, you'll see an option to use Face ID instead of entering your password.
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 14, color: "#92400e", marginBottom: 12 }}>
                                            Set up facial recognition for faster, secure login using:
                                        </div>
                                        <ul style={{ fontSize: 13, color: "#78350f", marginBottom: 12, paddingLeft: 20, lineHeight: 1.8 }}>
                                            <li>Face ID or Touch ID on iPhone</li>
                                            <li>Face Unlock or Fingerprint on Samsung/Android</li>
                                            <li>Windows Hello on Windows laptops</li>
                                            <li>Touch ID on Mac laptops</li>
                                        </ul>
                                        <button
                                            style={button}
                                            onClick={handleRegisterWebAuthn}
                                            disabled={webauthnLoading}
                                        >
                                            {webauthnLoading ? "Setting up..." : "🔐 Set Up Face ID"}
                                        </button>
                                    </div>
                                )}
                                {webauthnError && (
                                    <div style={{ marginTop: 12, padding: 12, background: "#fee2e2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
                                        {webauthnError}
                                    </div>
                                )}
                                {webauthnSuccess && (
                                    <div style={{ marginTop: 12, padding: 12, background: "#d1fae5", color: "#065f46", borderRadius: 8, fontSize: 13 }}>
                                        {webauthnSuccess}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
