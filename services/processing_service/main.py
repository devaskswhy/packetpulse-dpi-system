import json
import time
import signal
import sys
import threading
from confluent_kafka import Consumer, Producer, KafkaException
from fastapi import FastAPI
import uvicorn

from config import setup_logger, KAFKA_BROKERS, IN_TOPIC, OUT_TOPIC_FLOWS, HEALTH_PORT, FLUSH_INTERVAL_SEC
from flow_tracker import FlowTracker
from stats import StatsComputer

logger = setup_logger("processing_service")
app = FastAPI(title="Processing Service Health")

@app.get("/health")
def health():
    return {"status": "ok", "service": "processing_service"}

class ProcessorService:
    def __init__(self):
        self.tracker = FlowTracker()
        self.stats_comp = StatsComputer(self.tracker)
        self.running = True
        
        self.consumer_conf = {
            'bootstrap.servers': KAFKA_BROKERS,
            'group.id': 'processing_service',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': False
        }
        self.producer_conf = {
            'bootstrap.servers': KAFKA_BROKERS
        }

    def _delivery_report(self, err, msg):
        if err is not None:
            logger.error(f"Message delivery failed: {err}")

    def background_flusher(self, producer):
        """Background thread running every 5s to flush stale flows."""
        logger.info(f"Background flusher started (topic: {OUT_TOPIC_FLOWS})")
        while self.running:
            time.sleep(FLUSH_INTERVAL_SEC)
            try:
                stale_records = self.tracker.flush_stale()
                for rec in stale_records:
                    producer.produce(
                        OUT_TOPIC_FLOWS,
                        key=rec["flow_id"],
                        value=json.dumps(rec),
                        callback=self._delivery_report
                    )
                producer.poll(0)
            except Exception as e:
                logger.error(f"Background flush error: {e}")

    def run(self):
        # Retry connect
        while self.running:
            try:
                consumer = Consumer(self.consumer_conf)
                producer = Producer(self.producer_conf)
                consumer.subscribe([IN_TOPIC])
                logger.info(f"Connected to Kafka brokers at {KAFKA_BROKERS}")
                break
            except Exception as e:
                logger.error(f"Waiting for Kafka... {e}")
                time.sleep(2)
        
        if not self.running:
            return

        # Start background threads
        threading.Thread(target=self.background_flusher, args=(producer,), daemon=True).start()
        threading.Thread(target=self.stats_comp.run, daemon=True).start()
        
        logger.info("Started main consumer loop.")
        try:
            while self.running:
                msg = consumer.poll(1.0)
                if msg is None:
                    continue
                if msg.error():
                    logger.error(f"Consumer error: {msg.error()}")
                    continue
                
                try:
                    pkt = json.loads(msg.value().decode('utf-8'))
                    self.tracker.update(pkt)
                    # Commit offset asynchronously
                    consumer.commit(asynchronous=True)
                except Exception as e:
                    logger.error(f"Error parsing raw packet log: {e}")
                    
        except KeyboardInterrupt:
            logger.info("Received KeyboardInterrupt in processor loop.")
        finally:
            self.running = False
            self.stats_comp.stop()
            
            logger.info("Flushing remaining flows...")
            remaining = self.tracker.flush_all()
            for rec in remaining:
                producer.produce(
                    OUT_TOPIC_FLOWS,
                    key=rec["flow_id"],
                    value=json.dumps(rec),
                    callback=self._delivery_report
                )
            
            producer.flush()
            consumer.close()
            logger.info("Graceful shutdown complete.")

    def shutdown(self, signum, frame):
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.running = False

service = ProcessorService()

def main():
    signal.signal(signal.SIGINT, service.shutdown)
    signal.signal(signal.SIGTERM, service.shutdown)
    
    t = threading.Thread(target=service.run, daemon=True)
    t.start()
    uvicorn.run(app, host="0.0.0.0", port=HEALTH_PORT, log_level="error")

if __name__ == "__main__":
    main()
