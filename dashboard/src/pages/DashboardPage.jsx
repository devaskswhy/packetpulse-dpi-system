/**
 * DashboardPage — Performance-optimized overview
 * FIX: Removed all continuous animations and motion.div wrappers
 * FIX: Added displayStats debounce to throttle re-renders
 * FIX: All alert/status rows now plain divs (no AnimatePresence)
 */

import { useState, useEffect, useMemo } from "react";
import { useDPI } from "../context/DPIContext";
import { useCountUp } from "../hooks/useCountUp";
import { Link } from "react-router-dom";

import StatsCards from "../components/StatsCards";
import LiveTrafficChart from "../components/LiveTrafficChart";
import AppPieChart from "../components/AppPieChart";
import FlowsTable from "../components/FlowsTable";

export default function DashboardPage() {
    const { stats, flows, alerts, chartData, loading } = useDPI();

    // FIX D — Debounce stat updates: 100ms timeout prevents jank on rapid updates
    const [displayStats, setDisplayStats] = useState(stats);
    useEffect(() => {
        const timer = setTimeout(() => setDisplayStats(stats), 100);
        return () => clearTimeout(timer);
    }, [stats]);

    // Memoized data to prevent unnecessary re-renders
    const pieData = useMemo(() =>
        Object.entries(displayStats?.top_apps || {})
            .map(([name, value]) => ({ name, value })),
        [displayStats?.top_apps]
    );

    // Memoize recent alerts — slice to 3
    const recentAlerts = useMemo(() =>
        (alerts || []).slice(0, 3),
        [alerts]
    );

    // Animated counters for stat cards (use displayStats for debounced value)
    const animatedPackets = useCountUp(displayStats?.total_packets ?? 0);
    const animatedTraffic = useCountUp(Math.round((displayStats?.total_traffic ?? 0) / 1024 / 1024));
    const animatedThreats = useCountUp(displayStats?.blocked_threats ?? 0);

    // Format time ago
    const getTimeAgo = (timestamp) => {
        if (!timestamp) return "Unknown";
        const now = Date.now();
        const then = new Date(timestamp).getTime();
        const diff = now - then;
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
    };

    // Get severity color
    const getSeverityColor = (type) => {
        if (type === "blocked") return "#ef4444";
        if (type === "anomaly") return "#f97316";
        return "#3b82f6";
    };

    // System status indicators — static data, no interval
    const systemStatus = [
        { name: "Kafka", status: "ONLINE", color: "#10b981" },
        { name: "Redis", status: "ONLINE", color: "#10b981" },
        { name: "PostgreSQL", status: "ONLINE", color: "#10b981" },
        { name: "API Gateway", status: "ONLINE", color: "#10b981" },
        { name: "DPI Engine", status: "SIMULATED", color: "#f59e0b" }
    ];

    if (loading) {
        return (
            // FIX B — plain div for loading state (no motion overhead)
            <div style={{ opacity: 1 }}>
                <div className="loading-container">
                    <div className="spinner" />
                    <span className="loading-text">Loading dashboard…</span>
                </div>
            </div>
        );
    }

    return (
        // FIX A + C — removed flowingBackground animation and animated radial gradient
        // Static background is enough; NetworkBackground canvas handles visual depth
        <div
            style={{
                position: 'relative',
                minHeight: '100vh',
            }}
        >
            {/* FIX B — StatsCards wrapper: plain div, no motion layout recalc */}
            <div>
                <StatsCards
                    stats={{
                        ...displayStats,
                        total_packets: animatedPackets,
                        total_traffic: animatedTraffic * 1024 * 1024,
                        blocked_threats: animatedThreats
                    }}
                />
            </div>

            {/* Charts Row — plain div grid, no motion */}
            <div
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
                style={{ position: 'relative' }}
            >
                {/* Live Traffic Chart */}
                <div
                    className="lg:col-span-2"
                    style={{ position: 'relative', zIndex: 1, height: '320px' }}
                >
                    <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        zIndex: 10
                    }}>
                        {/* FIX A — removed animation: pulse from LIVE badge */}
                        <span style={{
                            background: '#10b981',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '2px',
                            fontSize: '10px',
                            fontWeight: '600',
                        }}>
                            LIVE
                        </span>
                        <span style={{
                            color: '#64748b',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                        }}>
                            ↑ {((displayStats?.current_traffic_mbps || 0)).toFixed(1)} MB/s | {displayStats?.current_pps || 0} pkt/s
                        </span>
                    </div>

                    <LiveTrafficChart chartData={chartData} />
                </div>

                {/* App Distribution Chart */}
                <div
                    className="lg:col-span-1"
                    style={{ height: '320px' }}
                >
                    <AppPieChart stats={displayStats} />
                </div>
            </div>

            {/* FIX E — TOP THREATS SUMMARY: plain divs, no AnimatePresence/motion.div */}
            <div
                style={{
                    background: 'rgba(15, 17, 23, 0.6)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px',
                    marginTop: '16px'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                }}>
                    <h3 style={{
                        color: '#ef4444',
                        fontSize: '14px',
                        fontWeight: '600',
                        margin: 0,
                        letterSpacing: '0.05em'
                    }}>
                        TOP THREATS SUMMARY
                    </h3>
                    <Link
                        to="/alerts"
                        style={{
                            color: '#22d3ee',
                            fontSize: '12px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        VIEW ALL →
                    </Link>
                </div>

                {recentAlerts && recentAlerts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recentAlerts.map((alert, index) => (
                            // FIX E — plain div, no motion.div per alert
                            <div
                                key={alert.ts || index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '8px 12px',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}
                            >
                                <span
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: getSeverityColor(alert.type),
                                        flexShrink: 0
                                    }}
                                />
                                <span style={{ color: '#e2e8f0', flex: 1 }}>
                                    {alert.reason || 'Security event detected'}
                                </span>
                                <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: '11px' }}>
                                    {alert.ip || 'Unknown'}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '11px' }}>
                                    {getTimeAgo(alert.ts)}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#10b981',
                        fontSize: '14px'
                    }}>
                        ✓ No active threats
                    </div>
                )}
            </div>

            {/* FIX E — SYSTEM STATUS: plain divs, no motion per service card */}
            <div
                style={{
                    background: 'rgba(15, 17, 23, 0.6)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }}
            >
                <h3 style={{
                    color: '#22d3ee',
                    fontSize: '14px',
                    fontWeight: '600',
                    margin: '0 0 12px 0',
                    letterSpacing: '0.05em'
                }}>
                    SYSTEM STATUS
                </h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '12px'
                }}>
                    {systemStatus.map((service) => (
                        // FIX E — plain div for each status row
                        <div
                            key={service.name}
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontFamily: 'monospace',
                                fontSize: '11px'
                            }}
                        >
                            {/* FIX A — static dot, no animation: pulse */}
                            <span
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: service.color,
                                    flexShrink: 0
                                }}
                            />
                            <span style={{ color: '#64748b' }}>{service.name}</span>
                            <span style={{
                                color: service.color,
                                fontWeight: '600',
                                marginLeft: 'auto'
                            }}>
                                {service.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Flows Table — plain div wrapper */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <FlowsTable flows={flows || []} compact />
            </div>

            {/* FIX A — Removed all inline @keyframes (flowingBackground, pulse) */}
        </div>
    );
}
