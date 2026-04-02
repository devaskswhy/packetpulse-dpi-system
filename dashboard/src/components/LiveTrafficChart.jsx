import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDPI } from '../context/DPIContext';

export default function LiveTrafficChart() {
  const { chartData } = useDPI();

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 md:p-6 w-full h-[400px]">
      <div className="flex justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-[#e2e8f0]">Live Traffic</h3>
          <p className="text-xs text-[#94a3b8]">Real-time bytes and packets per second</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorBytes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPackets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickMargin={10} minTickGap={30} />
          <YAxis yAxisId="left" stroke="#22d3ee" fontSize={11} tickFormatter={(val) => `${(val / 1024 / 1024).toFixed(1)} MB/s`} />
          <YAxis yAxisId="right" orientation="right" stroke="#a78bfa" fontSize={11} tickFormatter={(val) => `${val} p/s`} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            formatter={(value, name) => [name === 'bytes' ? `${(value/1024/1024).toFixed(2)} MB/s` : `${Math.round(value)} p/s`, name === 'bytes' ? 'Bytes/s' : 'Packets/s']}
          />
          <Area yAxisId="left" type="monotone" dataKey="bytes" stroke="#22d3ee" fillOpacity={1} fill="url(#colorBytes)" isAnimationActive={false} />
          <Area yAxisId="right" type="monotone" dataKey="packets" stroke="#a78bfa" fillOpacity={1} fill="url(#colorPackets)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
