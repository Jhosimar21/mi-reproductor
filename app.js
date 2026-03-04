/* =========================================================
   [APP.JS] Mi Netflix Personal (PÚBLICO)
   - Fuente de datos: videos.json (todos ven lo mismo)
   - Admin real (agregar/borrar) = editar videos.json + git push
   ========================================================= */

/* =========================
   [1] DOM REFERENCES
   ========================= */
const video = document.getElementById('video');

const titleEl = document.getElementById('title');
const videoLinkEl = document.getElementById('videoLink');
const audioLinkEl = document.getElementById('audioLink');
const libraryEl = document.getElementById('library');

const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');
const btnPlayEs = document.getElementById('btnPlayEs');
const btnPlayEn = document.getElementById('btnPlayEn');
const btnDelete = document.getElementById('btnDelete');

const adminPanel = document.getElementById('adminPanel');
const btnOpenAdmin = document.getElementById('btnOpenAdmin');
const btnCloseAdmin = document.getElementById('btnCloseAdmin');

const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const search = document.getElementById('search');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalSub = document.getElementById('modalSub');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnModalEn = document.getElementById('btnModalEn');
const btnModalEs = document.getElementById('btnModalEs');

/* =========================
   [2] DATA SOURCE (PUBLIC)
   ========================= */
let LIB = [];          // aquí vive la lista cargada desde videos.json
let selectedIndex = null;

async function loadLibraryFromJson(){
  try{
    const res = await fetch('./videos.json', { cache: "no-store" });
    if(!res.ok) throw new Error("No se pudo leer videos.json");
    const data = await res.json();
    LIB = Array.isArray(data) ? data : [];
  }catch(e){
    console.error(e);
    LIB = [];
  }
}

/* =========================
   [3] RENDER: SELECT + GRID
   ========================= */
function refreshSelect(){
  libraryEl.innerHTML = "";

  if (LIB.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "— Sin videos —";
    opt.value = "";
    libraryEl.appendChild(opt);
    selectedIndex = null;
    return;
  }

  LIB.forEach((it, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = it.title || `Item ${idx+1}`;
    libraryEl.appendChild(opt);
  });

  if (selectedIndex === null) selectedIndex = 0;
  libraryEl.value = String(selectedIndex);
}

function fillInputsFromSelected(){
  const idx = libraryEl.value;
  if (idx === "" || !LIB[idx]) return;

  selectedIndex = Number(idx);
  titleEl.value = LIB[idx].title || "";
  videoLinkEl.value = LIB[idx].video || "";
  audioLinkEl.value = LIB[idx].audio || "";
}

