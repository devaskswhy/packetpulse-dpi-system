import os
import json
import logging
import asyncio
from typing import Dict, Any, List
from collections import deque
from datetime import datetime
from confluent_kafka import Consumer

# Custom JSON Formatter
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
# Clear existing handlers
for h in logger.handlers[:]:
    logger.removeHandler(h)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.propagate = False

KAFKA_BROKERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

class DataLoader:
    def __init__(self):
        self.flows = deque(maxlen=1000)
        self.alerts = deque(maxlen=100)
        self.stats = {
            "total_packets": 0,
            "total_bytes": 0,
            "blocked_count": 0,
            "top_apps": {"Unknown": 0}
        }
        self._source = "kafka"

    def get_data(self) -> Dict[str, Any]:
        """Returns the current state."""
        return {
            "flows": list(self.flows),
            "alerts": list(self.alerts),
            "stats": self.stats
        }

    def get_source(self) -> str:
        return self._source

    async def poll_loop(self):
        """Background asyncio task to poll Kafka topics using confluent_kafka."""
        logger.info(f"Starting Kafka consumer loop on brokers: {KAFKA_BROKERS}")
        
        loop = asyncio.get_running_loop()
        
        consumer_conf = {
            'bootstrap.servers': KAFKA_BROKERS,
            'group.id': 'api_gateway',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': True
        }
        
        consumer = Consumer(consumer_conf)
        
        # We need to retry connection inside the async loop
        while True:
            try:
                # We use run_in_executor to not block the asyncio event loop
                await loop.run_in_executor(None, consumer.subscribe, ["processed_packets", "alerts"])
                logger.info("Successfully subscribed to processed_packets and alerts")
                break
            except Exception as e:
                logger.error(f"Kafka connection error: {e}")
                await asyncio.sleep(2.0)
                
        try:
            while True:
                # Use a small timeout to yield back to event loop if needed
                msg = await loop.run_in_executor(None, consumer.poll, 0.1)
                
                if msg is None:
                    # Give control back to event loop
                    await asyncio.sleep(0.01)
                    continue
                if msg.error():
                    logger.error(f"Consumer error: {msg.error()}")
                    continue
                    
                topic = msg.topic()
                try:
                    data = json.loads(msg.value().decode('utf-8'))
                    
                    if topic == "processed_packets":
                        # Convert Processing_Service output to API FlowObj
                        # Expected Processing keys: 
                        # flow_id, src_ip, dst_ip, src_port, dst_port, protocol, bytes_fw, bytes_bw, packets_fw, timestamp
                        flow_obj = {
                            "timestamp": data.get("timestamp", ""),
                            "src_ip": data.get("src_ip", ""),
                            "dst_ip": data.get("dst_ip", ""),
                            "src_port": data.get("src_port", 0),
                            "dst_port": data.get("dst_port", 0),
                            "protocol": data.get("protocol", ""),
                            "app": "Unknown",
                            "sni": None,
                            "bytes": data.get("bytes_fw", 0) + data.get("bytes_bw", 0),
                            "blocked": False, # Will be set by alerts if needed, but keeping False default
                            "flow_id": data.get("flow_id", "")
                        }
                        
                        self.flows.appendleft(flow_obj)
                        
                        # Update stats
                        self.stats["total_bytes"] += flow_obj["bytes"]
                        self.stats["total_packets"] += data.get("packets_fw", 0) + data.get("packets_bw", 0)
                        
                    elif topic == "alerts":
                        # Convert Alert to API AlertObj format
                        # Processing uses: alert_type, severity, message, timestamp
                        alert_obj = {
                            "type": "blocked" if "Blocked" in data.get("alert_type", "") else "anomaly",
                            "ip": data.get("flow_id", "").split("-")[0].split(":")[0], # Simplistic IP extraction
                            "reason": data.get("message", ""),
                            "ts": data.get("timestamp", datetime.utcnow().isoformat())
                        }
                        self.alerts.appendleft(alert_obj)
                        
                        if alert_obj["type"] == "blocked":
                            self.stats["blocked_count"] += 1
                        
                except Exception as e:
                    logger.error(f"Error parsing message: {e}")

        except asyncio.CancelledError:
            logger.info("Kafka consumer loop cancelled")
        finally:
            consumer.close()

# Global singleton instance
data_manager = DataLoader()
