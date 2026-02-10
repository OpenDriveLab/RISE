/* Interactive site script (nav + modal + charts) */

const q = (s, el=document)=>el.querySelector(s);
const qa = (s, el=document)=>[...el.querySelectorAll(s)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

/* Active nav */
function setActiveNav(){
  const sections = qa("section[id]");
  const links = qa(".nav-links a");
  const y = window.scrollY + 140;
  let current = sections[0]?.id;
  for (const sec of sections){
    if (sec.offsetTop <= y) current = sec.id;
  }
  links.forEach(a=>{
    a.classList.toggle("active", a.getAttribute("href")==="#"+current);
  });
}
window.addEventListener("scroll", setActiveNav, {passive:true});
window.addEventListener("load", setActiveNav);

/* Video modal */
function openModal(videoRef){
  const modal = q("#modal");
  const v = q("#modalVideo");
  const src = (typeof videoRef === 'string' && (videoRef.startsWith('http') || videoRef.endsWith('.mp4')))
    ? videoRef
    : q(videoRef)?.getAttribute("data-src");
  if (!src) return;
  v.src = src;
  modal.style.display = "flex";
  v.play().catch(()=>{});
}
function closeModal(){
  const modal = q("#modal");
  const v = q("#modalVideo");
  v.pause();
  v.removeAttribute("src");
  v.load();
  modal.style.display = "none";
}
window.openModal = openModal;
window.closeModal = closeModal;
window.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModal(); });

/* Progress bar */
function setupProgressBar(){
  const bar = document.createElement("div");
  bar.className="progress";
  document.body.appendChild(bar);
  const onScroll=()=>{
    const h = document.documentElement;
    const sc = h.scrollTop || document.body.scrollTop;
    const max = (h.scrollHeight - h.clientHeight) || 1;
    bar.style.width = (sc/max*100).toFixed(2)+"%";
  };
  window.addEventListener("scroll", onScroll, {passive:true});
  window.addEventListener("load", onScroll);
}

/* Copy buttons */
function setupCopyButtons(){
  qa("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const target = btn.getAttribute("data-copy");
      const el = q(target);
      if(!el) return;
      const text = el.innerText || el.textContent || "";
      try{
        await navigator.clipboard.writeText(text);
        const old = btn.textContent;
        btn.textContent = "✓ Copied";
        setTimeout(()=>btn.textContent=old, 1200);
      }catch(e){
        const old = btn.textContent;
        btn.textContent = "Copy failed";
        setTimeout(()=>btn.textContent=old, 1200);
      }
    });
  });
}

