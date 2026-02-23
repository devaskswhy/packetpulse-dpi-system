## Deep Packet Inspection Engine

High‑performance deep packet inspection (DPI) engine for offline PCAP analysis.  
It parses Ethernet/IP/TCP/UDP traffic, extracts TLS SNI / HTTP hostnames, classifies
flows by application, and applies flexible blocking rules to produce a filtered PCAP.

---

### Features

- **Offline PCAP processing**: Read standard `.pcap` captures from Wireshark, tcpdump, etc.
- **Protocol parsing**: Ethernet, IPv4, TCP, UDP parsing with timestamp and payload extraction.
- **Deep inspection**:
  - TLS SNI extraction from ClientHello
  - HTTP `Host` header extraction for plaintext HTTP
  - Basic DNS query domain extraction
- **Flow tracking**:
  - Five‑tuple based connection tracking
  - Per‑flow classification and statistics
- **Rule‑based blocking**:
  - Block by source IP, destination port, application, or domain (with wildcards)
  - Flow‑level blocking: once a flow is marked blocked, all subsequent packets are dropped
- **Multi‑threaded engine**:
  - Reader → Load Balancers → Fast Path workers → Output writer
  - Consistent hashing ensures all packets of a flow hit the same worker
- **Multiple CLIs**:
  - Packet summary viewer
  - SNI inspector
  - Single‑threaded DPI engine
  - Multi‑threaded DPI engine

---

### Repository Structure

```text
.
├── CMakeLists.txt
├── include/
│   ├── dpi_engine.h          # Multi-threaded DPI orchestration
│   ├── fast_path.h           # Fast Path worker threads
│   ├── load_balancer.h       # Load balancer threads
│   ├── connection_tracker.h  # Per-flow tracking and global stats
│   ├── rule_manager.h        # Blocking rule management
│   ├── types.h               # Core DPI types and enums
│   ├── pcap_reader.h         # PCAP file reader
│   ├── packet_parser.h       # Protocol parsing (Ethernet/IP/TCP/UDP)
│   ├── sni_extractor.h       # TLS/HTTP/DNS inspectors
│   ├── thread_safe_queue.h   # Generic thread-safe queue
│   └── platform.h            # Platform helpers
├── src/
│   ├── cli/
│   │   ├── packet_summary_main.cpp     # Human-friendly packet summary CLI
│   │   ├── sni_inspector_main.cpp      # Simple SNI logger CLI
│   │   ├── dpi_single_thread_main.cpp  # Single-threaded DPI engine CLI
│   │   └── dpi_engine_main.cpp         # Multi-threaded DPI engine CLI
│   ├── dpi_engine.cpp        # DPIEngine implementation (multi-threaded)
│   ├── fast_path.cpp         # Fast Path workers (classification + blocking)
│   ├── load_balancer.cpp     # Load balancers (distribute flows to workers)
│   ├── connection_tracker.cpp# Per-FP and global connection tracking
│   ├── rule_manager.cpp      # Rule evaluation and persistence
│   ├── pcap_reader.cpp       # PCAP reader implementation
│   ├── packet_parser.cpp     # Protocol parsing implementation
│   ├── sni_extractor.cpp     # TLS SNI / HTTP Host / DNS extraction
│   ├── types.cpp             # String helpers and SNI→AppType mapping
│   └── dpi_mt.cpp            # Alternative multi-threaded DPI prototype
├── generate_test_pcap.py     # Script to generate sample PCAPs
├── WINDOWS_SETUP.md          # Windows-specific build instructions
└── test_dpi.pcap             # Example capture (if present)
```

---

### Architecture Overview

At a high level, the engine turns an input PCAP into a filtered output PCAP:

```text
Input PCAP ──► Parser & Classifier ──► Policy Engine ──► Output PCAP
                            │
                            └── Statistics & Reports
```

- **Core model (`types.*`)**
  - `FiveTuple` identifies a flow (src/dst IP, ports, protocol).
  - `Connection` tracks per-flow state, SNI/hostname, and counters.
  - `AppType` encodes application categories (YouTube, Facebook, DNS, …).

- **Capture & parsing**
  - `PcapReader` streams packets from disk and exposes timestamps + raw bytes.
  - `PacketParser` decodes Ethernet/IP/TCP/UDP and exposes a `ParsedPacket` view.

- **Inspection services**
  - `SNIExtractor` extracts TLS SNI from ClientHello.
  - `HTTPHostExtractor` extracts the HTTP `Host` header.
  - `DNSExtractor` reads queried domains from DNS requests.

