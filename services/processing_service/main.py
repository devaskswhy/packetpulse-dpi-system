import os
import json
import time
import logging
import asyncio
from datetime import datetime
from collections import defaultdict
from confluent_kafka import Consumer, Producer, KafkaException
from fastapi import FastAPI
import uvicorn
import threading

# Custom JSON Formatter for Logging
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "service": "processing_service",
            "msg": record.getMessage()
        }
        return json.dumps(log_record)

logger = logging.getLogger("processing_service")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

# Config from env
KAFKA_BROKERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
IN_TOPIC = os.getenv("KAFKA_TOPIC_IN", "raw_packets")
OUT_TOPIC = os.getenv("KAFKA_TOPIC_OUT", "processed_packets")
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8002"))
WINDOW_SIZE = 10.0 # 10 seconds

app = FastAPI(title="Processing Service Health")

@app.get("/health")
def health():
    return {"status": "ok", "service": "processing_service"}

def delivery_report(err, msg):
    if err is not None:
        logger.error(f"Message delivery failed: {err}")

def run_processor():
    consumer_conf = {
        'bootstrap.servers': KAFKA_BROKERS,
        'group.id': 'processing_service',
        'auto.offset.reset': 'latest'
    }
    producer_conf = {
        'bootstrap.servers': KAFKA_BROKERS
    }
    
    # Retry connecting to Kafka
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

    flows = defaultdict(lambda: {
        "bytes_fw": 0, "bytes_bw": 0,
        "packets_fw": 0, "packets_bw": 0,
        "first_seen": None, "last_seen": None,
        "protocol": ""
    })
    
    last_flush = time.time()
    
    logger.info("Started processing service loops")
    try:
        while True:
            msg = consumer.poll(1.0)
            now = time.time()
            
            # Flush windows every 10 seconds
            if now - last_flush >= WINDOW_SIZE:
                for flow_id, stats in flows.items():
                    if stats["packets_fw"] == 0 and stats["packets_bw"] == 0:
                        continue
                    
                    src_ip, dst_ip, src_port, dst_port, protocol = flow_id
                    
                    record = {
                        "flow_id": f"{src_ip}:{src_port}-{dst_ip}:{dst_port}-{protocol}",
                        "src_ip": src_ip,
                        "dst_ip": dst_ip,
                        "src_port": src_port,
                        "dst_port": dst_port,
                        "protocol": protocol,
                        "bytes_fw": stats["bytes_fw"],
                        "bytes_bw": stats["bytes_bw"],
                        "packets_fw": stats["packets_fw"],
                        "packets_bw": stats["packets_bw"],
                        "duration": stats["last_seen"] - stats["first_seen"],
                        "timestamp": datetime.fromtimestamp(stats["last_seen"]).isoformat()
                    }
                    
                    try:
                        producer.produce(
                            OUT_TOPIC,
                            key=record["flow_id"],
                            value=json.dumps(record),
                            callback=delivery_report
                        )
                    except Exception as e:
                        logger.error(f"Produce failed: {e}")
                
                producer.poll(0)
                flows.clear()
                last_flush = now
                
            if msg is None:
                continue
            if msg.error():
                logger.error(f"Consumer error: {msg.error()}")
                continue
            
            try:
                pkt = json.loads(msg.value().decode('utf-8'))
                
                src = pkt.get("src_ip")
                dst = pkt.get("dst_ip")
                sport = pkt.get("src_port", 0)
                dport = pkt.get("dst_port", 0)
                proto = pkt.get("protocol")
                size = pkt.get("size", 0)
                ts = pkt.get("timestamp_us", now * 1000000) / 1000000.0
                
                # 5-tuple canonicalization (lowest IP first or directional)
                # keeping it directional for fw/bw distinction
                flow_key = (src, dst, sport, dport, proto)
                reverse_key = (dst, src, dport, sport, proto)
                
                if reverse_key in flows:
                    f = flows[reverse_key]
                    f["bytes_bw"] += size
                    f["packets_bw"] += 1
                    f["last_seen"] = ts
                else:
                    f = flows[flow_key]
                    if f["first_seen"] is None:
                        f["first_seen"] = ts
                        f["protocol"] = proto
                    f["bytes_fw"] += size
                    f["packets_fw"] += 1
                    f["last_seen"] = ts
                    
            except Exception as e:
                logger.error(f"Error parse packet: {e}")
                
    except KeyboardInterrupt:
        logger.info("Shutting down processing service")
    finally:
        consumer.close()
        producer.flush()

if __name__ == "__main__":
    t = threading.Thread(target=run_processor, daemon=True)
    t.start()
    uvicorn.run(app, host="0.0.0.0", port=HEALTH_PORT, log_level="error")
