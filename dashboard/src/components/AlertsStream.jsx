import { useAppStore } from '../store/useAppStore';
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';

const SEVERITY_COLORS = {
  critical: 'border-red-500 bg-red-500/10 text-red-500',
  high: 'border-orange-500 bg-orange-500/10 text-orange-500',
  medium: 'border-yellow-500 bg-yellow-500/10 text-yellow-500',
  low: 'border-blue-500 bg-blue-500/10 text-blue-500'
};

const SEVERITY_ICONS = {
  critical: <AlertCircle className="w-5 h-5 text-red-500" />,
  high: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  medium: <ShieldAlert className="w-5 h-5 text-yellow-500" />,
  low: <Info className="w-5 h-5 text-blue-500" />
};

export default function AlertsStream({ limit = 20, showHeader = true }) {
  let alerts = useAppStore(state => state.alerts);
  if (limit) alerts = alerts.slice(0, limit);

  return (
    <div className={`bg-[#111827] border border-[#1e293b] rounded-xl ${showHeader ? 'p-4 md:p-6 w-full flex flex-col h-[400px]' : 'p-2 w-full flex flex-col h-full'}`}>
      {showHeader && (
        <div className="mb-4 flex-shrink-0">
          <h3 className="text-sm font-bold text-[#e2e8f0]">Live Alerts Stream</h3>
          <p className="text-xs text-[#94a3b8]">Latest security events</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#334155] [&::-webkit-scrollbar-thumb]:rounded">
        {alerts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#94a3b8] text-sm">No alerts detected...</div>
        ) : (
          alerts.map((alert, i) => (
            <div key={alert.alert_id || i} className={`border-l-4 ${SEVERITY_COLORS[alert.severity?.toLowerCase()]?.split(' ')[0] || 'border-gray-500'} bg-[#1a2236] p-3 rounded-r-lg flex gap-3 shadow-sm`}>
              <div className="mt-0.5">{SEVERITY_ICONS[alert.severity?.toLowerCase()] || <Info className="w-5 h-5 text-gray-500"/>}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-semibold text-[#e2e8f0] truncate pr-2">{(alert.type || 'unknown').replace('_', ' ').toUpperCase()}</span>
                  <span className="text-[10px] text-[#94a3b8] whitespace-nowrap">
                    {new Date(alert.ts).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs text-[#94a3b8] truncate mb-1">SRC: <span className="font-mono text-[#e2e8f0]">{alert.src_ip}</span></div>
                <div className="text-xs text-[#64748b] leading-relaxed">{alert.reason}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
