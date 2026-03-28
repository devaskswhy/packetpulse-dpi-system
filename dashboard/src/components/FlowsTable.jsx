/**
 * FlowsTable — Full-featured table for network flow data.
 * Includes protocol & status badges, byte formatting, and monospace IPs.
 */

const formatBytes = (b) => {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(2) + " GB";
    if (b >= 1_048_576) return (b / 1_048_576).toFixed(2) + " MB";
    if (b >= 1_024) return (b / 1_024).toFixed(1) + " KB";
    return b + " B";
};

export default function FlowsTable({ flows, compact = false }) {
    if (!flows?.length) {
        return (
            <div className="table-panel">
                <div className="panel-header">
                    <div className="panel-title">Network Flows</div>
                </div>
                <div className="loading-container" style={{ padding: 40 }}>
                    <span className="loading-text">No flows to display</span>
                </div>
            </div>
        );
    }

    const displayed = compact ? flows.slice(0, 6) : flows;

    return (
        <div className="table-panel">
            <div className="panel-header">
                <div>
                    <div className="panel-title">
                        {compact ? "Recent Flows" : "Network Flows"}
                    </div>
                    <div className="panel-subtitle">
                        {compact
                            ? `Showing ${displayed.length} of ${flows.length} flows`
                            : `${flows.length} active flows`}
                    </div>
                </div>
                <span
                    className="panel-badge"
                    style={{
                        background: "rgba(34, 211, 238, 0.1)",
                        color: "var(--accent-cyan)",
                    }}
                >
                    {flows.length} total
                </span>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th>Destination</th>
                            <th>Protocol</th>
                            <th>Application</th>
                            <th>Packets</th>
                            <th>Bytes</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map((f, i) => (
                            <tr key={i}>
                                <td className="mono">
                                    {f.src_ip}
                                    <span style={{ color: "var(--text-muted)" }}>
                                        :{f.src_port}
                                    </span>
                                </td>
                                <td className="mono">
                                    {f.dst_ip}
                                    <span style={{ color: "var(--text-muted)" }}>
                                        :{f.dst_port}
                                    </span>
                                </td>
                                <td>
                                    <span
                                        className={`badge ${f.protocol.toLowerCase()}`}
                                    >
                                        {f.protocol}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                    {f.app}
                                </td>
                                <td>{f.packets.toLocaleString()}</td>
                                <td>{formatBytes(f.bytes)}</td>
                                <td>
                                    <span
                                        className={`badge ${f.blocked ? "blocked" : "allowed"}`}
                                    >
                                        {f.blocked ? "🚫 Blocked" : "✅ Allowed"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
