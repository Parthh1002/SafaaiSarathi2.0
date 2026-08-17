# Authentication & Token Lifecycle

1. Password hashing using Argon2id with salt length 16.
2. Access token (15m expiry) stored in memory.
3. Refresh token (7d expiry) in HTTP-only SameSite cookie.
