import os
import json
import time
import logging
from datetime import datetime
from collections import deque, defaultdict
import threading
from confluent_kafka import Consumer, Producer
from fastapi import FastAPI
import uvicorn

# Custom JSON Formatter
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "service": "detection_service",
            "msg": record.getMessage()
        }
        return json.dumps(log_record)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("detection_service")
# Clear existing handlers
for h in logger.handlers[:]:
    logger.removeHandler(h)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.propagate = False

# Config from env
KAFKA_BROKERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
IN_TOPIC = os.getenv("KAFKA_TOPIC_IN", "processed_packets")
OUT_TOPIC = os.getenv("KAFKA_TOPIC_OUT", "alerts")
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8003"))

app = FastAPI(title="Detection Service Health")

@app.get("/health")
def health():
    return {"status": "ok", "service": "detection_service"}

BLOCKED_IPS = {"192.168.1.100", "10.0.0.99"} # Example blocked IPs
RATE_LIMIT_PPS = 1000 # packets per second threshold

def delivery_report(err, msg):
    if err:
        logger.error(f"Failed to deliver alert: {err}")

def run_detector():
    consumer_conf = {
        'bootstrap.servers': KAFKA_BROKERS,
        'group.id': 'detection_service',
        'auto.offset.reset': 'latest'
    }
    producer_conf = {
        'bootstrap.servers': KAFKA_BROKERS
    }
    
    while True:
        try:
            consumer = Consumer(consumer_conf)
            producer = Producer(producer_conf)
            consumer.subscribe([IN_TOPIC])
            logger.info(f"Connected to Kafka brokers at {KAFKA_BROKERS}")
            break
        except Exception as e:
            logger.error(f"Waiting for Kafka... {e}")
            time.sleep(2)

    logger.info("Started detection loop")
    
    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None: continue
            if msg.error(): continue
            
            try:
                flow = json.loads(msg.value().decode('utf-8'))
                
                src = flow.get("src_ip")
                dst = flow.get("dst_ip")
                total_pkts = flow.get("packets_fw", 0) + flow.get("packets_bw", 0)
                duration = flow.get("duration", 0)
                
                alerts = []
                
                # Rule 1: Blocked IP
                if src in BLOCKED_IPS or dst in BLOCKED_IPS:
                    offender = src if src in BLOCKED_IPS else dst
                    alerts.append({
                        "alert_type": "Blocked_IP_Access",
                        "severity": "CRITICAL",
                        "message": f"Connection to/from known blocked IP: {offender}",
                        "flow_id": flow.get("flow_id", "unknown"),
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    })
                
                # Rule 2: Rate limit (High PPS)
                pps = total_pkts / duration if duration > 0 else total_pkts
                if pps > RATE_LIMIT_PPS:
                    alerts.append({
                        "alert_type": "High_Packet_Rate",
                        "severity": "HIGH",
                        "message": f"High packet rate detected: {pps:.1f} pps (Threshold {RATE_LIMIT_PPS})",
                        "flow_id": flow.get("flow_id", "unknown"),
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    })
                
                for alert in alerts:
                    producer.produce(
                        OUT_TOPIC,
                        value=json.dumps(alert),
                        callback=delivery_report
                    )
                    logger.info(f"Generated alert: {alert['alert_type']} for {alert['flow_id']}")
                    
            except Exception as e:
                logger.error(f"Decoding flow failed: {e}")

            producer.poll(0)

    except KeyboardInterrupt:
        logger.info("Shutting down detection service")
    finally:
        consumer.close()
        producer.flush()

if __name__ == "__main__":
    t = threading.Thread(target=run_detector, daemon=True)
    t.start()
    uvicorn.run(app, host="0.0.0.0", port=HEALTH_PORT, log_level="error")
