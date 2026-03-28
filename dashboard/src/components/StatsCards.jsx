/**
 * StatsCards — Six stat cards displayed in a responsive grid.
 * Maps the /stats API response to visual cards with icons and accents.
 */

const formatNumber = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
};

const formatBytes = (b) => {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + " GB";
    if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
    if (b >= 1_024) return (b / 1_024).toFixed(1) + " KB";
    return b + " B";
};

export default function StatsCards({ stats }) {
    if (!stats) return null;

    const cards = [
        {
            label: "Total Packets",
            value: formatNumber(stats.total_packets),
            sub: `${stats.packets_per_sec.toFixed(0)} pkt/s`,
            icon: "📦",
            accent: "cyan",
        },
        {
            label: "Total Traffic",
            value: formatBytes(stats.total_bytes),
            sub: `${(stats.capture_duration_sec / 60).toFixed(0)} min captured`,
            icon: "📡",
            accent: "violet",
        },
        {
            label: "Active Flows",
            value: stats.active_flows.toLocaleString(),
            sub: "Currently tracked",
            icon: "🔀",
            accent: "emerald",
        },
        {
            label: "Blocked",
            value: formatNumber(stats.blocked_packets),
            sub: "Packets dropped",
            icon: "🛡️",
            accent: "rose",
        },
        {
            label: "TCP Packets",
            value: formatNumber(stats.protocols.tcp),
            sub: `${((stats.protocols.tcp / stats.total_packets) * 100).toFixed(1)}% of traffic`,
            icon: "🔗",
            accent: "blue",
        },
        {
            label: "UDP Packets",
            value: formatNumber(stats.protocols.udp),
            sub: `${((stats.protocols.udp / stats.total_packets) * 100).toFixed(1)}% of traffic`,
            icon: "⚡",
            accent: "amber",
        },
    ];

    return (
        <div className="stats-grid">
            {cards.map((c) => (
                <div key={c.label} className={`stat-card ${c.accent}`}>
                    <div className="stat-header">
                        <span className="stat-label">{c.label}</span>
                        <span className="stat-icon">{c.icon}</span>
                    </div>
                    <div className="stat-value">{c.value}</div>
                    <div className="stat-sub">{c.sub}</div>
                </div>
            ))}
        </div>
    );
}