/* Charts (pure canvas) */
function canvasSetup(canvas){
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx, W:cssW, H:cssH};
}
function drawRoundedBar(ctx, x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x, y+h);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h);
  ctx.closePath();
  ctx.fill();
}
function drawBarChartPerBar(cfg){
  const canvas = q(cfg.canvas);
  if(!canvas) return ()=>{};
  const wrap = canvas.parentElement;
  const tip = wrap.querySelector(".tooltip");
  const {ctx, W, H} = canvasSetup(canvas);
  const pad = {l:64, r:18, t:18, b:54};
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const labels = cfg.labels;
  const values = cfg.values;
  const colors = cfg.colors || [];
  const n = labels.length;

  let maxV = Math.max(...values);
  const isPercentAxis = !!(cfg.yFmt && String(cfg.yFmt(1)).includes("%"));
  if(cfg.max!=null) {
    maxV = cfg.max;
  } else {
    maxV = isPercentAxis ? 100 : 10;
  }

  ctx.clearRect(0,0,W,H);

  const ticks = cfg.ticks || 5;
  for(let i=0;i<=ticks;i++){
    const y = pad.t + plotH*(1 - i/ticks);
    ctx.strokeStyle="rgba(10,20,40,.10)";
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+plotW,y); ctx.stroke();

    const v = maxV * (i/ticks);
    ctx.fillStyle="rgba(75,85,101,.85)";
    ctx.font="11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign="right"; ctx.textBaseline="middle";
    ctx.fillText(cfg.yFmt?cfg.yFmt(v):v.toFixed(0), pad.l-10, y);
  }

  ctx.strokeStyle="rgba(11,16,32,.60)";
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t+plotH); ctx.lineTo(pad.l+plotW, pad.t+plotH); ctx.stroke();

  const groupW = plotW / n;
  const barW = Math.min(64, groupW*0.64);
  const bars=[];

  for(let i=0;i<n;i++){
    const v = values[i];
    const bh = (v/maxV)*plotH;
    const x = pad.l + i*groupW + (groupW-barW)/2;
    const y = pad.t + plotH - bh;

    ctx.fillStyle = colors[i] || "rgba(120,140,170,.60)";
    drawRoundedBar(ctx, x,y,barW,bh,7);

    if(cfg.outlineIdx===i){
      ctx.strokeStyle="rgba(0,0,0,.22)";
      ctx.lineWidth=2;
      ctx.stroke();
    }

    bars.push({x,y,w:barW,h:bh,label:labels[i],value:v});

    const t = labels[i].length>18 ? labels[i].slice(0,16)+"…" : labels[i];
    const isRiseLabel = (t === "RISE" || labels[i] === "RISE");
    ctx.fillStyle="rgba(11,16,32,.85)";
    ctx.font=(isRiseLabel?"700 ":"500 ")+"11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign="center"; ctx.textBaseline="top";
    ctx.fillText(t, pad.l + i*groupW + groupW/2, pad.t+plotH+12);
  }

  if(cfg.title){
    ctx.fillStyle="rgba(11,16,32,.92)";
    ctx.font="700 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillText(cfg.title, pad.l, 6);
  }

  function hit(mx,my){
    for(const b of bars){
      if(mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h) return b;
    }
    return null;
  }
  function showTip(b,mx,my){
    if(!tip) return;
    const yv = cfg.yFmt ? cfg.yFmt(b.value) : b.value;
    tip.innerHTML = `<b>${b.label}</b><br/>${cfg.tipLabel||""} <b>${yv}</b>`;
    tip.classList.add("on");
    tip.style.left = clamp(mx+14, 8, W-260) + "px";
    tip.style.top  = clamp(my-16, 8, H-80) + "px";
  }
  function hideTip(){ if(tip) tip.classList.remove("on"); }

  canvas.onmousemove = (e)=>{
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const b = hit(mx,my);
    if(b) showTip(b,mx,my); else hideTip();
  };
  canvas.onmouseleave = hideTip;

  return ()=>drawBarChartPerBar(cfg);
}
function drawGroupedBarChart(cfg){
  const canvas = q(cfg.canvas);
  if(!canvas) return ()=>{};
  const wrap = canvas.parentElement;
  const tip = wrap.querySelector(".tooltip");
  const {ctx, W, H} = canvasSetup(canvas);
  const pad = {l:64, r:18, t:18, b:54};
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const labels = cfg.labels;
  const series = cfg.series;
  const n = labels.length, m = series.length;

  let maxV = 0;
  for(const s of series) for(const v of s.values) maxV = Math.max(maxV, v);
  const isPercentAxis = !!(cfg.yFmt && String(cfg.yFmt(1)).includes("%"));
  if(cfg.max!=null) {
    maxV = cfg.max;
  } else {
    maxV = isPercentAxis ? 100 : 10;
  }

  ctx.clearRect(0,0,W,H);

  const ticks = cfg.ticks || 5;
  for(let i=0;i<=ticks;i++){
    const y = pad.t + plotH*(1 - i/ticks);
    ctx.strokeStyle="rgba(10,20,40,.10)";
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+plotW,y); ctx.stroke();

    const v = maxV * (i/ticks);
    ctx.fillStyle="rgba(75,85,101,.85)";
    ctx.font="11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign="right"; ctx.textBaseline="middle";
    ctx.fillText(cfg.yFmt?cfg.yFmt(v):v.toFixed(0), pad.l-10, y);
  }

  ctx.strokeStyle="rgba(11,16,32,.60)";
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t+plotH); ctx.lineTo(pad.l+plotW, pad.t+plotH); ctx.stroke();

  const groupW = plotW / n;
  const barW = Math.min(28, groupW/(m+0.8));
  const gap = Math.max(6, (groupW - barW*m)/2);

  const bars=[];
  for(let i=0;i<n;i++){
    const gx = pad.l + i*groupW;
    for(let j=0;j<m;j++){
      const s = series[j];
      const v = s.values[i];
      const bh = (v/maxV)*plotH;
      const x = gx + gap + j*barW;
      const y = pad.t + plotH - bh;
      ctx.fillStyle=s.color;
      drawRoundedBar(ctx, x,y,barW*0.92,bh,6);
      bars.push({x,y,w:barW*0.92,h:bh,label:labels[i],series:s.name,value:v});
    }
    const t = labels[i].length>18 ? labels[i].slice(0,16)+"…" : labels[i];
    const isRiseLabel = (t === "RISE" || labels[i] === "RISE");
    ctx.fillStyle="rgba(11,16,32,.85)";
    ctx.font=(isRiseLabel?"700 ":"500 ")+"11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign="center"; ctx.textBaseline="top";
    ctx.fillText(t, pad.l + i*groupW + groupW/2, pad.t+plotH+12);
  }

  if(cfg.title){
    ctx.fillStyle="rgba(11,16,32,.92)";
    ctx.font="700 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillText(cfg.title, pad.l, 6);
  }

  function hit(mx,my){
    for(const b of bars){
      if(mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h) return b;
    }
    return null;
  }
  function showTip(b,mx,my){
    if(!tip) return;
    const yv = cfg.yFmt ? cfg.yFmt(b.value) : b.value;
    tip.innerHTML = `<b>${b.label}</b><br/>${b.series}: <b>${yv}</b>`;
    tip.classList.add("on");
    tip.style.left = clamp(mx+14, 8, W-260) + "px";
    tip.style.top  = clamp(my-16, 8, H-80) + "px";
  }
  function hideTip(){ if(tip) tip.classList.remove("on"); }

  canvas.onmousemove = (e)=>{
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const b = hit(mx,my);
    if(b) showTip(b,mx,my); else hideTip();
  };
  canvas.onmouseleave = hideTip;

  return ()=>drawGroupedBarChart(cfg);
}

