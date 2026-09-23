#!/usr/bin/env bash
# Builds the site's self-hosted media from a scraped Instagram export (research/ig/posts.json).
#
# The site hosts as little as possible — full videos are YouTube embeds. What ends up in public/media:
#   ig/<shortcode>/<nn>.jpg   a still for every carousel item (video frames link back to Instagram)
#   loops/<shortcode>/<nn>.mp4  ~10 s silent header loops (+ .jpg poster), only for refs used as `heroClip`
#   yt/<id>.jpg               YouTube poster frames
# plus src/data/media.json, the manifest pages build from (so media can live on R2 instead of public/).
#
# Raw Instagram videos are cached in research/ig/raw (never deployed). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

POSTS=research/ig/posts.json
RAW=research/ig/raw
OUT=public/media
mkdir -p "$OUT/ig" "$OUT/yt" "$OUT/loops" "$RAW"

ff() { ffmpeg -nostdin -loglevel error -y "$@"; }
# Frame from ~30% in (first frames of phone clips are often black), capped at 4 s
still() { # src dst
  local d; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")
  local at; at=$(awk -v d="$d" 'BEGIN { t = d * 0.3; if (t > 4) t = 4; printf "%.2f", t }')
  ff -ss "$at" -i "$1" -frames:v 1 -vf "scale='min(1440,iw)':-2" -q:v 4 "$2"
}
fetch() { curl -sf --max-time 180 -o "$2" "$1"; } # url dst

# 1. Stills for every Instagram item (and the raw video cache)
jq -r '.[] | .shortCode as $s
  | (if (.childPosts|length) > 0 then .childPosts else [.] end)
  | to_entries[]
  | [$s, (.key|tostring), (if .value.videoUrl then "video" else "image" end), (.value.videoUrl // .value.displayUrl)]
  | @tsv' "$POSTS" |
while IFS=$'\t' read -r code idx kind url; do
  n=$(printf %02d "$idx")
  mkdir -p "$OUT/ig/$code" "$RAW/$code"
  jpg="$OUT/ig/$code/$n.jpg"
  if [ "$kind" = video ]; then
    raw="$RAW/$code/$n.mp4"
    [ -f "$raw" ] || fetch "$url" "$raw" || { echo "fail $code $n" >&2; continue; }
    [ -f "$jpg" ] || still "$raw" "$jpg"
  else
    [ -f "$jpg" ] && continue
    tmp=$(mktemp); fetch "$url" "$tmp" && ff -i "$tmp" -vf "scale='min(1440,iw)':-2" -q:v 4 "$jpg" || echo "fail $code $n" >&2
    rm -f "$tmp"
  fi
done

# 2. Header loops: 10 s, no audio, for every heroClip in the episodes
for ref in $(sed -n 's/^heroClip:[[:space:]]*//p' src/content/episodes/*.md | sort -u); do
  src="$RAW/$ref.mp4"; dst="$OUT/loops/$ref.mp4"
  [ -f "$dst" ] && continue
  [ -f "$src" ] || { echo "no raw video for heroClip $ref" >&2; continue; }
  mkdir -p "$(dirname "$dst")"
  start=$(awk -v r="$ref" '$1 == r { print $2 }' scripts/loop-starts.txt 2>/dev/null); start=${start:-1}
  ff -ss "$start" -t 10 -i "$src" -an \
    -vf "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'" \
    -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart "$dst"
done
# poster = the loop's own first frame, so nothing flashes when it starts
for f in "$OUT"/loops/*/*.mp4; do
  [ -f "$f" ] && { [ -f "${f%.mp4}.jpg" ] || ff -i "$f" -frames:v 1 -q:v 4 "${f%.mp4}.jpg"; }
done

# 3. YouTube posters: channel videos + music videos Pushit shot (listed on /work)
for id in $(cat research/yt/ids.txt) bp3LlRkgumI EXvQlhD1JmI pnaWZvTfwAM EVGBe0Tn1Cc; do
  [ -f "$OUT/yt/$id.jpg" ] && continue
  fetch "https://i.ytimg.com/vi/$id/maxresdefault.jpg" "$OUT/yt/$id.jpg" \
    || fetch "https://i.ytimg.com/vi/$id/hqdefault.jpg" "$OUT/yt/$id.jpg" || echo "fail yt $id" >&2
done

# 4. Manifest: dimensions, whether a still is a video frame, and which loops exist
dims() { ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=, "$1"; }
{
  echo '{ "clips": {'
  sep=''
  for f in "$OUT"/ig/*/*.jpg; do
    ref=${f#"$OUT/ig/"}; ref=${ref%.jpg}
    video=false; [ -f "$RAW/$ref.mp4" ] && video=true
    IFS=, read -r w h <<<"$(dims "$f")"
    printf '%s\n    "%s": { "w": %s, "h": %s, "video": %s }' "$sep" "$ref" "$w" "$h" "$video"; sep=','
  done
  echo; echo '  }, "loops": {'
  sep=''
  for f in "$OUT"/loops/*/*.mp4; do
    [ -f "$f" ] || continue
    ref=${f#"$OUT/loops/"}; ref=${ref%.mp4}
    IFS=, read -r w h <<<"$(dims "$f")"
    printf '%s\n    "%s": { "w": %s, "h": %s }' "$sep" "$ref" "$w" "$h"; sep=','
  done
  echo; echo '  } }'
} > src/data/media.json
echo done
