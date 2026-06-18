import React from "react";

function tierStyle(tier) {
    const t = String(tier || "standard").toLowerCase();
    if (t === "premium") {
        return {
            background: "linear-gradient(135deg, var(--cc-primary), var(--cc-info))",
            color: "white",
            border: "1px solid rgba(37,99,235,0.35)",
            boxShadow: "0 6px 18px rgba(37,99,235,0.18)",
        };
    }
    if (t === "boosted") {
        return {
            background: "linear-gradient(135deg, var(--cc-warning), rgba(245,158,11,0.7))",
            color: "var(--cc-text)",
            border: "1px solid rgba(245,158,11,0.45)",
            boxShadow: "0 6px 18px rgba(245,158,11,0.18)",
        };
    }
    return {
        background: "var(--cc-surface)",
        color: "var(--cc-text)",
        border: "1px solid var(--cc-border)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
    };
}

export function TierBadge({ tier, style }) {
    const label = String(tier || "standard").toUpperCase();
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                height: "fit-content",
                ...tierStyle(tier),
                ...style,
            }}
            title={`${label} offer`}
        >
            {label}
        </span>
    );
}

export function StatusBadge({ tone = "muted", children, style }) {
    const tones = {
        success: { background: "rgba(16,185,129,0.12)", color: "var(--cc-success)", border: "1px solid rgba(16,185,129,0.25)" },
        danger: { background: "rgba(239,68,68,0.10)", color: "var(--cc-danger)", border: "1px solid rgba(239,68,68,0.22)" },
        info: { background: "rgba(14,165,233,0.10)", color: "var(--cc-info)", border: "1px solid rgba(14,165,233,0.22)" },
        muted: { background: "rgba(148,163,184,0.18)", color: "var(--cc-muted)", border: "1px solid rgba(148,163,184,0.35)" },
        warning: { background: "rgba(245,158,11,0.12)", color: "var(--cc-warning)", border: "1px solid rgba(245,158,11,0.25)" },
    };
    const t = tones[tone] || tones.muted;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                whiteSpace: "nowrap",
                ...t,
                ...style,
            }}
        >
            {children}
        </span>
    );
}

