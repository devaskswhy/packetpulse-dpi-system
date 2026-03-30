// ============================================================================
// kafka_producer.cpp — librdkafka RAII producer
//
// High-throughput configuration with async delivery reports.
// Thread-safe: rd_kafka_produce is internally serialized by librdkafka.
//
// Two produce() overloads:
//   1) produce(topic, key, json_string) — keyed, arbitrary topic
//   2) produce(payload)                 — default topic, no key (legacy)
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
        fprintf(stderr, "[KafkaProducer] Delivery FAILED: %s (topic=%s, partition=%d)\n",
                rd_kafka_err2str(rkmessage->err),
                rd_kafka_topic_name(rkmessage->rkt),
                rkmessage->partition);
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

        // Destroy cached topic handles
        for (auto& [name, handle] : topic_cache_) {
            if (handle) {
                rd_kafka_topic_destroy(handle);
            }
        }
        topic_cache_.clear();

        if (default_topic_) {
            rd_kafka_topic_destroy(default_topic_);
            default_topic_ = nullptr;
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

    // --- Create default topic -----------------------------------------------
    rd_kafka_topic_conf_t* topic_conf = rd_kafka_topic_conf_new();
    default_topic_ = rd_kafka_topic_new(producer_, config.topic.c_str(), topic_conf);
    if (!default_topic_) {
        LOG_ERROR("Failed to create Kafka topic '%s': %s",
                  config.topic.c_str(),
                  rd_kafka_err2str(rd_kafka_last_error()));
        return false;
    }
    // topic_conf is now owned by default_topic_

    LOG_INFO("Kafka producer initialized — brokers=%s topic=%s compression=%s",
             config.brokers.c_str(), config.topic.c_str(), config.compression.c_str());
    return true;
}

// ---------------------------------------------------------------------------
// Topic handle cache (for the multi-topic overload)
// ---------------------------------------------------------------------------

rd_kafka_topic_t* KafkaProducer::getOrCreateTopic(const std::string& topic_name) {
    std::lock_guard<std::mutex> lock(topic_cache_mutex_);
    auto it = topic_cache_.find(topic_name);
    if (it != topic_cache_.end()) {
        return it->second;
    }

    rd_kafka_topic_conf_t* tc = rd_kafka_topic_conf_new();
    rd_kafka_topic_t* rkt = rd_kafka_topic_new(producer_, topic_name.c_str(), tc);
    if (!rkt) {
        LOG_ERROR("Failed to create topic handle '%s': %s",
                  topic_name.c_str(),
                  rd_kafka_err2str(rd_kafka_last_error()));
        return nullptr;
    }
    topic_cache_[topic_name] = rkt;
    return rkt;
}

// ---------------------------------------------------------------------------
// Produce — keyed message to arbitrary topic
// ---------------------------------------------------------------------------

bool KafkaProducer::produce(const std::string& topic,
                            const std::string& key,
                            const std::string& json_string) {
    if (!producer_) {
        LOG_ERROR("Kafka producer not initialized");
        return false;
    }

    rd_kafka_topic_t* rkt = getOrCreateTopic(topic);
    if (!rkt) {
        return false;
    }

    int result = rd_kafka_produce(
        rkt,
        RD_KAFKA_PARTITION_UA,          // Automatic partitioning (uses key hash)
        RD_KAFKA_MSG_F_COPY,            // Copy payload into librdkafka buffer
        const_cast<char*>(json_string.data()),
        json_string.size(),
        key.data(), key.size(),          // Message key for partition affinity
        nullptr                          // No per-message opaque
    );

    if (result == -1) {
        rd_kafka_resp_err_t err = rd_kafka_last_error();
        if (err == RD_KAFKA_RESP_ERR__QUEUE_FULL) {
            // Back-pressure: poll to make room, then retry once
            rd_kafka_poll(producer_, 100);
            result = rd_kafka_produce(
                rkt,
                RD_KAFKA_PARTITION_UA,
                RD_KAFKA_MSG_F_COPY,
                const_cast<char*>(json_string.data()),
                json_string.size(),
                key.data(), key.size(),
                nullptr
            );
        }
        if (result == -1) {
            fprintf(stderr, "[KafkaProducer] produce() failed for topic '%s': %s\n",
                    topic.c_str(), rd_kafka_err2str(rd_kafka_last_error()));
            messages_failed_.fetch_add(1, std::memory_order_relaxed);
            return false;
        }
    }

    // Serve delivery reports (non-blocking)
    rd_kafka_poll(producer_, 0);
    return true;
}

// ---------------------------------------------------------------------------
// Produce — legacy overload (default topic, no key)
// ---------------------------------------------------------------------------

bool KafkaProducer::produce(std::string_view payload) {
    if (!producer_ || !default_topic_) {
        LOG_ERROR("Kafka producer not initialized");
        return false;
    }

    int result = rd_kafka_produce(
        default_topic_,
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
                default_topic_,
                RD_KAFKA_PARTITION_UA,
                RD_KAFKA_MSG_F_COPY,
                const_cast<char*>(payload.data()),
                payload.size(),
                nullptr, 0,
                nullptr
            );
        }
        if (result == -1) {
            fprintf(stderr, "[KafkaProducer] produce() failed: %s\n",
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
