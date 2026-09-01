const els = document.querySelectorAll('[data-reveal]');
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
els.forEach(el => io.observe(el));

document.getElementById('year').textContent = new Date().getFullYear();

const btn = document.querySelector('.menu-button');
const panel = document.querySelector('.mobile-panel');
btn?.addEventListener('click', () => {
  const open = panel.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
  panel.setAttribute('aria-hidden', String(!open));
});
panel?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  panel.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-hidden', 'true');
}));

// Lightweight hero parallax: the woman, headline and floating cards move at different rates.
const hero = document.getElementById('hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let ticking = false;
function updateParallax(){
  ticking = false;
  if (!hero || reduceMotion.matches) return;
  const rect = hero.getBoundingClientRect();
  const visible = rect.bottom > 0 && rect.top < window.innerHeight;
  if (!visible) return;
  const y = Math.max(0, Math.min(hero.offsetHeight, -rect.top));
  hero.style.setProperty('--hero-woman-y', `${y * 0.10}px`);
  hero.style.setProperty('--hero-text-y', `${y * -0.045}px`);
  hero.style.setProperty('--hero-card-left-y', `${y * -0.075}px`);
  hero.style.setProperty('--hero-card-right-y', `${y * 0.055}px`);
}
function requestParallax(){
  if (!ticking){ ticking = true; requestAnimationFrame(updateParallax); }
}
window.addEventListener('scroll', requestParallax, {passive:true});
window.addEventListener('resize', requestParallax);
requestParallax();

// Cursor parallax: the woman, headline and floating cards drift gently toward
// (or away from) the pointer. Desktop only, and eased so it feels weighted.
(function(){
  if (!hero || !window.matchMedia('(pointer:fine)').matches) return;
  const LAYERS = {
    woman: { x: 10, y: 6 },
    text:  { x: -8, y: -5 },
    cardl: { x: 14, y: 10 },
    cardr: { x: -12, y: -8 },
  };
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  function tick(){
    raf = 0;
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    for (const k in LAYERS){
      hero.style.setProperty('--mx-' + k, (cx * LAYERS[k].x).toFixed(2) + 'px');
      hero.style.setProperty('--my-' + k, (cy * LAYERS[k].y).toFixed(2) + 'px');
    }
    if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(tick);
  }
  function go(){ if (!raf) raf = requestAnimationFrame(tick); }
  window.addEventListener('pointermove', (e) => {
    if (reduceMotion.matches) return;
    const r = hero.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
    ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
    go();
  }, { passive: true });
})();

// Scroll-stepped sections (Method + Next Steps): the pinned block highlights one
// card/step at a time as the page scrolls; on mobile it drives a continuous rail
// (dots + dashed connector) rather than pinning, since there is no room to scrub.
function initScrollSteps(pinId, cardSelector){
  const pin = document.getElementById(pinId);
  if (!pin) return;
  const cards = Array.from(pin.querySelectorAll(cardSelector));
  if (!cards.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ticking = false;

  function setLineFills(progress){
    cards.forEach((card, i) => {
      const f = Math.max(0, Math.min(1, progress * cards.length - i));
      const out = card.querySelector('.jline-out');
      if (out) out.style.setProperty('--line-fill', f);
      const next = cards[i + 1];
      const nextIn = next && next.querySelector('.jline-in');
      if (nextIn) nextIn.style.setProperty('--line-fill', f);
    });
  }

  function update(){
    ticking = false;
    if (reduceMotion.matches){
      cards.forEach(card => card.classList.add('is-done'));
      setLineFills(1);
      return;
    }
    if (window.innerWidth <= 1050){
      const center = window.innerHeight * 0.6;
      let step = -1;
      cards.forEach((card, i) => {
        if (card.getBoundingClientRect().top < center) step = i;
      });
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        card.classList.toggle('is-active', r.top < center && r.bottom > center);
        card.classList.toggle('is-done', i <= step);
      });
      return;
    }
    const rect = pin.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return;
    const progress = Math.max(0, Math.min(1, -rect.top / total));
    const started = rect.top < 0;
    const step = started ? Math.min(cards.length - 1, Math.floor(progress * cards.length)) : -1;
    cards.forEach((card, i) => {
      card.classList.toggle('is-active', i === step);
      card.classList.toggle('is-done', step >= 0 && i <= step);
    });
    setLineFills(started ? progress : 0);
  }
  function request(){ if (!ticking){ ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, {passive:true});
  window.addEventListener('resize', request);
  update();
}
initScrollSteps('journeyPin', '.journey-card');
initScrollSteps('stepsPin', '.timeline article');

// ---------------------------------------------------------------------------
// Results carousel — JS driven so it always renders (no CSS-animation timing
// bug) and moves at a fixed, slow, predictable speed without needing hover.
// ---------------------------------------------------------------------------
const rmCarousel = (function(){
  const track = document.getElementById('rmTrack');
  const win = track && track.closest('.rm-window');
  if (!track || !win) return { pause(){}, resume(){} };

  const SPEED = 11;            // pixels per second — deliberately slow
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const kids = Array.from(track.children);
  const half = kids.length / 2;

  let loop = 0;                // width of one full (non duplicated) set
  let pos = 0;                 // float accumulator for scrollLeft
  let last = 0;
  let raf = 0;
  let holds = 0;               // >0 => auto-scroll suspended
  let idleTimer = 0;

  function measure(){
    if (!kids.length) return;
    const a = kids[0].offsetLeft;
    const b = kids[half] ? kids[half].offsetLeft : 0;
    let next = b - a;
    if (!next || next < 10){
      const r = kids[0].getBoundingClientRect();
      next = (r.width + 16) * half;
    }
    loop = next;
    pos = win.scrollLeft;
  }

  function step(now){
    raf = 0;
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!holds && loop > 0){
      pos += SPEED * dt;
      if (pos >= loop) pos -= loop;
      win.scrollLeft = pos;
    }
    schedule();
  }

  function schedule(){
    if (raf || reduce.matches) return;
    raf = requestAnimationFrame(step);
  }

  function pause(){ holds++; }
  function resume(){ holds = Math.max(0, holds - 1); last = 0; pos = win.scrollLeft; }

  // While the visitor scrolls/drags the strip by hand, stand down for a moment
  // and pick the loop back up from wherever they left it.
  function handOver(){
    holds = holds || 0;
    clearTimeout(idleTimer);
    if (!win._userHold){ win._userHold = true; pause(); }
    idleTimer = setTimeout(() => {
      if (win._userHold){ win._userHold = false; resume(); }
    }, 1600);
  }
  ['wheel','touchstart','pointerdown','keydown'].forEach(ev => {
    win.addEventListener(ev, handOver, { passive:true });
  });

  // Keep manual scrolling inside the duplicated range so it never hits an end.
  win.addEventListener('scroll', () => {
    if (!loop) return;
    if (win.scrollLeft >= loop * 2 - 2) win.scrollLeft -= loop;
    else if (win.scrollLeft <= 0) win.scrollLeft += loop;
    if (win._userHold) pos = win.scrollLeft;
  }, { passive:true });

  // Mouse drag (desktop) — native touch scrolling already covers phones.
  let down = false, startX = 0, startScroll = 0, moved = 0;
  win.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || (e.button != null && e.button !== 0)) return;
    down = true; moved = 0; startX = e.clientX; startScroll = win.scrollLeft;
  });
  win.addEventListener('pointermove', (e) => {
    if (!down) return;
    const d = e.clientX - startX;
    if (Math.abs(d) > moved) moved = Math.abs(d);
    if (moved > 4){ win.scrollLeft = startScroll - d; handOver(); }
  });
  function up(){
    if (!down) return;
    down = false;
    if (moved > 6){
      win.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture:true, once:true });
    }
  }
  win.addEventListener('pointerup', up);
  win.addEventListener('pointercancel', up);
  win.addEventListener('pointerleave', up);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else resume();
  });

  // Re-measure aggressively: this is what stops the strip from coming up blank
  // until a manual page refresh.
  function refresh(){ measure(); schedule(); }
  refresh();
  window.addEventListener('load', refresh);
  window.addEventListener('pageshow', refresh);
  Array.from(track.querySelectorAll('img')).forEach(img => {
    if (img.complete) return;
    img.addEventListener('load', measure, { once:true });
    img.addEventListener('error', measure, { once:true });
  });
  if (window.ResizeObserver){
    let first = true;
    new ResizeObserver(() => { if (first){ first = false; return; } measure(); }).observe(track);
  }
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
  [300, 900, 2000].forEach(t => setTimeout(refresh, t));

  return { pause, resume };
})();

