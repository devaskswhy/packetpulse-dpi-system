import React from "react";
import { useDPI } from "../context/DPIContext";

export default function AlertsList({ filter = "all" }) {
    const { alerts } = useDPI();

    console.log('AlertsList - alerts data:', alerts);

    // Safety fallback for map
    const safeAlerts = Array.isArray(alerts) ? alerts : [];

    // Map backend type to severity and icon
    const getSeverity = (type) => {
        if (type === "blocked") return "high";
        if (type === "anomaly") return "medium";
        return "low";
    };

    const getIcon = (type) => {
        if (type === "blocked") return "⛔";
        if (type === "anomaly") return "⚠️";
        return "ℹ️";
    };

    const filteredAlerts =
        filter === "all"
            ? safeAlerts
            : safeAlerts.filter((a) => getSeverity(a.type) === filter);

    if (filteredAlerts.length === 0) {
        return (
            <div className="card">
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No alerts to display
                </div>
            </div>
        );
    }

    return (
        <div className="alerts-list">
            {filteredAlerts.map((a, i) => {
                const sev = getSeverity(a.type);
                return (
                    <div key={i} className={`alert-card ${sev}`}>
                        <span className="alert-icon">{getIcon(a.type)}</span>
                        <div className="alert-body">
                            <div className="alert-title">{a.reason || "Security Event"}</div>
                            <div className="alert-desc">Involved IP: {a.ip}</div>
                            <div className="alert-meta">
                                <span className={`badge severity-${sev}`}>
                                    {sev.toUpperCase()}
                                </span>
                                <span className="alert-time">{a.ts}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
