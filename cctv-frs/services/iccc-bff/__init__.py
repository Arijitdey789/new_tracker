"""
ICCC BFF — Backend-for-Frontend for the ICCC Operator Dashboard.

This is the ONLY backend service the ICCC Dashboard frontend communicates with.
It proxies requests to core domain services (edge-inference, watchlist-service,
recognition-service) and handles:
  - Static file serving for the SENTINEL PRO SPA
  - WebSocket relay for real-time match alerts from the pipeline event queue
  - Auth validation before forwarding any request

Architecture: Frontend → iccc-bff → core domain services
The frontend NEVER calls domain services directly.
"""
