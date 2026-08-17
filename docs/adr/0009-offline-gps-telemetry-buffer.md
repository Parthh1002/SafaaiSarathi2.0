# ADR 0009: Offline GPS Breadcrumb Buffering Strategy

## Status
Accepted

## Context
Support drivers traversing low-connectivity network dead-zones.

## Decision
Buffer coordinates in IndexedDB with automatic background batch sync.
