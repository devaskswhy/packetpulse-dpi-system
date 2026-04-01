import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/useAppStore';

export default function LiveTrafficChart() {
  const stats = useAppStore(state => state.stats);
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!stats || !stats.ts) return;
    setData(prev => {
      const lastPoint = prev[prev.length - 1];
      if (lastPoint && lastPoint.rawTs === stats.ts) return prev; 

      let bytesPerSec = 0;
      let packetsPerSec = 0;

      if (lastPoint) {
        const timeDiff = (new Date(stats.ts).getTime() - new Date(lastPoint.rawTs).getTime()) / 1000;
        if (timeDiff > 0) {
          bytesPerSec = Math.max(0, (stats.total_bytes - lastPoint.rawBytes) / timeDiff);
          packetsPerSec = Math.max(0, (stats.total_packets - lastPoint.rawPackets) / timeDiff);
        }
      }

      const point = {
        time: new Date(stats.ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' }),
        rawTs: stats.ts,
        rawBytes: stats.total_bytes,
        rawPackets: stats.total_packets,
        bytesSec: bytesPerSec,
        packetsSec: packetsPerSec
      };

      const newData = [...prev, point];
      if (newData.length > 61) newData.shift();
      return newData;
    });
  }, [stats]);

  const renderData = data.slice(1);

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 md:p-6 w-full h-[400px]">
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#e2e8f0]">Live Traffic</h3>
          <p className="text-xs text-[#94a3b8]">Real-time bytes and packets per second</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={renderData}>
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
            formatter={(value, name) => [name === 'bytesSec' ? `${(value/1024/1024).toFixed(2)} MB/s` : `${Math.round(value)} p/s`, name === 'bytesSec' ? 'Bytes/s' : 'Packets/s']}
          />
          <Area yAxisId="left" type="monotone" dataKey="bytesSec" stroke="#22d3ee" fillOpacity={1} fill="url(#colorBytes)" isAnimationActive={false} />
          <Area yAxisId="right" type="monotone" dataKey="packetsSec" stroke="#a78bfa" fillOpacity={1} fill="url(#colorPackets)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
