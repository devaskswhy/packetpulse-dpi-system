/**
 * DashboardPage — Enhanced overview with flowing animations and new sections
 * Uses global real-time DPIContext with animated components
 */

import { motion } from "framer-motion";
import { useDPI } from "../context/DPIContext";
import { useCountUp } from "../hooks/useCountUp";
import { Link } from "react-router-dom";
import { useMemo, useCallback } from "react";

import StatsCards from "../components/StatsCards";
import LiveTrafficChart from "../components/LiveTrafficChart";
import AppPieChart from "../components/AppPieChart";
import FlowsTable from "../components/FlowsTable";

export default function DashboardPage() {
    const { stats, flows, alerts, chartData, loading } = useDPI();

    // Memoized data to prevent unnecessary re-renders
    const topApp = useMemo(() => 
      Object.keys(stats?.top_apps || {})[0] || 'Unknown',
      [stats?.top_apps]
    );

    const pieData = useMemo(() => 
      Object.entries(stats?.top_apps || {})
        .map(([name, value]) => ({ name, value })),
      [stats?.top_apps]
    );

    // Memoize recent alerts
    const recentAlerts = useMemo(() => 
      (alerts || []).slice(0, 3),
      [alerts]
    );

    // Animated counters for stat cards
    const animatedPackets = useCountUp(stats?.total_packets ?? 0);
    const animatedTraffic = useCountUp(Math.round((stats?.total_traffic ?? 0) / 1024 / 1024)); // Convert to MB
    const animatedThreats = useCountUp(stats?.blocked_threats ?? 0);

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

    // System status indicators
    const systemStatus = [
        { name: "Kafka", status: "ONLINE", color: "#10b981" },
        { name: "Redis", status: "ONLINE", color: "#10b981" },
        { name: "PostgreSQL", status: "ONLINE", color: "#10b981" },
        { name: "API Gateway", status: "ONLINE", color: "#10b981" },
        { name: "DPI Engine", status: "SIMULATED", color: "#f59e0b" }
    ];

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
            >
                <div className="loading-container">
                    <div className="spinner" />
                    <span className="loading-text">Loading dashboard…</span>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{
                position: 'relative',
                minHeight: '100vh',
                background: `
                    radial-gradient(circle at 20% 50%, rgba(34, 211, 238, 0.02) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, rgba(34, 211, 238, 0.02) 0%, transparent 50%),
                    radial-gradient(circle at 40% 20%, rgba(34, 211, 238, 0.02) 0%, transparent 50%)
                `,
                animation: 'flowingBackground 20s ease-in-out infinite'
            }}
        >
            {/* Enhanced Stats Cards with staggered entrance */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
            >
                <StatsCards 
                    stats={{
                        ...stats,
                        total_packets: animatedPackets,
                        total_traffic: animatedTraffic * 1024 * 1024, // Convert back to bytes
                        blocked_threats: animatedThreats
                    }} 
                />
            </motion.div>

            {/* Enhanced Charts Row */}
            <motion.div
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{ position: 'relative' }}
            >
                {/* Live Traffic Chart with enhancements */}
                <motion.div
                    className="lg:col-span-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
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
                        <span style={{
                            background: '#10b981',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '2px',
                            fontSize: '10px',
                            fontWeight: '600',
                            animation: 'pulse 2s ease-in-out infinite'
                        }}>
                            LIVE
                        </span>
                        <span style={{
                            color: '#64748b',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                        }}>
                            ↑ {((stats?.current_traffic_mbps || 0)).toFixed(1)} MB/s | {stats?.current_pps || 0} pkt/s
                        </span>
                    </div>
                    
                    <LiveTrafficChart chartData={chartData} />
                </motion.div>

                {/* App Distribution Chart */}
                <motion.div
                    className="lg:col-span-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    style={{ height: '320px' }}
                >
                    <AppPieChart stats={stats} />
                </motion.div>
            </motion.div>

            {/* TOP THREATS SUMMARY Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                style={{
                    background: 'rgba(15, 17, 23, 0.6)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
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
                            <motion.div
                                key={alert.ts || index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
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
                            </motion.div>
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
            </motion.div>

            {/* SYSTEM STATUS Panel */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
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
                    {systemStatus.map((service, index) => (
                        <motion.div
                            key={service.name}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
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
                            <span
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: service.color,
                                    animation: 'pulse 2s ease-in-out infinite',
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
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Existing Flows Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
                <FlowsTable flows={flows || []} compact />
            </motion.div>

            {/* CSS Animations */}
            <style jsx>{`
                @keyframes flowingBackground {
                    0%, 100% {
                        background-position: 0% 50%, 100% 50%, 50% 0%;
                    }
                    25% {
                        background-position: 100% 50%, 0% 100%, 100% 0%;
                    }
                    50% {
                        background-position: 100% 100%, 0% 0%, 0% 100%;
                    }
                    75% {
                        background-position: 0% 100%, 100% 0%, 0% 0%;
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </motion.div>
    );
}
