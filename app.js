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

let hlsVideo = null, hlsAudio = null, audioEs = null, syncTimer = null;

const KEY = "mi_biblioteca_links_v1";

function getLib(){ return JSON.parse(localStorage.getItem(KEY) || "[]"); }
function setLib(arr){ localStorage.setItem(KEY, JSON.stringify(arr)); }

function refreshSelect(){
  const lib = getLib();
  libraryEl.innerHTML = "";
  if (lib.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "— Sin videos guardados —";
    opt.value = "";
    libraryEl.appendChild(opt);
    return;
  }
  lib.forEach((it, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = it.title || `Item ${idx+1}`;
    libraryEl.appendChild(opt);
  });
}

function fillInputsFromSelected(){
  const lib = getLib();
  const idx = libraryEl.value;
  if (idx === "" || !lib[idx]) return;
  titleEl.value = lib[idx].title;
  videoLinkEl.value = lib[idx].video;
  audioLinkEl.value = lib[idx].audio;
}

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
  } catch {
    alert("Audio bloqueado: haz clic otra vez en Español.");
  }
}

async function playEnglish(){
  cleanupAudio();
  video.muted = false;
  if (!hlsVideo && !video.src) loadVideo();
  try { await video.play(); } catch {}
}

btnSave.onclick = () => {
  const title = titleEl.value.trim() || "Sin nombre";
  const v = videoLinkEl.value.trim();
  const a = audioLinkEl.value.trim();
  if (!v) return alert("Falta link del VIDEO.");

  const lib = getLib();
  lib.push({ title, video: v, audio: a });
  setLib(lib);

  refreshSelect();
  libraryEl.value = String(lib.length - 1);
  alert("Guardado ✅");
};

btnDelete.onclick = () => {
  const lib = getLib();
  const idx = libraryEl.value;
  if (idx === "" || !lib[idx]) return;
  lib.splice(Number(idx), 1);
  setLib(lib);
  refreshSelect();
  titleEl.value = ""; videoLinkEl.value = ""; audioLinkEl.value = "";
};

btnLoad.onclick = loadVideo;
btnPlayEs.onclick = playSpanish;
btnPlayEn.onclick = playEnglish;

libraryEl.onchange = fillInputsFromSelected;

refreshSelect();
fillInputsFromSelected();