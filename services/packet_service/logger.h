#ifndef PACKET_SERVICE_LOGGER_H
#define PACKET_SERVICE_LOGGER_H

// ============================================================================
// Thread-safe logging utility
// Severity levels: DEBUG, INFO, WARN, ERROR
// Output: stderr (unbuffered for real-time visibility)
// ============================================================================

#include <cstdio>
#include <cstdarg>
#include <ctime>
#include <mutex>
#include <chrono>

namespace PacketService {

enum class LogLevel : int {
    DEBUG = 0,
    INFO  = 1,
    WARN  = 2,
    ERROR = 3
};

#ifndef LOG_MIN_LEVEL
#define LOG_MIN_LEVEL 0  // Default: show all levels
#endif

class Logger {
public:
    static Logger& instance() {
        static Logger logger;
        return logger;
    }

    void setLevel(LogLevel level) {
        min_level_ = level;
    }

    void log(LogLevel level, const char* file, int line, const char* fmt, ...) {
        if (static_cast<int>(level) < static_cast<int>(min_level_)) return;

        // Format timestamp
        auto now = std::chrono::system_clock::now();
        auto time_t_now = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()) % 1000;

        struct tm tm_buf;
#ifdef _WIN32
        localtime_s(&tm_buf, &time_t_now);
#else
        localtime_r(&time_t_now, &tm_buf);
#endif

        char time_str[32];
        std::strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S", &tm_buf);

        // Format user message
        char msg_buf[2048];
        va_list args;
        va_start(args, fmt);
        vsnprintf(msg_buf, sizeof(msg_buf), fmt, args);
        va_end(args);

        // Extract basename from file path
        const char* basename = file;
        for (const char* p = file; *p; ++p) {
            if (*p == '/' || *p == '\\') basename = p + 1;
        }

        // JSON output format to stdout
        fprintf(stdout, "{\"ts\":\"%s.%03dZ\",\"level\":\"%s\",\"service\":\"packet_service\",\"msg\":\"%s\"}\n",
                time_str,
                static_cast<int>(ms.count()),
                levelToString(level),
                msg_buf);
        fflush(stdout);
    }

private:
    Logger() = default;
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    std::mutex mutex_;
    LogLevel min_level_ = static_cast<LogLevel>(LOG_MIN_LEVEL);

    static const char* levelToString(LogLevel level) {
        switch (level) {
            case LogLevel::DEBUG: return "DEBUG";
            case LogLevel::INFO:  return "INFO";
            case LogLevel::WARN:  return "WARN";
            case LogLevel::ERROR: return "ERROR";
            default:              return "UNKNOWN";
        }
    }
};

// Convenience macros
#define LOG_DEBUG(fmt, ...) \
    PacketService::Logger::instance().log(PacketService::LogLevel::DEBUG, __FILE__, __LINE__, fmt, ##__VA_ARGS__)
#define LOG_INFO(fmt, ...) \
    PacketService::Logger::instance().log(PacketService::LogLevel::INFO, __FILE__, __LINE__, fmt, ##__VA_ARGS__)
#define LOG_WARN(fmt, ...) \
    PacketService::Logger::instance().log(PacketService::LogLevel::WARN, __FILE__, __LINE__, fmt, ##__VA_ARGS__)
#define LOG_ERROR(fmt, ...) \
    PacketService::Logger::instance().log(PacketService::LogLevel::ERROR, __FILE__, __LINE__, fmt, ##__VA_ARGS__)

} // namespace PacketService

#endif // PACKET_SERVICE_LOGGER_H
