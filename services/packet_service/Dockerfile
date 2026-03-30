FROM gcc:12 AS builder

RUN apt-get update && apt-get install -y \
    cmake \
    libpcap-dev \
    librdkafka-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY CMakeLists.txt .
COPY *.cpp *.h ./
RUN cmake . && make -j$(nproc)

FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    libpcap0.8 \
    librdkafka1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/packet_capture_service /app/packet_capture_service

ENV KAFKA_BOOTSTRAP_SERVERS="kafka:29092"
ENV KAFKA_TOPIC="raw_packets"
ENV NETWORK_INTERFACE="eth0"

CMD ["./packet_capture_service"]
