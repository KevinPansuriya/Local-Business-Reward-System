// src/Settings.jsx
import React, { useState, useEffect } from "react";
import {
    fetchUserMe,
    getWebAuthnStatus,
    startWebAuthnRegistration,
    finishWebAuthnRegistration,
    updateUserProfile,
    updateUserLocationByAddress,
    forgotPasswordCustomer,
    resetPasswordCustomer,
    fetchNotificationPreferences,
    updateNotificationPreferences,
} from "./api";
import { startRegistration } from "@simplewebauthn/browser";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Input from "./ui/Input";

export default function Settings({ token, user, onProfileUpdate }) {
    const getStored = (key) => (typeof window !== "undefined" ? window.localStorage.getItem(key) : null);
    const validSections = new Set(["profile", "security", "notifications"]);
    const getInitialSection = () => {
        const stored = getStored("cc_customer_settings_section");
        return validSections.has(stored) ? stored : "profile";
    };
    const [activeSection, setActiveSection] = useState(getInitialSection);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    // Profile form state
    const [name, setName] = useState(user?.name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [addressLine1, setAddressLine1] = useState(user?.address_line1 || "");
    const [addressLine2, setAddressLine2] = useState(user?.address_line2 || "");
    const [city, setCity] = useState(user?.city || "");
    const [stateCode, setStateCode] = useState(user?.state || "");
    const [postalCode, setPostalCode] = useState(user?.postal_code || "");
    const [dob, setDob] = useState(user?.dob || "");
    const [resetPhone, setResetPhone] = useState(user?.phone || "");
    const [resetCode, setResetCode] = useState("");
    const [resetNewPassword, setResetNewPassword] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetRequested, setResetRequested] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    
    // Notification preferences state
    const [notifPrefs, setNotifPrefs] = useState({
        promotions_enabled: true,
        updates_enabled: true,
        sms_enabled: false,
        email_enabled: false,
    });
    const [notifPrefsLoading, setNotifPrefsLoading] = useState(false);
    const [notifPrefsSaving, setNotifPrefsSaving] = useState(false);
    
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
            setAddressLine1(user.address_line1 || "");
            setAddressLine2(user.address_line2 || "");
            setCity(user.city || "");
            setStateCode(user.state || "");
            setPostalCode(user.postal_code || "");
            setDob(user.dob || "");
            setResetPhone(user.phone || "");
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
                setHasWebAuthn(false);
            });
    }, [token]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("cc_customer_settings_section", activeSection);
        }
    }, [activeSection]);

    useEffect(() => {
        if (!token || activeSection !== "notifications") return;
        let mounted = true;
        setNotifPrefsLoading(true);
        fetchNotificationPreferences(token)
            .then((data) => {
                if (!mounted) return;
                setNotifPrefs({
                    promotions_enabled: data?.promotions_enabled !== false,
                    updates_enabled: data?.updates_enabled !== false,
                    sms_enabled: data?.sms_enabled === true,
                    email_enabled: data?.email_enabled === true,
                });
            })
            .catch(() => {
                if (!mounted) return;
                setError("Failed to load notification preferences");
            })
            .finally(() => {
                if (mounted) setNotifPrefsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [token, activeSection]);

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
            await updateUserProfile(token, {
                name,
                email,
                address_line1: addressLine1,
                address_line2: addressLine2,
                city,
                state: stateCode,
                postal_code: postalCode,
                dob
            });

            if (addressLine1 && city && stateCode && postalCode) {
                await updateUserLocationByAddress(token, {
                    address_line1: addressLine1,
                    address_line2: addressLine2,
                    city,
                    state: stateCode,
                    postal_code: postalCode
                });
            }

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
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                setWebauthnError("WebAuthn requires HTTPS. Please use ngrok or HTTPS connection.");
            } else {
                setWebauthnError(error.message || "Failed to set up Face ID");
            }
        } finally {
            setWebauthnLoading(false);
        }
    };

    const handleCustomerForgotPassword = async () => {
        if (!resetPhone) {
            setResetError("Phone number is required");
            return;
        }
        const cleanedPhone = resetPhone.replace(/\D/g, "");
        if (cleanedPhone.length !== 10) {
            setResetError("Phone number must be exactly 10 digits");
            return;
        }
        try {
            setResetError("");
            setResetMessage("");
            setResetLoading(true);
            const res = await forgotPasswordCustomer(cleanedPhone);
            setResetMessage(res.message || "Reset code sent to your phone number");
            setResetRequested(true);
        } catch (err) {
            setResetError(err.message || "Failed to send reset code");
        } finally {
            setResetLoading(false);
        }
    };

    const handleCustomerResetPassword = async () => {
        if (!resetCode) {
            setResetError("Reset code is required");
            return;
        }
        if (!resetNewPassword || resetNewPassword.length < 6) {
            setResetError("Password must be at least 6 characters");
            return;
        }
        if (resetNewPassword !== resetConfirmPassword) {
            setResetError("Passwords do not match");
            return;
        }
        const cleanedPhone = resetPhone.replace(/\D/g, "");
        try {
            setResetError("");
            setResetMessage("");
            setResetLoading(true);
            const res = await resetPasswordCustomer(cleanedPhone, resetCode, resetNewPassword);
            setResetMessage(res.message || "Password reset successfully.");
            setTimeout(() => {
                setResetRequested(false);
                setResetCode("");
                setResetNewPassword("");
                setResetConfirmPassword("");
            }, 2000);
        } catch (err) {
            setResetError(err.message || "Failed to reset password");
        } finally {
            setResetLoading(false);
        }
    };

    const saveNotificationPreferences = async () => {
        if (!token) return;
        setNotifPrefsSaving(true);
        setError("");
        setSuccess("");
        try {
            await updateNotificationPreferences(token, notifPrefs);
            setSuccess("Notification preferences saved.");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message || "Failed to save notification preferences");
        } finally {
            setNotifPrefsSaving(false);
        }
    };

    const sectionButton = {
        padding: "12px 20px",
        borderRadius: 8,
        border: "none",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        background: "transparent",
        color: "var(--cc-muted)",
        transition: "all 0.2s",
        marginRight: 8,
        marginBottom: 8
    };

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
            <h2 style={{ marginTop: 0, marginBottom: 24, fontSize: 28, fontWeight: 800, color: "var(--cc-text)" }}>⚙️ Settings</h2>

            {/* Section Navigation */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", borderBottom: "2px solid var(--cc-border)", paddingBottom: 12 }}>
                <Button
                    variant={activeSection === "profile" ? "primary" : "ghost"}
                    style={{
                        ...sectionButton,
                        borderBottom: activeSection === "profile" ? "2px solid var(--cc-primary)" : "2px solid transparent"
                    }}
                    onClick={() => setActiveSection("profile")}
                >
                    👤 Profile
                </Button>
                <Button
                    variant={activeSection === "security" ? "primary" : "ghost"}
                    style={{
                        ...sectionButton,
                        borderBottom: activeSection === "security" ? "2px solid var(--cc-primary)" : "2px solid transparent"
                    }}
                    onClick={() => setActiveSection("security")}
                >
                    🔒 Security
                </Button>
                <Button
                    variant={activeSection === "notifications" ? "primary" : "ghost"}
                    style={{
                        ...sectionButton,
                        borderBottom: activeSection === "notifications" ? "2px solid var(--cc-primary)" : "2px solid transparent"
                    }}
                    onClick={() => setActiveSection("notifications")}
                >
                    🔔 Notifications
                </Button>
            </div>

            {/* Profile Section */}
            {activeSection === "profile" && (
                <Card style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Profile Information</h3>
                        {!editing && (
                            <Button
                                variant="secondary"
                                style={{ padding: "8px 12px", borderColor: "rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.10)" }}
                                onClick={() => setEditing(true)}
                            >
                                ✏️ Edit
                            </Button>
                        )}
                    </div>

                    {error && <div style={{ padding: 12, borderRadius: 12, marginBottom: 16, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.22)", color: "var(--cc-danger)" }}>{error}</div>}
                    {success && <div style={{ padding: 12, borderRadius: 12, marginBottom: 16, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "var(--cc-success)" }}>{success}</div>}

                    {editing ? (
                        <div>
                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Full Name</label>
                            <Input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Phone Number</label>
                            <Input
                                style={{ background: "var(--cc-surface-2)", cursor: "not-allowed" }}
                                type="tel"
                                value={phone}
                                disabled
                                placeholder="Phone number (cannot be changed)"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Date of Birth</label>
                            <Input
                                type="date"
                                value={dob || ""}
                                onChange={(e) => setDob(e.target.value)}
                                placeholder="YYYY-MM-DD"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Address Line 1</label>
                            <Input
                                type="text"
                                value={addressLine1}
                                onChange={(e) => setAddressLine1(e.target.value)}
                                placeholder="Street address"
                            />

                            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Address Line 2</label>
                            <Input
                                type="text"
                                value={addressLine2}
                                onChange={(e) => setAddressLine2(e.target.value)}
                                placeholder="Apt, suite, unit (optional)"
                            />

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>City</label>
                                    <Input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="City"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>State</label>
                                    <Input
                                        type="text"
                                        value={stateCode}
                                        onChange={(e) => setStateCode(e.target.value)}
                                        placeholder="State"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>Postal Code</label>
                                    <Input
                                        type="text"
                                        value={postalCode}
                                        onChange={(e) => setPostalCode(e.target.value)}
                                        placeholder="ZIP"
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                                <Button
                                    variant="primary"
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "💾 Save Changes"}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setEditing(false);
                                        setError("");
                                        setSuccess("");
                                        if (user) {
                                            setName(user.name || "");
                                            setEmail(user.email || "");
                                        setAddressLine1(user.address_line1 || "");
                                        setAddressLine2(user.address_line2 || "");
                                        setCity(user.city || "");
                                        setStateCode(user.state || "");
                                        setPostalCode(user.postal_code || "");
                                        setDob(user.dob || "");
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 4 }}>Full Name</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cc-text)" }}>{user?.name || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 4 }}>Email</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cc-text)" }}>{user?.email || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 4 }}>Phone Number</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cc-text)" }}>{user?.phone || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 4 }}>Date of Birth</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cc-text)" }}>{user?.dob || "—"}</div>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 12, color: "var(--cc-muted)", marginBottom: 4 }}>Home Address</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--cc-text)" }}>
                                    {user?.address || [user?.address_line1, user?.address_line2, user?.city, user?.state, user?.postal_code].filter(Boolean).join(", ") || "—"}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Security Section */}
            {activeSection === "security" && (
                <Card style={{ marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 700 }}>Security Settings</h3>

                    {/* Face ID / Biometric Login */}
                    <div style={{ 
                        padding: 20, 
                        background: hasWebAuthn ? "rgba(16,185,129,0.10)" : "rgba(245,158,11,0.12)", 
                        borderRadius: 12, 
                        border: `1px solid ${hasWebAuthn ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
                        marginBottom: 20
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: "var(--cc-text)" }}>
                                    Facial Recognition (Face ID)
                                </div>
                                {hasWebAuthn ? (
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <span style={{ fontSize: 20 }}>✓</span>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--cc-success)" }}>
                                                Facial recognition is set up. You can use Face ID to login.
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--cc-muted)", marginTop: 8 }}>
                                            On your next login, you'll see an option to use Face ID instead of entering your password.
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 14, color: "var(--cc-text)", marginBottom: 12 }}>
                                            Set up facial recognition for faster, secure login using:
                                        </div>
                                        <ul style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 12, paddingLeft: 20, lineHeight: 1.8 }}>
                                            <li>Face ID or Touch ID on iPhone</li>
                                            <li>Face Unlock or Fingerprint on Samsung/Android</li>
                                            <li>Windows Hello on Windows laptops</li>
                                            <li>Touch ID on Mac laptops</li>
                                        </ul>
                                        <Button
                                            variant="primary"
                                            onClick={handleRegisterWebAuthn}
                                            disabled={webauthnLoading}
                                        >
                                            {webauthnLoading ? "Setting up..." : "🔐 Set Up Face ID"}
                                        </Button>
                                    </div>
                                )}
                                {webauthnError && (
                                    <div style={{ marginTop: 12, padding: 12, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.22)", color: "var(--cc-danger)", borderRadius: 12, fontSize: 13 }}>
                                        {webauthnError}
                                    </div>
                                )}
                                {webauthnSuccess && (
                                    <div style={{ marginTop: 12, padding: 12, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "var(--cc-success)", borderRadius: 12, fontSize: 13 }}>
                                        {webauthnSuccess}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Password reset */}
                    <div
                        style={{
                            padding: 20,
                            background: "var(--cc-surface-2)",
                            borderRadius: 12,
                            border: "1px solid var(--cc-border)",
                        }}
                    >
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: "var(--cc-text)" }}>
                            Password & Recovery
                        </div>
                        <div style={{ fontSize: 13, color: "var(--cc-muted)", marginBottom: 16 }}>
                            Send a reset code to your phone and set a new password.
                        </div>

                        {resetError && (
                            <div
                                style={{
                                    marginBottom: 12,
                                    padding: 12,
                                    background: "rgba(239,68,68,0.10)",
                                    border: "1px solid rgba(239,68,68,0.22)",
                                    color: "var(--cc-danger)",
                                    borderRadius: 12,
                                    fontSize: 13,
                                }}
                            >
                                {resetError}
                            </div>
                        )}
                        {resetMessage && (
                            <div
                                style={{
                                    marginBottom: 12,
                                    padding: 12,
                                    background: "rgba(16,185,129,0.10)",
                                    border: "1px solid rgba(16,185,129,0.25)",
                                    color: "var(--cc-success)",
                                    borderRadius: 12,
                                    fontSize: 13,
                                }}
                            >
                                {resetMessage}
                            </div>
                        )}

                        <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}>
                            Phone Number
                        </label>
                        <Input
                            type="tel"
                            value={resetPhone}
                            disabled
                            style={{ background: "var(--cc-surface-2)", cursor: "not-allowed", marginBottom: 12 }}
                        />

                        <Button variant="primary" onClick={handleCustomerForgotPassword} disabled={resetLoading}>
                            {resetLoading ? "Sending..." : "Send Reset Code"}
                        </Button>

                        {resetRequested && (
                            <div style={{ marginTop: 16 }}>
                                <label
                                    style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--cc-text)" }}
                                >
                                    Reset Code
                                </label>
                                <Input
                                    type="text"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                    placeholder="Enter code"
                                />

                                <label
                                    style={{
                                        display: "block",
                                        marginTop: 12,
                                        marginBottom: 8,
                                        fontWeight: 600,
                                        color: "var(--cc-text)",
                                    }}
                                >
                                    New Password
                                </label>
                                <Input
                                    type="password"
                                    value={resetNewPassword}
                                    onChange={(e) => setResetNewPassword(e.target.value)}
                                    placeholder="New password"
                                />

                                <label
                                    style={{
                                        display: "block",
                                        marginTop: 12,
                                        marginBottom: 8,
                                        fontWeight: 600,
                                        color: "var(--cc-text)",
                                    }}
                                >
                                    Confirm Password
                                </label>
                                <Input
                                    type="password"
                                    value={resetConfirmPassword}
                                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                                    placeholder="Confirm password"
                                />

                                <div style={{ marginTop: 12 }}>
                                    <Button variant="primary" onClick={handleCustomerResetPassword} disabled={resetLoading}>
                                        {resetLoading ? "Resetting..." : "Reset Password"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Notifications Section */}
            {activeSection === "notifications" && (
                <Card style={{ marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 24, fontSize: 20, fontWeight: 700 }}>Notification Preferences</h3>
                    
                    {error && <div style={{ padding: 12, borderRadius: 12, marginBottom: 16, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.22)", color: "var(--cc-danger)" }}>{error}</div>}
                    {success && <div style={{ padding: 12, borderRadius: 12, marginBottom: 16, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "var(--cc-success)" }}>{success}</div>}

                    {notifPrefsLoading ? (
                        <div style={{ textAlign: "center", padding: 20 }}>Loading preferences...</div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--cc-border)" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Promotion Notifications</div>
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Get notified when stores post new promotions</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notifPrefs.promotions_enabled}
                                        onChange={(e) => setNotifPrefs({ ...notifPrefs, promotions_enabled: e.target.checked })}
                                        style={{ width: 20, height: 20, cursor: "pointer" }}
                                    />
                                </label>
                                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--cc-border)" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Update Notifications</div>
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Get notified when stores post major updates</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notifPrefs.updates_enabled}
                                        onChange={(e) => setNotifPrefs({ ...notifPrefs, updates_enabled: e.target.checked })}
                                        style={{ width: 20, height: 20, cursor: "pointer" }}
                                    />
                                </label>
                                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--cc-border)" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>SMS Notifications</div>
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Receive notifications via SMS (requires phone number)</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notifPrefs.sms_enabled}
                                        onChange={(e) => setNotifPrefs({ ...notifPrefs, sms_enabled: e.target.checked })}
                                        style={{ width: 20, height: 20, cursor: "pointer" }}
                                    />
                                </label>
                                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Email Notifications</div>
                                        <div style={{ fontSize: 12, color: "var(--cc-muted)" }}>Receive notifications via email (requires email address)</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notifPrefs.email_enabled}
                                        onChange={(e) => setNotifPrefs({ ...notifPrefs, email_enabled: e.target.checked })}
                                        style={{ width: 20, height: 20, cursor: "pointer" }}
                                    />
                                </label>
                            </div>
                            <Button
                                variant="primary"
                                onClick={saveNotificationPreferences}
                                disabled={notifPrefsSaving}
                                style={{ width: "100%" }}
                            >
                                {notifPrefsSaving ? "Saving..." : "Save Preferences"}
                            </Button>
                        </div>
                    )}
                </Card>
            )}

        </div>
    );
}