function renderGrid(){
  const q = (search.value || "").trim().toLowerCase();

  const filtered = LIB
    .map((it, idx) => ({...it, idx}))
    .filter(it => (it.title || "").toLowerCase().includes(q));

  grid.innerHTML = "";

  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.idx = item.idx;

    // Miniatura: si hay poster úsalo, si no, degradado
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (item.poster) {
      thumb.style.backgroundImage = `url('${item.poster}')`;
      thumb.style.backgroundSize = "cover";
      thumb.style.backgroundPosition = "center";
      thumb.style.height = "160px";
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = item.title || "Sin nombre";

    const badges = document.createElement("div");
    badges.className = "badges";

    const badgeVideo = document.createElement("span");
    badgeVideo.className = "badge";
    badgeVideo.textContent = (item.video || "").includes(".m3u8") ? "HLS" : "LINK";

    const badgeAudio = document.createElement("span");
    badgeAudio.className = "badge";
    badgeAudio.textContent = item.audio ? "ES ✓" : "ES —";

    badges.appendChild(badgeVideo);
    badges.appendChild(badgeAudio);

    body.appendChild(title);
    body.appendChild(badges);

    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener("click", () => {
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
let hlsVideo = null, hlsAudio = null, audioEs = null, syncTimer = null;

function cleanupAudio(){
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (audioEs){ try{audioEs.pause()}catch{} audioEs.src=""; audioEs.load(); audioEs=null; }
  if (hlsAudio){ try{hlsAudio.destroy()}catch{} hlsAudio=null; }
}

function loadVideo(){
  const src = (videoLinkEl.value || "").trim();
  if (!src) return alert("Falta link del VIDEO.");

  if (hlsVideo){ try{hlsVideo.destroy()}catch{} hlsVideo=null; }
  video.pause(); video.removeAttribute("src"); video.load();

  if (window.Hls && Hls.isSupported()) {
    hlsVideo = new Hls({ enableWorker: true });
    hlsVideo.loadSource(src);
    hlsVideo.attachMedia(video);
  } else {
    video.src = src;
  }
}

function attachAudioEs(){
  const asrc = (audioLinkEl.value || "").trim();
  if (!asrc) return alert("Falta link del AUDIO español.");

  cleanupAudio();
  audioEs = new Audio();
  audioEs.preload = "auto";

  const isM3U8 = asrc.toLowerCase().includes(".m3u8");
  if (isM3U8 && window.Hls && Hls.isSupported()){
    hlsAudio = new Hls({ enableWorker: true });
    hlsAudio.loadSource(asrc);
    hlsAudio.attachMedia(audioEs);
  } else {
    audioEs.src = asrc;
  }

  video.addEventListener('play', () => audioEs && audioEs.play().catch(()=>{}));
  video.addEventListener('pause', () => audioEs && audioEs.pause());
  video.addEventListener('seeking', () => { if(audioEs) audioEs.currentTime = video.currentTime; });

  syncTimer = setInterval(() => {
    if (!audioEs || video.paused) return;
    const drift = Math.abs((audioEs.currentTime||0) - (video.currentTime||0));
    if (drift > 0.25) audioEs.currentTime = video.currentTime;
  }, 1000);
}

async function playSpanish(){
  if (!hlsVideo && !video.src) loadVideo();
  attachAudioEs();
  video.muted = true;

  try { await video.play(); } catch {}
  try {
    audioEs.currentTime = video.currentTime;
    await audioEs.play();
    modalSub.textContent = "Audio: Español (externo)";
  } catch {
    alert("Audio bloqueado: haz clic otra vez en Español.");
  }
}

async function playEnglish(){
  cleanupAudio();
  video.muted = false;
  if (!hlsVideo && !video.src) loadVideo();
  try { await video.play(); } catch {}
  modalSub.textContent = "Audio: Inglés (original)";
}

/* =========================
   [MODAL CONTROL]
   ========================= */
function openModal(){
  modal.classList.remove("hidden");
  modalTitle.textContent = titleEl.value || "Reproduciendo...";
  modalSub.textContent = "Audio: Inglés (original)";
}
function closeModal(){
  modal.classList.add("hidden");
}
function openModalAndPlayEnglish(){
  openModal();
  loadVideo();
  playEnglish();
}

/* =========================
   [5] UI EVENTS
   ========================= */
btnOpenAdmin.addEventListener("click", () => adminPanel.classList.remove("hidden"));
btnCloseAdmin.addEventListener("click", () => adminPanel.classList.add("hidden"));

btnCloseModal.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

btnModalEn.addEventListener("click", playEnglish);
btnModalEs.addEventListener("click", playSpanish);

btnLoad.onclick = () => { loadVideo(); openModal(); };
btnPlayEs.onclick = () => { openModal(); playSpanish(); };
btnPlayEn.onclick = () => { openModal(); playEnglish(); };

/* ===== ADMIN (sin backend) =====
   En GitHub Pages no se puede escribir videos.json desde el navegador.
   Por eso: tú editas videos.json manualmente y haces git push.
*/
btnSave.onclick = () => alert("Para agregar videos: edita videos.json y haz git push (GitHub Pages es estático).");
btnDelete.onclick = () => alert("Para eliminar videos: borra el item en videos.json y haz git push.");

/* =========================
   [INIT]
   ========================= */
(async function init(){
  await loadLibraryFromJson();
  refreshSelect();
  fillInputsFromSelected();
  renderGrid();
})();