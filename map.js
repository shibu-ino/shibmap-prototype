// ===== 基本設定 =====
const Z_CLUSTER = 7;   // これ以上でクラスタ表示
const Z_MARKER  = 12;  // これ以上で個別マーカー

const map = L.map('map').setView([35.0, 135.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const clusterLayer = L.markerClusterGroup();
const markerLayer  = L.layerGroup();

let items = [];

// ===== データ読み込み =====
fetch('items.json')
  .then(r => r.json())
  .then(data => {
    items = data;
    buildLayers(items);
    buildCards(items);
    updateView();
  });

// ===== レイヤー構築 =====
function buildLayers(items){
  clusterLayer.clearLayers();
  markerLayer.clearLayers();

  items.forEach(it => {
    const [lat, lng] = it.coords;

    const mCluster = L.marker([lat, lng]).bindPopup(makePopupHTML(it));
    mCluster.on('click', () => handlePlay(it));
    clusterLayer.addLayer(mCluster);

    const mMarker = L.marker([lat, lng]).bindPopup(makePopupHTML(it));
    mMarker.on('click', () => handlePlay(it));
    markerLayer.addLayer(mMarker);
  });
}

// ===== ポップアップ =====
function makePopupHTML(it){
  return `<div style="min-width:200px">
    <strong>${escapeHtml(it.title)}</strong><br/>
    <button onclick="window.__play('${encodeURIComponent(it.title)}')">再生</button>
  </div>`;
}
window.__play = (tenc) => {
  const t = decodeURIComponent(tenc);
  const it = items.find(x => x.title === t);
  if (it) handlePlay(it);
};

// ===== 再生処理 =====
function handlePlay(it){
  const lvl = determineLevel(map.getZoom());
  const clusterVideo = resolveClusterVideo(it.coords, lvl);
  const src = clusterVideo || pickBestMedia(it) || '';
  const v = document.getElementById('vid');
  if (!src) { v.removeAttribute('src'); v.load(); return; }
  v.src = src;
  v.play().catch(()=>{});
}

function determineLevel(z){
  if (z < Z_CLUSTER) return 'L0';       // 全体
  if (z < Z_MARKER) return 'L1L2';      // クラスタ
  return 'L3';                          // 個別
}

function resolveClusterVideo([lat,lng], lvl){
  if (lvl === 'L0') return 'output/L0_global.mp4';
  if (lvl === 'L1L2'){
    const z = (map.getZoom() >= 9) ? 8 : 5;
    const {x,y} = tileXY(lat, lng, z);
    const levelTag = (z === 8) ? 'L2' : 'L1';
    return `output/${levelTag}/z${z}_x${x}_y${y}.mp4`;
  }
  return null;
}

function pickBestMedia(it){
  if (it.media && it.media.length){
    const v = it.media.find(m => m.type === 'video');
    if (v) return v.path;
    const img = it.media.find(m => m.type === 'image');
    if (img) return img.path;
  }
  if (it.video) return it.video;
  if (it.image) return it.image;
  return null;
}

// ===== 表示切替 =====
function updateView(){
  const z = map.getZoom();
  map.removeLayer(clusterLayer);
  map.removeLayer(markerLayer);

  if (z < Z_CLUSTER){
    // 全体ビュー（必要ならヒートマップをここに追加）
  } else if (z < Z_MARKER){
    clusterLayer.addTo(map);
  } else {
    markerLayer.addTo(map);
  }
}
map.on('zoomend', updateView);

// ===== タイルID算出 =====
function tileXY(lat, lon, z){
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI) / 2 * n);
  return {x,y};
}

// ===== ヘルパ =====
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

// ===== 下部カード =====
function buildCards(items){
  const strip = document.getElementById('cardStrip');
  strip.innerHTML = '';
  items.slice(0, 24).forEach(it => {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = it.title;
    el.onclick = () => { 
      map.setView(it.coords, Math.max(map.getZoom(), Z_MARKER));
      handlePlay(it);
    };
    strip.appendChild(el);
  });
}