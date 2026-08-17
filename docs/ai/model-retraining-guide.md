# Automated Active Learning Retraining Guide

1. Collect verified false positive images from officer overrides.
2. Re-label with Roboflow / CVAT.
3. Run transfer learning epoch run (`yolo detect train data=waste.yaml epochs=50`).
