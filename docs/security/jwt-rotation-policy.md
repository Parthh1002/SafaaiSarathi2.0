# JWT Cryptographic Key Rotation Policy

- Refresh secrets rotated every 90 days.
- Revocation list stored in fast Redis / in-memory cache for instant logout.
