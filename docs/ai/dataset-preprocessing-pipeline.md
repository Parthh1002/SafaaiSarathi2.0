# Dataset Preprocessing Pipeline

1. Auto-orient EXIF metadata
2. Resize to 640x640 with letterbox padding
3. Mosaic and mixup augmentation during training
4. HSV hue/saturation jitter for harsh sunlight conditions
