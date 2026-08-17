# File Upload Security Verification

- Magic byte inspection prevents executable uploads disguised as `.jpg`.
- Maximum file size clamped to 8MB.
- Strip EXIF GPS for public view while retaining internal audit telemetry.
