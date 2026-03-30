#ifndef PACKET_SERVICE_PACKET_TYPES_H
#define PACKET_SERVICE_PACKET_TYPES_H

// ============================================================================
// Core packet data structures and JSON serialization
// Zero-allocation hot path via snprintf into pre-sized buffer
// ============================================================================

#include <cstdint>
#include <cstdio>
#include <string>
#include <cstring>
#include <arpa/inet.h>

namespace PacketService {

// Protocol constants
namespace Proto {
    constexpr uint8_t ICMP = 1;
    constexpr uint8_t TCP  = 6;
    constexpr uint8_t UDP  = 17;
}

// Ethernet header (14 bytes)
struct EthernetHeader {
    uint8_t  dest_mac[6];
    uint8_t  src_mac[6];
    uint16_t ether_type;      // Network byte order
} __attribute__((packed));

// IPv4 header (20 bytes minimum)
struct IPv4Header {
    uint8_t  version_ihl;     // Version (4 bits) + IHL (4 bits)
    uint8_t  tos;
    uint16_t total_length;
    uint16_t identification;
    uint16_t flags_fragment;
    uint8_t  ttl;
    uint8_t  protocol;
    uint16_t checksum;
    uint32_t src_ip;
    uint32_t dest_ip;
} __attribute__((packed));

// TCP header (20 bytes minimum)
struct TCPHeader {
    uint16_t src_port;
    uint16_t dest_port;
    uint32_t seq_number;
    uint32_t ack_number;
    uint8_t  data_offset;     // Upper 4 bits = offset in 32-bit words
    uint8_t  flags;
    uint16_t window;
    uint16_t checksum;
    uint16_t urgent_pointer;
} __attribute__((packed));

// UDP header (8 bytes, fixed)
struct UDPHeader {
    uint16_t src_port;
    uint16_t dest_port;
    uint16_t length;
    uint16_t checksum;
} __attribute__((packed));

// ============================================================================
// Parsed packet — the fields we extract and serialize
// ============================================================================
struct CapturedPacket {
    char     timestamp[32];     // ISO-8601 with microseconds
    char     src_ip[INET_ADDRSTRLEN];
    char     dst_ip[INET_ADDRSTRLEN];
    uint16_t src_port;
    uint16_t dst_port;
    char     protocol[8];       // "TCP", "UDP", "ICMP", "OTHER"
    uint32_t packet_size;

    // ----------------------------------------------------------------
    // Serialize to JSON — writes directly into caller-supplied buffer.
    // Returns number of bytes written (excluding NUL).
    // Buffer should be at least 512 bytes.
    // ----------------------------------------------------------------
    int toJson(char* buf, size_t buf_size) const {
        return snprintf(buf, buf_size,
            "{\"timestamp\":\"%s\","
            "\"src_ip\":\"%s\","
            "\"dst_ip\":\"%s\","
            "\"src_port\":%u,"
            "\"dst_port\":%u,"
            "\"protocol\":\"%s\","
            "\"packet_size\":%u}",
            timestamp,
            src_ip,
            dst_ip,
            static_cast<unsigned>(src_port),
            static_cast<unsigned>(dst_port),
            protocol,
            static_cast<unsigned>(packet_size));
    }

    // Convenience: return as std::string (allocates)
    std::string toJsonString() const {
        char buf[512];
        int len = toJson(buf, sizeof(buf));
        if (len < 0 || static_cast<size_t>(len) >= sizeof(buf)) {
            return "{}";
        }
        return std::string(buf, static_cast<size_t>(len));
    }
};

// ============================================================================
// Queue item — carries JSON payload ready for Kafka production
// ============================================================================
struct QueueItem {
    std::string json_payload;
};

} // namespace PacketService

#endif // PACKET_SERVICE_PACKET_TYPES_H
