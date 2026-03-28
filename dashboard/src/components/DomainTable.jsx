/**
 * DomainTable — Table displaying extracted SNI / domain data.
 */

const formatBytes = (b) => {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + " GB";
    if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
    if (b >= 1_024) return (b / 1_024).toFixed(1) + " KB";
    return b + " B";
};

export default function DomainTable({ domains }) {
    if (!domains?.length) return null;

    return (
        <div className="table-panel">
            <div className="panel-header">
                <div>
                    <div className="panel-title">Extracted Domains (SNI)</div>
                    <div className="panel-subtitle">
                        TLS SNI · HTTP Host · DNS extraction
                    </div>
                </div>
                <span
                    className="panel-badge"
                    style={{
                        background: "rgba(167, 139, 250, 0.1)",
                        color: "var(--accent-violet)",
                    }}
                >
                    {domains.length} domains
                </span>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Application</th>
                            <th>Flows</th>
                            <th>Traffic</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {domains.map((d, i) => (
                            <tr key={i}>
                                <td className="mono">{d.domain}</td>
                                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                    {d.app}
                                </td>
                                <td>{d.flow_count}</td>
                                <td>{formatBytes(d.total_bytes)}</td>
                                <td>
                                    <span
                                        className={`badge ${d.blocked ? "blocked" : "allowed"}`}
                                    >
                                        {d.blocked ? "🚫 Blocked" : "✅ Allowed"}
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
