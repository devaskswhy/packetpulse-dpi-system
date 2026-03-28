cmake_minimum_required(VERSION 3.16)
project(PacketCaptureService VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# =============================================================================
# Find dependencies
# =============================================================================

# --- libpcap -----------------------------------------------------------------
find_path(PCAP_INCLUDE_DIR pcap/pcap.h
    HINTS /usr/include /usr/local/include)
find_library(PCAP_LIBRARY pcap
    HINTS /usr/lib /usr/local/lib /usr/lib/x86_64-linux-gnu)

if(NOT PCAP_INCLUDE_DIR OR NOT PCAP_LIBRARY)
    message(FATAL_ERROR
        "libpcap not found. Install with: sudo apt install libpcap-dev")
endif()

message(STATUS "libpcap include: ${PCAP_INCLUDE_DIR}")
message(STATUS "libpcap library: ${PCAP_LIBRARY}")

# --- librdkafka --------------------------------------------------------------
find_path(RDKAFKA_INCLUDE_DIR librdkafka/rdkafka.h
    HINTS /usr/include /usr/local/include)
find_library(RDKAFKA_LIBRARY rdkafka
    HINTS /usr/lib /usr/local/lib /usr/lib/x86_64-linux-gnu)

if(NOT RDKAFKA_INCLUDE_DIR OR NOT RDKAFKA_LIBRARY)
    message(FATAL_ERROR
        "librdkafka not found. Install with: sudo apt install librdkafka-dev")
endif()

message(STATUS "librdkafka include: ${RDKAFKA_INCLUDE_DIR}")
message(STATUS "librdkafka library: ${RDKAFKA_LIBRARY}")

# =============================================================================
# Target
# =============================================================================

add_executable(packet_capture_service
    main.cpp
    parser.cpp
    kafka_producer.cpp
    capture_engine.cpp
)

target_include_directories(packet_capture_service PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${PCAP_INCLUDE_DIR}
    ${RDKAFKA_INCLUDE_DIR}
)

target_link_libraries(packet_capture_service PRIVATE
    ${PCAP_LIBRARY}
    ${RDKAFKA_LIBRARY}
    pthread
)

# Optimization for release builds
target_compile_options(packet_capture_service PRIVATE
    $<$<CONFIG:Release>:-O3 -march=native -DNDEBUG>
    $<$<CONFIG:Debug>:-g -O0 -fsanitize=address,undefined>
)
target_link_options(packet_capture_service PRIVATE
    $<$<CONFIG:Debug>:-fsanitize=address,undefined>
)
