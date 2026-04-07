import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { API_BASE, API_KEY, WS_BASE } from "../config";

const DPIContext = createContext(null);

export function useDPI() {
    return useContext(DPIContext);
}

export function DPIProvider({ children }) {
    const [stats, setStats] = useState(null);
    const [flows, setFlows] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState("offline"); // live, polling, offline
    const [chartData, setChartData] = useState([]);
    const wsRef = useRef(null);
    const pollingRef = useRef(null);
    const prevPackets = useRef(0);
    const prevBytes = useRef(0);

    const updateChartData = (newStats) => {
        const packetsDelta = Math.max(0, newStats.total_packets - prevPackets.current);
        const bytesDelta = Math.max(0, newStats.total_bytes - prevBytes.current);
        
        prevPackets.current = newStats.total_packets;
        prevBytes.current = newStats.total_bytes;
        
        const newPoint = {
            time: new Date().toLocaleTimeString(), 
            packets: packetsDelta,
            bytes: Math.round(bytesDelta / 1024)
        };
        
        setChartData(prev => {
            const updated = [...prev, newPoint];
            return updated.slice(-60); // Keep last 60 points only
        });
    };

    const pullData = async () => {
        try {
            const [statsRes, flowsRes, alertsRes] = await Promise.all([
                fetch(`${API_BASE}/stats`, { headers: { "X-API-Key": API_KEY } }).then((r) => r.json()),
                fetch(`${API_BASE}/flows?limit=500`, { headers: { "X-API-Key": API_KEY } }).then((r) => r.json()),
                fetch(`${API_BASE}/alerts`, { headers: { "X-API-Key": API_KEY } }).then((r) => r.json()),
            ]);
            setStats(statsRes || null);
            setFlows(flowsRes?.flows || flowsRes?.data || []);
            setAlerts(alertsRes?.alerts || alertsRes?.data || alertsRes || []);
            if (statsRes) updateChartData(statsRes);
            setLoading(false);
            return true;
        } catch (err) {
            console.error("Failed standard fetch:", err);
            setLoading(false);
            return false;
        }
    };

    const startPolling = () => {
        if (!pollingRef.current) {
            setConnectionStatus((prev) => prev !== "live" ? "polling" : "live");
            pollingRef.current = setInterval(async () => {
                const success = await pullData();
                if (!success) setConnectionStatus("offline");
                else setConnectionStatus(prev => prev === "offline" ? "polling" : prev);
            }, 3000);
        }
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch('http://localhost:8000/stats', {
                    headers: { 'X-API-Key': 'dev_key_12345' }
                });
                const data = await res.json();
                if (data && data.total_packets !== undefined) {
                    setStats(data);
                    updateChartData(data);
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        };
        
        // Poll immediately then every 3 seconds (reduced from 2s)
        poll();
        const interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            await pullData();
            if (isMounted) connectWs();
        };

        const wsUrl = 'ws://localhost:8000/ws/live?api_key=dev_key_12345';

        const connectWs = () => {
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            socket.onopen = () => {
                if (isMounted) {
                    setConnectionStatus("live");
                    console.log('WebSocket connected');
                }
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'stats' && msg.data) {
                        setStats(msg.data);
                        updateChartData(msg.data);
                    }
                    if (msg.flows) setFlows(msg.flows);
                    if (msg.alerts) setAlerts(msg.alerts);
                } catch (e) {
                    console.error("WebSocket payload error:", e);
                }
            };

            socket.onclose = () => {
                console.log("WebSocket closed, but polling continues...");
                if (isMounted) {
                    setConnectionStatus("polling");
                    // Keep polling running, attempt WS reconnect slowly in background
                    setTimeout(() => {
                        if (isMounted && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
                            connectWs();
                        }
                    }, 5000);
                }
            };

            socket.onerror = (error) => {
                console.error("WebSocket error:", error);
                socket.close();
            };
        };

        init();

        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect loop on unmount
                wsRef.current.close();
            }
        };
    }, []);

    const value = {
        stats,
        flows: flows || [],
        alerts: alerts || [],
        loading,
        connectionStatus,
        chartData
    };

    return (
        <DPIContext.Provider value={value}>
            {children}
        </DPIContext.Provider>
    );
}
