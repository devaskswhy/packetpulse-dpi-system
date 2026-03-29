// Single-threaded DPI Engine CLI - reference implementation
//
// Kafka integration: after building each flow's JSON string, the flow is
// produced to "raw_packets" keyed by flow_id. If Kafka is unavailable the
// --json file export still works as a fallback.

#include <iostream>
#include <fstream>
#include <unordered_map>
#include <vector>
#include <iomanip>
#include <unordered_set>
#include <algorithm>
#include <chrono>
#include <sstream>
#include <cstdlib>

#include "pcap_reader.h"
#include "packet_parser.h"
#include "sni_extractor.h"
#include "types.h"
#include "json_exporter.h"

// Kafka support — conditionally compiled when ENABLE_KAFKA is defined.
// The CMakeLists.txt for the DPI engine sets this when librdkafka is found.
#ifdef ENABLE_KAFKA
#include "../packet_service/kafka_producer.h"
#endif

using namespace PacketAnalyzer;
using namespace DPI;

namespace {

inline std::string getCurrentISO8601() {
    auto now = std::chrono::system_clock::now();
    std::time_t time = std::chrono::system_clock::to_time_t(now);
    std::tm tm_buf;
#ifdef _WIN32
    gmtime_s(&tm_buf, &time);
#else
    gmtime_r(&time, &tm_buf);
#endif
    std::ostringstream ss;
    ss << std::put_time(&tm_buf, "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}

struct Flow {
    std::string timestamp;
    FiveTuple tuple;
    AppType app_type = AppType::UNKNOWN;
    std::string sni;
    uint64_t packets = 0;
    uint64_t bytes = 0;
    bool blocked = false;
};

class BlockingRules {
public:
    std::unordered_set<uint32_t> blocked_ips;
    std::unordered_set<AppType> blocked_apps;
    std::vector<std::string> blocked_domains;

    void blockIP(const std::string& ip) {
        uint32_t addr = parseIP(ip);
        blocked_ips.insert(addr);
        std::cout << "[Rules] Blocked IP: " << ip << "\n";
    }

    void blockApp(const std::string& app) {
        for (int i = 0; i < static_cast<int>(AppType::APP_COUNT); i++) {
            if (appTypeToString(static_cast<AppType>(i)) == app) {
                blocked_apps.insert(static_cast<AppType>(i));
                std::cout << "[Rules] Blocked app: " << app << "\n";
                return;
            }
        }
    }

    void blockDomain(const std::string& domain) {
        blocked_domains.push_back(domain);
        std::cout << "[Rules] Blocked domain: " << domain << "\n";
    }

    std::string isBlockedReason(uint32_t src_ip, AppType app, const std::string& sni) const {
        if (blocked_ips.count(src_ip)) return "Blocked by Source IP";
        if (blocked_apps.count(app)) return "Blocked by App Policy";
        for (const auto& dom : blocked_domains) {
            if (sni.find(dom) != std::string::npos) return "Blocked by Domain Match";
        }
        return "";
    }

    static uint32_t parseIP(const std::string& ip) {
        uint32_t result = 0;
        int octet = 0, shift = 0;
        for (char c : ip) {
            if (c == '.') {
                result |= (octet << shift);
                shift += 8;
                octet = 0;
            } else if (c >= '0' && c <= '9') {
                octet = octet * 10 + (c - '0');
            }
        }
        return result | (octet << shift);
    }
};

// Build a single-flow JSON string (used for both Kafka and file export)
std::string flowToJsonString(const Flow& flow, const FiveTuple& tuple,
                              const std::string& flow_id) {
    std::string proto = (tuple.protocol == 6) ? "TCP"
                      : (tuple.protocol == 17) ? "UDP" : "OTHER";

    std::ostringstream j;
    j << "{"
      << "\"timestamp\":\"" << jsonEscape(flow.timestamp) << "\","
      << "\"src_ip\":\"" << ipToString(tuple.src_ip) << "\","
      << "\"dst_ip\":\"" << ipToString(tuple.dst_ip) << "\","
      << "\"src_port\":" << tuple.src_port << ","
      << "\"dst_port\":" << tuple.dst_port << ","
      << "\"protocol\":\"" << proto << "\","
      << "\"app\":\"" << jsonEscape(appTypeToString(flow.app_type)) << "\","
      << "\"sni\":" << (flow.sni.empty() ? "null" : "\"" + jsonEscape(flow.sni) + "\"") << ","
      << "\"bytes\":" << flow.bytes << ","
      << "\"blocked\":" << (flow.blocked ? "true" : "false") << ","
      << "\"flow_id\":\"" << jsonEscape(flow_id) << "\""
      << "}";
    return j.str();
}

void printUsage(const char* prog) {
    std::cout << R"(
Single-threaded DPI Engine
==========================

Usage: )" << prog << R"( <input.pcap> <output.pcap> [options]

Options:
  --block-ip <ip>        Block traffic from source IP
  --block-app <app>      Block application (YouTube, Facebook, etc.)
  --block-domain <dom>   Block domain (substring match)
  --json <path>          Export results as JSON (default: output.json)
  --kafka <brokers>      Produce flow events to Kafka (default: localhost:9092)
  --no-kafka             Disable Kafka even if compiled with ENABLE_KAFKA

Example:
  )" << prog << R"( capture.pcap filtered.pcap --block-app YouTube --json output.json
  )" << prog << R"( capture.pcap filtered.pcap --kafka localhost:9092
)";
}

} // namespace

int main(int argc, char* argv[]) {
    if (argc < 3) {
        printUsage(argv[0]);
        return 1;
    }

    std::string input_file = argv[1];
    std::string output_file = argv[2];

    BlockingRules rules;
    std::string json_output_path = "output.json";   // default
    bool export_json = false;

    // Kafka settings
    std::string kafka_brokers = "localhost:9092";
    bool use_kafka = false;
    bool no_kafka  = false;

    // Parse options
    for (int i = 3; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--block-ip" && i + 1 < argc) {
            rules.blockIP(argv[++i]);
        } else if (arg == "--block-app" && i + 1 < argc) {
            rules.blockApp(argv[++i]);
        } else if (arg == "--block-domain" && i + 1 < argc) {
            rules.blockDomain(argv[++i]);
        } else if (arg == "--json") {
            export_json = true;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                json_output_path = argv[++i];
            }
        } else if (arg == "--kafka") {
            use_kafka = true;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                kafka_brokers = argv[++i];
            }
        } else if (arg == "--no-kafka") {
            no_kafka = true;
        }
    }

    std::cout << "\n";
    std::cout << "╔══════════════════════════════════════════════════════════════╗\n";
    std::cout << "║            Single-threaded DPI Engine (reference)            ║\n";
    std::cout << "╚══════════════════════════════════════════════════════════════╝\n\n";

    // ---- Kafka producer (optional) ----------------------------------------
