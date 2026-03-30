FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y librdkafka-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV KAFKA_BOOTSTRAP_SERVERS="kafka:29092"
ENV HEALTH_PORT="8003"

CMD ["python", "main.py"]