function setupCharts(){
  const C = window.__RISE_CHARTS__;
  if(!C) return;

  const metricSel = q("#resMetric");
  const legend = q("#mainLegend");

  const simplifyMethod = (name)=>{
    if(name.includes("RISE")) return "RISE";
    if(name.includes("RECAP")) return "RECAP";
    if(name.includes("DAgger")) return "DAgger";
    if(name.includes("PPO")) return "PPO";
    if(name.includes("DSRL")) return "DSRL";
    if(name.includes("π0.5") || name.includes("pi0.5")) return "π0.5";
    return name;
  };

  const TASKS = ["Dynamic Brick Sorting", "Backpack Packing", "Box Closing"];
  const TASK_CANVAS = {
    "Dynamic Brick Sorting": "#mainChartBrick",
    "Backpack Packing": "#mainChartBackpack",
    "Box Closing": "#mainChartBox",
  };

  function renderMainAll(){
    const metric = metricSel.value;

    // Legend stays shared.
    legend.innerHTML = `
      <div class="item"><span class="swatch" style="background: rgba(120,140,170,.55)"></span> Baselines</div>
      <div class="item"><span class="swatch" style="background: rgba(91,124,250,.88)"></span> RISE</div>
    `;

    for(const task of TASKS){
      const data = C.main[task];
      if(!data) continue;
      const labels = data.methods.map(simplifyMethod);

      let values, yFmt, title, tipLabel;
      if(metric==="succ"){
        values = data.succ.slice();
        yFmt = (v)=>v.toFixed(0)+"%";
        title = `${task}: Success (%)`;
        tipLabel = "Success:";
      }else{
        values = data.score.slice();
        yFmt = (v)=>v.toFixed(2);
        title = `${task}: Score`;
        tipLabel = "Score:";
      }

      const outlineIdx = labels.findIndex(x=>x.includes("RISE"));
      const colors = labels.map(m=> m.includes("RISE") ? "rgba(91,124,250,.88)" : "rgba(120,140,170,.55)");
      const chartMax = (metric==="succ") ? 100 : null;
      drawBarChartPerBar({canvas: TASK_CANVAS[task], labels, values, colors, outlineIdx, yFmt, title, tipLabel, max: chartMax});
    }
  }

  metricSel.onchange = renderMainAll;
  renderMainAll();

  const r1 = drawGroupedBarChart({
    canvas:"#ablationOffline",
    title:"Ablation: Offline data ratio",
    labels: C.offline_ratio.ratio.map(r=>`ratio ${r}`),
    series:[
      {name:"Pick&Place Succ.(%)", values:C.offline_ratio.pick, color:"rgba(91,124,250,.72)"},
      {name:"Sort Acc.(%)", values:C.offline_ratio.sort, color:"rgba(168,85,247,.55)"},
      {name:"Complete Succ.(%)", values:C.offline_ratio.comp, color:"rgba(120,140,170,.55)"},
    ],
    yFmt:(v)=>v.toFixed(0)+"%",
    ticks:5,
    boldLabels:["ratio 0.6"]
  });

  const r2 = drawGroupedBarChart({
    canvas:"#ablationOnline",
    title:"Ablation: Online action/state integration",
    labels: C.online_integration.labels,
    series:[
      {name:"Pick&Place Succ.(%)", values:C.online_integration.pick, color:"rgba(91,124,250,.72)"},
      {name:"Sort Acc.(%)", values:C.online_integration.sort, color:"rgba(168,85,247,.55)"},
      {name:"Complete Succ.(%)", values:C.online_integration.comp, color:"rgba(120,140,170,.55)"},
    ],
    yFmt:(v)=>v.toFixed(0)+"%",
    ticks:5,
    boldLabels:["(✓,✓)"]
  });

  let t=null;
  window.addEventListener("resize", ()=>{
    clearTimeout(t);
    t=setTimeout(()=>{
      renderMainAll(); r1(); r2();
    }, 120);
  }, {passive:true});
}

