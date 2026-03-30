import time
import json
import threading
from typing import Dict, Any, List
from collections import defaultdict
from config import setup_logger, STATS_INTERVAL_SEC, OUT_TOPIC_STATS, KAFKA_BROKERS
from confluent_kafka import Producer

logger = setup_logger("stats_computer")

class StatsComputer:
    def __init__(self, tracker):
        self.tracker = tracker
        self.running = True
        
        # Configure Kafka Producer
        self.producer = Producer({'bootstrap.servers': KAFKA_BROKERS})

    def run(self):
        """Background thread to compute and produce stats."""
        logger.info(f"Starting stats computer (topic: {OUT_TOPIC_STATS})")
        
        while self.running:
            time.sleep(STATS_INTERVAL_SEC)
            try:
                self._compute_and_produce()
            except Exception as e:
                logger.error(f"Error computing stats: {e}")

    def _compute_and_produce(self):
        flows = self.tracker.get_all_active_flows()
        
        total_bytes = 0
        total_packets = 0
        blocked_count = 0
        unique_ips = set()
        app_bytes = defaultdict(int)
        
        for flow in flows:
            total_bytes += flow["bytes"]
            total_packets += flow["packets"]
            if flow["blocked_count"] > 0:
                blocked_count += 1
                
            unique_ips.add(flow["src_ip"])
            unique_ips.add(flow["dst_ip"])
            app_bytes[flow["app"]] += flow["bytes"]
            
        # Top 5 apps by bytes
        top_apps = dict(sorted(app_bytes.items(), key=lambda item: item[1], reverse=True)[:5])
        blocked_ratio = round((blocked_count / len(flows)) if len(flows) > 0 else 0, 3)
        
        stats_record = {
            "timestamp": int(time.time()),
            "active_flows": len(flows),
            "total_bytes": total_bytes,
            "total_packets": total_packets,
            "unique_ips": len(unique_ips),
            "blocked_count": blocked_count,
            "blocked_ratio": blocked_ratio,
            "top_apps": top_apps
        }
        
        self.producer.produce(
            OUT_TOPIC_STATS, 
            key="stats", 
            value=json.dumps(stats_record),
            callback=self._delivery_report
        )
        self.producer.poll(0)
        logger.info(f"Published stats: {len(flows)} active flows, {len(unique_ips)} IPs.")
        
    def _delivery_report(self, err, msg):
        if err is not None:
            logger.error(f"Stats generic deliver failed: {err}")

    def stop(self):
        self.running = False
        self.producer.flush()
