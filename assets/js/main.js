/* Interactive site script (nav + modal + charts) */

const q = (s, el=document)=>el.querySelector(s);
const qa = (s, el=document)=>[...el.querySelectorAll(s)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

/* Active nav - Enhanced */
function setupActiveNav(){
  const sections = qa("section[id]");
  const navLinks = qa(".nav a[href^='#']");
  
  function updateActiveNav(){
    const y = window.scrollY + 160;
    let current = '';
    
    sections.forEach(sec => {
      const sectionTop = sec.offsetTop;
      const sectionHeight = sec.clientHeight;
      if(y >= sectionTop - 100 && y < sectionTop + sectionHeight){
        current = sec.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      if(link.getAttribute('href') === '#' + current){
        link.classList.add('active');
      }
    });
  }
  
  window.addEventListener("scroll", updateActiveNav, {passive:true});
  updateActiveNav();
}

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

  // Animation support
  if(!canvas._animProgress) canvas._animProgress = 0;
  const animProgress = canvas._animProgress;

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
    const bhFull = (v/maxV)*plotH;
    const bh = bhFull * animProgress; // Apply animation progress
    const x = pad.l + i*groupW + (groupW-barW)/2;
    const y = pad.t + plotH - bh;

    ctx.fillStyle = colors[i] || "rgba(120,140,170,.60)";
    drawRoundedBar(ctx, x,y,barW,bh,7);

    if(cfg.outlineIdx===i){
      ctx.strokeStyle="rgba(0,0,0,.22)";
      ctx.lineWidth=2;
      ctx.stroke();
    }
    
    // Draw data label on top of bar (only if animation is near complete)
    if(animProgress > 0.7 && bh > 20){
      const labelText = cfg.yFmt ? cfg.yFmt(v) : v.toFixed(0);
      ctx.fillStyle = "rgba(0,0,0,.85)";
      ctx.font = "700 11px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(labelText, x + barW/2, y - 4);
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

  // Animation support
  if(!canvas._animProgress) canvas._animProgress = 0;
  const animProgress = canvas._animProgress;

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
      const bhFull = (v/maxV)*plotH;
      const bh = bhFull * animProgress; // Apply animation progress
      const x = gx + gap + j*barW;
      const y = pad.t + plotH - bh;
      ctx.fillStyle=s.color;
      drawRoundedBar(ctx, x,y,barW*0.92,bh,6);
      
      // Draw data label on grouped bars
      if(animProgress > 0.7 && bh > 15){
        const labelText = cfg.yFmt ? cfg.yFmt(v) : v.toFixed(0);
        ctx.fillStyle = "rgba(0,0,0,.75)";
        ctx.font = "600 9px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(labelText, x + barW*0.92/2, y - 3);
      }
      
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

      let values, yFmt, tipLabel, htmlTitle;
      if(metric==="succ"){
        values = data.succ.slice();
        yFmt = (v)=>v.toFixed(0)+"%";
        htmlTitle = `${task}: Success (%)`;
        tipLabel = "Success:";
      }else{
        values = data.score.slice();
        yFmt = (v)=>v.toFixed(2);
        htmlTitle = `${task}: Score`;
        tipLabel = "Score:";
      }

      // Update HTML title (h4 above canvas)
      const canvasId = TASK_CANVAS[task].replace('#', '');
      const canvasEl = document.getElementById(canvasId);
      if(canvasEl){
        // Find parent div, then find the h4 sibling before canvas-wrap
        const parentDiv = canvasEl.closest('.canvas-wrap').parentElement;
        const h4 = parentDiv.querySelector('h4');
        if(h4){
          h4.textContent = htmlTitle;
        }
      }

      const outlineIdx = labels.findIndex(x=>x.includes("RISE"));
      const colors = labels.map(m=> m.includes("RISE") ? "rgba(91,124,250,.88)" : "rgba(120,140,170,.55)");
      const chartMax = (metric==="succ") ? 100 : null;
      // Remove 'title' parameter to hide chart internal title
      drawBarChartPerBar({canvas: TASK_CANVAS[task], labels, values, colors, outlineIdx, yFmt, tipLabel, max: chartMax});
    }
  }

  // Initialize charts with progress 0 (invisible bars)
  for(const task of TASKS){
    const canvasEl = q(TASK_CANVAS[task]);
    if(canvasEl) canvasEl._animProgress = 0;
  }
  const ablOffline = q("#ablationOffline");
  const ablOnline = q("#ablationOnline");
  if(ablOffline) ablOffline._animProgress = 0;
  if(ablOnline) ablOnline._animProgress = 0;

  metricSel.onchange = renderMainAll;
  renderMainAll();
  
  // Store redraw functions
  const r1 = drawGroupedBarChart({
    canvas:"#ablationOffline",
    // title removed - now in HTML h4
    labels: C.offline_ratio.ratio.map(r=>`ratio ${r}`),
    series:[
      {name:"Sort Success Rate", values:C.offline_ratio.sort, color:"rgba(91,124,250,.72)"},
      {name:"Pick&Place Success Rate", values:C.offline_ratio.pick, color:"rgba(168,85,247,.55)"},
      {name:"Complete Success Rate", values:C.offline_ratio.comp, color:"rgba(120,140,170,.55)"},
    ],
    yFmt:(v)=>v.toFixed(0)+"%",
    ticks:5,
    boldLabels:["ratio 0.6"]
  });

  const r2 = drawGroupedBarChart({
    canvas:"#ablationOnline",
    // title removed - now in HTML h4
    labels: C.online_integration.labels,
    series:[
      {name:"Sort Success Rate", values:C.online_integration.sort, color:"rgba(91,124,250,.72)"},
      {name:"Pick&Place Success Rate", values:C.online_integration.pick, color:"rgba(168,85,247,.55)"},
      {name:"Complete Success Rate", values:C.online_integration.comp, color:"rgba(120,140,170,.55)"},
    ],
    yFmt:(v)=>v.toFixed(0)+"%",
    ticks:5,
    boldLabels:["(✓,✓)"]
  });
  
  // Initial draw with 0 progress (invisible bars)
  r1();
  r2();

  let t=null;
  window.addEventListener("resize", ()=>{
    clearTimeout(t);
    t=setTimeout(()=>{
      renderMainAll(); r1(); r2();
    }, 120);
  }, {passive:true});

  // Animation on scroll into view
  const animateChartOnScroll = (canvas) => {
    if(!canvas || canvas._animated) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting && !canvas._animated){
          canvas._animated = true;
          const duration = 800; // Animation duration in ms
          const startTime = performance.now();
          
          const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            
            canvas._animProgress = eased;
            
            // Redraw based on which chart type
            if(canvas.id === 'mainChartBrick' || canvas.id === 'mainChartBackpack' || canvas.id === 'mainChartBox'){
              renderMainAll();
            } else if(canvas.id === 'ablationOffline'){
              r1();
            } else if(canvas.id === 'ablationOnline'){
              r2();
            }
            
            if(progress < 1){
              requestAnimationFrame(animate);
            }
          };
          
          requestAnimationFrame(animate);
          observer.unobserve(canvas);
        }
      });
    }, {threshold: 0.2}); // Trigger when 20% of chart is visible
    
    observer.observe(canvas);
  };

  // Setup animation for all charts
  for(const task of TASKS){
    const canvasEl = q(TASK_CANVAS[task]);
    if(canvasEl) animateChartOnScroll(canvasEl);
  }
  animateChartOnScroll(q("#ablationOffline"));
  animateChartOnScroll(q("#ablationOnline"));
}

