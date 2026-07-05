# Field Mobile App

> Future mobile app for field patrol officers.

## Purpose
Per the CCTV FRS architecture, this app provides:
- Encrypted push alert on match confirmation
- Target info card (thumbnail, confidence score, last known location)
- GIS mini-map (last-seen location plotted on street map)
- Field acknowledgment (officer confirms receipt, marks response status)
- Secure messaging (encrypted back-channel to ICCC operator)

## Backend
Communicates exclusively with `services/field-api/` — never directly with core domain services.

## Tech Stack (Planned)
React Native or Flutter.

## Status
**Stub** — implementation pending.
