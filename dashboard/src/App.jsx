import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import FlowsPage from "./pages/FlowsPage";
import AlertsPage from "./pages/AlertsPage";
import { useDPI } from "./context/DPIContext";
import CyberCursor from "./components/effects/CyberCursor";
import NetworkBackground from "./components/effects/NetworkBackground";
import GlitchText from "./components/effects/GlitchText";
import AlertToast from "./components/effects/AlertToast";
import MatrixIntro from "./components/effects/MatrixIntro";
import TypeWriter from "./components/effects/TypeWriter";
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

const NAV_ITEMS = [
  { to: "/", icon: "📊", label: "Dashboard" },
  { to: "/flows", icon: "🔀", label: "Flows" },
  { to: "/alerts", icon: "🔔", label: "Alerts" },
];

const PAGE_TITLES = {
  "/": "Dashboard",
  "/flows": "Network Flows",
  "/alerts": "Alerts & Threats",
};

export default function App() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || "Dashboard";
  
  console.log('Debug - pathname:', location.pathname);
  console.log('Debug - title:', title);
  const { connectionStatus, stats } = useDPI();
  const [packetsPerSecond, setPacketsPerSecond] = useState(0);
  const previousPacketsRef = useRef(0);
  const previousTimeRef = useRef(Date.now());

  // Calculate packets per second
  useEffect(() => {
    if (stats && stats.total_packets !== undefined) {
      const currentTime = Date.now();
      const timeDiff = (currentTime - previousTimeRef.current) / 1000; // seconds
      const packetDiff = stats.total_packets - previousPacketsRef.current;
      
      if (timeDiff >= 2) { // Update every 2 seconds
        const pps = Math.round(packetDiff / timeDiff);
        setPacketsPerSecond(pps);
        previousPacketsRef.current = stats.total_packets;
        previousTimeRef.current = currentTime;
      }
    }
  }, [stats]);

  const getStatusString = () => {
    if (connectionStatus === "live") return "Engine Online (WS)";
    if (connectionStatus === "polling") return "Engine Polling (REST)";
    return "Engine Offline";
  };

  const getStatusColor = () => {
    if (connectionStatus === "live") return "var(--success)";
    if (connectionStatus === "polling") return "var(--warning)";
    return "var(--danger)";
  };

  return (
    <div className="app-layout">
      <MatrixIntro />
      <CyberCursor />
      <NetworkBackground />
      {/* ---- Sidebar ---- */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="brand-icon"
          >
            PP
          </motion.div>
          <div>
            <GlitchText text="PacketPulse" className="font-bold text-sm" />
            <span>DPI Engine</span>
          </div>
        </div>

        <nav>
          {NAV_ITEMS.map((item, index) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                <motion.div 
                  className="nav-hover-line"
                  initial={{ scaleY: 0 }}
                  whileHover={{ scaleY: 1 }}
                  transition={{ duration: 0.2 }}
                />
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-badge">
            <div 
              className={`status-dot ${connectionStatus === 'live' ? 'live' : ''}`} 
              style={{ backgroundColor: getStatusColor() }} 
            />
            <span>{getStatusString()}</span>
          </div>
        </div>
      </aside>

      {/* ---- Main Area ---- */}
      <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
        <header 
          className="topbar"
          style={{
            background: 'rgba(10, 14, 26, 0.8)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(34, 211, 238, 0.1)',
            background: 'linear-gradient(90deg, rgba(10, 14, 26, 0.8), rgba(34, 211, 238, 0.03), rgba(10, 14, 26, 0.8))'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>
            {/* <TypeWriter key={location.pathname} text={String(title)} /> */}
            {title}
          </h2>
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>CPU: --</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span>MEM: --</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span>PKT/s: {packetsPerSecond}</span>
            </div>
            <div className="live-indicator" style={{ display: connectionStatus === "live" ? "flex" : "none" }}>LIVE</div>
          </div>
        </header>
        
        <motion.div
          key={location.pathname}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            height: '2px',
            background: '#22d3ee',
            transformOrigin: 'left',
            width: '100%'
          }}
        />

        <div className="page-scroll">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </div>
      </div>
      <AlertToast />
    </div>
  );
}
