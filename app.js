/* =========================================================
   [APP.JS] Mi Netflix Personal (PÚBLICO)
   - Fuente: videos.json (todos ven lo mismo)
   - Admin real: editar videos.json + git push
   - Fix: cerrar modal detiene video/audio
   - Fix: evita listeners duplicados
   ========================================================= */

'use strict';

/* =========================
   [1] DOM
   ========================= */
const $ = (id) => document.getElementById(id);

const video = $('video');

const titleEl = $('title');
const videoLinkEl = $('videoLink');
const audioLinkEl = $('audioLink');
const libraryEl = $('library');

const btnSave = $('btnSave');
const btnLoad = $('btnLoad');
const btnPlayEs = $('btnPlayEs');
const btnPlayEn = $('btnPlayEn');
const btnDelete = $('btnDelete');

const adminPanel = $('adminPanel');
const btnOpenAdmin = $('btnOpenAdmin');
const btnCloseAdmin = $('btnCloseAdmin');

const grid = $('grid');
const empty = $('empty');
const search = $('search');

const modal = $('modal');
const modalTitle = $('modalTitle');
const modalSub = $('modalSub');
const btnCloseModal = $('btnCloseModal');
const btnModalEn = $('btnModalEn');
const btnModalEs = $('btnModalEs');

/* =========================
   [2] DATA (videos.json)
   ========================= */
let LIB = [];
let selectedIndex = null;

async function loadLibraryFromJson() {
  try {
    const res = await fetch('./videos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo leer videos.json');
    const data = await res.json();
    LIB = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
    LIB = [];
  }
}

/* =========================
   [3] RENDER
   ========================= */
function refreshSelect() {
  libraryEl.innerHTML = '';

  if (LIB.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '— Sin videos —';
    opt.value = '';
    libraryEl.appendChild(opt);
    selectedIndex = null;
    return;
  }

  LIB.forEach((it, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = it.title || `Item ${idx + 1}`;
    libraryEl.appendChild(opt);
  });

  if (selectedIndex === null) selectedIndex = 0;
  libraryEl.value = String(selectedIndex);
}

function fillInputsFromSelected() {
  const idx = libraryEl.value;
  if (idx === '' || !LIB[idx]) return;

  selectedIndex = Number(idx);
  titleEl.value = LIB[idx].title || '';
  videoLinkEl.value = LIB[idx].video || '';
  audioLinkEl.value = LIB[idx].audio || '';
}

function renderGrid() {
  const q = (search.value || '').trim().toLowerCase();

  const filtered = LIB
    .map((it, idx) => ({ ...it, idx }))
    .filter((it) => (it.title || '').toLowerCase().includes(q));

  grid.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.idx = String(item.idx);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    if (item.poster) {
      thumb.style.backgroundImage = `url('${item.poster}')`;
      thumb.style.backgroundSize = 'cover';
      thumb.style.backgroundPosition = 'center';
      thumb.style.height = '160px';
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const t = document.createElement('p');
    t.className = 'card-title';
    t.textContent = item.title || 'Sin nombre';

    const badges = document.createElement('div');
    badges.className = 'badges';

    const badgeVideo = document.createElement('span');
    badgeVideo.className = 'badge';
    badgeVideo.textContent = (item.video || '').includes('.m3u8') ? 'HLS' : 'LINK';

    const badgeAudio = document.createElement('span');
    badgeAudio.className = 'badge';
    badgeAudio.textContent = item.audio ? 'ES ✓' : 'ES —';

    badges.appendChild(badgeVideo);
    badges.appendChild(badgeAudio);

    body.appendChild(t);
    body.appendChild(badges);

    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener('click', () => {
      selectedIndex = item.idx;
      refreshSelect();
      fillInputsFromSelected();
      openModalAndPlayEnglish();
    });

    grid.appendChild(card);
  });
}

/* =========================
   [4] PLAYER: HLS + AUDIO ES
   ========================= */
let hlsVideo = null;
let hlsAudio = null;
let audioEs = null;
let syncTimer = null;

// handlers (para poder removerlos y no duplicar)
let onVideoPlay = null;
let onVideoPause = null;
let onVideoSeeking = null;

function stopVideoHard() {
  try { video.pause(); } catch {}
  try {
    if (hlsVideo) { hlsVideo.destroy(); hlsVideo = null; }
  } catch {}
  video.removeAttribute('src');
  video.load();
}

