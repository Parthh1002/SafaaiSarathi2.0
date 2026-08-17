# Cloud Scaling Strategy

- Stateless Express backend horizontally scales based on CPU utilization (>75%).
- Supabase connection pooling via PgBouncer handles up to 10,000 concurrent citizen connections.
