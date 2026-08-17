# AI Vision Fallback Strategy

If the FastAPI microservice on port 8100 is unreachable, the Node.js API gracefully falls back to deterministic rule-based tagging (`localClassify`).
