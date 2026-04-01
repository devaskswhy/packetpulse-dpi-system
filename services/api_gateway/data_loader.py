import os
import json
import logging
import asyncio
import random
import hashlib
from typing import Dict, Any
from collections import deque
from datetime import datetime

from connection_manager import ws_manager

# ── JSON Formatter ──────────────────────────────────────────────────────────
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "service": "api_gateway",
            "msg": record.getMessage()
        }
        return json.dumps(log_record)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_gateway")
for h in logger.handlers[:]:
    logger.removeHandler(h)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.propagate = False

KAFKA_BROKERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

# ── Simulated Data ──────────────────────────────────────────────────────────
SIM_APPS = ["YouTube", "Netflix", "Facebook", "Instagram", "TikTok", "Reddit", "DNS", "Spotify", "GitHub", "Cloudflare"]
SIM_PROTOS = ["TCP", "UDP"]
SIM_SNIS = ["googlevideo.com", "nflxvideo.net", "fbcdn.net", "cdninstagram.com", "tiktokv.com", "reddit.com", "dns.google", "audio-ak.spotify.com", "github.com", "cloudflare.com"]
SIM_SRC_IPS = [f"192.168.1.{i}" for i in range(10, 60)]
SIM_DST_IPS = ["142.250.183.78", "151.101.1.140", "104.16.85.20", "52.94.236.248", "31.13.65.36", "23.210.112.44", "198.41.215.162", "13.107.42.14"]

def _generate_flow():
    app_idx = random.randint(0, len(SIM_APPS) - 1)
    src_ip = random.choice(SIM_SRC_IPS)
    dst_ip = random.choice(SIM_DST_IPS)
    src_port = random.randint(49152, 65535)
    dst_port = random.choice([443, 80, 53, 8080, 8443, 993, 587])
    proto = "UDP" if dst_port == 53 else "TCP"
    five_tuple = f"{src_ip}-{dst_ip}-{src_port}-{dst_port}-{proto}"
    flow_id = hashlib.md5(five_tuple.encode()).hexdigest()[:16]
    return {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "src_ip": src_ip, "dst_ip": dst_ip,
        "src_port": src_port, "dst_port": dst_port,
        "protocol": proto, "app": SIM_APPS[app_idx],
        "sni": SIM_SNIS[app_idx],
        "bytes": random.randint(1024, 25_000_000),
        "blocked": random.random() < 0.08,
        "flow_id": flow_id,
    }

