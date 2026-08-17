# Prisma Indexing Strategy

- Composite Index: `(ward_id, status, created_at)`
- Geospatial Index: `(latitude, longitude)` for radius searches
- Full-text search index on complaint remarks.
