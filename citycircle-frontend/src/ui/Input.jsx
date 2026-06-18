import React from "react";

export default function Input({ style, ...props }) {
    return (
        <input
            {...props}
            style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--cc-radius-sm)",
                border: "1px solid var(--cc-border)",
                background: "var(--cc-surface)",
                color: "var(--cc-text)",
                fontSize: 13,
                boxSizing: "border-box",
                ...style,
            }}
        />
    );
}