#ifdef ENABLE_KAFKA
    std::unique_ptr<PacketService::KafkaProducer> kafka_producer;
    bool kafka_available = false;

    if (use_kafka && !no_kafka) {
        kafka_producer = std::make_unique<PacketService::KafkaProducer>();
        PacketService::KafkaConfig kcfg;
        kcfg.brokers = kafka_brokers;
        kcfg.topic   = "raw_packets";

        if (kafka_producer->init(kcfg)) {
            kafka_available = true;
            std::cout << "[Kafka] Producer connected to " << kafka_brokers << "\n";
        } else {
            std::cerr << "[Kafka] WARNING: Could not initialize producer — "
                      << "falling back to --json file output only\n";
            kafka_producer.reset();
        }
    }
#else
    bool kafka_available = false;
    if (use_kafka && !no_kafka) {
        std::cerr << "[Kafka] WARNING: Binary compiled without ENABLE_KAFKA — "
                  << "Kafka disabled. Rebuild with librdkafka to enable.\n";
    }
#endif

    PcapReader reader;
    if (!reader.open(input_file)) {
        return 1;
    }

    std::ofstream output(output_file, std::ios::binary);
    if (!output.is_open()) {
        std::cerr << "Error: Cannot open output file\n";
        return 1;
    }

    const auto& header = reader.getGlobalHeader();
    output.write(reinterpret_cast<const char*>(&header), sizeof(header));

    std::unordered_map<FiveTuple, Flow, FiveTupleHash> flows;
    std::vector<DPI::AlertExport> generated_alerts;

    uint64_t total_packets = 0;
    uint64_t total_bytes = 0;
    uint64_t forwarded = 0;
    uint64_t dropped = 0;
    std::unordered_map<AppType, uint64_t> app_stats;

    RawPacket raw;
    ParsedPacket parsed;

    auto start_time = std::chrono::steady_clock::now();
    std::string global_ts = getCurrentISO8601();

    while (reader.readNextPacket(raw)) {
        total_packets++;
        total_bytes += raw.data.size();

        if (!PacketParser::parse(raw, parsed)) {
            continue;
        }
        if (!parsed.has_ip || (!parsed.has_tcp && !parsed.has_udp)) continue;

        FiveTuple tuple;
        tuple.src_ip = BlockingRules::parseIP(parsed.src_ip);
        tuple.dst_ip = BlockingRules::parseIP(parsed.dest_ip);
        tuple.src_port = parsed.src_port;
        tuple.dst_port = parsed.dest_port;
        tuple.protocol = parsed.protocol;

        Flow& flow = flows[tuple];
        if (flow.packets == 0) {
            flow.tuple = tuple;
            flow.timestamp = global_ts;
        }
        flow.packets++;
        flow.bytes += raw.data.size();

        if ((flow.app_type == AppType::UNKNOWN || flow.app_type == AppType::HTTPS) &&
            flow.sni.empty() && parsed.has_tcp && parsed.dest_port == 443) {

            size_t payload_offset = 14;
            uint8_t ip_ihl = raw.data[14] & 0x0F;
            payload_offset += ip_ihl * 4;

            if (payload_offset + 12 < raw.data.size()) {
                uint8_t tcp_offset = (raw.data[payload_offset + 12] >> 4) & 0x0F;
                payload_offset += tcp_offset * 4;

                if (payload_offset < raw.data.size()) {
                    size_t payload_len = raw.data.size() - payload_offset;
                    if (payload_len > 5) {
                        auto sni = SNIExtractor::extract(raw.data.data() + payload_offset, payload_len);
                        if (sni) {
                            flow.sni = *sni;
                            flow.app_type = sniToAppType(*sni);
                        }
                    }
                }
            }
        }

        if ((flow.app_type == AppType::UNKNOWN || flow.app_type == AppType::HTTP) &&
            flow.sni.empty() && parsed.has_tcp && parsed.dest_port == 80) {

            size_t payload_offset = 14;
            uint8_t ip_ihl = raw.data[14] & 0x0F;
            payload_offset += ip_ihl * 4;

            if (payload_offset + 12 < raw.data.size()) {
                uint8_t tcp_offset = (raw.data[payload_offset + 12] >> 4) & 0x0F;
                payload_offset += tcp_offset * 4;

                if (payload_offset < raw.data.size()) {
                    size_t payload_len = raw.data.size() - payload_offset;
                    auto host = HTTPHostExtractor::extract(raw.data.data() + payload_offset, payload_len);
                    if (host) {
                        flow.sni = *host;
                        flow.app_type = sniToAppType(*host);
                    }
                }
            }
        }

        if (flow.app_type == AppType::UNKNOWN &&
            (parsed.dest_port == 53 || parsed.src_port == 53)) {
            flow.app_type = AppType::DNS;
        }

        if (flow.app_type == AppType::UNKNOWN) {
            if (parsed.dest_port == 443) flow.app_type = AppType::HTTPS;
            else if (parsed.dest_port == 80) flow.app_type = AppType::HTTP;
        }

        if (!flow.blocked) {
            std::string reason = rules.isBlockedReason(tuple.src_ip, flow.app_type, flow.sni);
            if (!reason.empty()) {
                flow.blocked = true;
                
                DPI::AlertExport alert;
                alert.type = "blocked";
                alert.ip = parsed.src_ip;
                alert.reason = reason + " (" + (flow.sni.empty() ? appTypeToString(flow.app_type) : flow.sni) + ")";
                alert.ts = global_ts;
                generated_alerts.push_back(alert);
            }
        }

        app_stats[flow.app_type]++;

        if (flow.blocked) {
            dropped++;
        } else {
            forwarded++;
            PcapPacketHeader pkt_hdr;
            pkt_hdr.ts_sec = raw.header.ts_sec;
            pkt_hdr.ts_usec = raw.header.ts_usec;
            pkt_hdr.incl_len = raw.data.size();
            pkt_hdr.orig_len = raw.data.size();
            output.write(reinterpret_cast<const char*>(&pkt_hdr), sizeof(pkt_hdr));
            output.write(reinterpret_cast<const char*>(raw.data.data()), raw.data.size());
        }
    }

    reader.close();
    output.close();

    // ---- Produce flows to Kafka -------------------------------------------
