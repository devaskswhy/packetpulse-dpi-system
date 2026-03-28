#ifndef JSON_EXPORTER_H
#define JSON_EXPORTER_H

#include "types.h"
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>
#include <chrono>
#include <cstdio>

namespace DPI {

inline std::string ipToString(uint32_t ip) {
    std::ostringstream s;
    s << ((ip >>  0) & 0xFF) << "."
      << ((ip >>  8) & 0xFF) << "."
      << ((ip >> 16) & 0xFF) << "."
      << ((ip >> 24) & 0xFF);
    return s.str();
}

inline std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;
        }
    }
    return out;
}

struct FlowExport {
    std::string timestamp;
    uint32_t src_ip;
    uint32_t dst_ip;
    uint16_t src_port;
    uint16_t dst_port;
    uint8_t  protocol;
    AppType  app_type;
    std::string sni;
    uint64_t bytes;
    bool     blocked;
    std::string flow_id;
};

struct AlertExport {
    std::string type;
    std::string ip;
    std::string reason;
    std::string ts;
};

struct StatsExport {
    uint64_t total_packets;
    uint64_t total_bytes;
    uint64_t blocked_count;
    std::unordered_map<std::string, uint64_t> top_apps;
};

inline bool exportToJSON(
    const std::string& output_path,
    const StatsExport& stats,
    const std::vector<FlowExport>& flows,
    const std::vector<AlertExport>& alerts
) {
    std::string temp_path = output_path + ".tmp";
    std::ofstream out(temp_path);
    if (!out.is_open()) return false;

    std::ostringstream json;
    
    json << "{\n";

    // ---- stats ----
    json << "  \"stats\": {\n"
         << "    \"total_packets\": " << stats.total_packets << ",\n"
         << "    \"total_bytes\": "   << stats.total_bytes << ",\n"
         << "    \"blocked_count\": " << stats.blocked_count << ",\n"
         << "    \"top_apps\": {";
         
    bool first_app = true;
    for (const auto& kv : stats.top_apps) {
        if (!first_app) json << ",";
        json << " \"" << jsonEscape(kv.first) << "\": " << kv.second;
        first_app = false;
    }
    json << " }\n  },\n";

    // ---- flows ----
    json << "  \"flows\": [\n";
    for (size_t i = 0; i < flows.size(); ++i) {
        const auto& f = flows[i];
        std::string proto = (f.protocol == 6) ? "TCP" : (f.protocol == 17) ? "UDP" : "OTHER";
        json << "    {\n"
             << "      \"timestamp\": \"" << jsonEscape(f.timestamp) << "\",\n"
             << "      \"src_ip\": \""    << ipToString(f.src_ip)   << "\",\n"
             << "      \"dst_ip\": \""    << ipToString(f.dst_ip)   << "\",\n"
             << "      \"src_port\": "    << f.src_port             << ",\n"
             << "      \"dst_port\": "    << f.dst_port             << ",\n"
             << "      \"protocol\": \""  << proto                  << "\",\n"
             << "      \"app\": \""       << jsonEscape(appTypeToString(f.app_type)) << "\",\n"
             << "      \"sni\": "         << (f.sni.empty() ? "null" : "\"" + jsonEscape(f.sni) + "\"") << ",\n"
             << "      \"bytes\": "       << f.bytes                << ",\n"
             << "      \"blocked\": "     << (f.blocked ? "true" : "false") << ",\n"
             << "      \"flow_id\": \""   << jsonEscape(f.flow_id)  << "\"\n"
             << "    }" << (i + 1 < flows.size() ? "," : "") << "\n";
    }
    json << "  ],\n";

    // ---- alerts ----
    json << "  \"alerts\": [\n";
    for (size_t i = 0; i < alerts.size(); ++i) {
        const auto& a = alerts[i];
        json << "    {\n"
             << "      \"type\": \""   << jsonEscape(a.type)   << "\",\n"
             << "      \"ip\": \""     << jsonEscape(a.ip)     << "\",\n"
             << "      \"reason\": \"" << jsonEscape(a.reason) << "\",\n"
             << "      \"ts\": \""     << jsonEscape(a.ts)     << "\"\n"
             << "    }" << (i + 1 < alerts.size() ? "," : "") << "\n";
    }
    json << "  ]\n";

    json << "}\n";

    out << json.str();
    out.close();

    // Atomic rename
    std::remove(output_path.c_str());
    std::rename(temp_path.c_str(), output_path.c_str());

    return true;
}

} // namespace DPI

#endif // JSON_EXPORTER_H
