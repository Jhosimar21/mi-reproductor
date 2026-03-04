'use strict';

/* =========================================================
   Mi Netflix Personal (GitHub Pages)
   - Todos ven lo mismo: videos.json
   - Tú como admin: editas videos.json + git add/commit/push
   - Modal cierra con X / clic fuera / ESC
   - Cerrar modal detiene video y audio externo
   ========================================================= */

/* ===== Helpers ===== */
const $ = (id) => document.getElementById(id);
const must = (id) => {
  const el = $(id);
  if (!el) console.error(`❌ Falta elemento con id="${id}" en el HTML`);
  return el;
};

/* ===== DOM ===== */
const video = must('video');

const titleEl = must('title');
const videoLinkEl = must('videoLink');
const audioLinkEl = must('audioLink');
const libraryEl = must('library');

const btnOpenAdmin = must('btnOpenAdmin');
const btnCloseAdmin = must('btnCloseAdmin');
const adminPanel = must('adminPanel');

const grid = must('grid');
const empty = must('empty');
const search = must('search');

const modal = must('modal');
const modalTitle = must('modalTitle');
const modalSub = must('modalSub');
const btnCloseModal = must('btnCloseModal');
const btnModalEn = must('btnModalEn');
const btnModalEs = must('btnModalEs');

const btnLoad = must('btnLoad');
const btnPlayEn = must('btnPlayEn');
const btnPlayEs = must('btnPlayEs');
const btnSave = must('btnSave');
const btnDelete = must('btnDelete');

/* ===== Data ===== */
let LIB = [];
let selectedIndex = null;

/* ===== Player state ===== */
let hlsVideo = null;
let hlsAudio = null;
let audioEs = null;
let syncTimer = null;

let onVideoPlay = null;
let onVideoPause = null;
let onVideoSeeking = null;

/* =========================================================
   DATA: cargar videos.json
   ========================================================= */
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

/* =========================================================
   RENDER
   ========================================================= */
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

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (item.poster) {
      thumb.style.backgroundImage = `url('${item.poster}')`;
      thumb.style.backgroundSize = 'cover';
      thumb.style.backgroundPosition = 'center';
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const t = document.createElement('p');
    t.className = 'card-title';
    t.textContent = item.title || 'Sin nombre';

    const badges = document.createElement('div');
    badges.className = 'badges';

    const b1 = document.createElement('span');
    b1.className = 'badge';
    b1.textContent = (item.video || '').includes('.m3u8') ? 'HLS' : 'LINK';

    const b2 = document.createElement('span');
    b2.className = 'badge';
    b2.textContent = item.audio ? 'ES ✓' : 'ES —';

    badges.appendChild(b1);
    badges.appendChild(b2);

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

/* =========================================================
   PLAYER
   ========================================================= */
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

  stopVideoHard();

  const isM3U8 = src.toLowerCase().includes('.m3u8');
  if (window.Hls && Hls.isSupported() && isM3U8) {
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
  if (window.Hls && Hls.isSupported() && isM3U8) {
    hlsAudio = new Hls({ enableWorker: true });
    hlsAudio.loadSource(asrc);
    hlsAudio.attachMedia(audioEs);
  } else {
    audioEs.src = asrc;
  }

  onVideoPlay = () => audioEs && audioEs.play().catch(() => {});
  onVideoPause = () => audioEs && audioEs.pause();
  onVideoSeeking = () => { if (audioEs) audioEs.currentTime = video.currentTime; };

  video.addEventListener('play', onVideoPlay);
  video.addEventListener('pause', onVideoPause);
  video.addEventListener('seeking', onVideoSeeking);

  syncTimer = setInterval(() => {
    if (!audioEs || video.paused) return;
    const drift = Math.abs((audioEs.currentTime || 0) - (video.currentTime || 0));
    if (drift > 0.25) audioEs.currentTime = video.currentTime;
  }, 1000);
}

async function playEnglish() {
  cleanupAudio();
  video.muted = false;
  if (!video.src && !hlsVideo) loadVideo();
  try { await video.play(); } catch {}
  modalSub.textContent = 'Audio: Inglés (original)';
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

/* =========================================================
   MODAL
   ========================================================= */
function openModal() {
  modal.classList.remove('hidden');
  modalTitle.textContent = titleEl.value || 'Reproduciendo...';
  modalSub.textContent = 'Audio: Inglés (original)';
}

function closeModal() {
  modal.classList.add('hidden');
  cleanupAudio();
  stopVideoHard();
}

function openModalAndPlayEnglish() {
  openModal();
  loadVideo();
  playEnglish();
}

/* =========================================================
   EVENTS
   ========================================================= */
btnOpenAdmin.addEventListener('click', () => adminPanel.classList.remove('hidden'));
btnCloseAdmin.addEventListener('click', () => adminPanel.classList.add('hidden'));

btnCloseModal.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

btnModalEn.addEventListener('click', playEnglish);
btnModalEs.addEventListener('click', playSpanish);

btnLoad.addEventListener('click', () => { loadVideo(); openModal(); });
btnPlayEn.addEventListener('click', () => { openModal(); playEnglish(); });
btnPlayEs.addEventListener('click', () => { openModal(); playSpanish(); });

libraryEl.addEventListener('change', fillInputsFromSelected);
search.addEventListener('input', renderGrid);

/* Admin real (estático) */
btnSave.addEventListener('click', () => alert('Para agregar: edita videos.json y haz git add/commit/push.'));
btnDelete.addEventListener('click', () => alert('Para eliminar: borra el item en videos.json y haz git add/commit/push.'));

/* =========================================================
   INIT
   ========================================================= */
(async function init() {
  await loadLibraryFromJson();
  refreshSelect();
  fillInputsFromSelected();
  renderGrid();
})();