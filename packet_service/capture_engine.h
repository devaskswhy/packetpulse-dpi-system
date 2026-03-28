#ifndef PACKET_SERVICE_CAPTURE_ENGINE_H
#define PACKET_SERVICE_CAPTURE_ENGINE_H

// ============================================================================
// CaptureEngine — multithreaded packet capture and Kafka production pipeline
//
//   [Capture Thread]  --> ThreadSafeQueue --> [N × Producer Threads]
//        (libpcap)           (bounded)            (librdkafka)
//
// Graceful shutdown via stop() or signal handler setting running_ = false.
// ============================================================================

#include <string>
#include <thread>
#include <vector>
#include <atomic>
#include <functional>
#include <pcap/pcap.h>

#include "packet_types.h"
#include "parser.h"
#include "kafka_producer.h"

namespace PacketService {

// ---------------------------------------------------------------------------
// Bounded, thread-safe queue (same pattern as existing DPI::ThreadSafeQueue)
// ---------------------------------------------------------------------------
#include <queue>
#include <mutex>
#include <condition_variable>
#include <optional>
#include <chrono>

template<typename T>
class BoundedQueue {
public:
    explicit BoundedQueue(size_t max_size = 100000) : max_size_(max_size) {}

    // Push — blocks if full
    void push(T item) {
        std::unique_lock<std::mutex> lock(mutex_);
        not_full_.wait(lock, [this] { return queue_.size() < max_size_ || shutdown_; });
        if (shutdown_) return;
        queue_.push(std::move(item));
        not_empty_.notify_one();
    }

    // Try push — returns false immediately if full or shutdown
    bool tryPush(T item) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (queue_.size() >= max_size_ || shutdown_) return false;
        queue_.push(std::move(item));
        not_empty_.notify_one();
        return true;
    }

    // Pop — blocks until item available or shutdown
    std::optional<T> pop() {
        std::unique_lock<std::mutex> lock(mutex_);
        not_empty_.wait(lock, [this] { return !queue_.empty() || shutdown_; });
        if (queue_.empty()) return std::nullopt;
        T item = std::move(queue_.front());
        queue_.pop();
        not_full_.notify_one();
        return item;
    }

    // Pop with timeout
    std::optional<T> popWithTimeout(std::chrono::milliseconds timeout) {
        std::unique_lock<std::mutex> lock(mutex_);
        if (!not_empty_.wait_for(lock, timeout,
                [this] { return !queue_.empty() || shutdown_; })) {
            return std::nullopt;
        }
        if (queue_.empty()) return std::nullopt;
        T item = std::move(queue_.front());
        queue_.pop();
        not_full_.notify_one();
        return item;
    }

    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.size();
    }

    void shutdown() {
        std::lock_guard<std::mutex> lock(mutex_);
        shutdown_ = true;
        not_empty_.notify_all();
        not_full_.notify_all();
    }

    bool isShutdown() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return shutdown_;
    }

private:
    std::queue<T> queue_;
    mutable std::mutex mutex_;
    std::condition_variable not_empty_;
    std::condition_variable not_full_;
    size_t max_size_;
    bool shutdown_ = false;
};

// ---------------------------------------------------------------------------
// CaptureEngine
// ---------------------------------------------------------------------------

struct EngineConfig {
    std::string interface       = "eth0";
    int         snaplen         = 65535;
    int         promisc         = 1;
    int         timeout_ms      = 1;          // pcap read timeout
    int         producer_threads = 2;
    size_t      queue_capacity  = 100000;
    KafkaConfig kafka;
};

class CaptureEngine {
public:
    CaptureEngine();
    ~CaptureEngine();

    // Non-copyable
    CaptureEngine(const CaptureEngine&) = delete;
    CaptureEngine& operator=(const CaptureEngine&) = delete;

    // Initialize pcap + Kafka; returns false on failure
    bool init(const EngineConfig& config);

    // Start capture + producer threads (non-blocking)
    void start();

    // Request graceful shutdown
    void stop();

    // Block until all threads complete
    void join();

    // Runtime statistics
    uint64_t packetsCaptured() const { return packets_captured_.load(std::memory_order_relaxed); }
    uint64_t packetsDropped()  const { return packets_dropped_.load(std::memory_order_relaxed); }
    uint64_t packetsQueued()   const { return packets_queued_.load(std::memory_order_relaxed); }

    // External access to running flag (for signal handler)
    std::atomic<bool>& runningFlag() { return running_; }

private:
    // Thread entry points
    void captureLoop();
    void producerLoop(int thread_id);

    // libpcap callback (static, adapts to member via user data)
    static void pcapCallback(
        uint8_t* user_data,
        const struct pcap_pkthdr* header,
        const uint8_t* data);

    EngineConfig              config_;
    pcap_t*                   pcap_handle_ = nullptr;
    std::atomic<bool>         running_{false};

    BoundedQueue<QueueItem>   queue_;

    std::thread               capture_thread_;
    std::vector<std::thread>  producer_threads_;

    // Each producer thread gets its own KafkaProducer (avoids contention)
    std::vector<std::unique_ptr<KafkaProducer>> producers_;

    // Counters
    std::atomic<uint64_t>     packets_captured_{0};
    std::atomic<uint64_t>     packets_dropped_{0};
    std::atomic<uint64_t>     packets_queued_{0};
};

} // namespace PacketService

#endif // PACKET_SERVICE_CAPTURE_ENGINE_H
