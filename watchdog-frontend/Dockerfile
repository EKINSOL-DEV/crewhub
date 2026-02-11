FROM node:20-alpine

RUN apk add --no-cache bash curl lsof

WORKDIR /app

# Copy watchdog script
COPY watchdog.sh /usr/local/bin/watchdog.sh
RUN chmod +x /usr/local/bin/watchdog.sh

# Environment defaults
ENV FRONTEND_PORT=5180
ENV HEALTH_CHECK_INTERVAL=30
ENV MAX_RESTARTS=10
ENV RESTART_WINDOW=3600
ENV CREWHUB_DIR=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${FRONTEND_PORT}/ || exit 1

EXPOSE ${FRONTEND_PORT}

ENTRYPOINT ["/usr/local/bin/watchdog.sh"]
CMD ["start"]
