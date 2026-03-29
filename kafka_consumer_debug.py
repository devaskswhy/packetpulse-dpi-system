#!/usr/bin/env python3
"""
kafka_consumer_debug.py — PacketPulse Debug Consumer

Subscribes to the 'raw_packets' Kafka topic and pretty-prints each message
as formatted JSON. Designed for development/debugging use.

Usage:
    python kafka_consumer_debug.py
    python kafka_consumer_debug.py --broker localhost:9092 --topic raw_packets
    python kafka_consumer_debug.py --group debug-group

Requirements:
    pip install confluent-kafka==2.3.0
"""

import argparse
import json
import signal
import sys
from confluent_kafka import Consumer, KafkaError, KafkaException


def create_consumer(broker: str, group_id: str, topic: str) -> Consumer:
    """Create and configure a Kafka consumer."""
    conf = {
        "bootstrap.servers": broker,
        "group.id": group_id,
        "auto.offset.reset": "latest",
        "enable.auto.commit": True,
        "auto.commit.interval.ms": 5000,
        "session.timeout.ms": 10000,
    }
    consumer = Consumer(conf)
    consumer.subscribe([topic])
    return consumer


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PacketPulse Debug Consumer — pretty-print raw_packets from Kafka"
    )
    parser.add_argument(
        "--broker", "-b",
        default="localhost:9092",
        help="Kafka broker address (default: localhost:9092)",
    )
    parser.add_argument(
        "--topic", "-t",
        default="raw_packets",
        help="Kafka topic to subscribe to (default: raw_packets)",
    )
    parser.add_argument(
        "--group", "-g",
        default="packetpulse-debug",
        help="Consumer group ID (default: packetpulse-debug)",
    )
    args = parser.parse_args()

    # ---- Graceful SIGINT shutdown ------------------------------------------
    shutdown = False

    def signal_handler(signum, frame):
        nonlocal shutdown
        print("\n[DEBUG CONSUMER] Received SIGINT — shutting down gracefully...")
        shutdown = True

    signal.signal(signal.SIGINT, signal_handler)

    # ---- Create consumer ---------------------------------------------------
    print(f"[DEBUG CONSUMER] Connecting to {args.broker}")
    print(f"[DEBUG CONSUMER] Topic: {args.topic}  |  Group: {args.group}")
    print(f"[DEBUG CONSUMER] Waiting for messages (Ctrl+C to exit)...\n")

    consumer = create_consumer(args.broker, args.group, args.topic)
    msg_count = 0

    try:
        while not shutdown:
            msg = consumer.poll(timeout=1.0)

            if msg is None:
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    # Reached end of partition — not an error, just informational
                    continue
                else:
                    raise KafkaException(msg.error())

            msg_count += 1

            # Decode message
            topic = msg.topic()
            partition = msg.partition()
            offset = msg.offset()
            key = msg.key().decode("utf-8") if msg.key() else None
            value = msg.value().decode("utf-8") if msg.value() else None

            # Header
            print(f"{'─' * 72}")
            print(
                f"  topic={topic}  partition={partition}  "
                f"offset={offset}  key={key}"
            )
            print(f"{'─' * 72}")

            # Pretty-print JSON payload
            if value:
                try:
                    parsed = json.loads(value)
                    print(json.dumps(parsed, indent=2, ensure_ascii=False))
                except json.JSONDecodeError:
                    print(f"  [RAW] {value}")
            else:
                print("  [EMPTY MESSAGE]")

            print()

    except KafkaException as e:
        print(f"[DEBUG CONSUMER] Kafka error: {e}", file=sys.stderr)
        sys.exit(1)

    finally:
        # Close consumer cleanly (commits offsets, leaves group)
        consumer.close()
        print(f"[DEBUG CONSUMER] Consumer closed. Total messages received: {msg_count}")


if __name__ == "__main__":
    main()