// ---------------------------------------------------------------------------
// Lightbox with gallery navigation: arrows, keyboard and touch swipe.
// ---------------------------------------------------------------------------
(function(){
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  const img = document.getElementById('lightboxImg');
  const tag = document.getElementById('lightboxTag');
  const count = document.getElementById('lightboxCount');
  const figure = document.getElementById('lightboxFigure');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  const galleries = {};
  const triggers = Array.from(document.querySelectorAll('button[data-full]'));

  triggers.forEach(btn => {
    const host = btn.closest('[data-gallery]');
    const name = host ? host.dataset.gallery : 'single';
    const list = galleries[name] || (galleries[name] = []);
    // skip the duplicated marquee clones so each image appears once
    if (btn.getAttribute('aria-hidden') === 'true') { btn._gallery = name; return; }
    btn._gallery = name;
    btn._index = list.length;
    list.push({ src: btn.dataset.full, tag: btn.dataset.tag || '' });
  });

  let current = [];
  let at = 0;

  function render(){
    const item = current[at];
    if (!item) return;
    lightbox.classList.add('is-swapping');
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      img.src = item.src;
      img.alt = item.tag;
      tag.textContent = item.tag;
      count.textContent = current.length > 1 ? (at + 1) + ' / ' + current.length : '';
      lightbox.classList.remove('is-swapping');
    };
    pre.src = item.src;
  }

  function preload(){
    [at - 1, at + 1].forEach(i => {
      const item = current[(i + current.length) % current.length];
      if (item) { const p = new Image(); p.src = item.src; }
    });
  }

  function go(step){
    if (current.length < 2) return;
    at = (at + step + current.length) % current.length;
    render();
    preload();
  }

  function open(list, index){
    current = list;
    at = index;
    lightbox.dataset.single = current.length > 1 ? 'false' : 'true';
    render();
    preload();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    rmCarousel.pause();
  }

  function close(){
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    rmCarousel.resume();
  }

  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      const list = galleries[btn._gallery] || [];
      let index = btn._index;
      if (index == null){
        index = Math.max(0, list.findIndex(o => o.src === btn.dataset.full));
      }
      if (list.length) open(list, index);
      else open([{ src: btn.dataset.full, tag: btn.dataset.tag || '' }], 0);
    });
  });

  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); go(1); });
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target === figure) close(); });
  window.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  });

  // Swipe support
  let sx = 0, sy = 0, sw = false;
  figure.addEventListener('pointerdown', (e) => { sw = true; sx = e.clientX; sy = e.clientY; });
  figure.addEventListener('pointerup', (e) => {
    if (!sw) return;
    sw = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  });
  figure.addEventListener('pointercancel', () => { sw = false; });
  let tx = 0, ty = 0;
  figure.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive:true });
  figure.addEventListener('touchend', (e) => {
    if (!e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }, { passive:true });
})();

