# PacketPulse DPI System 🚀

A production-grade, fully containerized, event-driven Deep Packet Inspection platform 
with intelligent threat detection, persistent storage, and a real-time React dashboard — 
deployable with a single command.

## 🏗️ Architecture

```text
[C++ Packet Service]
        │
        ▼
   (raw_packets) ──► [Kafka]
                        │
                        ▼
                [Processing Service]
                        │
                        ▼
  (processed_packets) ──► [Kafka] ──► [Detection Service]
                        │                    │
                        ▼                    ▼
                [API Gateway] ◄── (alerts) ──┘
                        │
                        ▼
                [React Dashboard]
```

## ⚡ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Packet Engine | C++ 17 + libpcap + librdkafka | High-speed DPI, TLS SNI extraction |
| Message Broker | Apache Kafka 7.6 + Zookeeper | Event-driven backbone |
| Processing | Python 3.12 + confluent-kafka | Flow aggregation, 5-tuple tracking |
| Detection | Python 3.12 + scikit-learn | Rule engine + ML anomaly detection |
| ML / Detection | scikit-learn IsolationForest | Unsupervised anomaly detection, DDoS patterns |
| API Gateway | FastAPI + slowapi + Redis auth | REST + WebSocket, pagination, rate limiting, API key auth |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 (async) + Alembic | Persistent flows, alerts, stats history |
| Frontend | React + Vite + Recharts | Live dashboard |
| Cache / Rate Limiter | Redis 7.2 | Active flow cache, rate limiting, stats TTL |
| Reverse Proxy | nginx:alpine | Static serving, API proxy, WebSocket support |
| Orchestration | Docker Compose | Local development |

## 🚀 Quick Start

### Prerequisites
- Docker Desktop with WSL2 integration enabled
- That's it. Nothing else needed.

### One-Command Setup
```bash
git clone https://github.com/devaskswhy/packetpulse-dpi-system
cd packetpulse-dpi-system
cp .env.example .env        # Edit with your values
make up
```

Open **http://localhost** in your browser.

### Makefile Commands
| Command | Description |
|---|---|
| `make up` | Build and start all services |
| `make down` | Stop all services |
| `make logs` | Follow all service logs |
| `make reset` | Full reset (delete volumes + rebuild) |

### Service URLs
| Service | URL |
|---|---|
| Dashboard | http://localhost |
| API Gateway | http://localhost/api |
| API Docs | http://localhost/api/docs |
| Kafka | localhost:9092 |
| Redis | localhost:6379 |
| PostgreSQL | localhost:5432 |

## � Docker Architecture

Each service has its own optimized Dockerfile:

| Service | Base Image | Build Strategy |
|---|---|---|
| packet_service | ubuntu:22.04 | Multi-stage: compile → copy binary only |
| processing_service | python:3.11-slim | pip install → copy src |
| detection_service | python:3.11-slim | includes scikit-learn + saved models |
| api_gateway | python:3.11-slim | uvicorn with 2 workers |
| dashboard | node:20-alpine → nginx:alpine | Build React → serve static via nginx |

**nginx** handles:
- Serves React static files on port 80
- Proxies `/api/*` → api_gateway:8000
- WebSocket upgrade headers for `/ws/*` 

### Environment Variables
Copy `.env.example` to `.env` and configure:
```env
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
REDIS_URL=redis://redis:6379/0
POSTGRES_URL=postgresql+asyncpg://pp:pp_secret@postgres/packetpulse
ADMIN_SECRET=change_me_in_production
API_KEY=your_api_key_here
```

## �📁 Project Structure

```text
Packet_analyzer-main/
├── src/                    # C++ DPI Engine source
├── include/                # C++ headers
├── api/                    # FastAPI Gateway
│   ├── main.py            # App entrypoint + CORS + WebSocket
│   └── routes/            # flows, stats, alerts endpoints
├── dashboard/              # React + Vite frontend
│   └── src/
│       ├── context/       # DPIContext — WebSocket state
│       └── components/    # Charts, FlowTable, AlertsStream
├── packet_service/         # C++ Kafka producer service
├── services/
│   ├── processing_service/    # Flow tracker, 5-tuple aggregation
│   │   ├── main.py           # Kafka consumer loop
│   │   ├── flow_tracker.py   # FlowTracker class, 30s stale flush
│   │   ├── stats.py          # Top apps, bytes aggregation
│   │   └── cache.py          # RedisCache — store/get flows, TTL=300s
│   ├── detection_service/
│   │   ├── main.py           # Consumer loop — rules + ML pipeline
│   │   ├── rule_engine.py    # RuleEngine — IP/domain/port/rate blocking
│   │   ├── ml_engine.py      # AnomalyDetector — IsolationForest
│   │   └── models/           # Saved model: isolation_forest.pkl
│   ├── db/                       # Shared DB library
│   │   ├── models.py             # SQLAlchemy models: Flow, Alert, Stats
│   │   ├── session.py            # Async engine + get_session()
│   │   ├── crud.py               # upsert_flow, insert_alert, insert_stats, get_flows
│   │   └── migrations/           # Alembic migrations
├── docker-compose.yml      # Kafka + Zookeeper + Redis + Postgres
├── start.py               # Unified launcher
└── kafka_consumer_debug.py # Debug consumer for raw_packets
```

