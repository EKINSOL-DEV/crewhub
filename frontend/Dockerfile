FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Copy watchdog script
COPY watchdog.sh /app/watchdog.sh
RUN chmod +x /app/watchdog.sh

EXPOSE 5180

# Use watchdog to auto-restart Vite on crash
CMD ["/app/watchdog.sh"]