// ---------------------------------------------------------------------------
// WHO WE ARE — exploded-view storytelling.
// The film is scrubbed by the scroll position while each block of copy rises
// on its own beat, timed so the lead paragraph lands on the photographer shot
// and the closing paragraph finishes just before the last frame.
// ---------------------------------------------------------------------------
(function(){
  const pin = document.getElementById('missionPin');
  const stage = pin && pin.querySelector('.mission-stage');
  const video = document.getElementById('missionVideo');
  const bar = document.getElementById('missionBar');
  if (!pin || !stage || !video) return;

  const media = stage.querySelector('.mission-media');
  const copy = document.getElementById('missionCopy');
  const after = document.getElementById('missionAfter');
  const tail = stage.querySelector('.mission-text');
  let steps = [];
  // wide: four beats inside the pinned stage.
  // stacked: only three fit on screen — the closing paragraph is moved below
  // the pin and simply fades in as you keep scrolling.
  const RANGES_WIDE = [[0.02, 0.13], [0.16, 0.38], [0.42, 0.63], [0.67, 0.90]];
  const RANGES_TALL = [[0.03, 0.16], [0.20, 0.48], [0.56, 0.85]];
  const VIDEO_SPAN = 0.94;          // film is finished a little before the pin ends
  // Anchor: when the lead paragraph lands (p = 0.63) the film must be on the
  // photographer shot with the team looking into the lens — 4.7s in.
  const ANCHOR_P = 0.63, ANCHOR_T = 3.2;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reduce.matches) return;       // copy stays visible, film stays on its poster

  stage.classList.add('mission-live');

  let duration = 0, ready = false, inView = false, unlocked = false, want = 0;

  video.addEventListener('loadedmetadata', () => {
    duration = video.duration || 0;
    ready = duration > 0;
    apply();
  });
  let dead = false;
  function giveUp(){
    if (dead) return;
    dead = true;
    stage.classList.remove('mission-live');
    steps.forEach(el => { el.style.opacity = ''; el.style.transform = ''; });
  }
  // <source> failures surface on the source element, not the video
  Array.from(video.querySelectorAll('source')).forEach((src, i, all) => {
    src.addEventListener('error', () => { if (i === all.length - 1) giveUp(); });
  });
  video.addEventListener('error', giveUp);

  function unlock(){
    if (unlocked) return;
    unlocked = true;
    const pr = video.play();
    if (pr && pr.then) pr.then(() => video.pause()).catch(() => {});
    else { try { video.pause(); } catch(_){} }
  }
  window.addEventListener('touchstart', unlock, { once:true, passive:true });
  window.addEventListener('scroll', unlock, { once:true, passive:true });
  window.addEventListener('pointerdown', unlock, { once:true, passive:true });

  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const ease = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
  const stacked = () => window.innerWidth <= 1050;

  // Park the closing paragraph inside or outside the pinned stage to match the
  // layout, so the same markup serves both compositions.
  let placedTall = null;
  function place(){
    const tall = stacked();
    if (tail && after && copy && placedTall !== tall){
      placedTall = tall;
      (tall ? after : copy).appendChild(tail);
      tail.style.opacity = '';
      tail.style.transform = '';
    }
    steps = Array.from(copy.querySelectorAll('.m-step'));
  }
  place();

  if (tail && window.IntersectionObserver){
    new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting && stacked()) tail.classList.add('is-in'); });
    }, { threshold: 0.15 }).observe(tail);
  }

  // How far through the section we are, 0 → 1.
  function progress(){
    const r = pin.getBoundingClientRect();
    const total = r.height - stage.offsetHeight;
    if (total <= 0) return 0;
    // Stacked: begin the story as soon as the film card is fully on screen,
    // while it is still rising from the bottom of the viewport.
    let head = 0;
    if (stacked() && media){
      head = Math.max(0, window.innerHeight - media.offsetHeight - 24);
    }
    return clamp((head - r.top) / (total + head));
  }

  function apply(){
    if (dead) return;
    place();
    const p = progress();
    const tall = stacked();
    const ranges = tall ? RANGES_TALL : RANGES_WIDE;
    const lift = tall ? 30 : 42;

    steps.forEach((el, i) => {
      const [a, b] = ranges[i] || [0, 1];
      const e = ease(clamp((p - a) / (b - a)));
      el.style.opacity = e;
      el.style.transform = 'translate3d(0,' + ((1 - e) * lift).toFixed(1) + 'px,0)';
    });

    if (ready){
      const ap = tall ? 0.85 : ANCHOR_P;
      const at = tall ? 4.4 : ANCHOR_T;
      const a = Math.min(0.98, at / duration);
      const f = p <= ap
        ? (p / ap) * a
        : a + (clamp((p - ap) / (VIDEO_SPAN - ap))) * (1 - a);
      want = clamp(f) * (duration - 0.05);
    }
    if (bar) bar.style.transform = 'scaleX(' + (ready && duration ? (want/duration).toFixed(3) : 0) + ')';
  }

  // Seek straight to the newest target and chain off 'seeked'. Queuing
  // intermediate seeks makes the painted frame lag behind the scroll; skipping
  // to the latest position keeps picture and copy locked together.
  function syncVideo(){
    if (!ready || dead) return;
    if (video.seeking) return;                       // 'seeked' will pick it up
    if (Math.abs(video.currentTime - want) < 0.015) return;
    try { video.currentTime = want; } catch(_){}
  }
  video.addEventListener('seeked', syncVideo);
  function schedule(){ syncVideo(); }

  let pending = false;
  function onScroll(){
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; apply(); schedule(); });
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll);

  if (window.IntersectionObserver){
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView){ unlock(); schedule(); }
    }, { rootMargin: '200px 0px' }).observe(pin);
  } else { inView = true; schedule(); }

  apply();
  window.addEventListener('load', () => { apply(); schedule(); });
})();