## 🗺️ Kafka Topics

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| raw_packets | packet_service (C++) | processing_service | Raw flow data |
| processed_packets | processing_service | detection_service, api_gateway | Aggregated flows |
| alerts | detection_service | api_gateway | Security alerts |
| flow_stats | processing_service | api_gateway | Aggregated stats every 10s |

## ⚡ Redis Architecture

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `flow:<flow_id>` | Hash | 300s | Active flow cache |
| `rl:<ip>` | Sorted Set | 60s | Rate limiting sliding window |
| `cache:stats` | String | 5s | Cached stats response |
| `rules:config` | String | — | Detection rules (persistent) |
| `ml:training_data` | List | — | Last 10k flows for ML training |

**Performance impact:**
- GET /flows: Redis-first lookup → ~2ms vs ~50ms DB query
- Rate limiting: O(log N) per request using sorted sets
- Stats endpoint: 5s TTL cache eliminates redundant aggregation

## 🗄️ Database Schema

Three core tables managed via Alembic migrations:

**flows**
| Column | Type | Description |
|---|---|---|
| id | Serial PK | Auto increment |
| flow_id | VARCHAR UNIQUE | SHA256 of 5-tuple |
| src_ip / dst_ip | VARCHAR | IP addresses |
| src_port / dst_port | INTEGER | Port numbers |
| protocol | VARCHAR | TCP / UDP / OTHER |
| app | VARCHAR | Detected application |
| sni | VARCHAR | TLS SNI hostname |
| bytes / packets | BIGINT | Traffic counters |
| first_seen / last_seen | TIMESTAMPTZ | Flow timestamps |
| duration_s | FLOAT | Flow duration |
| blocked | BOOLEAN | Blocked flag |

**alerts**
| Column | Type | Description |
|---|---|---|
| id | Serial PK | Auto increment |
| alert_id | VARCHAR UNIQUE | UUID4 |
| type | VARCHAR | Alert category |
| severity | VARCHAR | low/medium/high/critical |
| flow_id | VARCHAR | Related flow |
| src_ip / dst_ip | VARCHAR | IP addresses |
| reason | TEXT | Human readable reason |
| ts | TIMESTAMPTZ | Alert timestamp |

**stats**
| Column | Type | Description |
|---|---|---|
| id | Serial PK | Auto increment |
| ts | TIMESTAMPTZ | Snapshot timestamp |
| total_packets | BIGINT | Cumulative packets |
| total_bytes | BIGINT | Cumulative bytes |
| blocked_count | INTEGER | Total blocked flows |
| top_apps | JSONB | App → bytes mapping |

### Running Migrations
```bash
cd services/db
alembic upgrade head
```

## 🔐 API Security & Rate Limiting

### Authentication
All endpoints (except `/health`) require an API key via header:
```bash
curl http://localhost:8000/flows \
  -H "X-API-Key: your_api_key_here"
```

Managing API keys (requires ADMIN_SECRET env var):
```bash
# Add a new API key
curl -X POST http://localhost:8000/admin/keys \
  -H "X-Admin-Secret: your_admin_secret" \
  -d '{"key": "new_api_key_123"}'
```

### Rate Limiting
- **100 requests/minute** per IP (via slowapi)
- Exceeding limit returns `429 Too Many Requests`

### Pagination
All list endpoints support pagination:
```
GET /flows?page=1&limit=50&src_ip=1.2.3.4&app=YouTube&blocked=true
GET /alerts?page=1&limit=50&severity=high&type=anomaly
```

Response envelope:
```json
{
  "data": [...],
  "total": 1500,
  "page": 1,
  "limit": 50,
  "pages": 30
}
```

