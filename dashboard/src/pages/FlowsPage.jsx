/**
 * FlowsPage — SOC Terminal Style Network Flows Monitor
 * Real-time packet stream analysis with security operations center aesthetic
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_KEY, API_BASE } from "../config";

const APP_COLORS = {
  YouTube: "#FF0000",
  Netflix: "#E50914", 
  TikTok: "#69C9D0",
  Facebook: "#1877F2",
  Instagram: "#E1306C",
  GitHub: "#6e5494",
  Reddit: "#FF4500",
  DNS: "#F59E0B",
  Spotify: "#1DB954",
  Cloudflare: "#F38020",
  Unknown: "#6B7280"
};

export default function FlowsPage() {
  const [flows, setFlows] = useState([]);
  const [filteredFlows, setFilteredFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());
  const [filterText, setFilterText] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [blockedOnly, setBlockedOnly] = useState(false);

  // Fetch flows data
  const fetchFlows = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/flows?limit=100`, {
        headers: { "X-API-Key": API_KEY }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const flowsData = data.flows || data.data || data || [];
      setFlows(flowsData);
      setLastSync(new Date());
    } catch (err) {
      console.error("Failed to fetch flows:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchFlows();
    const interval = setInterval(fetchFlows, 10000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = flows;

    // Text filter
    if (filterText) {
      filtered = filtered.filter(flow => 
        (flow.app && flow.app.toLowerCase().includes(filterText.toLowerCase())) ||
        (flow.src_ip && flow.src_ip.includes(filterText)) ||
        (flow.dst_ip && flow.dst_ip.includes(filterText)) ||
        (flow.protocol && flow.protocol.toLowerCase().includes(filterText.toLowerCase()))
      );
    }

    // Protocol filter
    if (protocolFilter !== "all") {
      filtered = filtered.filter(flow => 
        flow.protocol?.toLowerCase() === protocolFilter.toLowerCase()
      );
    }

    // Blocked filter
    if (blockedOnly) {
      filtered = filtered.filter(flow => flow.blocked === true);
    }

    setFilteredFlows(filtered);
  }, [flows, filterText, protocolFilter, blockedOnly]);

  // Format functions
  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(1) + " GB";
    if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
    if (bytes >= 1_024) return (bytes / 1_024).toFixed(1) + " KB";
    return bytes + " B";
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    return `${seconds}s`;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getAppColor = (app) => {
    if (!app) return APP_COLORS.Unknown;
    return APP_COLORS[app] || APP_COLORS.Unknown;
  };

  const stats = {
    total: filteredFlows.length,
    blocked: filteredFlows.filter(f => f.blocked).length,
    totalBytes: filteredFlows.reduce((sum, f) => sum + (f.bytes || 0), 0)
  };

  // Loading skeleton
  if (loading && flows.length === 0) {
    return (
      <div style={{ padding: "20px", fontFamily: "monospace" }}>
        <div style={{ 
          fontSize: "24px", 
          letterSpacing: "0.3em", 
          marginBottom: "10px",
          color: "#22d3ee"
        }}>
          NETWORK FLOWS
        </div>
        <div style={{ color: "#64748b", marginBottom: "20px" }}>
          LOADING FLOW DATA...
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ 
            padding: "12px", 
            marginBottom: "8px", 
            background: "rgba(0,0,0,0.3)",
            borderRadius: "4px",
            animation: "pulse 1.5s ease-in-out infinite"
          }}>
            <div style={{ height: "16px", background: "#1e293b", borderRadius: "2px" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{
          fontSize: "24px",
          letterSpacing: "0.3em",
          color: "#22d3ee",
          margin: 0,
          textTransform: "uppercase"
        }}>
          NETWORK FLOWS
        </h1>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "8px"
        }}>
          <div style={{ color: "#64748b" }}>
            LIVE PACKET STREAM — <span style={{ color: "#22d3ee" }}>{filteredFlows.length}</span> ACTIVE FLOWS
          </div>
          <div style={{ color: "#64748b", fontSize: "12px" }}>
            LAST SYNC: {formatTime(lastSync)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "20px",
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <input
          type="text"
          placeholder="FILTER BY APP, IP, PROTOCOL..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            flex: 1,
            minWidth: "250px",
            background: "transparent",
            border: "none",
            borderBottom: "2px solid #22d3ee",
            color: "#e2e8f0",
            padding: "8px 4px",
            fontFamily: "monospace",
            fontSize: "14px"
          }}
        />
        
        <select
          value={protocolFilter}
          onChange={(e) => setProtocolFilter(e.target.value)}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#e2e8f0",
            padding: "8px 12px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "14px"
          }}
        >
          <option value="all">ALL PROTOCOLS</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
          <option value="other">OTHER</option>
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "#64748b", fontSize: "12px" }}>BLOCKED</label>
          <button
            onClick={() => setBlockedOnly(!blockedOnly)}
            style={{
              width: "44px",
              height: "24px",
              background: blockedOnly ? "#22d3ee" : "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              position: "relative",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <div style={{
              position: "absolute",
              top: "2px",
              left: blockedOnly ? "22px" : "2px",
              width: "18px",
              height: "18px",
              background: "#fff",
              borderRadius: "50%",
              transition: "all 0.2s"
            }} />
          </button>
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
            onClick={fetchFlows}
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
      {filteredFlows.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <pre style={{
            color: "#64748b",
            fontSize: "18px",
            margin: 0,
            fontFamily: "monospace"
          }}>
{`██╗   ██╗ ██████╗ ██╗██████╗
██║   ██║██╔═══██╗██║██╔══██╗
██║   ██║██║   ██║██║██║  ██║
╚██╗ ██╔╝██║   ██║██║██║  ██║
╚████╔╝ ╚██████╔╝██║██████╔╝
╚═══╝   ╚═════╝ ╚═╝╚═════╝
`}
          </pre>
          <div style={{ marginTop: "20px", color: "#64748b" }}>
            SCANNING NETWORK<span style={{ animation: "blink 1s infinite" }}>...</span>
          </div>
        </div>
      )}

      {/* Flow Table */}
      <AnimatePresence>
        {filteredFlows.map((flow, index) => (
          <motion.div
            key={`${flow.flow_id || index}-${lastSync.getTime()}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            style={{
              background: flow.blocked ? "rgba(239, 68, 68, 0.05)" : "rgba(0, 0, 0, 0.3)",
              borderLeft: flow.blocked ? "3px solid #ef4444" : "3px solid transparent",
              borderRadius: "4px",
              padding: "12px 16px",
              marginBottom: "8px",
              display: "grid",
              gridTemplateColumns: "40px 80px 140px 140px 100px 60px 80px 80px 80px",
              gap: "12px",
              alignItems: "center",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            whileHover={{
              borderLeftColor: "#22d3ee",
              background: "rgba(34, 211, 238, 0.05)"
            }}
          >
            {/* # */}
            <div style={{ color: "#64748b" }}>{index + 1}</div>
            
            {/* Flow ID */}
            <div style={{ 
              color: "#64748b", 
              fontFamily: "monospace",
              fontSize: "11px"
            }}>
              {(flow.flow_id || "unknown").substring(0, 8)}
            </div>
            
            {/* Source */}
            <div style={{ 
              color: "#22d3ee", 
              fontFamily: "monospace",
              fontSize: "11px"
            }}>
              {flow.src_ip || "0.0.0.0"}:{flow.src_port || "--"}
            </div>
            
            {/* Destination */}
            <div style={{ 
              color: "#fff", 
              fontFamily: "monospace",
              fontSize: "11px"
            }}>
              {flow.dst_ip || "0.0.0.0"}:{flow.dst_port || "--"}
            </div>
            
            {/* App */}
            <div>
              <span style={{
                background: getAppColor(flow.app),
                color: "#fff",
                padding: "2px 6px",
                borderRadius: "2px",
                fontSize: "10px",
                fontWeight: "600"
              }}>
                {flow.app || "Unknown"}
              </span>
            </div>
            
            {/* Protocol */}
            <div>
              <span style={{
                background: flow.protocol === "tcp" ? "#3b82f6" : 
                          flow.protocol === "udp" ? "#10b981" : "#6b7280",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: "2px",
                fontSize: "10px",
                fontWeight: "600"
              }}>
                {flow.protocol?.toUpperCase() || "UNKNOWN"}
              </span>
            </div>
            
            {/* Bytes */}
            <div style={{ color: "#94a3b8" }}>
              {formatBytes(flow.bytes)}
            </div>
            
            {/* Duration */}
            <div style={{ color: "#94a3b8" }}>
              {formatDuration(flow.duration)}
            </div>
            
            {/* Status */}
            <div>
              {flow.blocked ? (
                <span style={{
                  background: "#ef4444",
                  color: "#fff",
                  padding: "2px 6px",
                  borderRadius: "2px",
                  fontSize: "10px",
                  fontWeight: "600"
                }}>
                  ⚠️ BLOCKED
                </span>
              ) : (
                <span style={{
                  color: "#10b981",
                  fontSize: "12px"
                }}>
                  ● ALLOWED
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Stats Bar */}
      {filteredFlows.length > 0 && (
        <div style={{
          marginTop: "30px",
          padding: "16px",
          background: "rgba(0, 0, 0, 0.5)",
          border: "1px solid #334155",
          borderRadius: "4px",
          color: "#64748b",
          fontSize: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            SHOWING {stats.total} OF {flows.length} FLOWS
          </div>
          <div>
            {stats.blocked} BLOCKED
          </div>
          <div>
            {formatBytes(stats.totalBytes)} TOTAL
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
