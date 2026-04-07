import React, { memo } from 'react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDPI } from '../context/DPIContext';

function LiveTrafficChart({ chartData }) {
  const { chartData: contextChartData } = useDPI();
  const data = chartData || contextChartData;

  return (
    <div style={{ width: '100%', height: 280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', marginTop: '-8px' }}>
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' }}>Live Traffic</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Real-time bytes and packets per second</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
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

export default memo(LiveTrafficChart);
