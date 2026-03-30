// ============================================================================
// capture_engine.cpp — Multithreaded capture → queue → Kafka pipeline
//
// Capture thread:
//   - pcap_loop with callback → parse → serialize to JSON → push to queue
//
// Producer threads (N):
//   - Pop from queue → produce to Kafka (each thread has its own producer)
//
// Shutdown:
//   - Signal handler sets running_ = false
//   - pcap_breakloop stops capture
//   - Queue shutdown wakes blocked producers
//   - All threads join cleanly
// ============================================================================

#include "capture_engine.h"
#include "logger.h"

#include <cstring>

namespace PacketService {

// ---------------------------------------------------------------------------
// Constructor / Destructor
// ---------------------------------------------------------------------------

CaptureEngine::CaptureEngine() = default;

CaptureEngine::~CaptureEngine() {
    stop();
    join();
    if (pcap_handle_) {
        pcap_close(pcap_handle_);
        pcap_handle_ = nullptr;
    }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

bool CaptureEngine::init(const EngineConfig& config) {
    config_ = config;

    // --- Open pcap ----------------------------------------------------------
    char errbuf[PCAP_ERRBUF_SIZE];
    pcap_handle_ = pcap_open_live(
        config_.interface.c_str(),
        config_.snaplen,
        config_.promisc,
        config_.timeout_ms,
        errbuf
    );

    if (!pcap_handle_) {
        LOG_ERROR("pcap_open_live failed on '%s': %s",
                  config_.interface.c_str(), errbuf);
        return false;
    }

    // Verify we're on Ethernet
    int dlt = pcap_datalink(pcap_handle_);
    if (dlt != DLT_EN10MB) {
        LOG_ERROR("Unsupported data link type %d on '%s' (expected Ethernet)",
                  dlt, config_.interface.c_str());
        pcap_close(pcap_handle_);
        pcap_handle_ = nullptr;
        return false;
    }

    LOG_INFO("pcap: opened '%s' (snaplen=%d, promisc=%s)",
             config_.interface.c_str(), config_.snaplen,
             config_.promisc ? "yes" : "no");

    // --- Set up queue -------------------------------------------------------
    queue_ = BoundedQueue<QueueItem>(config_.queue_capacity);

    // --- Initialize Kafka producers -----------------------------------------
    producers_.reserve(config_.producer_threads);
    for (int i = 0; i < config_.producer_threads; ++i) {
        auto producer = std::make_unique<KafkaProducer>();
        if (!producer->init(config_.kafka)) {
            LOG_ERROR("Failed to initialize Kafka producer #%d", i);
            return false;
        }
        producers_.push_back(std::move(producer));
    }

    LOG_INFO("Initialized %d Kafka producer(s)", config_.producer_threads);
    return true;
}

// ---------------------------------------------------------------------------
// Start / Stop / Join
// ---------------------------------------------------------------------------

void CaptureEngine::start() {
    running_.store(true, std::memory_order_release);

    // Capture thread
    capture_thread_ = std::thread(&CaptureEngine::captureLoop, this);
    LOG_INFO("Capture thread started");

    // Producer threads
    producer_threads_.reserve(config_.producer_threads);
    for (int i = 0; i < config_.producer_threads; ++i) {
        producer_threads_.emplace_back(&CaptureEngine::producerLoop, this, i);
        LOG_INFO("Producer thread #%d started", i);
    }
}

void CaptureEngine::stop() {
    if (!running_.load(std::memory_order_acquire)) return;

    running_.store(false, std::memory_order_release);

    // Break pcap_loop
    if (pcap_handle_) {
        pcap_breakloop(pcap_handle_);
    }

    // Wake up any blocked producer threads
    queue_.shutdown();

    LOG_INFO("Stop signal sent to all threads");
}

void CaptureEngine::join() {
    if (capture_thread_.joinable()) {
        capture_thread_.join();
        LOG_INFO("Capture thread joined");
    }

    for (size_t i = 0; i < producer_threads_.size(); ++i) {
        if (producer_threads_[i].joinable()) {
            producer_threads_[i].join();
            LOG_INFO("Producer thread #%zu joined", i);
        }
    }
    producer_threads_.clear();

    // Flush all producers
    for (auto& producer : producers_) {
        if (producer) {
            producer->flush(5000);
        }
    }
}

// ---------------------------------------------------------------------------
// Capture Loop (runs in its own thread)
// ---------------------------------------------------------------------------

void CaptureEngine::captureLoop() {
    LOG_INFO("Capture loop started on '%s'", config_.interface.c_str());

    // pcap_loop will invoke pcapCallback for each packet
    // -1 = capture indefinitely until pcap_breakloop
    int result = pcap_loop(pcap_handle_, -1, pcapCallback,
                           reinterpret_cast<uint8_t*>(this));

    if (result == PCAP_ERROR) {
        LOG_ERROR("pcap_loop error: %s", pcap_geterr(pcap_handle_));
    } else if (result == PCAP_ERROR_BREAK) {
        LOG_INFO("pcap_loop terminated by breakloop");
    }

    // Report pcap stats
    struct pcap_stat stats;
    if (pcap_stats(pcap_handle_, &stats) == 0) {
        LOG_INFO("pcap stats: received=%u dropped_kernel=%u dropped_iface=%u",
                 stats.ps_recv, stats.ps_drop, stats.ps_ifdrop);
    }

    LOG_INFO("Capture loop ended");
}

// ---------------------------------------------------------------------------
// pcap Callback (static, called per packet from pcap_loop)
// ---------------------------------------------------------------------------

void CaptureEngine::pcapCallback(
    uint8_t* user_data,
    const struct pcap_pkthdr* header,
    const uint8_t* data)
{
    auto* self = reinterpret_cast<CaptureEngine*>(user_data);

    self->packets_captured_.fetch_add(1, std::memory_order_relaxed);

    // Parse packet
    auto parsed = PacketParser::parse(header, data);
    if (!parsed.has_value()) {
        self->packets_dropped_.fetch_add(1, std::memory_order_relaxed);
        return;
    }

    // Serialize to JSON
    QueueItem item;
    item.json_payload = parsed->toJsonString();

    // Try non-blocking push first, fall back to blocking
    if (!self->queue_.tryPush(std::move(item))) {
        self->packets_dropped_.fetch_add(1, std::memory_order_relaxed);
        // Under extreme load, drop rather than block the capture thread
        static thread_local uint64_t drop_count = 0;
        if (++drop_count % 10000 == 0) {
            LOG_WARN("Queue full — dropped %llu packets (total) on capture thread",
                     static_cast<unsigned long long>(
                         self->packets_dropped_.load(std::memory_order_relaxed)));
        }
        return;
    }

    self->packets_queued_.fetch_add(1, std::memory_order_relaxed);
}

// ---------------------------------------------------------------------------
// Producer Loop (one per thread)
// ---------------------------------------------------------------------------

void CaptureEngine::producerLoop(int thread_id) {
    LOG_INFO("Producer loop #%d started", thread_id);

    auto& producer = producers_[static_cast<size_t>(thread_id)];
    uint64_t produced = 0;
    uint64_t errors   = 0;

    while (running_.load(std::memory_order_acquire) || !queue_.isShutdown()) {
        // Pop with timeout to periodically check running flag
        auto item = queue_.popWithTimeout(std::chrono::milliseconds(100));
        if (!item.has_value()) {
            // Timeout or shutdown with empty queue
            if (!running_.load(std::memory_order_acquire) && queue_.isShutdown()) {
                break;
            }
            continue;
        }

        if (producer->produce(item->json_payload)) {
            ++produced;
        } else {
            ++errors;
            if (errors % 1000 == 0) {
                LOG_WARN("Producer #%d: %llu produce errors so far",
                         thread_id, static_cast<unsigned long long>(errors));
            }
        }
    }

    // Drain remaining items from the queue
    while (true) {
        auto item = queue_.popWithTimeout(std::chrono::milliseconds(10));
        if (!item.has_value()) break;
        producer->produce(item->json_payload);
        ++produced;
    }

    LOG_INFO("Producer #%d finished: produced=%llu errors=%llu",
             thread_id,
             static_cast<unsigned long long>(produced),
             static_cast<unsigned long long>(errors));
}

} // namespace PacketService
