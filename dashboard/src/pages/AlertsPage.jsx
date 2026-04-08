/**
 * AlertsPage — Real-time Threat Intelligence Feed
 * Professional security monitoring interface with live alert streaming
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_KEY, API_BASE } from "../config";

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316", 
  medium: "#eab308",
  low: "#3b82f6"
};

const SEVERITY_LEVELS = ["all", "critical", "high", "medium", "low"];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [newAlertsCount, setNewAlertsCount] = useState(0);
  const [showNewAlertsBanner, setShowNewAlertsBanner] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 20;
  const previousAlertsRef = useRef([]);
  const containerRef = useRef(null);

  // Fetch alerts data
  const fetchAlerts = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/alerts`, {
        headers: { "X-API-Key": API_KEY }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const alertsData = data.alerts || data.data || data || [];
      
      // Check for new alerts
      const previousLength = previousAlertsRef.current.length;
      const currentLength = alertsData.length;
      
      if (previousLength > 0 && currentLength > previousLength) {
        const newCount = currentLength - previousLength;
        setNewAlertsCount(newCount);
        setShowNewAlertsBanner(true);
      }
      
      setAlerts(alertsData);
      previousAlertsRef.current = alertsData;
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 8 seconds (reduced from 5s)
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 8000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = alerts;

    if (activeFilter !== "all") {
      filtered = alerts.filter(alert => {
        const alertSeverity = getSeverity(alert.type);
        return alertSeverity === activeFilter;
      });
    }

    setFilteredAlerts(filtered);
  }, [alerts, activeFilter]);

  // Get severity from alert type
  const getSeverity = (type) => {
    if (type === "blocked") return "critical";
    if (type === "anomaly") return "high";
    return "low";
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    return SEVERITY_COLORS[severity] || SEVERITY_COLORS.low;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp);
    
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  // Get severity counts
  const getSeverityCounts = () => {
    const counts = {
      all: alerts.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    alerts.forEach(alert => {
      const severity = getSeverity(alert.type);
      counts[severity]++;
    });

    return counts;
  };

  // Scroll to top and dismiss banner
  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setShowNewAlertsBanner(false);
    setNewAlertsCount(0);
  };

  // Pagination
  const totalPages = Math.ceil(filteredAlerts.length / alertsPerPage);
  const startIndex = (currentPage - 1) * alertsPerPage;
  const paginatedAlerts = filteredAlerts.slice(startIndex, startIndex + alertsPerPage);

  const counts = getSeverityCounts();

  // Loading state
  if (loading && alerts.length === 0) {
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ 
          fontSize: "24px", 
          letterSpacing: "0.3em", 
          marginBottom: "10px",
          color: "#ef4444"
        }}>
          THREAT INTELLIGENCE FEED
        </div>
        <div style={{ color: "#64748b", marginBottom: "20px" }}>
          LOADING THREAT DATA...
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{
            background: "rgba(15, 17, 23, 0.8)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "12px",
            animation: "pulse 1.5s ease-in-out infinite"
          }}>
            <div style={{ height: "16px", background: "#1e293b", borderRadius: "4px", marginBottom: "8px" }} />
            <div style={{ height: "12px", background: "#1e293b", borderRadius: "4px", width: "80%" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ padding: "20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{
          fontSize: "24px",
          letterSpacing: "0.3em",
          color: "#ef4444",
          margin: 0,
          textTransform: "uppercase"
        }}>
          THREAT INTELLIGENCE FEED
        </h1>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{
              color: "#ef4444",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span style={{ 
                width: "8px", 
                height: "8px", 
                background: "#ef4444", 
                borderRadius: "50%",
                animation: "pulse 2s ease-in-out infinite"
              }} />
              MONITORING ACTIVE
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: "12px" }}>
            {counts.all} THREATS DETECTED | {counts.critical} CRITICAL
          </div>
        </div>
      </div>

      {/* New Alerts Banner */}
      <AnimatePresence>
        {showNewAlertsBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={scrollToTop}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "4px",
              padding: "8px 12px",
              marginBottom: "20px",
              cursor: "pointer",
              color: "#ef4444",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            ▲ {newAlertsCount} NEW ALERT{newAlertsCount > 1 ? 'S' : ''}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Severity Filter Tabs */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "2px", position: "relative" }}>
          {SEVERITY_LEVELS.map((level) => (
            <motion.button
              key={level}
              onClick={() => setActiveFilter(level)}
              style={{
                padding: "8px 16px",
                background: activeFilter === level 
                  ? getSeverityColor(level) 
                  : "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: activeFilter === level ? "#fff" : "#64748b",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                borderRadius: "4px 4px 0 0",
                position: "relative",
                zIndex: 1
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {level.toUpperCase()}
              <span style={{ 
                marginLeft: "6px", 
                opacity: 0.7,
                fontSize: "10px"
              }}>
                ({counts[level]})
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid #ef4444",
          borderRadius: "4px",
          padding: "16px",
          marginBottom: "20px",
          color: "#ef4444"
        }}>
          <div style={{ marginBottom: "8px" }}>ERROR: {error}</div>
          <button
            onClick={fetchAlerts}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredAlerts.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{
            fontSize: "32px",
            color: "#10b981",
            marginBottom: "16px"
          }}>
            ✓ NO THREATS DETECTED
          </div>
          <div style={{
            fontSize: "48px",
            color: "#10b981",
            opacity: 0.1,
            marginBottom: "20px",
            fontWeight: "700"
          }}>
            SYSTEM SECURE
          </div>
          <div style={{
            width: "12px",
            height: "12px",
            background: "#10b981",
            borderRadius: "50%",
            margin: "0 auto",
            animation: "pulse 2s ease-in-out infinite"
          }} />
        </div>
      )}

      {/* Alert Cards */}
      <motion.div
        layout
        style={{ marginBottom: "20px" }}
      >
        <AnimatePresence>
          {paginatedAlerts.map((alert, index) => {
            const severity = getSeverity(alert.type);
            const isCritical = severity === "critical";
            const color = getSeverityColor(severity);

            return (
              <motion.div
                key={`${alert.ts || index}-${alert.ip || index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.05,
                  layout: { duration: 0.3 }
                }}
                layout
                style={{
                  background: "rgba(15, 17, 23, 0.8)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderLeft: `4px solid ${color}`,
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "12px",
                  position: "relative",
                  ...(isCritical && {
                    boxShadow: `0 0 20px ${color}40`,
                    transform: "scale(1.02)"
                  })
                }}
              >
                {/* Critical Alert Special Treatment */}
                {isCritical && (
                  <div style={{
                    position: "absolute",
                    top: "-8px",
                    left: "-4px",
                    background: "#ef4444",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "700",
                    animation: "pulse 2s ease-in-out infinite"
                  }}>
                    ⚠ CRITICAL THREAT
                  </div>
                )}

                {/* Top Row */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      background: color,
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: "2px",
                      fontSize: "10px",
                      fontWeight: "600"
                    }}>
                      {severity.toUpperCase()}
                    </span>
                    <span style={{
                      color: "#e2e8f0",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                      {alert.type?.toUpperCase() || "UNKNOWN"}
                    </span>
                  </div>
                  <span style={{ color: "#64748b", fontSize: "10px" }}>
                    {formatTime(alert.ts)}
                  </span>
                </div>

                {/* Middle Row */}
                <div style={{
                  color: "#e2e8f0",
                  fontSize: "14px",
                  marginBottom: "12px",
                  lineHeight: "1.4"
                }}>
                  ⚡ {alert.reason || "Security event detected"}
                </div>

                {/* Bottom Row */}
                <div style={{
                  display: "flex",
                  gap: "16px",
                  fontSize: "11px",
                  color: "#64748b"
                }}>
                  <span>
                    SRC: <span style={{ color: "#22d3ee", fontFamily: "monospace" }}>
                      {alert.ip || "Unknown"}
                    </span>
                  </span>
                  {alert.dst_ip && (
                    <span>
                      DST: <span style={{ color: "#22d3ee", fontFamily: "monospace" }}>
                        {alert.dst_ip}
                      </span>
                    </span>
                  )}
                  {alert.flow_id && (
                    <span>
                      FLOW: <span style={{ color: "#64748b", fontFamily: "monospace" }}>
                        {alert.flow_id.substring(0, 12)}
                      </span>
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginTop: "20px"
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: "8px 12px",
              background: currentPage === 1 ? "#1e293b" : "#374151",
              border: "1px solid #4b5563",
              color: currentPage === 1 ? "#6b7280" : "#e2e8f0",
              borderRadius: "4px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: "12px"
            }}
          >
            Previous
          </button>
          
          <span style={{
            padding: "8px 16px",
            color: "#e2e8f0",
            fontSize: "12px"
          }}>
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: "8px 12px",
              background: currentPage === totalPages ? "#1e293b" : "#374151",
              border: "1px solid #4b5563",
              color: currentPage === totalPages ? "#6b7280" : "#e2e8f0",
              borderRadius: "4px",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontSize: "12px"
            }}
          >
            Next
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
