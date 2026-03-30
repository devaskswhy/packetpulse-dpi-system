import os
import json
import time
import logging
import threading
from confluent_kafka import Consumer, Producer
from fastapi import FastAPI
import uvicorn
import asyncio
from rate_limiter import RateLimiter
from rule_engine import RuleEngine
from ml_engine import MLEngine
from config import setup_logger, KAFKA_BROKERS, IN_TOPIC, OUT_TOPIC, REDIS_HOST, REDIS_PORT, HEALTH_PORT

logger = setup_logger("detection_main")

app = FastAPI(title="Detection Service Health")

@app.get("/health")
def health():
    return {"status": "ok", "service": "detection_service"}

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
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
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

    rate_limiter = RateLimiter(
        redis_host=REDIS_HOST, 
        redis_port=REDIS_PORT, 
        producer=producer, 
        alert_topic=OUT_TOPIC
    )
    
    rule_engine = RuleEngine(rate_limiter)
    ml_engine = MLEngine()
    
    # Start the rule engine background refresh
    loop.create_task(rule_engine.start_refresh_loop())

    logger.info("Started detection loop")
    
    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None: continue
            if msg.error(): continue
            
            try:
                flow = json.loads(msg.value().decode('utf-8'))
                
                # Check deterministic rules
                alerts = loop.run_until_complete(rule_engine.check(flow))
                
                # Check ML models (stubbed)
                alerts.extend(ml_engine.check(flow))
                
                for alert in alerts:
                    producer.produce(
                        OUT_TOPIC,
                        value=json.dumps(alert),
                        callback=delivery_report
                    )
                    logger.info(f"Generated alert: {alert.get('type', alert.get('alert_type'))} for {alert.get('flow_id', 'unknown')}")
                    
            except Exception as e:
                logger.error(f"Decoding flow failed: {e}")

            producer.poll(0)

    except KeyboardInterrupt:
        logger.info("Shutting down detection service")
    finally:
        consumer.close()
        producer.flush()
        loop.run_until_complete(rule_engine.stop())
        loop.run_until_complete(rate_limiter.close())
        loop.close()

if __name__ == "__main__":
    t = threading.Thread(target=run_detector, daemon=True)
    t.start()
    uvicorn.run(app, host="0.0.0.0", port=HEALTH_PORT, log_level="error")