- **Flow tracking & rules**
  - `ConnectionTracker` owns a per-worker hash map of active connections and
    handles classification (`classifyConnection`) and blocking state.
  - `RuleManager` centralizes all blocklists:
    - Source IPs
    - Ports
    - Applications (`AppType`)
    - Domains (exact and wildcard patterns like `*.example.com`)

- **Multi-threaded engine (`DPIEngine`)**

```text
PCAP Reader
    │
    ├─ hash(five-tuple) → Load Balancer 0
    └─ hash(five-tuple) → Load Balancer 1 ...
             │
             ├─ hash(five-tuple) → Fast Path 0
             └─ hash(five-tuple) → Fast Path 1 ...
                                      │
                                      └─ Output Queue → Output Writer
```

- **Load balancers** distribute incoming `PacketJob` instances to Fast Path
  workers using consistent hashing on the five-tuple.
- **Fast Path workers**:
  - own a `ConnectionTracker`
  - inspect payloads (TLS/HTTP/DNS)
  - classify flows and consult `RuleManager`
  - push allowed packets into the shared output queue
- **Output writer** drains the output queue and writes a valid PCAP with
  the original global header and per-packet headers.

---

### Provided CLIs

- **`packet_summary_cli`**
  - Single-file summary tool for exploring a PCAP.
  - Displays per-packet Ethernet / IP / TCP / UDP headers and a small payload preview.

- **`sni_inspector_cli`**
  - Scans a capture and prints any TLS SNI found in HTTPS ClientHello packets.

- **`dpi_single_thread_cli`**
  - Straightforward, single-threaded DPI engine.
  - Good for understanding end-to-end logic before looking at the threaded version.

- **`dpi_engine_cli`**
  - Production-style multi-threaded DPI based on `DPIEngine`.
  - Supports the full rule set, per-app statistics, and connection-level reporting.

---

### Building

#### Requirements

- A C++17 compiler:
  - **Linux / WSL**: `g++` or `clang++`
  - **macOS**: Xcode command line tools or Homebrew `gcc`/`llvm`
  - **Windows**: MSVC (Visual Studio) or MinGW‑w64
- **CMake 3.16+**

#### Configure & build (recommended)

```bash
cmake -S . -B build
cmake --build build --config Release
```

Executables will be placed under `build/` (or `build/Release` on some generators).

---

### Running the tools

Assuming you built with the commands above and are in the project root:

#### Packet summary

```bash
./build/packet_summary_cli input.pcap
./build/packet_summary_cli input.pcap 10    # limit to first 10 packets
```

#### SNI inspector

```bash
./build/sni_inspector_cli input.pcap
```

#### Single-threaded DPI engine

```bash
./build/dpi_single_thread_cli input.pcap filtered.pcap \
  --block-app YouTube \
  --block-ip 192.168.1.50 \
  --block-domain facebook
```

#### Multi-threaded DPI engine

```bash
./build/dpi_engine_cli input.pcap filtered.pcap \
  --block-app YouTube \
  --block-domain *.tiktok.com \
  --block-ip 192.168.1.50 \
  --lbs 4 --fps 4
```

- `--lbs` controls the number of load balancer threads.
- `--fps` controls the number of Fast Path workers per load balancer.

---

### Windows notes

On Windows, you can:

- Use **Visual Studio** to open the folder as a CMake project and build the
  `packet_summary_cli`, `sni_inspector_cli`, `dpi_single_thread_cli`, and
  `dpi_engine_cli` targets.
- Or follow `WINDOWS_SETUP.md` for detailed MSVC / MinGW / WSL instructions.

When running from PowerShell or `cmd`, remember:

```powershell
build\Release\dpi_engine_cli.exe input.pcap output.pcap --block-app YouTube
```

---

### Extending the engine

- **Add more application signatures**:
  - Extend `sniToAppType` in `types.cpp` with additional SNI / hostname patterns.
- **Custom rule sets**:
  - Use `RuleManager::saveRules` / `loadRules` via the DPI engine APIs.
  - Persist IP / app / domain / port rules across runs.
- **Additional protocols**:
  - Extend `PacketParser` and `SNIExtractor` to recognize new protocols or
    QUIC/HTTP3 variants.

---

### License & contribution

This project is intended as a reference DPI implementation and a learning tool
for multi-threaded packet processing. You can experiment with new heuristics,
applications, and statistics by building on the existing engine and CLIs.