#ifdef ENABLE_KAFKA
    uint64_t kafka_sent = 0;
    uint64_t kafka_fail = 0;

    if (kafka_available && kafka_producer) {
        std::cout << "[Kafka] Publishing " << flows.size() << " flow records to raw_packets...\n";

        for (const auto& [tuple, flow] : flows) {
            // Compute flow_id (same logic as JSON export)
            size_t fid = FiveTupleHash{}(tuple);
            std::stringstream ss;
            ss << std::hex << std::setfill('0') << std::setw(16) << fid;
            std::string flow_id = ss.str();

            std::string json_str = flowToJsonString(flow, tuple, flow_id);

            if (kafka_producer->produce("raw_packets", flow_id, json_str)) {
                kafka_sent++;
            } else {
                kafka_fail++;
            }
        }

        kafka_producer->flush(10000);
        std::cout << "[Kafka] Published: sent=" << kafka_sent
                  << " failed=" << kafka_fail << "\n";
    }
#endif

    // ---- JSON file export (always available as fallback) -------------------
    if (export_json) {
        DPI::StatsExport stats_exp{};
        stats_exp.total_packets = total_packets;
        stats_exp.total_bytes   = total_bytes;
        stats_exp.blocked_count = dropped;

        std::vector<std::pair<AppType, uint64_t>> sorted_apps(app_stats.begin(), app_stats.end());
        std::sort(sorted_apps.begin(), sorted_apps.end(),
                  [](const auto& a, const auto& b) { return a.second > b.second; });
        
        for (size_t i = 0; i < std::min<size_t>(5, sorted_apps.size()); i++) {
            stats_exp.top_apps[appTypeToString(sorted_apps[i].first)] = sorted_apps[i].second;
        }

        std::vector<DPI::FlowExport> flow_exports;
        flow_exports.reserve(flows.size());
        for (const auto& [tuple, flow] : flows) {
            size_t fid = FiveTupleHash{}(tuple);
            std::stringstream ss;
            ss << std::hex << std::setfill('0') << std::setw(16) << fid;

            DPI::FlowExport fe{};
            fe.timestamp = flow.timestamp;
            fe.src_ip    = tuple.src_ip;
            fe.dst_ip    = tuple.dst_ip;
            fe.src_port  = tuple.src_port;
            fe.dst_port  = tuple.dst_port;
            fe.protocol  = tuple.protocol;
            fe.app_type  = flow.app_type;
            fe.sni       = flow.sni;
            fe.bytes     = flow.bytes;
            fe.blocked   = flow.blocked;
            fe.flow_id   = ss.str();
            flow_exports.push_back(fe);
        }

        if (DPI::exportToJSON(json_output_path, stats_exp, flow_exports, generated_alerts)) {
            std::cout << "[JSON] Exported exact schema atomically to: " << json_output_path << "\n";
        }
    }

    return 0;
}
