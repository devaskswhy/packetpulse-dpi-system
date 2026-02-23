// SNI Inspector CLI - simple TLS hostname logger
#include <iostream>
#include "pcap_reader.h"
#include "packet_parser.h"
#include "sni_extractor.h"
#include "types.h"

using namespace PacketAnalyzer;
using namespace DPI;

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <pcap_file>\n";
        return 1;
    }

    PcapReader reader;
    if (!reader.open(argv[1])) {
        return 1;
    }

    RawPacket raw;
    ParsedPacket parsed;
    int total_packets = 0;
    int sni_hits = 0;

    std::cout << "Scanning packets for TLS SNI...\n";

    while (reader.readNextPacket(raw)) {
        total_packets++;

        if (!PacketParser::parse(raw, parsed)) {
            continue;
        }

        if (!parsed.has_ip) continue;

        std::cout << "Packet " << total_packets << ": "
                  << parsed.src_ip << ":" << parsed.src_port
                  << " -> " << parsed.dest_ip << ":" << parsed.dest_port;

        // Try SNI extraction for HTTPS packets
        if (parsed.has_tcp && parsed.dest_port == 443 && parsed.payload_length > 0) {
            size_t payload_offset = 14;  // Ethernet
            uint8_t ip_ihl = raw.data[14] & 0x0F;
            payload_offset += ip_ihl * 4;
            uint8_t tcp_offset = (raw.data[payload_offset + 12] >> 4) & 0x0F;
            payload_offset += tcp_offset * 4;

            if (payload_offset < raw.data.size()) {
                size_t payload_len = raw.data.size() - payload_offset;
                auto sni = SNIExtractor::extract(raw.data.data() + payload_offset, payload_len);
                if (sni) {
                    std::cout << " [SNI: " << *sni << "]";
                    sni_hits++;
                }
            }
        }

        std::cout << "\n";
    }

    std::cout << "\nTotal packets: " << total_packets << "\n";
    std::cout << "SNI extracted: " << sni_hits << "\n";

    reader.close();
    return 0;
}

