// ============================================================================
// parser.cpp — Zero-copy packet header extraction
//
// Parses Ethernet → IPv4 → TCP/UDP headers from raw libpcap buffers.
// Returns std::nullopt for non-IPv4 or malformed packets.
// ============================================================================

#include "parser.h"
#include "logger.h"

#include <cstring>
#include <ctime>
#include <arpa/inet.h>

namespace PacketService {

// Minimum sizes
static constexpr size_t ETH_HLEN    = 14;
static constexpr uint16_t ETH_IPV4  = 0x0800;
static constexpr size_t IPV4_MIN    = 20;
static constexpr size_t TCP_MIN     = 20;
static constexpr size_t UDP_MIN     = 8;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

std::optional<CapturedPacket> PacketParser::parse(
    const struct pcap_pkthdr* header,
    const uint8_t* data)
{
    if (!header || !data) return std::nullopt;

    const size_t caplen = header->caplen;

    // --- Ethernet -----------------------------------------------------------
    if (caplen < ETH_HLEN) {
        LOG_DEBUG("Packet too short for Ethernet header: %zu bytes", caplen);
        return std::nullopt;
    }

    const auto* eth = reinterpret_cast<const EthernetHeader*>(data);
    uint16_t ether_type = ntohs(eth->ether_type);

    // Only process IPv4
    if (ether_type != ETH_IPV4) {
        return std::nullopt;
    }

    // --- IPv4 ---------------------------------------------------------------
    size_t offset = ETH_HLEN;
    if (caplen < offset + IPV4_MIN) {
        LOG_DEBUG("Packet too short for IPv4 header");
        return std::nullopt;
    }

    const auto* ip = reinterpret_cast<const IPv4Header*>(data + offset);
    uint8_t ip_version = (ip->version_ihl >> 4) & 0x0F;
    if (ip_version != 4) {
        LOG_DEBUG("Not IPv4 (version=%u)", ip_version);
        return std::nullopt;
    }

    uint8_t ihl = (ip->version_ihl & 0x0F) * 4;  // Header length in bytes
    if (ihl < IPV4_MIN || caplen < offset + ihl) {
        LOG_DEBUG("Invalid IPv4 IHL: %u", ihl);
        return std::nullopt;
    }

    // Build result
    CapturedPacket pkt{};
    pkt.packet_size = header->len;  // Original packet size on the wire

    // Format timestamp
    formatTimestamp(
        static_cast<uint32_t>(header->ts.tv_sec),
        static_cast<uint32_t>(header->ts.tv_usec),
        pkt.timestamp, sizeof(pkt.timestamp));

    // IP addresses — convert to dotted-decimal
    inet_ntop(AF_INET, &ip->src_ip,  pkt.src_ip, sizeof(pkt.src_ip));
    inet_ntop(AF_INET, &ip->dest_ip, pkt.dst_ip, sizeof(pkt.dst_ip));

    uint8_t protocol = ip->protocol;
    strncpy(pkt.protocol, protocolToString(protocol), sizeof(pkt.protocol) - 1);
    pkt.protocol[sizeof(pkt.protocol) - 1] = '\0';

    // --- Transport layer ----------------------------------------------------
    offset += ihl;

    if (protocol == Proto::TCP) {
        if (caplen < offset + TCP_MIN) {
            // Truncated TCP — still return packet with port 0
            pkt.src_port = 0;
            pkt.dst_port = 0;
            return pkt;
        }
        const auto* tcp = reinterpret_cast<const TCPHeader*>(data + offset);
        pkt.src_port = ntohs(tcp->src_port);
        pkt.dst_port = ntohs(tcp->dest_port);
    }
    else if (protocol == Proto::UDP) {
        if (caplen < offset + UDP_MIN) {
            pkt.src_port = 0;
            pkt.dst_port = 0;
            return pkt;
        }
        const auto* udp = reinterpret_cast<const UDPHeader*>(data + offset);
        pkt.src_port = ntohs(udp->src_port);
        pkt.dst_port = ntohs(udp->dest_port);
    }
    else {
        // ICMP or other — no ports
        pkt.src_port = 0;
        pkt.dst_port = 0;
    }

    return pkt;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const char* PacketParser::protocolToString(uint8_t protocol) {
    switch (protocol) {
        case Proto::TCP:  return "TCP";
        case Proto::UDP:  return "UDP";
        case Proto::ICMP: return "ICMP";
        default:          return "OTHER";
    }
}

void PacketParser::formatTimestamp(
    uint32_t ts_sec, uint32_t ts_usec,
    char* buf, size_t buf_size)
{
    time_t t = static_cast<time_t>(ts_sec);
    struct tm tm_buf;

#ifdef _WIN32
    gmtime_s(&tm_buf, &t);
#else
    gmtime_r(&t, &tm_buf);
#endif

    // "2026-02-23T16:30:05.123456Z"
    char time_part[24];
    strftime(time_part, sizeof(time_part), "%Y-%m-%dT%H:%M:%S", &tm_buf);
    snprintf(buf, buf_size, "%s.%06uZ", time_part, ts_usec);
}

} // namespace PacketService
