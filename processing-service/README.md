# HizmatTop AI 3D/VR Tour Processing Service

This folder is the future Python processing service for turning owner-uploaded room videos into interactive 3D/VR tours.

Current MVP behavior:

- keeps the processing contract separate from the Node.js API;
- creates a predictable output folder for each tour;
- mocks the heavy reconstruction steps so the full product flow can be tested locally.

Future pipeline:

1. Extract useful frames from the uploaded video.
2. Remove blurry and near-duplicate frames.
3. Run COLMAP to estimate camera poses and sparse geometry.
4. Run Gaussian Splatting or Nerfstudio Splatfacto.
5. Export a web viewer result.
6. Notify the Node.js backend with status, result URL, preview image, and errors.

Example:

```bash
python vr_pipeline.py --tour-id demo-tour --video-path ../backend/uploads/vr-videos/demo.mp4 --output-dir ./output
```
