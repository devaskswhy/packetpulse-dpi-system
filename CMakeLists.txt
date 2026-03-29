cmake_minimum_required(VERSION 3.16)
project(PacketAnalyzer VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Header files location
include_directories(${CMAKE_SOURCE_DIR}/include)

# Core libraries used by all CLIs
set(DPI_CORE_SOURCES
    src/pcap_reader.cpp
    src/packet_parser.cpp
    src/sni_extractor.cpp
    src/types.cpp
)

set(DPI_ENGINE_SOURCES
    src/dpi_engine.cpp
    src/rule_manager.cpp
    src/connection_tracker.cpp
    src/load_balancer.cpp
    src/fast_path.cpp
)

# =============================================================================
# Optional: librdkafka for Kafka integration in the DPI single-thread CLI
# =============================================================================
find_path(RDKAFKA_INCLUDE_DIR librdkafka/rdkafka.h
    HINTS /usr/include /usr/local/include)
find_library(RDKAFKA_LIBRARY rdkafka
    HINTS /usr/lib /usr/local/lib /usr/lib/x86_64-linux-gnu)

if(RDKAFKA_INCLUDE_DIR AND RDKAFKA_LIBRARY)
    set(HAVE_RDKAFKA TRUE)
    message(STATUS "librdkafka found — Kafka integration ENABLED")
    message(STATUS "  include: ${RDKAFKA_INCLUDE_DIR}")
    message(STATUS "  library: ${RDKAFKA_LIBRARY}")
else()
    set(HAVE_RDKAFKA FALSE)
    message(STATUS "librdkafka not found — Kafka integration DISABLED (--json fallback only)")
endif()

# Packet summary CLI
add_executable(packet_summary_cli
    src/cli/packet_summary_main.cpp
    ${DPI_CORE_SOURCES}
)

# Simple SNI inspector CLI
add_executable(sni_inspector_cli
    src/cli/sni_inspector_main.cpp
    ${DPI_CORE_SOURCES}
)

# Single-threaded DPI engine CLI (with optional Kafka)
if(HAVE_RDKAFKA)
    add_executable(dpi_single_thread_cli
        src/cli/dpi_single_thread_main.cpp
        ${DPI_CORE_SOURCES}
        packet_service/kafka_producer.cpp
    )
    target_compile_definitions(dpi_single_thread_cli PRIVATE ENABLE_KAFKA)
    target_include_directories(dpi_single_thread_cli PRIVATE
        ${RDKAFKA_INCLUDE_DIR}
        ${CMAKE_SOURCE_DIR}/packet_service
    )
    target_link_libraries(dpi_single_thread_cli PRIVATE ${RDKAFKA_LIBRARY})
else()
    add_executable(dpi_single_thread_cli
        src/cli/dpi_single_thread_main.cpp
        ${DPI_CORE_SOURCES}
    )
endif()

# Multi-threaded DPI engine CLI (DPIEngine-based)
add_executable(dpi_engine_cli
    src/cli/dpi_engine_main.cpp
    ${DPI_CORE_SOURCES}
    ${DPI_ENGINE_SOURCES}
)
