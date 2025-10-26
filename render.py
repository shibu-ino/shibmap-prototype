import json, math, os, subprocess, shlex, unicodedata, re
from pathlib import Path

# ========= ユーザー設定 =========
INPUT_JSON = "items.json"           # 入力データ
WORKDIR = Path("./render_work")     # 一時ワーク
OUTDIR  = Path("./output")          # 出力先
FPS = 30
W, H = 1080, 1920                   # 縦動画想定
IMG_SECONDS_DEFAULT = 4
VIDEO_MAX_SECONDS = 6
LEVELS = {
    "L0": {"type": "global"},
    "L1": {"z": 5},
    "L2": {"z": 8},
    "L3": {"type": "per_item"}
}
# =================================

def slug(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[^\w\-]+", "_", s)
    return s.strip("_")

def tile_xy(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1.0/math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return x, y

def ensure_dirs():
    WORKDIR.mkdir(parents=True, exist_ok=True)
    OUTDIR.mkdir(parents=True, exist_ok=True)

def run(cmd):
    print(">>", cmd)
    return subprocess.run(cmd, shell=True, check=True)

def to_clip_from_image(img_path, out_path, seconds=IMG_SECONDS_DEFAULT):
    cmd = f'''
    ffmpeg -y -loop 1 -t {seconds} -i {shlex.quote(img_path)} \
      -vf "scale=w={W}:h={H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2" \
      -r {FPS} -pix_fmt yuv420p -an {shlex.quote(out_path)}
    '''
    run(cmd)

def to_clip_from_video(in_path, out_path, max_seconds=VIDEO_MAX_SECONDS):
    cmd = f'''
    ffmpeg -y -i {shlex.quote(in_path)} -t {max_seconds} \
      -vf "scale=w={W}:h={H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2" \
      -r {FPS} -pix_fmt yuv420p -c:a aac -b:a 128k {shlex.quote(out_path)}
    '''
    run(cmd)

def concat_ffmpeg(list_file, out_path):
    cmd = f'ffmpeg -y -f concat -safe 0 -i {shlex.quote(list_file)} -c copy {shlex.quote(out_path)}'
    run(cmd)

def load_items():
    data = json.load(open(INPUT_JSON, "r", encoding="utf-8"))
    norm = []
    for it in data:
        title = it["title"]
        lat, lon = it["coords"]
        media = it.get("media", [])
        norm.append({"title": title, "coords":[lat, lon], "media": media})
    return norm

def build_unit_clips(items):
    unit = {}
    for it in items:
        key = slug(it["title"])
        unit[key] = []
        for m in it.get("media", []):
            typ = m.get("type")
            path = m.get("path")
            if not path or not os.path.exists(path):
                continue
            out = WORKDIR / f"{key}_{len(unit[key]):02d}.mp4"
            if typ == "image":
                to_clip_from_image(path, out, seconds=m.get("duration_hint", IMG_SECONDS_DEFAULT))
                unit[key].append(str(out))
            elif typ == "video":
                to_clip_from_video(path, out, max_seconds=m.get("duration_hint", VIDEO_MAX_SECONDS))
                unit[key].append(str(out))
        if not unit[key]:
            out = WORKDIR / f"{key}_placeholder.mp4"
            cmd = f'ffmpeg -y -f lavfi -i color=c=black:s={W}x{H}:d=2 -r {FPS} -pix_fmt yuv420p {shlex.quote(str(out))}'
            run(cmd)
            unit[key].append(str(out))
    return unit

def write_concat_and_render(clip_paths, out_path):
    lst = WORKDIR / (Path(out_path).stem + "_list.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for p in clip_paths:
            f.write(f"file '{p}'\n")
    concat_ffmpeg(str(lst), out_path)

def render_L0(items, unit_clips):
    seq = []
    for it in items:
        key = slug(it["title"])
        clips = unit_clips.get(key, [])
        if clips:
            seq.append(clips[0])
    out = OUTDIR / "L0_global.mp4"
    write_concat_and_render(seq, str(out))

def render_clustered(items, unit_clips, z, level_tag):
    clusters = {}
    for it in items:
        lat, lon = it["coords"]
        x, y = tile_xy(lat, lon, z)
        cid = f"z{z}_x{x}_y{y}"
        clusters.setdefault(cid, []).append(it)

    for cid, group in clusters.items():
        seq = []
        for it in group:
            key = slug(it["title"])
            clips = unit_clips.get(key, [])
            if clips:
                seq.append(clips[0])
        if not seq: 
            continue
        out_dir = OUTDIR / level_tag
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / f"{cid}.mp4"
        write_concat_and_render(seq, str(out))

def render_per_item(items, unit_clips):
    out_dir = OUTDIR / "L3"
    out_dir.mkdir(parents=True, exist_ok=True)
    for it in items:
        key = slug(it["title"])
        clips = unit_clips.get(key, [])
        if not clips: 
            continue
        out = out_dir / f"{key}.mp4"
        write_concat_and_render(clips, str(out))

def main():
    ensure_dirs()
    items = load_items()
    unit = build_unit_clips(items)
    render_L0(items, unit)
    render_clustered(items, unit, z=LEVELS["L1"]["z"], level_tag="L1")
    render_clustered(items, unit, z=LEVELS["L2"]["z"], level_tag="L2")
    render_per_item(items, unit)

if __name__ == "__main__":
    main()