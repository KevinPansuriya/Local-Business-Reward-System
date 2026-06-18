import React from "react";

const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: "var(--cc-radius-sm)",
    border: "1px solid var(--cc-border)",
    background: "var(--cc-surface)",
    color: "var(--cc-text)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.08s ease, background-color 0.15s ease, border-color 0.15s ease",
    userSelect: "none",
};

const variants = {
    primary: {
        border: "1px solid rgba(37,99,235,0.3)",
        background: "var(--cc-primary)",
        color: "#fff",
    },
    secondary: {
        background: "var(--cc-surface-2)",
        color: "var(--cc-text)",
    },
    ghost: {
        border: "1px solid transparent",
        background: "transparent",
        color: "var(--cc-text)",
    },
    danger: {
        border: "1px solid rgba(239,68,68,0.3)",
        background: "var(--cc-danger)",
        color: "#fff",
    },
};

export default function Button({
    variant = "secondary",
    style,
    disabled,
    children,
    ...props
}) {
    const v = variants[variant] || variants.secondary;
    return (
        <button
            {...props}
            disabled={disabled}
            style={{
                ...base,
                ...v,
                opacity: disabled ? 0.6 : 1,
                ...style,
            }}
            onMouseDown={(e) => {
                if (disabled) return;
                e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
            }}
        >
            {children}
        </button>
    );
}