### Filtering Options
**Flows:** src_ip, dst_ip, app, protocol, blocked, start, end
**Alerts:** type, severity, start, end

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /health | ❌ | System health check |
| GET | /flows | ✅ | Paginated flows (DB + Redis) |
| GET | /flows/{flow_id} | ✅ | Single flow lookup |
| GET | /stats | ✅ | Aggregated stats (cached 5s) |
| GET | /stats/history | ✅ | 24h stats history |
| GET | /alerts | ✅ | Paginated alerts from DB |
| GET | /rules | ✅ | Current detection rules |
| POST | /rules | ✅ | Update detection rules |
| POST | /admin/keys | ✅ | Add API key (admin only) |
| WS | /ws/live | ✅ | Real-time WebSocket stream |

### WebSocket Events
```json
{ "type": "stats",        "data": { ... } }         // Every 2s
{ "type": "alert",        "data": { ... } }         // Immediate on alert
{ "type": "flows_update", "count": 42 }             // On flow flush
```

## 🔄 Flow Tracking

The Processing Service consumes `raw_packets` from Kafka and aggregates 
flows using 5-tuple keys (src_ip, dst_ip, src_port, dst_port, protocol).

**FlowRecord schema:**
```json
{
  "flow_id": "<sha256 of 5-tuple>",
  "src_ip": "1.2.3.4",
  "dst_ip": "5.6.7.8", 
  "src_port": 443,
  "dst_port": 52341,
  "protocol": "TCP",
  "app": "YouTube",
  "bytes": 1048576,
  "packets": 720,
  "first_seen": "2026-01-01T00:00:00Z",
  "last_seen": "2026-01-01T00:00:30Z",
  "duration_s": 30.0,
  "blocked": false
}
```
- Flows inactive for 30s are flushed to `processed_packets` topic
- Stats (top apps, unique IPs, blocked ratio) published every 10s to `flow_stats`

## 🛡️ Detection Engine

PacketPulse uses a two-layer detection pipeline on every processed flow:

### Layer 1 — Rule Engine
Fast, deterministic checks loaded from Redis (`rules:config`), refreshed every 60s:

| Rule Type | Example | Severity |
|---|---|---|
| Blocked IP | src_ip in blocklist | Critical |
| Blocked Domain | sni matches `*.malware.com` | High |
| Blocked Port | dst_port in [4444, 6667] | High |
| Rate Limit | >1000 packets/min from single IP | Medium |

### Layer 2 — ML Anomaly Detection
Unsupervised **IsolationForest** model trained on live traffic:

- **Features**: bytes, packets, duration_s, dst_port, protocol
- **Training data**: last 10,000 flows (stored in Redis)
- **Auto-retrains**: every 1 hour in background thread
- **Threshold**: anomaly score < -0.3 triggers alert
- **Cold start**: ML checks skipped until model is trained (no false positives)

### Alert Schema
```json
{
  "alert_id": "uuid4",
  "type": "blocked_ip | blocked_domain | rate_limit | anomaly",
  "severity": "low | medium | high | critical",
  "flow_id": "...",
  "src_ip": "1.2.3.4",
  "reason": "IP matched blocklist entry",
  "ts": "2026-01-01T00:00:00Z"
}
```

### Managing Rules
```bash
# Add blocked IP
curl -X POST http://localhost:8000/rules \
  -H "Content-Type: application/json" \
  -d '{"blocked_ips": ["1.2.3.4"], "blocked_domains": ["*.ads.com"]}'

# View current rules  
curl http://localhost:8000/rules
```

## 📊 Current System Status

- ✅ Phase 1: System Stabilized
- ✅ Phase 2: Kafka Event Backbone  
- ✅ Phase 3: Microservices Architecture
- ✅ Phase 4: Flow Tracking & Aggregation
- ✅ Phase 5: Redis Caching & Rate Limiting
- ✅ Phase 6: Intelligent Detection Engine (Rules + ML)
- ✅ Phase 7: PostgreSQL Persistent Storage
- ✅ Phase 8: Production-Grade API Gateway
- ✅ Phase 9: Fully Dockerized (One-Command Setup)
- ✅ Phase 10: Kubernetes Deployment (Production-Ready)


## 🛠️ Development

### Running Infrastructure
docker compose up -d zookeeper kafka

### Running Full System
python start.py

### Debug Kafka Messages
python kafka_consumer_debug.py

### API Documentation
http://localhost:8000/docs

## 📄 License
MIT