def _generate_alert():
    alert_types = [
        ("blocked", "high", "Blocked by App Policy (TikTok)"),
        ("blocked", "high", "Connection to known blocked IP: 10.0.0.99"),
        ("anomaly", "medium", "High UDP port scanning behavior"),
        ("anomaly", "medium", "Anomalous traffic pattern detected (IsolationForest)"),
        ("blocked", "critical", "SNI matched blocked pattern: *.malware.com"),
        ("anomaly", "high", "Rate limit exceeded: 1200 pps from single IP"),
    ]
    t, sev, reason = random.choice(alert_types)
    return {
        "type": t,
        "severity": sev,
        "ip": random.choice(SIM_SRC_IPS),
        "reason": reason,
        "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ── DataLoader ──────────────────────────────────────────────────────────────
class DataLoader:
    def __init__(self):
        self.flows = deque(maxlen=1000)
        self.alerts = deque(maxlen=100)
        self.stats: Dict[str, Any] = {
            "total_packets": 0,
            "total_bytes": 0,
            "blocked_count": 0,
            "top_apps": {"Unknown": 0},
        }
        self._source = "initializing"

    def get_data(self) -> Dict[str, Any]:
        return {
            "flows": list(self.flows),
            "alerts": list(self.alerts),
            "stats": self.stats,
        }

    def get_source(self) -> str:
        return self._source

    # ── Main loop ───────────────────────────────────────────────────────
    async def poll_loop(self):
        kafka_ok = await self._try_kafka()
        if not kafka_ok:
            logger.info("Kafka unavailable — switching to simulated data generator")
            self._source = "simulated"
            await self._simulate_loop()

    # ── Kafka ───────────────────────────────────────────────────────────
    async def _try_kafka(self) -> bool:
        try:
            from confluent_kafka import Consumer
        except ImportError:
            logger.warning("confluent_kafka not installed – skipping Kafka consumer")
            return False

        logger.info(f"Attempting Kafka connection on: {KAFKA_BROKERS}")
        consumer_conf = {
            "bootstrap.servers": KAFKA_BROKERS,
            "group.id": "api_gateway",
            "auto.offset.reset": "latest",
            "enable.auto.commit": True,
            "session.timeout.ms": 6000,
            "socket.timeout.ms": 3000,
        }

        loop = asyncio.get_running_loop()
        try:
            consumer = Consumer(consumer_conf)
            metadata = await loop.run_in_executor(None, lambda: consumer.list_topics(timeout=3.0))
            if not metadata or not metadata.topics:
                raise Exception("Failed to fetch Kafka metadata or no topics available")

            await loop.run_in_executor(None, consumer.subscribe, ["processed_packets", "alerts"])
            logger.info("Successfully connected to Kafka — consuming live data")
            self._source = "kafka"
            await self._kafka_loop(consumer, loop)
            return True
        except Exception as e:
            logger.warning(f"Kafka connection failed: {e}. Falling back to simulated data.")

        return False

    async def _kafka_loop(self, consumer, loop):
        try:
            while True:
                msg = await loop.run_in_executor(None, consumer.poll, 0.1)
                if msg is None:
                    await asyncio.sleep(0.01)
                    continue
                if msg.error():
                    logger.error(f"Consumer error: {msg.error()}")
                    continue

                topic = msg.topic()
                try:
                    data = json.loads(msg.value().decode("utf-8"))
                    if topic == "processed_packets":
                        flow_obj = {
                            "timestamp": data.get("timestamp", data.get("last_seen", "")),
                            "src_ip": data.get("src_ip", ""),
                            "dst_ip": data.get("dst_ip", ""),
                            "src_port": data.get("src_port", 0),
                            "dst_port": data.get("dst_port", 0),
                            "protocol": data.get("protocol", ""),
                            "app": data.get("app", "Unknown"),
                            "sni": data.get("sni"),
                            "bytes": data.get("bytes", data.get("bytes_fw", 0) + data.get("bytes_bw", 0)),
                            "blocked": data.get("blocked", False),
                            "flow_id": data.get("flow_id", ""),
                        }
                        self.flows.appendleft(flow_obj)
                        self.stats["total_bytes"] += flow_obj["bytes"]
                        self.stats["total_packets"] += data.get("packets", data.get("packets_fw", 0) + data.get("packets_bw", 0))
                        app_name = flow_obj["app"]
                        self.stats["top_apps"][app_name] = self.stats["top_apps"].get(app_name, 0) + flow_obj["bytes"]

                        # Push flows_update to WS clients
                        await ws_manager.broadcast({
                            "type": "flows_update",
                            "count": len(self.flows),
                        })

                    elif topic == "alerts":
                        alert_obj = {
                            "type": data.get("type", "blocked" if "Blocked" in data.get("alert_type", "") else "anomaly"),
                            "severity": data.get("severity", "medium"),
                            "ip": data.get("src_ip", data.get("flow_id", "").split("-")[0]),
                            "reason": data.get("reason", data.get("message", "")),
                            "ts": data.get("ts", data.get("timestamp", datetime.utcnow().isoformat())),
                        }
                        self.alerts.appendleft(alert_obj)
                        if alert_obj["type"] == "blocked":
                            self.stats["blocked_count"] += 1

                        # Immediately push alert to WS clients
                        await ws_manager.broadcast({
                            "type": "alert",
                            "data": alert_obj,
                        })

                except Exception as e:
                    logger.error(f"Error parsing message: {e}")

        except asyncio.CancelledError:
            logger.info("Kafka consumer loop cancelled")
        finally:
            consumer.close()

    # ── Simulated ───────────────────────────────────────────────────────
    async def _simulate_loop(self):
        logger.info("Simulated data generator started — dashboard will show live data")
        app_bytes: Dict[str, int] = {}
        total_packets = 0
        total_bytes = 0
        blocked_count = 0

        # Pre-seed 20 flows
        for _ in range(20):
            flow = _generate_flow()
            self.flows.appendleft(flow)
            total_bytes += flow["bytes"]
            pkt = random.randint(10, 500)
            total_packets += pkt
            if flow["blocked"]:
                blocked_count += 1
            app_bytes[flow["app"]] = app_bytes.get(flow["app"], 0) + flow["bytes"]

        # Seed 5 alerts
        for _ in range(5):
            self.alerts.appendleft(_generate_alert())

        self.stats = {
            "total_packets": total_packets,
            "total_bytes": total_bytes,
            "blocked_count": blocked_count,
            "top_apps": dict(sorted(app_bytes.items(), key=lambda x: x[1], reverse=True)[:5]),
        }

        try:
            while True:
                await asyncio.sleep(random.uniform(1.0, 3.0))

                batch = random.randint(1, 5)
                for _ in range(batch):
                    flow = _generate_flow()
                    self.flows.appendleft(flow)
                    pkt = random.randint(10, 500)
                    total_packets += pkt
                    total_bytes += flow["bytes"]
                    if flow["blocked"]:
                        blocked_count += 1
                    app_bytes[flow["app"]] = app_bytes.get(flow["app"], 0) + flow["bytes"]

                # Push flows_update to WS
                await ws_manager.broadcast({
                    "type": "flows_update",
                    "count": len(self.flows),
                })

                # Occasionally generate an alert
                if random.random() < 0.3:
                    alert = _generate_alert()
                    self.alerts.appendleft(alert)
                    if alert["type"] == "blocked":
                        blocked_count += 1
                    # Immediately push alert to WS clients
                    await ws_manager.broadcast({
                        "type": "alert",
                        "data": alert,
                    })

                self.stats = {
                    "total_packets": total_packets,
                    "total_bytes": total_bytes,
                    "blocked_count": blocked_count,
                    "top_apps": dict(sorted(app_bytes.items(), key=lambda x: x[1], reverse=True)[:5]),
                }

                # Broadcast stats every cycle (≈ every 2s)
                await ws_manager.broadcast({
                    "type": "stats",
                    "data": self.stats,
                })

        except asyncio.CancelledError:
            logger.info("Simulated data generator stopped")


# Global singleton
data_manager = DataLoader()
