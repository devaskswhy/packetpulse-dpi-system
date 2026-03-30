// ============================================================================
// main.cpp — Packet Capture Service entry point
//
// - CLI argument parsing (interface, broker, topic, threads, log level)
// - Signal handling (SIGINT / SIGTERM → graceful shutdown)
// - Spawns CaptureEngine pipeline, prints stats on exit
// ============================================================================

#include "capture_engine.h"
#include "logger.h"
#include "health_server.h"

#include <csignal>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <atomic>
#include <chrono>
#include <thread>

using namespace PacketService;

// ---------------------------------------------------------------------------
// Global engine pointer for signal handler access
// ---------------------------------------------------------------------------
static CaptureEngine* g_engine = nullptr;
static HealthServer* g_health_server = nullptr;

static void signalHandler(int sig) {
    LOG_INFO("Received signal %d — initiating shutdown...", sig);
    if (g_engine) {
        g_engine->runningFlag().store(false, std::memory_order_release);
    }
    if (g_health_server) {
        g_health_server->stop();
    }
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------
static void printUsage(const char* prog) {
    fprintf(stderr,
        "PacketPulse Capture Service\n"
        "Usage: %s [OPTIONS]\n\n"
        "Options:\n"
        "  -i <interface>   Network interface to capture from   (default: eth0)\n"
        "  -b <brokers>     Kafka broker list                   (default: localhost:9092)\n"
        "  -t <topic>       Kafka topic name                    (default: raw_packets)\n"
        "  -n <threads>     Number of producer threads          (default: 2)\n"
        "  -q <capacity>    Internal queue capacity              (default: 100000)\n"
        "  -l <level>       Log level: debug|info|warn|error    (default: info)\n"
        "  -h               Show this help message\n\n"
        "Example:\n"
        "  %s -i eth0 -b kafka1:9092,kafka2:9092 -t raw_packets -n 4\n",
        prog, prog);
}

// ---------------------------------------------------------------------------
// Parse Env/CLI arguments
// ---------------------------------------------------------------------------
static EngineConfig parseConfig(int argc, char* argv[]) {
    EngineConfig config;
    
    // Environment defaults
    const char* env_brokers = std::getenv("KAFKA_BOOTSTRAP_SERVERS");
    const char* env_topic = std::getenv("KAFKA_TOPIC");
    const char* env_iface = std::getenv("NETWORK_INTERFACE");
    
    if (env_brokers) config.kafka.brokers = env_brokers;
    if (env_topic) config.kafka.topic = env_topic;
    if (env_iface) config.interface = env_iface;

    // CLI overrides
    for (int i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            printUsage(argv[0]);
            exit(0);
        }
        else if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) config.interface = argv[++i];
        else if (strcmp(argv[i], "-b") == 0 && i + 1 < argc) config.kafka.brokers = argv[++i];
        else if (strcmp(argv[i], "-t") == 0 && i + 1 < argc) config.kafka.topic = argv[++i];
        else if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) {
            config.producer_threads = std::atoi(argv[++i]);
            if (config.producer_threads < 1) config.producer_threads = 1;
            if (config.producer_threads > 32) config.producer_threads = 32;
        }
        else if (strcmp(argv[i], "-q") == 0 && i + 1 < argc) {
            config.queue_capacity = static_cast<size_t>(std::atol(argv[++i]));
            if (config.queue_capacity < 1000) config.queue_capacity = 1000;
        }
    }

    return config;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
int main(int argc, char* argv[]) {
    LOG_INFO("=== PacketPulse Capture Service ===");

    EngineConfig config = parseConfig(argc, argv);

    LOG_INFO("Configuration:");
    LOG_INFO("  Interface:        %s", config.interface.c_str());
    LOG_INFO("  Kafka brokers:    %s", config.kafka.brokers.c_str());
    LOG_INFO("  Kafka topic:      %s", config.kafka.topic.c_str());
    LOG_INFO("  Producer threads: %d", config.producer_threads);
    LOG_INFO("  Queue capacity:   %zu", config.queue_capacity);

    // --- Initialize engine --------------------------------------------------
    CaptureEngine engine;
    g_engine = &engine;
    
    HealthServer health_server;
    g_health_server = &health_server;

    if (!engine.init(config)) {
        LOG_ERROR("Failed to initialize capture engine — exiting");
        return 1;
    }

    // --- Install signal handlers -------------------------------------------
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = signalHandler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGINT,  &sa, nullptr);
    sigaction(SIGTERM, &sa, nullptr);

    // --- Start pipeline & Server -------------------------------------------
    LOG_INFO("Starting capture pipeline...");
    health_server.start(8001);
    engine.start();

    // --- Periodic stats reporting ------------------------------------------
    auto start_time = std::chrono::steady_clock::now();
    while (engine.runningFlag().load(std::memory_order_acquire)) {
        std::this_thread::sleep_for(std::chrono::seconds(10));
        if (!engine.runningFlag().load(std::memory_order_acquire)) break;

        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::steady_clock::now() - start_time).count();

        uint64_t captured = engine.packetsCaptured();
        uint64_t dropped  = engine.packetsDropped();
        uint64_t queued   = engine.packetsQueued();
        double pps = (elapsed > 0) ? static_cast<double>(captured) / elapsed : 0.0;

        LOG_INFO("Stats [%llds]: captured=%llu dropped=%llu queued=%llu pps=%.1f",
                 static_cast<long long>(elapsed),
                 static_cast<unsigned long long>(captured),
                 static_cast<unsigned long long>(dropped),
                 static_cast<unsigned long long>(queued),
                 pps);
    }

    // --- Shutdown -----------------------------------------------------------
    LOG_INFO("Shutting down...");
    engine.stop();
    engine.join();

    // Final stats
    LOG_INFO("=== Final Statistics ===");
    LOG_INFO("  Packets captured: %llu",
             static_cast<unsigned long long>(engine.packetsCaptured()));
    LOG_INFO("  Packets dropped:  %llu",
             static_cast<unsigned long long>(engine.packetsDropped()));

    LOG_INFO("=== PacketPulse Capture Service terminated ===");
    return 0;
}
