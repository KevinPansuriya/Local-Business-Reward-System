import React, { useEffect, useRef, useState } from "react";

const TOOLBAR_STYLE = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: 8,
    border: "1px solid var(--cc-border)",
    borderRadius: 8,
    background: "var(--cc-surface-2)",
    alignItems: "center",
};

const BUTTON_STYLE = {
    padding: "4px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid var(--cc-border)",
    background: "var(--cc-surface)",
    cursor: "pointer",
    lineHeight: 1,
    minWidth: 28,
    outline: "none",
};

const SELECT_STYLE = {
    ...BUTTON_STYLE,
    padding: "4px 6px",
};

const PALETTE = [
    "#000000", "#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777",
    "#888888", "#999999", "#aaaaaa", "#bbbbbb", "#cccccc", "#dddddd", "#eeeeee", "#ffffff",
    "#7f1d1d", "#991b1b", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca",
    "#7c2d12", "#9a3412", "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa",
    "#78350f", "#92400e", "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a",
    "#14532d", "#166534", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0",
    "#134e4a", "#115e59", "#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4",
    "#0c4a6e", "#075985", "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd",
    "#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
    "#312e81", "#3730a3", "#4338ca", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
    "#581c87", "#6b21a8", "#7e22ce", "#9333ea", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff",
    "#4a044e", "#6b0468", "#86198f", "#a21caf", "#c026d3", "#d946ef", "#e879f9", "#f5d0fe"
];

const COLOR_BOX_STYLE = {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: "1px solid var(--cc-border)",
    cursor: "pointer",
};

