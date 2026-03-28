#ifndef PACKET_SERVICE_PARSER_H
#define PACKET_SERVICE_PARSER_H

// ============================================================================
// PacketParser — zero-copy header extraction from raw libpcap buffers
// ============================================================================

#include <optional>
#include <pcap/pcap.h>
#include "packet_types.h"

namespace PacketService {

class PacketParser {
public:
    // Parse a raw packet captured by libpcap.
    // Returns std::nullopt for non-IPv4 or malformed packets.
    static std::optional<CapturedPacket> parse(
        const struct pcap_pkthdr* header,
        const uint8_t* data);

private:
    // Convert IP protocol number to human-readable string
    static const char* protocolToString(uint8_t protocol);

    // Format pcap timestamp as ISO-8601 with microseconds
    static void formatTimestamp(
        uint32_t ts_sec, uint32_t ts_usec,
        char* buf, size_t buf_size);
};

} // namespace PacketService

#endif // PACKET_SERVICE_PARSER_H
