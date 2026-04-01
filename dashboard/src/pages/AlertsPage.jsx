/**
 * AlertsPage — Security alerts with severity filter.
 */

import { useState } from "react";
import AlertsList from "../components/AlertsList";

const SEVERITY_FILTERS = ["all", "high", "medium", "low"];

export default function AlertsPage() {
    const [filter, setFilter] = useState("all");

    return (
        <>
            <div className="page-header">
                <h2>Alerts & Threats</h2>
                <p>
                    Security events detected by the DPI engine's rule and classification
                    system
                </p>
            </div>

            <div className="filter-bar">
                {SEVERITY_FILTERS.map((f) => (
                    <button
                        key={f}
                        className={`filter-btn${filter === f ? " active" : ""}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === "all"
                            ? "All"
                            : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            <AlertsList filter={filter} />
        </>
    );
}
