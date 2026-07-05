"""
Case Portal BFF — Backend-for-Frontend for the Case Management Portal.

Handles:
  - Proxied requests to watchlist-service (enrollment, case management)
  - Proxied requests to evidentiary-service (clip viewing, export)
  - Proxied requests to audit-service (audit log queries)
  - Auth/session validation for portal users

Architecture: Frontend → case-portal-bff → core domain services
The case-management-portal frontend NEVER calls domain services directly.

Status: Stub — implementation pending.
"""