window.addEventListener("load", ()=>{
  setupProgressBar();
  setupCopyButtons();
  setupCharts();
  setupBackToTop();
  setupFadeInAnimations();
  setupActiveNav();
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
/* =========================================
   无缝轮播 (修复回滚时的卡片缩放闪烁问题)
   ========================================= */
function initCarousel() {
  const track = document.getElementById('track');
  if (!track) return;

  const originalCards = document.querySelectorAll('.carousel-card');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const gapPx = 15;

  // 1. 克隆首尾
  const firstClone = originalCards[0].cloneNode(true);
  const lastClone = originalCards[originalCards.length - 1].cloneNode(true);
  track.appendChild(firstClone);
  track.insertBefore(lastClone, originalCards[0]);

  let allCards = document.querySelectorAll('.carousel-card');
  let currentIndex = 1; 
  let isTransitioning = false;

  // 2. 动态获取宽度
  function getCardWidthPercent() {
    return window.innerWidth < 768 ? 75 : 60;
  }

  // 3. 更新轨道位置
  function updateTrack(animate) {
    if (animate) {
      track.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    } else {
      track.style.transition = 'none';
    }
    const wPercent = getCardWidthPercent();
    const centerOffset = (100 - wPercent) / 2;
    const val = `calc(${centerOffset}% - ${currentIndex} * (${wPercent}% + ${gapPx}px))`;
    track.style.transform = `translateX(${val})`;
  }

  // 4. 更新激活状态 (控制缩放和透明度)
  function updateActive() {
    allCards.forEach((card, index) => {
      const video = card.querySelector('video');
      
      if (index === currentIndex) {
        // 当前激活卡片
        card.classList.add('is-active');
        // 直接操作样式，保证优先级
        card.style.opacity = '1';
        card.style.transform = 'scale(1)'; 
        card.style.filter = 'blur(0)';
        card.style.zIndex = '10';
        if (video) video.play().catch(()=>{});
      } else {
        // 非激活卡片
        card.classList.remove('is-active');
        card.style.opacity = '0.4';
        card.style.transform = 'scale(0.9)';
        card.style.filter = 'blur(1px)';
        card.style.zIndex = '1';
        if (video) video.pause();
      }
    });
    
    // Update indicators
    updateIndicators();
  }
  
  // Update carousel indicators
  function updateIndicators(){
    const indicators = document.querySelectorAll('#carouselIndicators .indicator');
    // Map current index (1-3 with clones) to original (0-2)
    let realIndex = currentIndex - 1;
    if(realIndex < 0) realIndex = originalCards.length - 1;
    if(realIndex >= originalCards.length) realIndex = 0;
    
    indicators.forEach((ind, i) => {
      ind.classList.toggle('active', i === realIndex);
    });
  }
  
  // Click indicator to jump
  const indicators = document.querySelectorAll('#carouselIndicators .indicator');
  indicators.forEach((ind, i) => {
    ind.addEventListener('click', () => {
      if(isTransitioning) return;
      const targetIndex = i + 1; // +1 because of clone offset
      if(targetIndex !== currentIndex){
        currentIndex = targetIndex;
        isTransitioning = true;
        updateActive();
        updateTrack(true);
      }
    });
  });

  // 5. 切换逻辑
  function switchSlide(direction) {
    if (isTransitioning) return;
    currentIndex += direction;
    isTransitioning = true;
    
    updateActive(); // 先触发缩放动画
    updateTrack(true); // 再触发位移动画
  }

  // 6. 监听动画结束 (处理瞬间回滚 + 防止缩放闪烁)
  track.addEventListener('transitionend', () => {
    if (!isTransitioning) return;
    isTransitioning = false;

    let targetIndex = -1;
    // 检测是否到了边界
    if (currentIndex === allCards.length - 1) targetIndex = 1;
    else if (currentIndex === 0) targetIndex = allCards.length - 2;

    if (targetIndex !== -1) {
      // === 核心修复开始 ===
      
      // 1. 给所有卡片加上禁止动画类
      // 这步至关重要：防止从 scale(0.9) 变成 scale(1) 时播放动画
      allCards.forEach(c => c.classList.add('no-transition'));
      track.style.transition = 'none';

      // 2. 视频同步 (防止黑屏)
      const currentVideo = allCards[currentIndex].querySelector('video');
      const targetVideo = allCards[targetIndex].querySelector('video');
      if (currentVideo && targetVideo) {
        targetVideo.currentTime = currentVideo.currentTime;
        targetVideo.play().catch(()=>{});
      }

      // 3. 瞬间瞬移位置
      currentIndex = targetIndex;
      updateTrack(false);
      
      // 4. 瞬间强制应用激活样式 (因为加了 no-transition，这里会瞬间变大，不会有动画)
      updateActive();

      // 5. 强制浏览器重绘 (Force Reflow)
      // 告诉浏览器：“立刻把上面的变化渲染出来，不要等”
      void track.offsetHeight; 

      // 6. 恢复动画能力 (下一帧再移除锁，确保万无一失)
      requestAnimationFrame(() => {
        allCards.forEach(c => c.classList.remove('no-transition'));
        track.style.transition = ''; 
      });
      // === 核心修复结束 ===
    }
  });

  // 7. 事件绑定
  nextBtn.onclick = (e) => { e.preventDefault(); switchSlide(1); };
  prevBtn.onclick = (e) => { e.preventDefault(); switchSlide(-1); };

  // 手机滑动
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
  track.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (diff < -50) switchSlide(1);
    if (diff > 50) switchSlide(-1);
  }, {passive: true});

  // 初始化
  updateTrack(false);
  updateActive();
  updateIndicators();
  window.addEventListener('resize', () => updateTrack(false));
}

window.addEventListener('load', () => {
  try { initCarousel(); } catch(e) { console.error(e); }
});

/* ===== Back to Top Button ===== */
function setupBackToTop(){
  const btn = q('#backToTop');
  if(!btn) return;
  
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  window.addEventListener('scroll', () => {
    if(window.scrollY > 400){
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
    }
  }, {passive: true});
}

/* ===== Fade-in Animations on Scroll ===== */
function setupFadeInAnimations(){
  const elements = qa('.fade-in, .fade-in-section');
  if(elements.length === 0) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  elements.forEach(el => observer.observe(el));
}