import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { fetchStats, fetchFlows, fetchAlerts, healthCheck } from "../api";

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
    const wsRef = useRef(null);
    const pollingRef = useRef(null);

    const pullData = async () => {
        try {
            const [statsRes, flowsRes, alertsRes] = await Promise.all([
                fetchStats(),
                fetchFlows({ limit: 500 }),
                fetchAlerts(),
            ]);
            setStats(statsRes || null);
            setFlows(flowsRes?.flows || []);
            setAlerts(alertsRes || []);
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
        let isMounted = true;

        const init = async () => {
            await pullData();
            if (isMounted) connectWs();
        };

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//localhost:8000/ws/live`;

        const connectWs = () => {
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            socket.onopen = () => {
                if (isMounted) {
                    setConnectionStatus("live");
                    stopPolling(); // Stop polling if WS is alive
                }
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.stats) setStats(data.stats);
                    if (data.flows) setFlows(data.flows);
                    if (data.alerts) setAlerts(data.alerts);
                } catch (e) {
                    console.error("WebSocket payload error:", e);
                }
            };

            socket.onclose = () => {
                console.log("WebSocket closed, falling back to polling...");
                if (isMounted) {
                    setConnectionStatus("polling");
                    startPolling();
                    // Attempt WS reconnect slowly in background
                    setTimeout(() => {
                        if (isMounted && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
                            connectWs();
                        }
                    }, 5000);
                }
            };

            socket.onerror = () => {
                socket.close();
            };
        };

        init();

        return () => {
            isMounted = false;
            stopPolling();
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
        connectionStatus
    };

    return (
        <DPIContext.Provider value={value}>
            {children}
        </DPIContext.Provider>
    );
}
