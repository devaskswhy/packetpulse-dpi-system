# PacketPulse DPI System 🚀

A production-grade, event-driven Deep Packet Inspection platform built with C++, Python microservices, Apache Kafka, and a real-time React dashboard.

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

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /flows | Paginated flow list |
| GET | /stats | Aggregated statistics |
| GET | /alerts | Security alerts |
| GET | /health | System health check |
| WS | /ws/live | Real-time WebSocket stream |

## 📊 Current System Status

- ✅ Phase 1: System Stabilized
- ✅ Phase 2: Kafka Event Backbone  
- ✅ Phase 3: Microservices Architecture
- 🔄 Phase 4: Flow Tracking (In Progress)
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
