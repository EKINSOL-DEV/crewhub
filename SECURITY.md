# Security Policy

## Overview

CrewHub is designed for **local and trusted network** use by default. Out of the box, there is **no authentication** — anyone who can reach the port can access the dashboard and its API.

This is intentional for ease of development and local use, but it means **CrewHub is not production-ready without additional hardening**.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Email:** [security@ekinsol.be](mailto:security@ekinsol.be)
- **GitHub:** Contact [@ch-ekinsol](https://github.com/ch-ekinsol) via a private security advisory or direct message
- **Do not** open a public GitHub issue for security vulnerabilities
- We aim to acknowledge reports within 48 hours

## Security Best Practices

If you plan to deploy CrewHub beyond your local machine or trusted network:

### 1. Enable Authentication
- Use the built-in API key authentication for agent onboarding
- Configure access controls for the dashboard
- Never expose an unauthenticated instance to the internet

### 2. Use HTTPS
- Always use TLS/HTTPS for any non-localhost deployment
- Use a reverse proxy (nginx, Caddy, Traefik) to terminate TLS
- Ensure WebSocket (WSS) and SSE connections are also encrypted

### 3. Firewall Rules
- Restrict access to CrewHub ports (default: 8091 backend, 5180 frontend)
- Only allow connections from trusted IPs or VPN
- Block public access unless explicitly needed

### 4. Token Management
- Rotate API keys regularly
- Use environment variables for secrets — never commit them to source
- Limit token scope and permissions where possible

### 5. Keep Updated
- Watch this repo for security-related releases
- Update dependencies regularly

## Security Documentation

- **[Security Hardening Plan](docs/security-hardening-plan.md)** — Roadmap for production-grade security features
- **[Security Review](docs/security-review.md)** — Current security posture analysis

## Scope

This policy applies to the CrewHub application itself. Third-party integrations (OpenClaw, Claude Code, Codex CLI) have their own security considerations — consult their respective documentation.
