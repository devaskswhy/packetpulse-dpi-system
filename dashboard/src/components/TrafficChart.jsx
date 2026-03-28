/**
 * TrafficChart — Area chart showing protocol-level traffic breakdown.
 * Uses Recharts composable API for a polished, animated chart.
 */

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

/**
 * Generate mock time-series data from the aggregate stats.
 * In production this would come from a streaming endpoint.
 */
function generateTimeSeries(stats) {
    if (!stats) return [];

    const points = 24;
    const data = [];
    const now = Date.now();

    for (let i = 0; i < points; i++) {
        const t = new Date(now - (points - 1 - i) * 300_000); // 5-min intervals
        const jitter = () => 0.7 + Math.random() * 0.6;

        data.push({
            time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            TCP: Math.round((stats.protocols.tcp / points) * jitter()),
            UDP: Math.round((stats.protocols.udp / points) * jitter()),
            Other: Math.round((stats.protocols.other / points) * jitter()),
        });
    }
    return data;
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>
                {label}
            </div>
            {payload.map((p) => (
                <div
                    key={p.dataKey}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        color: p.color,
                    }}
                >
                    <span>{p.dataKey}</span>
                    <span style={{ fontWeight: 600 }}>
                        {p.value.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default function TrafficChart({ stats }) {
    const data = generateTimeSeries(stats);

    return (
        <div className="chart-panel" style={{ gridColumn: "span 1" }}>
            <div className="panel-header">
                <div>
                    <div className="panel-title">Traffic Volume</div>
                    <div className="panel-subtitle">
                        Protocol breakdown · 5-min intervals
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                    data={data}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="gradTCP" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradUDP" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                        dataKey="time"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={{ stroke: "#1e293b" }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) =>
                            v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v
                        }
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                    />
                    <Area
                        type="monotone"
                        dataKey="TCP"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        fill="url(#gradTCP)"
                        animationDuration={1200}
                    />
                    <Area
                        type="monotone"
                        dataKey="UDP"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        fill="url(#gradUDP)"
                        animationDuration={1400}
                    />
                    <Area
                        type="monotone"
                        dataKey="Other"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        fill="url(#gradOther)"
                        animationDuration={1600}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
