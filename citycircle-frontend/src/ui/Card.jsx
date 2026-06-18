import React from "react";

export default function Card({ style, children, ...props }) {
    return (
        <div
            {...props}
            style={{
                border: "1px solid var(--cc-border)",
                borderRadius: "var(--cc-radius-md)",
                background: "var(--cc-surface)",
                boxShadow: "var(--cc-shadow-sm)",
                padding: 16,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

