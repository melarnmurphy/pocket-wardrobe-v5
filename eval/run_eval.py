"""Run the eval image set through a deployed pipeline endpoint and score it.

Usage:
  python eval/run_eval.py --endpoint https://<user>--fashion-pipeline-dev.modal.run
Reads images from ~/.pocketwardrobe-eval/originals (converting HEIC->JPEG via sips,
preserving EXIF orientation) and ground truth from ~/.pocketwardrobe-eval/ground_truth.json.
"""
import argparse, json, os, subprocess, tempfile, glob
import urllib.request

EVAL_DIR = os.path.expanduser("~/.pocketwardrobe-eval")

def to_jpeg(src: str, dst: str) -> None:
    # sips preserves EXIF orientation in the JPEG so the server's exif_transpose runs.
    subprocess.run(["sips", "-s", "format", "jpeg", src, "--out", dst],
                   check=True, capture_output=True)

def analyse(endpoint: str, jpeg_path: str) -> dict:
    import requests  # pip install requests in the dev env
    with open(jpeg_path, "rb") as f:
        r = requests.post(f"{endpoint}/analyse",
                          files={"file": (os.path.basename(jpeg_path), f, "image/jpeg")},
                          timeout=120)
    r.raise_for_status()
    return r.json()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True)
    args = ap.parse_args()
    gt = json.load(open(os.path.join(EVAL_DIR, "ground_truth.json")))
    originals = sorted(glob.glob(os.path.join(EVAL_DIR, "originals", "*")))
    rows, dup_total, empty_total = [], 0, 0
    with tempfile.TemporaryDirectory() as tmp:
        for src in originals:
            name = os.path.splitext(os.path.basename(src))[0]
            jpg = os.path.join(tmp, name + ".jpg")
            to_jpeg(src, jpg)
            result = analyse(args.endpoint, jpg)
            gs = result.get("garments", [])
            cats = [g["category"] for g in gs]
            dups = len(cats) - len(set(cats))
            dup_total += max(0, dups)
            if not gs:
                empty_total += 1
            rows.append((name, len(gs), cats))
    print(f"{'image':<10} {'#det':>4}  categories")
    for name, n, cats in rows:
        print(f"{name:<10} {n:>4}  {cats}")
    print(f"\nempty results: {empty_total}/{len(rows)}   duplicate detections: {dup_total}")

if __name__ == "__main__":
    main()
