// src/StoreDashboard.jsx
import React, { useState } from "react";
import { fetchCustomerForStore, createTransaction } from "./api";

export default function StoreDashboard({ token }) {
    const [lookupInput, setLookupInput] = useState("");
    const [customer, setCustomer] = useState(null);
    const [amount, setAmount] = useState("");
    const [result, setResult] = useState(null);
    const [err, setErr] = useState("");

    if (!token) return <p>Please log in as store.</p>;

    const handleLookup = async () => {
        setErr("");
        setCustomer(null);
        setResult(null);

        let val = lookupInput.trim();
        if (!val) {
            setErr("Enter customer id or scanned value.");
            return;
        }
        if (val.startsWith("USER:")) {
            val = val.split("USER:")[1];
        }
        if (!/^\d+$/.test(val)) {
            setErr("Invalid user id.");
            return;
        }

        try {
            const data = await fetchCustomerForStore(token, val);
            setCustomer(data);
        } catch (e) {
            setErr(e.message);
        }
    };

    const handleTransaction = async () => {
        setErr("");
        setResult(null);
        if (!customer) {
            setErr("Lookup a customer first.");
            return;
        }
        if (!amount || isNaN(Number(amount))) {
            setErr("Enter a valid amount.");
            return;
        }

        try {
            const res = await createTransaction(token, {
                userId: customer.id,
                amount: Number(amount),
            });
            setResult(res);
            setCustomer({
                ...customer,
                loops_balance: res.newBalance,
                total_loops_earned: res.newTotal,
            });
        } catch (e) {
            setErr(e.message);
        }
    };

    return (
        <div style={card}>
            <h2>Store Dashboard</h2>

            <h3>1. Lookup Customer</h3>
            <input
                style={{ width: 260 }}
                placeholder="Scan USER:1 or enter 1"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
            />
            <button onClick={handleLookup} style={{ marginLeft: 8 }}>
                Lookup
            </button>

            {customer && (
                <div style={{ marginTop: 12 }}>
                    <p>
                        Customer: <strong>{customer.name}</strong> (ID {customer.id})
                    </p>
                    <p>
                        Plan: {customer.plan} | Tier: <strong>{customer.tier}</strong>
                    </p>
                    <p>Loops balance: {customer.loops_balance}</p>
                </div>
            )}

            <hr style={{ margin: "16px 0" }} />

            <h3>2. Record Purchase</h3>
            <input
                style={{ width: 120 }}
                placeholder="Amount (e.g. 25.50)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
            />
            <button onClick={handleTransaction} style={{ marginLeft: 8 }}>
                Apply
            </button>

            {result && (
                <div style={{ marginTop: 12, fontSize: 14 }}>
                    <p>Transaction recorded.</p>
                    <p>
                        Amount: ${(result.amountCents / 100).toFixed(2)} | Loops earned:{" "}
                        {result.loopsEarned}
                    </p>
                    <p>New Loops balance: {result.newBalance}</p>
                </div>
            )}

            {err && <p style={{ color: "red", marginTop: 8 }}>Error: {err}</p>}
        </div>
    );
}

const card = {
    border: "1px solid #ddd",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    maxWidth: 480,
};
