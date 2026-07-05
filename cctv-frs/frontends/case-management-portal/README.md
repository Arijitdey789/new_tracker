# Case Management Portal

> Future frontend for case/watchlist/audit management.

## Purpose
Per the CCTV FRS architecture, this portal provides:
- Target enrollment (upload reference photo, link case reference, authorization workflow)
- Case dashboard (active/closed cases, alert history, trajectory records)
- Watchlist management (add, update, expire, archive entries)
- Evidentiary clip viewer (view and export hash-signed video clips)
- Audit log viewer (full trail with filters for compliance/oversight)
- User/role management (RBAC — assign roles, manage accounts, set zone-scoped access)
- National DB sync status (CCTNS/AFRS/FIR adapter feeds)

## Backend
Communicates exclusively with `services/case-portal-bff/` — never directly with core domain services.

## Tech Stack (Planned)
React + Mapbox/Cesium for GIS features.

## Status
**Stub** — implementation pending.
