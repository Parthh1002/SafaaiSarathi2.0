# ADR 0004: 100-Meter Spatial Deduplication Strategy

## Status
Accepted

## Context
Prevent multiple citizens photographing the same garbage pile from generating duplicate dispatches.

## Decision
Apply Haversine distance clustering with 100m tolerance window.
