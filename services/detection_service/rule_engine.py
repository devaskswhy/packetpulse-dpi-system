import json
import time
import asyncio
import fnmatch
from typing import List, Dict, Any
import uuid
from datetime import datetime
import redis.asyncio as redis
from config import setup_logger, REDIS_HOST, REDIS_PORT

logger = setup_logger("rule_engine")

class RuleEngine:
    def __init__(self, rate_limiter):
        self.rate_limiter = rate_limiter
        self.redis_pool = redis.ConnectionPool(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        self.redis = redis.Redis(connection_pool=self.redis_pool)
        self.running = True
        
        # Default rules
        self.rules = {
            "blocked_ips": ["1.2.3.4"],
            "blocked_domains": ["*.ads.com", "malware.net"],
            "rate_limits": { "default_pps": 1000, "ip_overrides": {} },
            "blocked_ports": [4444, 6667]
        }
        
    async def start_refresh_loop(self):
        """Asynchronous loop fetching rules from Redis every 60s."""
        logger.info("Starting RuleEngine background refresh loop")
        # Ensure we fetch at least once immediately
        await self._fetch_rules()
        
        while self.running:
            await asyncio.sleep(60)
            await self._fetch_rules()

    async def _fetch_rules(self):
        try:
            data = await self.redis.get("rules:config")
            if data:
                new_rules = json.loads(data)
                # Ensure the required keys exist, map defaults if they don't
                self.rules = {
                    "blocked_ips": new_rules.get("blocked_ips", self.rules["blocked_ips"]),
                    "blocked_domains": new_rules.get("blocked_domains", self.rules["blocked_domains"]),
                    "rate_limits": new_rules.get("rate_limits", self.rules["rate_limits"]),
                    "blocked_ports": new_rules.get("blocked_ports", self.rules["blocked_ports"])
                }
                logger.info("Successfully refreshed rules from Redis.")
        except Exception as e:
            logger.error(f"Failed to fetch rules from Redis: {e}")

    async def check(self, flow: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluate single flow record across deterministic rules. 
        Returns a list of formatting Alerts.
        """
        alerts = []
        
        src_ip = flow.get("src_ip", "")
        dst_ip = flow.get("dst_ip", "")
        sni = flow.get("sni", "")
        src_port = flow.get("src_port", 0)
        dst_port = flow.get("dst_port", 0)
        flow_id = flow.get("flow_id", "unknown")
        
        # 1. Blocked IP Check
        blocked_ips = set(self.rules.get("blocked_ips", []))
        if src_ip in blocked_ips or dst_ip in blocked_ips:
            offender = src_ip if src_ip in blocked_ips else dst_ip
            alerts.append(self._create_alert(
                "blocked_ip",
                flow,
                f"Connection involving known blocked IP: {offender}",
                "critical"
            ))

        # 2. Blocked Domains (SNI Check)
        if sni:
            blocked_domains = self.rules.get("blocked_domains", [])
            for domain in blocked_domains:
                if fnmatch.fnmatch(sni, domain) or sni == domain:
                    alerts.append(self._create_alert(
                        "blocked_domain",
                        flow,
                        f"SNI '{sni}' matched blocked pattern: {domain}",
                        "high"
                    ))
                    break
        
        # 3. Blocked Ports Check
        blocked_ports = set(self.rules.get("blocked_ports", []))
        if src_port in blocked_ports or dst_port in blocked_ports:
            offending_port = src_port if src_port in blocked_ports else dst_port
            alerts.append(self._create_alert(
                "blocked_port",
                flow,
                f"Communication over blocked port: {offending_port}",
                "medium"
            ))
            
        # 4. Rate Limiting Check
        rate_limits = self.rules.get("rate_limits", {})
        default_pps = rate_limits.get("default_pps", 1000)
        overrides = rate_limits.get("ip_overrides", {})
        
        src_limit = overrides.get(src_ip, default_pps)
        dst_limit = overrides.get(dst_ip, default_pps)
        
        # We need to compute total packets or just treat this flow as the batch.
        # But Phase 5 rate limiter expects total packets currently processed?
        # Actually in Phase 5, the rate limiter just bumps by 1 or the batch length.
        # Wait, the instruction says: RateLimiter using Redis sliding window...
        # If rate_limiter.is_rate_limited triggers its own alert, we just call it.
        # To unify alert mapping, let's have it return bool and we map alert here.
        is_src_limited = await self.rate_limiter.is_rate_limited(src_ip, window_s=60, max_packets=src_limit)
        if is_src_limited:
            alerts.append(self._create_alert(
                "rate_limit",
                flow,
                f"IP {src_ip} exceeded packet rate limit of {src_limit} over 60s.",
                "high"
            ))
            
        is_dst_limited = await self.rate_limiter.is_rate_limited(dst_ip, window_s=60, max_packets=dst_limit)
        if is_dst_limited:
            alerts.append(self._create_alert(
                "rate_limit",
                flow,
                f"IP {dst_ip} exceeded packet rate limit of {dst_limit} over 60s.",
                "high"
            ))

        return alerts

    def _create_alert(self, type_str: str, flow: Dict[str, Any], reason: str, severity: str) -> Dict[str, Any]:
        return {
            "alert_id": str(uuid.uuid4()),
            "type": type_str,
            "flow_id": flow.get("flow_id", "unknown"),
            "src_ip": flow.get("src_ip", ""),
            "dst_ip": flow.get("dst_ip", ""),
            "reason": reason,
            "severity": severity,
            "ts": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        }
        
    async def stop(self):
        self.running = False
        try:
            await self.redis.close()
            await self.redis_pool.disconnect()
        except:
            pass
