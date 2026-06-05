import argparse
import json
from pathlib import Path
from time import sleep


def make_stage(root: Path, name: str) -> Path:
    stage = root / name
    stage.mkdir(parents=True, exist_ok=True)
    return stage


def extract_frames(video_path: Path, root: Path) -> dict:
    frames_dir = make_stage(root, "frames")
    # MVP placeholder. Later this should call ffmpeg/OpenCV and filter frames.
    (frames_dir / "README.txt").write_text(
        f"Frames will be extracted from: {video_path}\n",
        encoding="utf-8",
    )
    return {"status": "ok", "framesDir": str(frames_dir)}


def run_colmap(root: Path) -> dict:
    colmap_dir = make_stage(root, "colmap")
    # Future hook for feature extraction, matching, mapping, and undistortion.
    (colmap_dir / "README.txt").write_text("COLMAP output placeholder\n", encoding="utf-8")
    return {"status": "mocked", "colmapDir": str(colmap_dir)}


def run_gaussian_splatting(root: Path) -> dict:
    splat_dir = make_stage(root, "gaussian-splatting")
    # Future hook for Nerfstudio Splatfacto or another splat training pipeline.
    (splat_dir / "README.txt").write_text("Gaussian Splatting output placeholder\n", encoding="utf-8")
    return {"status": "mocked", "splatDir": str(splat_dir)}


def export_viewer(root: Path, tour_id: str) -> dict:
    viewer_dir = make_stage(root, "viewer")
    html = viewer_dir / "index.html"
    html.write_text(
        f"""<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>HizmatTop VR Tour {tour_id}</title></head>
  <body>
    <h1>HizmatTop 3D/VR Tour</h1>
    <p>This is a placeholder viewer. Connect Gaussian Splatting export here.</p>
  </body>
</html>
""",
        encoding="utf-8",
    )
    return {"status": "ok", "viewerDir": str(viewer_dir), "entry": str(html)}


def main() -> None:
    parser = argparse.ArgumentParser(description="HizmatTop VR tour processing pipeline")
    parser.add_argument("--tour-id", required=True)
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    video_path = Path(args.video_path)
    root = Path(args.output_dir) / args.tour_id
    root.mkdir(parents=True, exist_ok=True)

    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    manifest = {
        "tourId": args.tour_id,
        "videoPath": str(video_path),
        "stages": [],
    }

    for stage_fn in (extract_frames, run_colmap, run_gaussian_splatting):
        manifest["stages"].append(stage_fn(video_path, root) if stage_fn == extract_frames else stage_fn(root))
        sleep(0.2)

    manifest["viewer"] = export_viewer(root, args.tour_id)
    manifest["resultType"] = "placeholder"
    manifest["progress"] = 100

    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