window.addEventListener("load", ()=>{
  setupProgressBar();
  setupCopyButtons();
  setupCharts();
});

/* ===== Hero video interactions ===== */
function setupHeroVideo(){
  const topbar = document.querySelector(".topbar");
  const heroVid = document.querySelector("#heroVideo");
  const muteBtn = document.querySelector("#muteBtn");
  const downBtn = document.querySelector("#downBtn");

  const onScroll=()=>{
    const y = window.scrollY || 0;
    if(topbar) topbar.classList.toggle("scrolled", y>20);
  };
  window.addEventListener("scroll", onScroll, {passive:true});
  window.addEventListener("load", onScroll);

  if(heroVid && muteBtn){
    const syncLabel=()=>{
      muteBtn.textContent = heroVid.muted ? "🔇 Muted" : "🔊 Sound";
    };
    muteBtn.addEventListener("click", ()=>{
      heroVid.muted = !heroVid.muted;
      if(!heroVid.muted){
        heroVid.volume = 0.6;
        heroVid.play().catch(()=>{});
      }
      syncLabel();
    });
    syncLabel();
  }
  if(downBtn){
    downBtn.addEventListener("click", ()=>{
      const target = document.querySelector("#demos") || document.querySelector("main");
      if(target) target.scrollIntoView({behavior:"smooth"});
    });
  }
}
window.addEventListener("load", ()=>{
  try{ setupHeroVideo(); }catch(e){}
});

