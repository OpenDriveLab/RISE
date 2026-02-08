#!/usr/bin/env python3
"""Generate two VIRAL-style At-a-Glance autoplay videos from paper figures (Fig.4 and Fig.5).

Usage:
  python tools/make_at_glance_videos.py --pdf 13.pdf --out assets/videos

You MUST edit the config constants near the top at least once:
  - FIG4_PAGE / FIG5_PAGE (0-based page indices)
  - FIG4_BBOX / FIG5_BBOX (pixel bboxes on the rendered page image)
Optional:
  - FIG4_MODULES (module boxes) / FIG5_PATH (dot path)

The script saves extracted previews to:
  assets/figures/fig4_extracted.png
  assets/figures/fig5_extracted.png
"""

import argparse
from pathlib import Path
import numpy as np
import cv2

try:
    import fitz  # PyMuPDF
except Exception as e:
    raise SystemExit("PyMuPDF (fitz) is required. Install: pip install pymupdf") from e

# ==================== CONFIG (EDIT ME) ====================
FIG4_PAGE = 0
FIG5_PAGE = 0

FIG4_BBOX = (80, 80, 1800, 1100)
FIG5_BBOX = (80, 80, 1800, 1100)

FIG4_MODULES = [
    {"name":"Proposal", "color":(200,110,30), "bbox":(80, 80, 520, 360)},
    {"name":"Dynamics", "color":(40, 200, 200), "bbox":(560, 80, 1080, 360)},
    {"name":"Value",    "color":(70, 210, 120), "bbox":(1120, 80, 1640, 360)},
    {"name":"Advantage","color":(70, 200, 255), "bbox":(560, 420, 1080, 720)},
]

FIG5_PATH = [
    (300, 350),
    (900, 320),
    (1250, 520),
    (300, 350),
]

OUT1 = "at_glance_cwm_workflow.mp4"
OUT2 = "at_glance_self_improve.mp4"
# ==========================================================

def render_page(pdf_path: Path, page_idx: int, scale: float = 2.5) -> np.ndarray:
    doc = fitz.open(str(pdf_path))
    page = doc.load_page(page_idx)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

def crop(img: np.ndarray, bbox):
    x0,y0,x1,y1 = map(int, bbox)
    x0=max(0,x0); y0=max(0,y0); x1=min(img.shape[1],x1); y1=min(img.shape[0],y1)
    return img[y0:y1, x0:x1].copy()

def dim_except(img: np.ndarray, bbox, dim=0.38, blur=3):
    dark = (img.astype(np.float32)*dim).astype(np.uint8)
    dark = cv2.GaussianBlur(dark, (blur*2+1, blur*2+1), 0)
    mask = np.zeros(img.shape[:2], np.uint8)
    x0,y0,x1,y1 = map(int, bbox)
    cv2.rectangle(mask, (x0,y0), (x1,y1), 255, -1)
    m = (mask[...,None]/255.0).astype(np.float32)
    return (img.astype(np.float32)*m + dark.astype(np.float32)*(1-m)).astype(np.uint8)

def draw_highlight(img: np.ndarray, bbox, color_bgr, label: str):
    x0,y0,x1,y1 = map(int, bbox)
    out = img.copy()
    glow = out.copy()
    cv2.rectangle(glow, (x0,y0), (x1,y1), color_bgr, 10)
    glow = cv2.GaussianBlur(glow, (0,0), 8)
    out = cv2.addWeighted(out, 1.0, glow, 0.25, 0)
    cv2.rectangle(out, (x0,y0), (x1,y1), color_bgr, 4)
    pad=10
    tw = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)[0][0]
    cv2.rectangle(out, (x0, max(0,y0-42)), (x0+tw+2*pad, y0-6), color_bgr, -1)
    cv2.putText(out, label, (x0+pad, y0-14), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255,255,255), 2, cv2.LINE_AA)
    return out

def zoom_pan_frame(img: np.ndarray, focus_bbox, out_size=(960,540), scale=1.18):
    H,W = img.shape[:2]
    x0,y0,x1,y1 = map(int, focus_bbox)
    cx = (x0+x1)/2; cy = (y0+y1)/2
    bw = (x1-x0)*scale; bh = (y1-y0)*scale
    out_w,out_h = out_size
    target_ar = out_w/out_h
    ar = bw/bh
    if ar > target_ar: bh = bw/target_ar
    else: bw = bh*target_ar
    nx0 = int(max(0, cx-bw/2)); ny0 = int(max(0, cy-bh/2))
    nx1 = int(min(W, cx+bw/2)); ny1 = int(min(H, cy+bh/2))
    crop_img = img[ny0:ny1, nx0:nx1]
    return cv2.resize(crop_img, (out_w,out_h), interpolation=cv2.INTER_AREA)

def write_mp4(frames, out_path: Path, fps=24):
    out_w,out_h = frames[0].shape[1], frames[0].shape[0]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    vw = cv2.VideoWriter(str(out_path), fourcc, fps, (out_w,out_h))
    for f in frames: vw.write(f)
    vw.release()

