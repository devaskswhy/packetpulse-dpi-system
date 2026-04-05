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
  const { connectionStatus } = useDPI();

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
          <div className="brand-icon">PP</div>
          <div>
            <GlitchText text="PacketPulse" className="font-bold text-sm" />
            <span>DPI Engine</span>
          </div>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-badge">
            <div className="status-dot" style={{ backgroundColor: getStatusColor() }} />
            <span>{getStatusString()}</span>
          </div>
        </div>
      </aside>

      {/* ---- Main Area ---- */}
      <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
        <header className="topbar">
          <h2>{title}</h2>
          <div className="topbar-actions">
            <div className="live-indicator" style={{ display: connectionStatus === "live" ? "flex" : "none" }}>LIVE</div>
          </div>
        </header>

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
