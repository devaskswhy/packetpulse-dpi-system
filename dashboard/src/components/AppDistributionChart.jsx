import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useAppStore } from '../store/useAppStore';

const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f472b6', '#c084fc'];

export default function AppDistributionChart() {
  const stats = useAppStore(state => state.stats);
  
  const data = stats?.top_apps 
    ? Object.entries(stats.top_apps)
        .map(([name, bytes]) => ({ name, value: bytes }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 md:p-6 w-full h-[400px]">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-[#e2e8f0]">Top Applications</h3>
        <p className="text-xs text-[#94a3b8]">By volume (bytes)</p>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        {data.length > 0 ? (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => `${(value / 1024 / 1024).toFixed(2)} MB`}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}/>
          </PieChart>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-[#94a3b8]">No data available</div>
        )}
      </ResponsiveContainer>
    </div>
  );
}