/* ===== Parallax hero: scale/dim video + fade text + hide title ===== */
function setupParallaxHero(){
  const hero = document.querySelector(".hero-video");
  const vid = document.querySelector("#heroVideo");
  const dim = document.querySelector("#heroDim");
  const overlay = document.querySelector("#heroOverlay");
  const title = document.querySelector("#heroTitle");
  const subtitle = document.querySelector("#heroSubtitle");
  const meta = document.querySelector("#heroMeta");
  const links = document.querySelector("#heroLinks");
  const actions = document.querySelector("#heroActions");

  if(!hero || !vid) return;

  let ticking=false;
  const update=()=>{
    ticking=false;
    const rect = hero.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const denom = Math.max(1, rect.height - 0.35*vh);
    const p = Math.min(1, Math.max(0, (-rect.top) / denom));

    const s = 1 + 0.06 * p;
    vid.style.transform = "scale(" + s.toFixed(4) + ")";

    if(dim){
      const a = 0.02 + 0.35*p;
      dim.style.background = "rgba(0,0,0," + a.toFixed(3) + ")";
    }

    const op = Math.max(0, 1 - 1.05*p);
    const ty = 10*p;
    if(overlay){
      overlay.style.opacity = op.toFixed(3);
      overlay.style.transform = "translateY(" + ty.toFixed(1) + "px)";
    }

    if(title){
      if(p > 0.22) title.classList.add("hide-title");
      else title.classList.remove("hide-title");
    }
    const op2 = Math.max(0, 1 - 1.25*p);
    if(subtitle) subtitle.style.opacity = op2.toFixed(3);
    if(meta) meta.style.opacity = op2.toFixed(3);
    if(links) links.style.opacity = op2.toFixed(3);
    if(actions) actions.style.opacity = op2.toFixed(3);
  };

  const onScroll=()=>{
    if(!ticking){
      ticking=true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", onScroll, {passive:true});
  window.addEventListener("resize", onScroll, {passive:true});
  window.addEventListener("load", onScroll);
  onScroll();
}

/* ===== Interactive CWM module UI ===== */
function setupCWMInteractive(){
  const input = document.querySelector("#imgInput");
  const clearBtn = document.querySelector("#clearImgBtn");
  const preview = document.querySelector("#previewImg");
  const thumbs = document.querySelectorAll("#thumbGrid .thumb");
  const runBtn = document.querySelector("#runBtn");

  const steps = document.querySelectorAll(".stepper .step");
  const stepText = document.querySelector("#stepText");

  if(!preview || steps.length===0) return;

  const toySVG = (label)=>{
    const bg = ({blocks:"#f3f4f6",kitchen:"#fef3c7",factory:"#ecfeff",desk:"#ede9fe"})[label] || "#f3f4f6";
    const fg = "rgba(0,0,0,.55)";
    const s = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">' +
      '<rect width="100%" height="100%" fill="'+bg+'"/>' +
      '<rect x="70" y="90" width="420" height="360" rx="26" fill="rgba(255,255,255,.78)" stroke="rgba(0,0,0,.12)"/>' +
      '<rect x="540" y="130" width="590" height="90" rx="22" fill="rgba(255,255,255,.68)" stroke="rgba(0,0,0,.10)"/>' +
      '<rect x="540" y="250" width="590" height="90" rx="22" fill="rgba(255,255,255,.68)" stroke="rgba(0,0,0,.10)"/>' +
      '<rect x="540" y="370" width="590" height="90" rx="22" fill="rgba(255,255,255,.68)" stroke="rgba(0,0,0,.10)"/>' +
      '<text x="600" y="105" font-family="Arial" font-size="36" fill="'+fg+'" font-weight="800">'+label.toUpperCase()+' OBSERVATION</text>' +
      '<text x="280" y="280" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="26" fill="'+fg+'">input image</text>' +
      '<text x="835" y="190" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="22" fill="'+fg+'">proposal</text>' +
      '<text x="835" y="310" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="22" fill="'+fg+'">dynamics</text>' +
      '<text x="835" y="430" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="22" fill="'+fg+'">value</text>' +
      '</svg>';
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s)));
  };

  const setActiveThumb=(el)=>{
    thumbs.forEach(t=>t.classList.remove("active"));
    if(el) el.classList.add("active");
  };

  thumbs.forEach(t=>{
    t.addEventListener("click", ()=>{
      setActiveThumb(t);
      const key = t.getAttribute("data-thumb");
      preview.src = toySVG(key);
    });
  });

  if(input){
    input.addEventListener("change", ()=>{
      const f = input.files && input.files[0];
      if(!f) return;
      setActiveThumb(null);
      const url = URL.createObjectURL(f);
      preview.src = url;
    });
  }

  if(clearBtn){
    clearBtn.addEventListener("click", ()=>{
      if(input) input.value="";
      setActiveThumb(null);
    });
  }

  const texts = [
    "<b>Proposal:</b> the policy proposes candidate action chunks given the current observation and prompt.",
    "<b>Dynamics:</b> a controllable model predicts multi-view futures conditioned on candidate actions.",
    "<b>Value:</b> a progress/TD value model evaluates imagined outcomes to produce dense learning signals.",
    "<b>Advantage:</b> advantages computed from value guide policy improvement in a closed-loop."
  ];

  function selectStep(i){
    steps.forEach(s=>s.classList.remove("active"));
    const el = steps[i];
    if(el) el.classList.add("active");
    if(stepText) stepText.innerHTML = texts[i] || texts[0];
  }
  steps.forEach(s=>{
    s.addEventListener("click", ()=>{
      selectStep(parseInt(s.getAttribute("data-step")||"0",10));
    });
  });

  if(runBtn){
    runBtn.addEventListener("click", ()=>{
      let i=0;
      selectStep(0);
      const timer = setInterval(()=>{
        i++;
        if(i>=4){ clearInterval(timer); return; }
        selectStep(i);
      }, 650);
    });
  }
  selectStep(0);
}

