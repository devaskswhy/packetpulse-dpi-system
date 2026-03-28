/**
 * FlowsPage — Full flows table with filter controls.
 */

import { useState, useEffect } from "react";
import { fetchFlows } from "../api";
import FlowsTable from "../components/FlowsTable";

const FILTERS = ["All", "Allowed", "Blocked"];

export default function FlowsPage() {
    const [flows, setFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("All");

    useEffect(() => {
        const load = async () => {
            try {
                const params = {};
                if (activeFilter === "Blocked") params.blocked = true;
                if (activeFilter === "Allowed") params.blocked = false;

                const res = await fetchFlows(params);
                setFlows(res.flows);
            } catch (err) {
                console.error("Failed to fetch flows:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [activeFilter]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <span className="loading-text">Loading flows…</span>
            </div>
        );
    }

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
                        onClick={() => {
                            setLoading(true);
                            setActiveFilter(f);
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <FlowsTable flows={flows} />
        </>
    );
}
