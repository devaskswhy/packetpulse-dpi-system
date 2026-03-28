/**
 * DashboardPage — Overview with stat cards, charts, and recent flows.
 * Fetches from /stats, /flows, and /sni on mount.
 */

import { useState, useEffect } from "react";
import { fetchStats, fetchFlows, fetchSNI } from "../api";

import StatsCards from "../components/StatsCards";
import TrafficChart from "../components/TrafficChart";
import AppPieChart from "../components/AppPieChart";
import FlowsTable from "../components/FlowsTable";
import DomainTable from "../components/DomainTable";

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [flows, setFlows] = useState([]);
    const [domains, setDomains] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const [statsRes, flowsRes, sniRes] = await Promise.all([
                fetchStats(),
                fetchFlows(),
                fetchSNI(),
            ]);
            setStats(statsRes.stats);
            setFlows(flowsRes.flows);
            setDomains(sniRes.domains);
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

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
                <FlowsTable flows={flows} compact />
                <DomainTable domains={domains} />
            </div>
        </>
    );
}
