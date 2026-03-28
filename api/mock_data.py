from typing import Dict, Any, List
from datetime import datetime

_mock_ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

MOCK_STATS = {
    "total_packets": 124500,
    "total_bytes": 104857600,
    "blocked_count": 86,
    "top_apps": {
        "YouTube": 65000,
        "Facebook": 25000,
        "Netflix": 20000,
        "DNS": 5000,
        "Other": 9500
    }
}

MOCK_FLOWS = [
    {
        "timestamp": _mock_ts,
        "src_ip": "192.168.1.10",
        "dst_ip": "142.250.183.78",
        "src_port": 54312,
        "dst_port": 443,
        "protocol": "TCP",
        "app": "YouTube",
        "sni": "googlevideo.com",
        "bytes": 23010000,
        "blocked": False,
        "flow_id": "a1b2c3d4e5f60000"
    },
    {
        "timestamp": _mock_ts,
        "src_ip": "192.168.1.25",
        "dst_ip": "151.101.1.140",
        "src_port": 60122,
        "dst_port": 443,
        "protocol": "TCP",
        "app": "Reddit",
        "sni": "reddit.com",
        "bytes": 951000,
        "blocked": False,
        "flow_id": "b2c3d4e5f6000011"
    },
    {
        "timestamp": _mock_ts,
        "src_ip": "192.168.1.30",
        "dst_ip": "104.16.85.20",
        "src_port": 55024,
        "dst_port": 443,
        "protocol": "TCP",
        "app": "TikTok",
        "sni": "tiktokv.com",
        "bytes": 1250000,
        "blocked": True,
        "flow_id": "c3d4e5f600001122"
    }
]

MOCK_ALERTS = [
    {
        "type": "blocked",
        "ip": "192.168.1.30",
        "reason": "Blocked by App Policy (TikTok)",
        "ts": _mock_ts
    },
    {
        "type": "anomaly",
        "ip": "192.168.1.55",
        "reason": "High UDP port scanning behavior",
        "ts": _mock_ts
    }
]

def get_mock_data() -> Dict[str, Any]:
    return {
        "stats": MOCK_STATS,
        "flows": MOCK_FLOWS,
        "alerts": MOCK_ALERTS
    }
