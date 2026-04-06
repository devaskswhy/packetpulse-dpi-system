/**
 * FlowsPage — Full flows table with filter controls.
 * Uses global real-time DPIContext.
 */

import { useState } from "react";
import { useDPI } from "../context/DPIContext";
import FlowsTable from "../components/FlowsTable";

const FILTERS = ["All", "Allowed", "Blocked"];

export default function FlowsPage() {
    const { flows, loading } = useDPI();
    const [activeFilter, setActiveFilter] = useState("All");

    console.log('FlowsPage - flows data:', flows);
    console.log('FlowsPage - loading:', loading);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <span className="loading-text">Loading flows…</span>
            </div>
        );
    }

    const filteredFlows = flows.filter(f => {
        if (activeFilter === "Blocked") return f.blocked === true;
        if (activeFilter === "Allowed") return f.blocked === false;
        return true;
    });

    return (
        <>
            <div className="page-header">
                <h2>Network Flows</h2>
                <p>All tracked connections from the DPI engine's flow table</p>
            </div>

            <div className="filter-bar">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        className={`filter-btn${activeFilter === f ? " active" : ""}`}
                        onClick={() => setActiveFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <FlowsTable flows={filteredFlows} />
        </>
    );
}