export default function RichTextEditor({ value, onChange }) {
    const editorRef = useRef(null);
    const selectionRef = useRef(null);
    const [showTextColors, setShowTextColors] = useState(false);
    const [textColor, setTextColor] = useState("#111111");
    const [showBgColors, setShowBgColors] = useState(false);
    const [bgColor, setBgColor] = useState("#ffffff");
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrike, setIsStrike] = useState(false);

    useEffect(() => {
        if (!editorRef.current) return;
        if (typeof value === "string" && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);
    useEffect(() => {
        try {
            document.execCommand("styleWithCSS", false, true);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (!editorRef.current) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const anchorNode = sel.anchorNode;
            if (anchorNode && editorRef.current.contains(anchorNode)) {
                selectionRef.current = sel.getRangeAt(0);
                setIsBold(document.queryCommandState("bold"));
                setIsItalic(document.queryCommandState("italic"));
                setIsUnderline(document.queryCommandState("underline"));
                setIsStrike(document.queryCommandState("strikeThrough"));
            }
        };
        document.addEventListener("selectionchange", handleSelectionChange);
        return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, []);

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (!sel || !selectionRef.current) return;
        sel.removeAllRanges();
        sel.addRange(selectionRef.current);
    };

    const exec = (command, commandValue = null) => {
        if (!editorRef.current) return;
        restoreSelection();
        editorRef.current.focus();
        document.execCommand(command, false, commandValue);
        onChange(editorRef.current.innerHTML || "");
    };

    const handleInput = () => {
        if (!editorRef.current) return;
        onChange(editorRef.current.innerHTML || "");
    };

    const applyFontSize = (sizePx) => {
        if (!editorRef.current) return;
        restoreSelection();
        editorRef.current.focus();
        document.execCommand("fontSize", false, "7");
        const fontTags = editorRef.current.querySelectorAll('font[size="7"]');
        fontTags.forEach((font) => {
            const span = document.createElement("span");
            span.style.fontSize = `${sizePx}px`;
            span.innerHTML = font.innerHTML;
            font.parentNode.replaceChild(span, font);
        });
        onChange(editorRef.current.innerHTML || "");
    };

    return (
        <div style={{ display: "grid", gap: 8 }}>
            <div style={TOOLBAR_STYLE}>
                <select
                    style={SELECT_STYLE}
                    onChange={(e) => exec("formatBlock", e.target.value)}
                    defaultValue="p"
                >
                    <option value="p">Normal text</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                </select>
                <select
                    style={SELECT_STYLE}
                    onChange={(e) => exec("fontName", e.target.value)}
                    defaultValue="Arial"
                >
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Verdana">Verdana</option>
                </select>
                <select
                    style={SELECT_STYLE}
                    onChange={(e) => applyFontSize(Number(e.target.value))}
                    defaultValue="14"
                >
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="24">24</option>
                </select>
                <button
                    type="button"
                    style={{ ...BUTTON_STYLE, background: isBold ? "rgba(59,130,246,0.15)" : BUTTON_STYLE.background }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("bold")}
                >
                    B
                </button>
                <button
                    type="button"
                    style={{ ...BUTTON_STYLE, background: isItalic ? "rgba(59,130,246,0.15)" : BUTTON_STYLE.background }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("italic")}
                >
                    I
                </button>
                <button
                    type="button"
                    style={{ ...BUTTON_STYLE, background: isUnderline ? "rgba(59,130,246,0.15)" : BUTTON_STYLE.background }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("underline")}
                >
                    U
                </button>
                <button
                    type="button"
                    style={{ ...BUTTON_STYLE, background: isStrike ? "rgba(59,130,246,0.15)" : BUTTON_STYLE.background }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("strikeThrough")}
                >
                    S
                </button>
                <div style={{ position: "relative" }}>
                    <button
                        type="button"
                        style={BUTTON_STYLE}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            setShowTextColors((prev) => !prev);
                            setShowBgColors(false);
                        }}
                    >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 700 }}>A</span>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: textColor, border: "1px solid var(--cc-border)" }} />
                        </span>
                    </button>
                    {showTextColors && (
                        <div
                            style={{
                                position: "absolute",
                                zIndex: 10,
                                marginTop: 6,
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid var(--cc-border)",
                                background: "var(--cc-surface)",
                                display: "grid",
                                gridTemplateColumns: "repeat(8, 1fr)",
                                gap: 6,
                                minWidth: 200,
                            }}
                        >
                            {PALETTE.map((color) => (
                                <div
                                    key={color}
                                    style={{ ...COLOR_BOX_STYLE, background: color }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        exec("foreColor", color);
                                        setTextColor(color);
                                        setShowTextColors(false);
                                    }}
                                    title={color}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ position: "relative" }}>
                    <button
                        type="button"
                        style={BUTTON_STYLE}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            setShowBgColors((prev) => !prev);
                            setShowTextColors(false);
                        }}
                    >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 700 }}>T</span>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: bgColor, border: "1px solid var(--cc-border)" }} />
                        </span>
                    </button>
                    {showBgColors && (
                        <div
                            style={{
                                position: "absolute",
                                zIndex: 10,
                                marginTop: 6,
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid var(--cc-border)",
                                background: "var(--cc-surface)",
                                display: "grid",
                                gridTemplateColumns: "repeat(8, 1fr)",
                                gap: 6,
                                minWidth: 200,
                                maxWidth: 320,
                            }}
                        >
                            {PALETTE.map((color) => (
                                <div
                                    key={color}
                                    style={{ ...COLOR_BOX_STYLE, background: color }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        exec("hiliteColor", color);
                                        setBgColor(color);
                                        setShowBgColors(false);
                                    }}
                                    title={color}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    style={BUTTON_STYLE}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("justifyLeft")}
                >
                    ⬅
                </button>
                <button
                    type="button"
                    style={BUTTON_STYLE}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("justifyCenter")}
                >
                    ⬌
                </button>
                <button
                    type="button"
                    style={BUTTON_STYLE}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("justifyRight")}
                >
                    ➡
                </button>
                <button
                    type="button"
                    style={BUTTON_STYLE}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("insertUnorderedList")}
                >
                    ••
                </button>
                <button
                    type="button"
                    style={BUTTON_STYLE}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("insertOrderedList")}
                >
                    1.
                </button>
                <button
                    type="button"
                    style={BUTTON_STYLE}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("insertHorizontalRule")}
                >
                    —
                </button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onKeyUp={handleInput}
                onMouseUp={handleInput}
                onBlur={() => {
                    setShowTextColors(false);
                    setShowBgColors(false);
                }}
                style={{
                    minHeight: 120,
                    padding: 12,
                    border: "1px solid var(--cc-border)",
                    borderRadius: 8,
                    background: "var(--cc-surface)",
                    color: "var(--cc-text)",
                    outline: "none",
                }}
            />
        </div>
    );
}
