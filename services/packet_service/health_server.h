#ifndef PACKET_SERVICE_HEALTH_SERVER_H
#define PACKET_SERVICE_HEALTH_SERVER_H

#include "logger.h"
#include <thread>
#include <atomic>
#include <string>
#include <unistd.h>
#include <sys/types.h>
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "Ws2_32.lib")
#else
#include <sys/socket.h>
#include <netinet/in.h>
#endif

namespace PacketService {

class HealthServer {
public:
    HealthServer() : running_(false), server_fd_(-1) {}
    ~HealthServer() { stop(); }

    void start(int port = 8001) {
        running_ = true;
        thread_ = std::thread(&HealthServer::run, this, port);
    }

    void stop() {
        running_ = false;
        if (server_fd_ >= 0) {
#ifdef _WIN32
            closesocket(server_fd_);
#else
            close(server_fd_);
#endif
            server_fd_ = -1;
        }
        if (thread_.joinable()) {
            thread_.join();
        }
    }

private:
    std::atomic<bool> running_;
    int server_fd_;
    std::thread thread_;

    void run(int port) {
#ifdef _WIN32
        WSADATA wsaData;
        WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif

        server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
        if (server_fd_ < 0) {
            LOG_ERROR("Failed to create health check socket");
            return;
        }

        int opt = 1;
#ifdef _WIN32
        setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
        setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

        struct sockaddr_in address;
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port);

        if (bind(server_fd_, (struct sockaddr *)&address, sizeof(address)) < 0) {
            LOG_ERROR("Failed to bind health check socket to port %d", port);
            return;
        }

        if (listen(server_fd_, 3) < 0) {
            LOG_ERROR("Failed to listen on health check socket");
            return;
        }

        LOG_INFO("Health check server listening on port %d", port);

        while (running_) {
            struct sockaddr_in client_addr;
#ifdef _WIN32
            int addrlen = sizeof(client_addr);
#else
            socklen_t addrlen = sizeof(client_addr);
#endif
            int new_socket = accept(server_fd_, (struct sockaddr *)&client_addr, &addrlen);
            if (new_socket < 0) {
                if (running_) LOG_ERROR("Health check accept failed");
                continue;
            }

            char buffer[1024] = {0};
#ifdef _WIN32
            recv(new_socket, buffer, 1024, 0);
#else
            read(new_socket, buffer, 1024);
#endif
            
            std::string response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\"}";
#ifdef _WIN32
            send(new_socket, response.c_str(), response.length(), 0);
            closesocket(new_socket);
#else
            write(new_socket, response.c_str(), response.length());
            close(new_socket);
#endif
        }

#ifdef _WIN32
        WSACleanup();
#endif
    }
};

} // namespace PacketService
#endif // PACKET_SERVICE_HEALTH_SERVER_H