function cleanupAudio() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }

  // remover listeners previos si existían
  if (onVideoPlay) video.removeEventListener('play', onVideoPlay);
  if (onVideoPause) video.removeEventListener('pause', onVideoPause);
  if (onVideoSeeking) video.removeEventListener('seeking', onVideoSeeking);
  onVideoPlay = onVideoPause = onVideoSeeking = null;

  if (audioEs) {
    try { audioEs.pause(); } catch {}
    audioEs.src = '';
    try { audioEs.load(); } catch {}
    audioEs = null;
  }

  if (hlsAudio) {
    try { hlsAudio.destroy(); } catch {}
    hlsAudio = null;
  }
}

function loadVideo() {
  const src = (videoLinkEl.value || '').trim();
  if (!src) return alert('Falta link del VIDEO.');

  // reset video
  stopVideoHard();

  if (window.Hls && Hls.isSupported() && src.includes('.m3u8')) {
    hlsVideo = new Hls({ enableWorker: true });
    hlsVideo.loadSource(src);
    hlsVideo.attachMedia(video);
  } else {
    video.src = src;
  }
}

function attachAudioEs() {
  const asrc = (audioLinkEl.value || '').trim();
  if (!asrc) return alert('Falta link del AUDIO español.');

  cleanupAudio();

  audioEs = new Audio();
  audioEs.preload = 'auto';

  const isM3U8 = asrc.toLowerCase().includes('.m3u8');
  if (isM3U8 && window.Hls && Hls.isSupported()) {
    hlsAudio = new Hls({ enableWorker: true });
    hlsAudio.loadSource(asrc);
    hlsAudio.attachMedia(audioEs);
  } else {
    audioEs.src = asrc;
  }

  // crear handlers UNA vez (y guardarlos para remover luego)
  onVideoPlay = () => audioEs && audioEs.play().catch(() => {});
  onVideoPause = () => audioEs && audioEs.pause();
  onVideoSeeking = () => { if (audioEs) audioEs.currentTime = video.currentTime; };

  video.addEventListener('play', onVideoPlay);
  video.addEventListener('pause', onVideoPause);
  video.addEventListener('seeking', onVideoSeeking);

  // re-sync suave
  syncTimer = setInterval(() => {
    if (!audioEs || video.paused) return;
    const drift = Math.abs((audioEs.currentTime || 0) - (video.currentTime || 0));
    if (drift > 0.25) audioEs.currentTime = video.currentTime;
  }, 1000);
}

async function playSpanish() {
  if (!video.src && !hlsVideo) loadVideo();
  attachAudioEs();
  video.muted = true;

  try { await video.play(); } catch {}
  try {
    audioEs.currentTime = video.currentTime;
    await audioEs.play();
    modalSub.textContent = 'Audio: Español (externo)';
  } catch {
    alert('Audio bloqueado: haz clic otra vez en Español.');
  }
}

async function playEnglish() {
  cleanupAudio();
  video.muted = false;
  if (!video.src && !hlsVideo) loadVideo();
  try { await video.play(); } catch {}
  modalSub.textContent = 'Audio: Inglés (original)';
}

/* =========================
   [5] MODAL
   ========================= */
function openModal() {
  modal.classList.remove('hidden');
  modalTitle.textContent = titleEl.value || 'Reproduciendo...';
  modalSub.textContent = 'Audio: Inglés (original)';
}

function closeModal() {
  // cerrar UI
  modal.classList.add('hidden');

  // detener todo para que NO siga sonando ni se quede pegado
  cleanupAudio();
  stopVideoHard();
}

function openModalAndPlayEnglish() {
  openModal();
  loadVideo();
  playEnglish();
}

/* =========================
   [6] EVENTS
   ========================= */
btnOpenAdmin.addEventListener('click', () => adminPanel.classList.remove('hidden'));
btnCloseAdmin.addEventListener('click', () => adminPanel.classList.add('hidden'));

btnCloseModal.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

btnModalEn.addEventListener('click', playEnglish);
btnModalEs.addEventListener('click', playSpanish);

btnLoad.onclick = () => { loadVideo(); openModal(); };
btnPlayEs.onclick = () => { openModal(); playSpanish(); };
btnPlayEn.onclick = () => { openModal(); playEnglish(); };

// Admin sin backend
btnSave.onclick = () => alert('Para agregar: edita videos.json y haz git push (GitHub Pages es estático).');
btnDelete.onclick = () => alert('Para eliminar: borra el item en videos.json y haz git push.');

libraryEl.addEventListener('change', () => {
  fillInputsFromSelected();
});

search.addEventListener('input', renderGrid);

// tecla ESC cierra modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

/* =========================
   [INIT]
   ========================= */
(async function init() {
  await loadLibraryFromJson();
  refreshSelect();
  fillInputsFromSelected();
  renderGrid();
})();