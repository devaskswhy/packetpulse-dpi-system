#ifndef PACKET_SERVICE_KAFKA_PRODUCER_H
#define PACKET_SERVICE_KAFKA_PRODUCER_H

// ============================================================================
// KafkaProducer — RAII wrapper around librdkafka
//
// Tuned for high-throughput, low-latency packet streaming:
//   - Asynchronous delivery with delivery-report callback
//   - Configurable batching, compression, and queue limits
//   - Thread-safe: multiple threads can call produce() concurrently
// ============================================================================

#include <string>
#include <string_view>
#include <atomic>
#include <librdkafka/rdkafka.h>

namespace PacketService {

struct KafkaConfig {
    std::string brokers        = "localhost:9092";
    std::string topic          = "raw_packets";
    int         batch_size     = 10000;        // messages per batch
    int         linger_ms      = 5;            // max wait before sending batch
    std::string compression    = "lz4";        // none | gzip | snappy | lz4 | zstd
    int         queue_buffering_max_msgs = 500000;
    int         queue_buffering_max_kb   = 1048576;  // 1 GB
    int         message_max_bytes        = 1048576;  // 1 MB
};

class KafkaProducer {
public:
    KafkaProducer();
    ~KafkaProducer();

    // Non-copyable, non-movable
    KafkaProducer(const KafkaProducer&) = delete;
    KafkaProducer& operator=(const KafkaProducer&) = delete;

    // Initialize the producer with the given configuration.
    // Returns true on success.
    bool init(const KafkaConfig& config);

    // Produce a JSON message to the configured topic.
    // Thread-safe. Returns true if the message was enqueued.
    bool produce(std::string_view payload);

    // Flush outstanding messages (blocks up to timeout_ms).
    void flush(int timeout_ms = 10000);

    // Statistics
    uint64_t messagesSent()   const { return messages_sent_.load(std::memory_order_relaxed); }
    uint64_t messagesFailed() const { return messages_failed_.load(std::memory_order_relaxed); }

private:
    rd_kafka_t*       producer_ = nullptr;
    rd_kafka_topic_t* topic_    = nullptr;

    std::atomic<uint64_t> messages_sent_{0};
    std::atomic<uint64_t> messages_failed_{0};

    // librdkafka delivery report callback (static, invoked per message)
    static void deliveryReportCallback(
        rd_kafka_t* rk,
        const rd_kafka_message_t* rkmessage,
        void* opaque);
};

} // namespace PacketService

#endif // PACKET_SERVICE_KAFKA_PRODUCER_H
