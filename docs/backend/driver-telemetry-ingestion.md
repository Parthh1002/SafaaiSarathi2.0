# Real-Time Driver Telemetry Pipeline

- Driver sends GPS packets every 3s.
- WebSocket server calculates instantaneous speed and heading angle.
- Broadcasts to ward subscribers with sub-50ms latency.
