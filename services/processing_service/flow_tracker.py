import time
import hashlib
from datetime import datetime
from config import setup_logger, FLOW_TIMEOUT_SEC
import threading

logger = setup_logger("flow_tracker")

class FlowTracker:
    def __init__(self):
        # Maps canonical flow_id to flow data
        self.flows = {}
        self.lock = threading.Lock()
        
    def _canonical_key(self, src_ip, dst_ip, src_port, dst_port, protocol):
        # Create a direction-agnostic signature for flow mapping
        if src_ip < dst_ip:
            sig = f"{src_ip}:{src_port}-{dst_ip}:{dst_port}-{protocol}"
        else:
            sig = f"{dst_ip}:{dst_port}-{src_ip}:{src_port}-{protocol}"
        return hashlib.md5(sig.encode('utf-8')).hexdigest()

    def update(self, pkt):
        """Update tracker with a new packet."""
        src_ip = pkt.get("src_ip", "")
        dst_ip = pkt.get("dst_ip", "")
        src_port = pkt.get("src_port", 0)
        dst_port = pkt.get("dst_port", 0)
        protocol = pkt.get("protocol", "")
        app = pkt.get("app", "unknown")
        sni = pkt.get("sni", None)
        size = pkt.get("size", 0)
        
        now = time.time()
        
        flow_id = self._canonical_key(src_ip, dst_ip, src_port, dst_port, protocol)
        
        with self.lock:
            if flow_id not in self.flows:
                self.flows[flow_id] = {
                    "flow_id": flow_id,
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "src_port": src_port,
                    "dst_port": dst_port,
                    "protocol": protocol,
                    "app": app,
                    "sni": sni,
                    "bytes": size,
                    "packets": 1,
                    "first_seen": now,
                    "last_seen": now,
                    "blocked_count": 0
                }
            else:
                flow = self.flows[flow_id]
                flow["bytes"] += size
                flow["packets"] += 1
                flow["last_seen"] = now
                # Retain known sni/app
                if sni: flow["sni"] = sni
                if app != "unknown": flow["app"] = app
                
    def get_all_active_flows(self):
        """Returns a copy of active flows for stats computation."""
        with self.lock:
            return list(self.flows.values())

    def flush_stale(self):
        """Yields flowed records that haven't been updated in FLOW_TIMEOUT_SEC."""
        now = time.time()
        stale_records = []
        
        with self.lock:
            stale_keys = [
                fid for fid, flow in self.flows.items()
                if now - flow["last_seen"] > FLOW_TIMEOUT_SEC
            ]
            
            for fid in stale_keys:
                flow = self.flows.pop(fid)
                stale_records.append(self._format_output(flow))
                
        if stale_records:
            logger.info(f"Flushed {len(stale_records)} stale flows.")
        return stale_records
        
    def flush_all(self):
        """Forces flush of ALL flows (for graceful shutdown)."""
        all_records = []
        with self.lock:
            for fid, flow in list(self.flows.items()):
                all_records.append(self._format_output(flow))
            self.flows.clear()
        
        if all_records:
            logger.info(f"Forced flush of all {len(all_records)} flows.")
        return all_records

    def _format_output(self, flow):
        duration = flow["last_seen"] - flow["first_seen"]
        
        # Convert to ISO8601 strings
        fs_str = datetime.fromtimestamp(flow["first_seen"]).isoformat() + "Z"
        ls_str = datetime.fromtimestamp(flow["last_seen"]).isoformat() + "Z"
        
        return {
            "flow_id": flow["flow_id"],
            "src_ip": flow["src_ip"],
            "dst_ip": flow["dst_ip"],
            "src_port": flow["src_port"],
            "dst_port": flow["dst_port"],
            "protocol": flow["protocol"],
            "app": flow["app"],
            "sni": flow["sni"] or "",
            "bytes": flow["bytes"],
            "packets": flow["packets"],
            "first_seen": fs_str,
            "last_seen": ls_str,
            "blocked": flow["blocked_count"] > 0,
            "duration_s": round(duration, 3)
        }
