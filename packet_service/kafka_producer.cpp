// ============================================================================
// kafka_producer.cpp — librdkafka RAII producer
//
// High-throughput configuration with async delivery reports.
// Thread-safe: rd_kafka_produce is internally serialized by librdkafka.
// ============================================================================

#include "kafka_producer.h"
#include "logger.h"

#include <cstring>

namespace PacketService {

// ---------------------------------------------------------------------------
// Delivery report callback — invoked per message by librdkafka's poller
// ---------------------------------------------------------------------------
void KafkaProducer::deliveryReportCallback(
    rd_kafka_t* /*rk*/,
    const rd_kafka_message_t* rkmessage,
    void* opaque)
{
    auto* self = static_cast<KafkaProducer*>(opaque);
    if (rkmessage->err) {
        LOG_ERROR("Kafka delivery failed: %s", rd_kafka_err2str(rkmessage->err));
        self->messages_failed_.fetch_add(1, std::memory_order_relaxed);
    } else {
        self->messages_sent_.fetch_add(1, std::memory_order_relaxed);
    }
}

// ---------------------------------------------------------------------------
// Constructor / Destructor
// ---------------------------------------------------------------------------

KafkaProducer::KafkaProducer() = default;

KafkaProducer::~KafkaProducer() {
    if (producer_) {
        // Wait for outstanding messages
        LOG_INFO("Flushing Kafka producer...");
        rd_kafka_flush(producer_, 10000);

        if (topic_) {
            rd_kafka_topic_destroy(topic_);
            topic_ = nullptr;
        }

        rd_kafka_destroy(producer_);
        producer_ = nullptr;
        LOG_INFO("Kafka producer destroyed");
    }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

bool KafkaProducer::init(const KafkaConfig& config) {
    char errstr[512];

    // --- Global configuration -----------------------------------------------
    rd_kafka_conf_t* conf = rd_kafka_conf_new();
    if (!conf) {
        LOG_ERROR("Failed to create Kafka configuration");
        return false;
    }

    // Broker list
    if (rd_kafka_conf_set(conf, "bootstrap.servers", config.brokers.c_str(),
                          errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        LOG_ERROR("Kafka config error (bootstrap.servers): %s", errstr);
        rd_kafka_conf_destroy(conf);
        return false;
    }

    // Batching for throughput
    auto setConf = [&](const char* key, const std::string& value) -> bool {
        if (rd_kafka_conf_set(conf, key, value.c_str(),
                              errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
            LOG_ERROR("Kafka config error (%s): %s", key, errstr);
            return false;
        }
        return true;
    };

    if (!setConf("batch.num.messages", std::to_string(config.batch_size))) {
        rd_kafka_conf_destroy(conf);
        return false;
    }
    if (!setConf("linger.ms", std::to_string(config.linger_ms))) {
        rd_kafka_conf_destroy(conf);
        return false;
    }
    if (!setConf("compression.type", config.compression)) {
        rd_kafka_conf_destroy(conf);
        return false;
    }
    if (!setConf("queue.buffering.max.messages",
                 std::to_string(config.queue_buffering_max_msgs))) {
        rd_kafka_conf_destroy(conf);
        return false;
    }
    if (!setConf("queue.buffering.max.kbytes",
                 std::to_string(config.queue_buffering_max_kb))) {
        rd_kafka_conf_destroy(conf);
        return false;
    }
    if (!setConf("message.max.bytes",
                 std::to_string(config.message_max_bytes))) {
        rd_kafka_conf_destroy(conf);
        return false;
    }

    // Delivery report callback
    rd_kafka_conf_set_dr_msg_cb(conf, deliveryReportCallback);
    rd_kafka_conf_set_opaque(conf, this);

    // --- Create producer ----------------------------------------------------
    producer_ = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!producer_) {
        LOG_ERROR("Failed to create Kafka producer: %s", errstr);
        // conf is destroyed by rd_kafka_new on failure
        return false;
    }
    // conf is now owned by producer_

    // --- Create topic -------------------------------------------------------
    rd_kafka_topic_conf_t* topic_conf = rd_kafka_topic_conf_new();
    topic_ = rd_kafka_topic_new(producer_, config.topic.c_str(), topic_conf);
    if (!topic_) {
        LOG_ERROR("Failed to create Kafka topic '%s': %s",
                  config.topic.c_str(),
                  rd_kafka_err2str(rd_kafka_last_error()));
        return false;
    }
    // topic_conf is now owned by topic_

    LOG_INFO("Kafka producer initialized — brokers=%s topic=%s compression=%s",
             config.brokers.c_str(), config.topic.c_str(), config.compression.c_str());
    return true;
}

// ---------------------------------------------------------------------------
// Produce
// ---------------------------------------------------------------------------

bool KafkaProducer::produce(std::string_view payload) {
    if (!producer_ || !topic_) {
        LOG_ERROR("Kafka producer not initialized");
        return false;
    }

    int result = rd_kafka_produce(
        topic_,
        RD_KAFKA_PARTITION_UA,          // Automatic partitioning
        RD_KAFKA_MSG_F_COPY,            // Copy payload into librdkafka buffer
        const_cast<char*>(payload.data()),
        payload.size(),
        nullptr, 0,                      // No key
        nullptr                          // No per-message opaque
    );

    if (result == -1) {
        rd_kafka_resp_err_t err = rd_kafka_last_error();
        if (err == RD_KAFKA_RESP_ERR__QUEUE_FULL) {
            // Back-pressure: poll to make room, then retry once
            rd_kafka_poll(producer_, 100);
            result = rd_kafka_produce(
                topic_,
                RD_KAFKA_PARTITION_UA,
                RD_KAFKA_MSG_F_COPY,
                const_cast<char*>(payload.data()),
                payload.size(),
                nullptr, 0,
                nullptr
            );
        }
        if (result == -1) {
            LOG_ERROR("Kafka produce failed: %s",
                      rd_kafka_err2str(rd_kafka_last_error()));
            messages_failed_.fetch_add(1, std::memory_order_relaxed);
            return false;
        }
    }

    // Serve delivery reports (non-blocking)
    rd_kafka_poll(producer_, 0);
    return true;
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

void KafkaProducer::flush(int timeout_ms) {
    if (producer_) {
        rd_kafka_flush(producer_, timeout_ms);
    }
}

} // namespace PacketService
