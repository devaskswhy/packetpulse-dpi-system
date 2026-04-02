/**
 * DashboardPage — Overview with stat cards, charts, and recent flows.
 * Uses global real-time DPIContext.
 */

import { useDPI } from "../context/DPIContext";

import StatsCards from "../components/StatsCards";
import LiveTrafficChart from "../components/LiveTrafficChart";
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
                <LiveTrafficChart />
                <AppPieChart stats={stats} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <FlowsTable flows={flows || []} compact />
            </div>
        </>
    );
}
