import os
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "service": "processing_service",
            "msg": record.getMessage()
        }
        return json.dumps(log_record)

def setup_logger(name):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
    return logger

KAFKA_BROKERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
IN_TOPIC = os.getenv("KAFKA_TOPIC_IN", "raw_packets")
OUT_TOPIC_FLOWS = os.getenv("KAFKA_TOPIC_OUT_FLOWS", "processed_packets")
OUT_TOPIC_STATS = os.getenv("KAFKA_TOPIC_OUT_STATS", "flow_stats")
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8002"))

FLOW_TIMEOUT_SEC = 30.0
STATS_INTERVAL_SEC = 10.0
FLUSH_INTERVAL_SEC = 5.0