def make_fig4_video(fig: np.ndarray, out_path: Path, fps=24):
    out_size=(960,540)
    frames=[]
    per_phase=int(2.0*fps); intro=int(0.8*fps); outro=int(1.0*fps)
    whole=(0,0,fig.shape[1],fig.shape[0])
    for i in range(intro):
        s=1.02+0.03*(i/max(1,intro-1))
        fr=zoom_pan_frame(fig, whole, out_size=out_size, scale=s)
        cv2.putText(fr,"Fig.4  CWM Workflow",(30,55),cv2.FONT_HERSHEY_SIMPLEX,0.9,(255,255,255),3,cv2.LINE_AA)
        frames.append(fr)
    label_map={"Proposal":"Action Proposal","Dynamics":"Controllable Dynamics","Value":"Progress + TD Value","Advantage":"Advantage-driven Update"}
    for mod in FIG4_MODULES:
        base=draw_highlight(dim_except(fig, mod["bbox"]), mod["bbox"], mod["color"], mod["name"])
        for i in range(per_phase):
            s=1.15+0.05*np.sin(i/per_phase*np.pi)
            fr=zoom_pan_frame(base, mod["bbox"], out_size=out_size, scale=s)
            lbl=label_map.get(mod["name"],mod["name"])
            cv2.rectangle(fr,(30,72),(30+520,112),(0,0,0),-1)
            cv2.putText(fr,lbl,(45,102),cv2.FONT_HERSHEY_SIMPLEX,0.85,(255,255,255),2,cv2.LINE_AA)
            frames.append(fr)
    for i in range(outro):
        s=1.08-0.06*(i/max(1,outro-1))
        fr=zoom_pan_frame(fig, whole, out_size=out_size, scale=s)
        cv2.putText(fr,"Compositional World Model",(30,55),cv2.FONT_HERSHEY_SIMPLEX,0.9,(255,255,255),3,cv2.LINE_AA)
        frames.append(fr)
    write_mp4(frames,out_path,fps=fps)

def make_fig5_video(fig: np.ndarray, out_path: Path, fps=24):
    out_size=(960,540)
    frames=[]
    T=int(7.0*fps); whole=(0,0,fig.shape[1],fig.shape[0])
    for t in range(T):
        p=t/(T-1)
        s=1.03+0.05*np.sin(p*np.pi)
        fr=zoom_pan_frame(fig, whole, out_size=out_size, scale=s)
        seg=int(p*(len(FIG5_PATH)-1)); seg=min(seg,len(FIG5_PATH)-2)
        lp=(p*(len(FIG5_PATH)-1)-seg)
        x0,y0=FIG5_PATH[seg]; x1,y1=FIG5_PATH[seg+1]
        x=int(x0+(x1-x0)*lp); y=int(y0+(y1-y0)*lp)
        dot=fr.copy()
        cv2.circle(dot,(x,y),18,(255,255,255),-1,cv2.LINE_AA)
        cv2.circle(dot,(x,y),42,(80,180,255),4,cv2.LINE_AA)
        dot=cv2.GaussianBlur(dot,(0,0),4)
        fr=cv2.addWeighted(fr,1.0,dot,0.20,0)
        cv2.circle(fr,(x,y),10,(255,255,255),-1,cv2.LINE_AA)
        if p<0.25: lbl="Policy"
        elif p<0.55: lbl="Imagined Rollouts"
        elif p<0.80: lbl="Dense Advantage"
        else: lbl="Self-Improving Loop"
        cv2.rectangle(fr,(30,72),(30+520,112),(0,0,0),-1)
        cv2.putText(fr,"Fig.5  "+lbl,(45,102),cv2.FONT_HERSHEY_SIMPLEX,0.85,(255,255,255),2,cv2.LINE_AA)
        frames.append(fr)
    write_mp4(frames,out_path,fps=fps)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",type=str,default="13.pdf")
    ap.add_argument("--out",type=str,default="assets/videos")
    ap.add_argument("--scale",type=float,default=2.5)
    args=ap.parse_args()
    pdf=Path(args.pdf); out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    page4=render_page(pdf,FIG4_PAGE,scale=args.scale)
    page5=render_page(pdf,FIG5_PAGE,scale=args.scale)
    fig4=crop(page4,FIG4_BBOX); fig5=crop(page5,FIG5_BBOX)
    Path("assets/figures").mkdir(parents=True,exist_ok=True)
    cv2.imwrite("assets/figures/fig4_extracted.png",fig4)
    cv2.imwrite("assets/figures/fig5_extracted.png",fig5)
    make_fig4_video(fig4,out/OUT1)
    make_fig5_video(fig5,out/OUT2)
    print("Wrote:", out/OUT1, out/OUT2)
    print("Extracted previews: assets/figures/fig4_extracted.png, fig5_extracted.png")

if __name__=="__main__": main()
