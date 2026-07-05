"""
Field API — Backend-for-Frontend for the Field Mobile App.

Handles:
  - Push alert delivery to field patrol officers
  - Target info card data (thumbnail, confidence, last known location)
  - Field acknowledgment (receipt confirmation, response status)
  - Secure messaging back-channel to ICCC operator

Architecture: Frontend → field-api → core domain services (alert-service)
The field-mobile-app NEVER calls domain services directly.

Status: Stub — implementation pending.
"""
