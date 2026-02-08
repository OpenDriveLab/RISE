# At-a-Glance Videos (Fig.4 / Fig.5)

The page uses:
- `assets/videos/at_glance_cwm_workflow.mp4` (Fig.4)
- `assets/videos/at_glance_self_improve.mp4` (Fig.5)

This repo ships with placeholder MP4s so the page runs immediately.

## Generate real videos from the PDF
1) Put `13.pdf` at repo root.
2) Edit `tools/make_at_glance_videos.py`:
   - `FIG4_PAGE`, `FIG5_PAGE` (0-based)
   - `FIG4_BBOX`, `FIG5_BBOX`
   - refine `FIG4_MODULES`, `FIG5_PATH`
3) Run:
```bash
python tools/make_at_glance_videos.py --pdf 13.pdf --out assets/videos
```
It outputs the two MP4s and saves extracted figure previews to `assets/figures/`.
