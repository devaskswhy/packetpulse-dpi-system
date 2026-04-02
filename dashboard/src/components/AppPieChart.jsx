/**
 * AppPieChart — Donut chart showing traffic by application.
 * Uses Recharts PieChart with custom active-shape rendering.
 */

import { useState } from "react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Sector,
} from "recharts";

const COLORS = [
    "#22d3ee",
    "#a78bfa",
    "#34d399",
    "#fb7185",
    "#fbbf24",
    "#60a5fa",
    "#f472b6",
    "#818cf8",
    "#2dd4bf",
    "#f97316",
];

const formatBytes = (b) => {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + " GB";
    if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
    if (b >= 1_024) return (b / 1_024).toFixed(1) + " KB";
    return b + " B";
};

const renderActiveShape = (props) => {
    const {
        cx, cy, innerRadius, outerRadius, startAngle, endAngle,
        fill, payload, percent,
    } = props;

    return (
        <g>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontWeight={700}>
                {payload.name}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize={12}>
                {(percent * 100).toFixed(1)}%
            </text>
            <Sector
                cx={cx} cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx} cy={cy}
                innerRadius={outerRadius + 10}
                outerRadius={outerRadius + 14}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                opacity={0.4}
            />
        </g>
    );
};

export default function AppPieChart({ stats }) {
    const [activeIndex, setActiveIndex] = useState(0);
    
    // Use pre-aggregated top_apps data from stats
    const data = stats?.top_apps 
        ? Object.entries(stats.top_apps)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
        : [];

    return (
        <div className="chart-panel">
            <div className="panel-header">
                <div>
                    <div className="panel-title">Traffic by App</div>
                    <div className="panel-subtitle">Bytes per application</div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        dataKey="value"
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        onMouseEnter={(_, i) => setActiveIndex(i)}
                        animationDuration={800}
                    >
                        {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px 14px",
                    padding: "4px 4px 0",
                    justifyContent: "center",
                }}
            >
                {data.map((d, i) => (
                    <div
                        key={d.name}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11,
                            color: "#94a3b8",
                            cursor: "pointer",
                            opacity: activeIndex === i ? 1 : 0.65,
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: COLORS[i % COLORS.length],
                                flexShrink: 0,
                            }}
                        />
                        {d.name}
                        <span style={{ color: "#475569", fontWeight: 600 }}>
                            {formatBytes(d.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
