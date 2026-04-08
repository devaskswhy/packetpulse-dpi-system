/**
 * DashboardPage — Enhanced overview with flowing animations and new sections
 * Uses global real-time DPIContext with animated components
 */

import { motion } from "framer-motion";
import { useDPI } from "../context/DPIContext";
import { useCountUp } from "../hooks/useCountUp";
import { Link } from "react-router-dom";
import { useMemo, useCallback, useState, useEffect } from "react";

import StatsCards from "../components/StatsCards";
import LiveTrafficChart from "../components/LiveTrafficChart";
import AppPieChart from "../components/AppPieChart";
import FlowsTable from "../components/FlowsTable";

export default function DashboardPage() {
    const { stats, flows, alerts, chartData, loading } = useDPI();
    const [localFlows, setLocalFlows] = useState([]);

    // Fetch flows independently with auth
    useEffect(() => {
        const fetchFlows = async () => {
            try {
                const res = await fetch('http://localhost:8000/flows?limit=5', {
                    headers: { 'X-API-Key': 'dev_key_12345' }
                });
                const data = await res.json();
                const flowList = Array.isArray(data) ? data : (data.data ?? []);
                setLocalFlows(flowList);
            } catch (e) {
                console.error("Failed to fetch flows:", e);
            }
        };
        fetchFlows();
        const interval = setInterval(fetchFlows, 15000);
        return () => clearInterval(interval);
    }, []);

    // Debounce stats display to prevent rapid re-renders
    const [displayStats, setDisplayStats] = useState({
        total_packets: 0, total_traffic: 0, blocked_threats: 0, top_apps: {}
    });
    useEffect(() => {
        const t = setTimeout(() => setDisplayStats(stats || {}), 200);
        return () => clearTimeout(t);
    }, [stats]);

    // Memoized data to prevent unnecessary re-renders
    const topApp = useMemo(() => 
      Object.keys(displayStats?.top_apps || {})[0] || 'Unknown',
      [displayStats?.top_apps]
    );

    const pieData = useMemo(() => 
      Object.entries(displayStats?.top_apps || {})
        .map(([name, value]) => ({ name, value })),
      [displayStats?.top_apps]
    );

    // Memoize recent alerts
    const recentAlerts = useMemo(() => 
      (alerts || []).slice(0, 3),
      [alerts]
    );

    // Animated counters for stat cards
    const animatedPackets = useCountUp(displayStats?.total_packets ?? 0);
    const animatedTraffic = useCountUp(Math.round((displayStats?.total_traffic ?? 0) / 1024 / 1024)); // Convert to MB
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
                `
            }}
        >
            {/* Enhanced Stats Cards with staggered entrance */}
            <div
                style={{
                    opacity: 1
                }}
            >
                <StatsCards 
                    stats={{
                        ...displayStats,
                        total_packets: animatedPackets,
                        total_traffic: animatedTraffic * 1024 * 1024, // Convert back to bytes
                        blocked_threats: animatedThreats
                    }} 
                />
            </div>

            {/* Enhanced Charts Row */}
            <motion.div
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{ position: 'relative' }}
            >
                {/* Live Traffic Chart with enhancements */}
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
                        <span style={{
                            background: '#10b981',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '2px',
                            fontSize: '10px',
                            fontWeight: '600'
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
                </div>

                {/* App Distribution Chart */}
                <div
                    className="lg:col-span-1"
                    style={{ height: '320px' }}
                >
                    <AppPieChart stats={stats} />
                </div>
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
            </motion.div>

            {/* Existing Flows Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
            >
                <FlowsTable flows={localFlows || []} compact />
            </motion.div>

            </motion.div>
    );
}
