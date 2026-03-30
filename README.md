# PacketPulse DPI System 🚀

A production-grade, event-driven Deep Packet Inspection platform with 
real-time flow tracking, built with C++, Python microservices, Apache Kafka, 
and a live React dashboard.

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
| API Gateway | FastAPI + Uvicorn + WebSockets | REST API + real-time streaming |
| Frontend | React + Vite + Recharts | Live dashboard |
| Orchestration | Docker Compose | Local development |

## 🚀 Quick Start

### Prerequisites
- Windows 10/11 with WSL2 (Ubuntu 24.04)
- Docker Desktop with WSL2 integration enabled
- Node.js 20+, Python 3.11+, CMake 4+

### Setup
1. Clone repo
2. cd into project
3. docker compose up -d zookeeper kafka
4. docker compose up -d kafka-init (wait 10s)
5. python start.py
6. Open http://localhost:5174

## 📁 Project Structure

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
│   │   └── stats.py          # Top apps, bytes aggregation
├── docker-compose.yml      # Kafka + Zookeeper + infra
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

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /flows | Paginated flow list |
| GET | /stats | Aggregated statistics |
| GET | /alerts | Security alerts |
| GET | /health | System health check |
| WS | /ws/live | Real-time WebSocket stream |

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

## 📊 Current System Status

- ✅ Phase 1: System Stabilized
- ✅ Phase 2: Kafka Event Backbone  
- ✅ Phase 3: Microservices Architecture
- ✅ Phase 4: Flow Tracking & Aggregation
- ⏳ Phase 5: Redis Caching
- ⏳ Phase 6: ML Detection Engine
- ⏳ Phase 7: PostgreSQL Database
- ⏳ Phase 8: Production API
- ⏳ Phase 9: Real-time UI
- ⏳ Phase 10: Full Dockerization
- ⏳ Phase 11: Kubernetes

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