window.addEventListener("load", ()=>{
  try{ setupParallaxHero(); }catch(e){}
  try{ setupCWMInteractive(); }catch(e){}
});


/* ---------------- Demo Rotator (scroll-driven 3-task focus) ---------------- */
function initDemoRotator(){
  const wrap = document.getElementById('demoRotatorWrap');
  const rot = document.getElementById('demoRotator');
  if(!wrap || !rot) return;
  const cards = [...rot.querySelectorAll('.demo-card')];
  if(cards.length < 3) return;

  let active = 0;
  let smoothP = 0;
  let targetP = 0;
  let ticking = false;
  let lastSwitchAt = 0;
  const COOLDOWN_MS = 920;
  const STEP_PROGRESS = 1/2;
  const WHEEL_THRESHOLD = 70;
  let wheelAccum = 0;
  let wheelVel = 0;
  let lastWheelTs = 0;
  let intentDir = 0;

  const apply = (idx, switching=false) => {
    active = Math.max(0, Math.min(2, idx));
    if(switching){
      rot.classList.add('is-switching');
      clearTimeout(rot._switchTid);
      rot._switchTid = setTimeout(()=>rot.classList.remove('is-switching'), 260);
    }
    cards.forEach((c,i)=>{
      c.classList.remove('is-active','is-left','is-right');
      if(i===active) c.classList.add('is-active');
      else if(i===(active+2)%3) c.classList.add('is-left');
      else c.classList.add('is-right');
    });
  };

  const progressFromScroll = () => {
    const rect = wrap.getBoundingClientRect();
    const total = Math.max(1, wrap.offsetHeight - window.innerHeight);
    return Math.max(0, Math.min(1, -rect.top / total));
  };

  const maybeStepByProgress = (p) => {
    // hysteresis window to avoid accidental double-switch
    const now = performance.now();
    if(now - lastSwitchAt < COOLDOWN_MS) return;
    const t01 = STEP_PROGRESS * 0.74;
    const t12 = STEP_PROGRESS + STEP_PROGRESS * 0.74;
    const b10 = STEP_PROGRESS * 0.26;
    const b21 = STEP_PROGRESS + STEP_PROGRESS * 0.26;

    if(active===0 && p > t01){ apply(1, true); lastSwitchAt = now; return; }
    if(active===1){
      if(p > t12){ apply(2, true); lastSwitchAt = now; return; }
      if(p < b10){ apply(0, true); lastSwitchAt = now; return; }
    }
    if(active===2 && p < b21){ apply(1, true); lastSwitchAt = now; return; }
  };

  const onWheel = (e) => {
    const r = wrap.getBoundingClientRect();
    if(r.bottom < 120 || r.top > window.innerHeight - 120) return;

    const now = performance.now();
    const dt = Math.max(8, now - (lastWheelTs || now));
    lastWheelTs = now;

    // weighted accumulation + velocity to emulate inertial intent
    wheelAccum = wheelAccum * 0.72 + e.deltaY;
    wheelVel = wheelVel * 0.75 + (e.deltaY / dt) * 32;

    // lock while cooldown to prevent accidental multi-step
    if(now - lastSwitchAt < COOLDOWN_MS){
      wheelAccum *= 0.55;
      wheelVel *= 0.55;
      return;
    }

    const mag = Math.abs(wheelAccum) + Math.abs(wheelVel) * 10;
    if(mag < WHEEL_THRESHOLD) return;

    const dir = (wheelAccum + wheelVel) > 0 ? 1 : -1;

    // require direction consistency once intent starts
    if(intentDir !== 0 && dir !== intentDir){
      wheelAccum *= 0.4;
      wheelVel *= 0.4;
      return;
    }
    intentDir = dir;

    const next = Math.max(0, Math.min(2, active + dir));
    if(next !== active){
      apply(next, true);
      lastSwitchAt = now;
      targetP = next * STEP_PROGRESS;
    }

    // reset after switch
    wheelAccum = 0;
    wheelVel = 0;
    setTimeout(()=>{ intentDir = 0; }, COOLDOWN_MS * 0.75);
  };

  const raf = () => {
    const pScroll = progressFromScroll();
    targetP = targetP * 0.86 + pScroll * 0.14;
    smoothP += (targetP - smoothP) * 0.085;
    maybeStepByProgress(smoothP);
    ticking = false;
  };

  const schedule = () => {
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(raf);
  };

  apply(0);
  targetP = progressFromScroll();
  smoothP = targetP;
  schedule();
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  window.addEventListener('wheel', onWheel, {passive:true});
}

