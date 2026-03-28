/**
 * DashboardPage — Overview with stat cards, charts, and recent flows.
 * Uses global real-time DPIContext.
 */

import { useDPI } from "../context/DPIContext";

import StatsCards from "../components/StatsCards";
import TrafficChart from "../components/TrafficChart";
import AppPieChart from "../components/AppPieChart";
import FlowsTable from "../components/FlowsTable";

export default function DashboardPage() {
    const { stats, flows, loading } = useDPI();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
                <span className="loading-text">Loading dashboard…</span>
            </div>
        );
    }

    return (
        <>
            <StatsCards stats={stats} />

            <div className="charts-row">
                <TrafficChart stats={stats} />
                <AppPieChart flows={flows} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <FlowsTable flows={flows || []} compact />
            </div>
        </>
    );
}
