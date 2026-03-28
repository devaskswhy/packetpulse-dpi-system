/**
 * AlertsList — Shows mock security alerts with severity levels.
 * Will connect to the detection engine once built.
 */

const MOCK_ALERTS = [
    {
        severity: "high",
        icon: "🚨",
        title: "Blocked domain access detected",
        desc: "Host 192.168.1.10 attempted to reach *.facebook.com (blocked by domain rule). 7 flows intercepted.",
        time: "2 min ago",
    },
    {
        severity: "high",
        icon: "⛔",
        title: "TikTok traffic blocked",
        desc: "Host 192.168.1.30 attempted connections to *.tiktok.com. 12 flows dropped by application rule.",
        time: "5 min ago",
    },
    {
        severity: "medium",
        icon: "⚠️",
        title: "High packet rate from single host",
        desc: "192.168.1.30 is generating 4,710 packets to AWS endpoints. Potential data exfiltration or large upload.",
        time: "8 min ago",
    },
    {
        severity: "medium",
        icon: "🔍",
        title: "Unusual DNS query volume",
        desc: "26 DNS queries in short burst from 192.168.1.25 to 8.8.8.8. Could indicate DNS tunneling.",
        time: "12 min ago",
    },
    {
        severity: "low",
        icon: "ℹ️",
        title: "New SSH session established",
        desc: "Inbound SSH connection from 10.0.0.5 to 192.168.1.1 — 2,340 packets exchanged.",
        time: "18 min ago",
    },
    {
        severity: "low",
        icon: "📊",
        title: "Netflix streaming detected",
        desc: "High-bandwidth flow (5.0 MB) to *.netflix.com from 192.168.1.10. Application classified as Netflix.",
        time: "22 min ago",
    },
    {
        severity: "medium",
        icon: "🔐",
        title: "Unclassified TLS traffic",
        desc: "3 flows with unknown SNI patterns detected. Manual inspection recommended for threat assessment.",
        time: "30 min ago",
    },
];

export default function AlertsList({ filter = "all" }) {
    const alerts =
        filter === "all"
            ? MOCK_ALERTS
            : MOCK_ALERTS.filter((a) => a.severity === filter);

    return (
        <div className="alerts-list">
            {alerts.map((a, i) => (
                <div key={i} className={`alert-card ${a.severity}`}>
                    <span className="alert-icon">{a.icon}</span>
                    <div className="alert-body">
                        <div className="alert-title">{a.title}</div>
                        <div className="alert-desc">{a.desc}</div>
                        <div className="alert-meta">
                            <span className={`badge severity-${a.severity}`}>
                                {a.severity.toUpperCase()}
                            </span>
                            <span className="alert-time">{a.time}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