window.addEventListener('load', ()=>{ try{ initDemoRotator(); }catch(e){} });
// 1. 初始化变量
const track = document.getElementById('track');
const originalCards = document.querySelectorAll('.carousel-card');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const gapPx = 15;

// 动态计算宽度百分比
function getCardWidthPercent() {
  return window.innerWidth < 768 ? 75 : 60;
}

// 2. 克隆卡片
const firstClone = originalCards[0].cloneNode(true);
const lastClone = originalCards[originalCards.length - 1].cloneNode(true);
track.appendChild(firstClone);
track.insertBefore(lastClone, originalCards[0]);

let allCards = document.querySelectorAll('.carousel-card');
let currentIndex = 1; 
let isTransitioning = false;

// 3. 核心切换函数
function switchSlide(direction) {
  if (isTransitioning) return;
  
  // 边界保护
  if (direction === 1 && currentIndex >= allCards.length - 1) return;
  if (direction === -1 && currentIndex <= 0) return;

  currentIndex += direction;
  isTransitioning = true;
  updateTrack(true);
  updateActive();
}

// === 4. 事件绑定 (暴力修复点击问题) ===

// 绑定点击
nextBtn.addEventListener('click', (e) => {
  e.preventDefault();
  switchSlide(1);
});
prevBtn.addEventListener('click', (e) => {
  e.preventDefault();
  switchSlide(-1);
});

// 绑定触摸结束 (针对部分安卓机)
// 为了防止 Click 和 Touchend 触发两次，我们加个简单的锁
let touchLock = false;
function handleTouchBtn(e, dir) {
  e.preventDefault(); // 防止触发后面的 click
  e.stopPropagation(); // 防止冒泡
  if(touchLock) return;
  
  switchSlide(dir);
  
  touchLock = true;
  setTimeout(() => { touchLock = false; }, 300);
}

nextBtn.addEventListener('touchend', (e) => handleTouchBtn(e, 1));
prevBtn.addEventListener('touchend', (e) => handleTouchBtn(e, -1));


// 5. 触摸滑动支持 (Swipe)
let touchStartX = 0;
track.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
track.addEventListener('touchend', e => {
  const touchEndX = e.changedTouches[0].screenX;
  if (touchEndX < touchStartX - 50) switchSlide(1);
  if (touchEndX > touchStartX + 50) switchSlide(-1);
}, {passive: true});


// 6. 无缝循环处理
track.addEventListener('transitionend', () => {
  isTransitioning = false;
  let targetIndex = -1;
  
  if (currentIndex === allCards.length - 1) targetIndex = 1;
  else if (currentIndex === 0) targetIndex = allCards.length - 2;

  if (targetIndex !== -1) {
    // 视频同步
    const v1 = allCards[currentIndex].querySelector('video');
    const v2 = allCards[targetIndex].querySelector('video');
    if (v1 && v2) v2.currentTime = v1.currentTime;

    // 瞬移
    track.classList.add('no-transition');
    allCards.forEach(c => c.classList.add('no-transition'));
    
    currentIndex = targetIndex;
    updateTrack(false);
    updateActive();

    void track.offsetHeight; // 强制重绘
    requestAnimationFrame(() => {
      track.classList.remove('no-transition');
      allCards.forEach(c => c.classList.remove('no-transition'));
    });
  }
});

// 7. 更新视图逻辑
function updateTrack(animate) {
  if (animate) track.style.transition = 'transform 0.4s ease-out';
  else track.style.transition = 'none';

  const wPercent = getCardWidthPercent();
  const centerOffset = (100 - wPercent) / 2;
  const val = `calc(${centerOffset}% - ${currentIndex} * (${wPercent}% + ${gapPx}px))`;
  track.style.transform = `translateX(${val})`;
}

function updateActive() {
  allCards.forEach((card, index) => {
    const v = card.querySelector('video');
    if (index === currentIndex) {
      card.classList.add('is-active');
      if (v) {
          v.muted = true;
          v.playsInline = true;
          v.play().catch(()=>{});
      }
    } else {
      card.classList.remove('is-active');
      if (v) v.pause();
    }
  });
}

// 初始化
updateTrack(false);
updateActive();
window.addEventListener('resize', () => updateTrack(false));