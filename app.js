// TACTICAL WARDOGS MORTAR & ARTILLERY MAP CALCULATOR
// (C) 2026 - Interactive Elevation & Range Compensator

const MAP_CONFIGS = {
  kavkazi: {
    id: 'kavkazi',
    name: 'Bakurani',
    world: 'Kavkazi',
    bounds: { min: [-16320, -20400], max: [0, -4080] },
    zRange: { min: -1008.27, max: 106.47 },
    overview: 'maps/kavkazi/overview.webp',
    elevation: 'maps/kavkazi/elevation.bin',
    objectives: 'maps/kavkazi/objectives.json',
    defaultGun: [-8360, -11233],
    defaultTarget: [-8160, -11033]
  },
  europe: {
    id: 'europe',
    name: 'Ozeti',
    world: 'Europe',
    bounds: { min: [-16160, -16160], max: [160, 160] },
    zRange: { min: -1044.80, max: 0.04 },
    overview: 'maps/europe/overview.webp',
    elevation: 'maps/europe/elevation.bin',
    objectives: 'maps/europe/objectives.json',
    defaultGun: [-8000, -8000],
    defaultTarget: [-7750, -7800]
  },
  'north-america': {
    id: 'north-america',
    name: 'Zestafona',
    world: 'NorthAmerica',
    bounds: { min: [-8192, -8192], max: [8192, 8192] },
    zRange: { min: 0.0, max: 1225.0 },
    overview: 'maps/north-america/overview.webp',
    elevation: 'maps/north-america/elevation.bin',
    objectives: 'maps/north-america/objectives.json',
    defaultGun: [0, 0],
    defaultTarget: [300, 300]
  }
};

// 16 Cardinal Directions
const CARDINALS = [
  { name: "Bắc (N)", min: 348.75, max: 11.25 },
  { name: "Bắc - Đông Bắc (NNE)", min: 11.25, max: 33.75 },
  { name: "Đông Bắc (NE)", min: 33.75, max: 56.25 },
  { name: "Đông - Đông Bắc (ENE)", min: 56.25, max: 78.75 },
  { name: "Đông (E)", min: 78.75, max: 101.25 },
  { name: "Đông - Đông Nam (ESE)", min: 101.25, max: 123.75 },
  { name: "Đông Nam (SE)", min: 123.75, max: 146.25 },
  { name: "Nam - Đông Nam (SSE)", min: 146.25, max: 168.75 },
  { name: "Nam (S)", min: 168.75, max: 191.25 },
  { name: "Nam - Tây Nam (SSW)", min: 191.25, max: 213.75 },
  { name: "Tây Nam (SW)", min: 213.75, max: 236.25 },
  { name: "Tây - Tây Nam (WSW)", min: 236.25, max: 258.75 },
  { name: "Tây (W)", min: 258.75, max: 281.25 },
  { name: "Tây - Tây Bắc (WNW)", min: 281.25, max: 303.75 },
  { name: "Tây Bắc (NW)", min: 303.75, max: 326.25 },
  { name: "Bắc - Tây Bắc (NNW)", min: 326.25, max: 348.75 }
];

function getCardinal(deg) {
  deg = ((deg % 360) + 360) % 360;
  for (let c of CARDINALS) {
    if (c.min > c.max) {
      if (deg >= c.min || deg < c.max) return c.name;
    } else {
      if (deg >= c.min && deg < c.max) return c.name;
    }
  }
  return "Bắc (N)";
}

// Global App State
let currentMapKey = 'kavkazi';
let currentElevationData = null; // Uint16Array 2048x2048
let map = null;
let imageOverlay = null;
let gunMarker = null;
let targetMarker = null;
let trajectoryLine = null;
let rangeCircles = [];
let objectivesLayer = null;

let clickMode = null; // 'gun', 'target', or null
let currentSolution = null;
let savedTargets = [];

// DOM References
const loadingOverlay = document.getElementById('loading-overlay');
const toast = document.getElementById('toast');
const footerPos = document.getElementById('footer-pos');
const footerElev = document.getElementById('footer-elev');
const hudPanel = document.getElementById('hud-panel');
const hudToggleBtn = document.getElementById('hud-toggle-btn');

// Solution displays
const heroFiringRange = document.getElementById('heroFiringRange');
const heroFlatDist = document.getElementById('heroFlatDist');
const heroDeltaZ = document.getElementById('heroDeltaZ');
const solBearing = document.getElementById('solBearing');
const solCardinal = document.getElementById('solCardinal');
const solElevationMils = document.getElementById('solElevationMils');
const solElevationDeg = document.getElementById('solElevationDeg');
const solToF = document.getElementById('solToF');
const solApex = document.getElementById('solApex');
const gunCoordsDisplay = document.getElementById('gunCoordsDisplay');
const targetCoordsDisplay = document.getElementById('targetCoordsDisplay');
const dist3dDisplay = document.getElementById('dist3dDisplay');

// Manual Input fields
const inputGunX = document.getElementById('inputGunX');
const inputGunY = document.getElementById('inputGunY');
const inputTargetX = document.getElementById('inputTargetX');
const inputTargetY = document.getElementById('inputTargetY');
const applyCoordsBtn = document.getElementById('applyCoordsBtn');
const moveToTargetBtn = document.getElementById('moveToTargetBtn');
const saveTargetBtn = document.getElementById('saveTargetBtn');
const copySolutionBtn = document.getElementById('copySolutionBtn');
const historyList = document.getElementById('historyList');

// Click mode buttons
const setGunModeBtn = document.getElementById('setGunModeBtn');
const setTargetModeBtn = document.getElementById('setTargetModeBtn');
const centerViewBtn = document.getElementById('centerViewBtn');

// SVG Custom Marker Icons
function createMortarIcon() {
  const svg = `
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="21" cy="21" r="18" fill="rgba(0, 255, 136, 0.2)" stroke="#00ff88" stroke-width="2"/>
      <circle cx="21" cy="21" r="5" fill="#00ff88"/>
      <line x1="21" y1="3" x2="21" y2="10" stroke="#00ff88" stroke-width="2"/>
      <line x1="21" y1="32" x2="21" y2="39" stroke="#00ff88" stroke-width="2"/>
      <line x1="3" y1="21" x2="10" y2="21" stroke="#00ff88" stroke-width="2"/>
      <line x1="32" y1="21" x2="39" y2="21" stroke="#00ff88" stroke-width="2"/>
      <path d="M14 27 L21 15 L28 27 Z" fill="none" stroke="#00ff88" stroke-width="2"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'mortar-marker-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

function createTargetIcon() {
  const svg = `
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="21" cy="21" r="16" fill="rgba(255, 51, 102, 0.2)" stroke="#ff3366" stroke-width="2"/>
      <circle cx="21" cy="21" r="2" fill="#ff3366"/>
      <line x1="21" y1="2" x2="21" y2="13" stroke="#ff3366" stroke-width="2.5"/>
      <line x1="21" y1="29" x2="21" y2="40" stroke="#ff3366" stroke-width="2.5"/>
      <line x1="2" y1="21" x2="13" y2="21" stroke="#ff3366" stroke-width="2.5"/>
      <line x1="29" y1="21" x2="40" y2="21" stroke="#ff3366" stroke-width="2.5"/>
      <circle cx="21" cy="21" r="8" fill="none" stroke="#ff3366" stroke-width="1.5" stroke-dasharray="2 2"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'target-marker-icon',
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

// Toast helper
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// 1. ELEVATION LOOKUP LOGIC
function getElevation(x, y) {
  if (!currentElevationData) return 0;
  const cfg = MAP_CONFIGS[currentMapKey];
  const b = cfg.bounds;

  // Bilinear sampling across 2048x2048 elevation grid
  const normX = (x - b.min[0]) / (b.max[0] - b.min[0]);
  const normY = (y - b.min[1]) / (b.max[1] - b.min[1]);

  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return 0;

  const px = normX * 2047;
  const py = normY * 2047;
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const fx = px - x0, fy = py - y0;
  const x1 = Math.min(x0 + 1, 2047);
  const y1 = Math.min(y0 + 1, 2047);

  const v00 = currentElevationData[y0 * 2048 + x0];
  const v10 = currentElevationData[y0 * 2048 + x1];
  const v01 = currentElevationData[y1 * 2048 + x0];
  const v11 = currentElevationData[y1 * 2048 + x1];

  const val = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
  const z = cfg.zRange.min + (val / 65535.0) * (cfg.zRange.max - cfg.zRange.min);
  return z;
}

// 2. BALLISTICS & ELEVATION COMPENSATION
function calculateBallistics(gunPos, targetPos) {
  const dx = targetPos.lng - gunPos.lng;
  const dy = targetPos.lat - gunPos.lat;

  const dist2D = Math.hypot(dx, dy);

  const zGun = getElevation(gunPos.lng, gunPos.lat);
  const zTarget = getElevation(targetPos.lng, targetPos.lat);
  const deltaZ = zTarget - zGun; // + means target is higher, - means lower

  const dist3D = Math.hypot(dx, dy, deltaZ);

  // Bearing (0° North, 90° East, clockwise)
  let bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
  let mathDeg = (Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360;

  // L81 Mortar Range & Height Compensation:
  // In high-angle mortar trajectories, the shell impacts at a steep angle (beta ≈ 62°).
  // When target is deltaZ higher, shell hits the mountain early.
  // Delta distance compensation: ΔD = ΔZ / tan(62°) ≈ 0.532 * ΔZ
  const tanImpactAngle = 1.88; // tan(62°)
  const rangeCompensation = deltaZ / tanImpactAngle;
  const adjustedDistance = Math.max(50, dist2D + rangeCompensation);

  // Mil Calculation for standard 81mm mortar (approx 800 - 1550 mils):
  // 100m ≈ 1520 mils, 500m ≈ 1340 mils, 1000m ≈ 1080 mils, 1250m ≈ 800 mils
  const clampedRange = Math.min(1250, Math.max(50, adjustedDistance));
  const tNorm = (clampedRange - 50) / 1200; // 0 to 1
  const mils = Math.round(1550 - tNorm * 750);
  const elevDegrees = (mils * (360 / 6400)).toFixed(1);

  // Time of flight (approx 12s to 26s)
  const tof = (11.0 + tNorm * 15.0).toFixed(1);

  // Apex altitude
  const apexRise = 40 + tNorm * 280;
  const apexZ = Math.max(zGun, zTarget) + apexRise;

  return {
    gun: { x: gunPos.lng, y: gunPos.lat, z: zGun },
    target: { x: targetPos.lng, y: targetPos.lat, z: zTarget },
    dist2D,
    dist3D,
    deltaZ,
    rangeCompensation,
    adjustedDistance,
    bearing,
    mathDeg,
    cardinal: getCardinal(bearing),
    mils,
    elevDegrees,
    tof,
    apexZ
  };
}

// 3. UPDATE HUD & UI
function updateUI() {
  if (!gunMarker || !targetMarker) return;

  const gunLatLng = gunMarker.getLatLng();
  const targetLatLng = targetMarker.getLatLng();

  currentSolution = calculateBallistics(gunLatLng, targetLatLng);

  // Hero numbers
  heroFiringRange.innerHTML = `${currentSolution.adjustedDistance.toFixed(1)} <span class="hero-unit">m</span>`;
  heroFlatDist.textContent = `Thực: ${currentSolution.dist2D.toFixed(1)} m`;

  const compSign = currentSolution.rangeCompensation >= 0 ? '+' : '';
  const zSign = currentSolution.deltaZ >= 0 ? '+' : '';
  heroDeltaZ.textContent = `Độ cao: ${zSign}${currentSolution.deltaZ.toFixed(1)} m (${compSign}${currentSolution.rangeCompensation.toFixed(1)}m bù)`;

  // Cards
  solBearing.textContent = `${Math.round(currentSolution.bearing)}°`;
  solCardinal.textContent = `${currentSolution.cardinal} (${currentSolution.bearing.toFixed(1)}°)`;

  solElevationMils.textContent = `${currentSolution.mils}`;
  solElevationDeg.textContent = `${currentSolution.elevDegrees}° nâng nòng`;

  solToF.textContent = `~${currentSolution.tof}s`;
  solApex.textContent = `+${Math.round(currentSolution.apexZ)}m`;

  // Details
  gunCoordsDisplay.textContent = `X: ${currentSolution.gun.x.toFixed(1)}, Y: ${currentSolution.gun.y.toFixed(1)} (Z: ${currentSolution.gun.z.toFixed(1)}m)`;
  targetCoordsDisplay.textContent = `X: ${currentSolution.target.x.toFixed(1)}, Y: ${currentSolution.target.y.toFixed(1)} (Z: ${currentSolution.target.z.toFixed(1)}m)`;
  dist3dDisplay.textContent = `${currentSolution.dist3D.toFixed(1)} m`;

  // Form Inputs sync
  inputGunX.value = currentSolution.gun.x.toFixed(1);
  inputGunY.value = currentSolution.gun.y.toFixed(1);
  inputTargetX.value = currentSolution.target.x.toFixed(1);
  inputTargetY.value = currentSolution.target.y.toFixed(1);

  // Update Trajectory Polyline
  if (trajectoryLine) {
    trajectoryLine.setLatLngs([gunLatLng, targetLatLng]);
    const midLatLng = L.latLng(
      (gunLatLng.lat + targetLatLng.lat) / 2,
      (gunLatLng.lng + targetLatLng.lng) / 2
    );
    trajectoryLine.setTooltipContent(
      `Cự ly: ${currentSolution.dist2D.toFixed(0)}m (Bù: ${currentSolution.adjustedDistance.toFixed(0)}m) | ${Math.round(currentSolution.bearing)}°`
    );
  }

  // Update Range Circles around Gun
  if (rangeCircles.length === 2) {
    rangeCircles[0].setLatLng(gunLatLng);
    rangeCircles[1].setLatLng(gunLatLng);
  }

  // Redraw Terrain Cross-Section Canvas
  drawCrossSection();
}

// 4. DRAW TERRAIN CROSS-SECTION CANVAS
function drawCrossSection() {
  const canvas = document.getElementById('crossSectionCanvas');
  if (!canvas || !currentSolution) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * window.devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * window.devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  const samples = 40;
  const points = [];
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = currentSolution.gun.x + (currentSolution.target.x - currentSolution.gun.x) * t;
    const y = currentSolution.gun.y + (currentSolution.target.y - currentSolution.gun.y) * t;
    const z = getElevation(x, y);
    points.push({ t, z });
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  // Add apex height to max bounds
  maxZ = Math.max(maxZ, currentSolution.apexZ) + 20;
  minZ = minZ - 20;
  const rangeZ = Math.max(1, maxZ - minZ);

  const padding = 20 * window.devicePixelRatio;
  const mapY = (z) => h - padding - ((z - minZ) / rangeZ) * (h - 2 * padding);
  const mapX = (t) => padding + t * (w - 2 * padding);

  // 1. Draw Terrain Fill
  ctx.beginPath();
  ctx.moveTo(mapX(0), h);
  for (let i = 0; i <= samples; i++) {
    ctx.lineTo(mapX(points[i].t), mapY(points[i].z));
  }
  ctx.lineTo(mapX(1), h);
  ctx.closePath();

  const terrainGrad = ctx.createLinearGradient(0, mapY(maxZ), 0, h);
  terrainGrad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
  terrainGrad.addColorStop(1, 'rgba(10, 16, 26, 0.9)');
  ctx.fillStyle = terrainGrad;
  ctx.fill();

  // Terrain line
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2 * window.devicePixelRatio;
  ctx.stroke();

  // 2. Draw Parabolic Shell Trajectory
  ctx.beginPath();
  const apexT = 0.5;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // Parabolic arc equation
    const arcZ = currentSolution.gun.z + (currentSolution.target.z - currentSolution.gun.z) * t + 4 * (currentSolution.apexZ - Math.max(currentSolution.gun.z, currentSolution.target.z)) * t * (1 - t);
    const px = mapX(t);
    const py = mapY(arcZ);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2.5 * window.devicePixelRatio;
  ctx.setLineDash([5 * window.devicePixelRatio, 4 * window.devicePixelRatio]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Gun & Target Dots
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.arc(mapX(0), mapY(currentSolution.gun.z), 5 * window.devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff3366';
  ctx.beginPath();
  ctx.arc(mapX(1), mapY(currentSolution.target.z), 5 * window.devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();
}

// 5. MAP INITIALIZATION & SWITCHING
async function loadMap(mapKey) {
  currentMapKey = mapKey;
  const cfg = MAP_CONFIGS[mapKey];

  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.pointerEvents = 'all';

  // 1. Fetch Elevation Buffer (8MB binary)
  try {
    const res = await fetch(cfg.elevation);
    const buf = await res.arrayBuffer();
    currentElevationData = new Uint16Array(buf);
  } catch (err) {
    console.error('Failed to load elevation.bin:', err);
    currentElevationData = null;
  }

  // 2. Initialize or Update Leaflet Map
  const southWest = L.latLng(cfg.bounds.min[1], cfg.bounds.min[0]);
  const northEast = L.latLng(cfg.bounds.max[1], cfg.bounds.max[0]);
  const bounds = L.latLngBounds(southWest, northEast);

  if (!map) {
    map = L.map('map', {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false
    });

    // Mouse move coordinate tracker
    map.on('mousemove', (e) => {
      const z = getElevation(e.latlng.lng, e.latlng.lat);
      footerPos.textContent = `X: ${e.latlng.lng.toFixed(1)} | Y: ${e.latlng.lat.toFixed(1)}`;
      footerElev.textContent = `Độ cao (Z): ${z.toFixed(1)} m`;
    });

    // Map click handler for interactive placement
    map.on('click', (e) => {
      if (clickMode === 'gun') {
        gunMarker.setLatLng(e.latlng);
        setClickMode(null);
        updateUI();
        showToast("Đã đặt vị trí Súng cối!");
      } else if (clickMode === 'target') {
        targetMarker.setLatLng(e.latlng);
        setClickMode(null);
        updateUI();
        showToast("Đã đặt vị trí Mục tiêu!");
      }
    });
  }

  // Update image overlay
  if (imageOverlay) {
    map.removeLayer(imageOverlay);
  }
  imageOverlay = L.imageOverlay(cfg.overview, bounds).addTo(map);

  map.setMaxBounds(bounds);
  map.fitBounds(bounds);

  // Initialize Markers
  const gunLatLng = L.latLng(cfg.defaultGun[1], cfg.defaultGun[0]);
  const targetLatLng = L.latLng(cfg.defaultTarget[1], cfg.defaultTarget[0]);

  if (!gunMarker) {
    gunMarker = L.marker(gunLatLng, {
      icon: createMortarIcon(),
      draggable: true,
      title: 'Vị trí Súng cối (Kéo thả để di chuyển)'
    }).addTo(map);

    gunMarker.on('drag', updateUI);
  } else {
    gunMarker.setLatLng(gunLatLng);
  }

  if (!targetMarker) {
    targetMarker = L.marker(targetLatLng, {
      icon: createTargetIcon(),
      draggable: true,
      title: 'Mục tiêu bắn (Kéo thả để di chuyển)'
    }).addTo(map);

    targetMarker.on('drag', updateUI);
  } else {
    targetMarker.setLatLng(targetLatLng);
  }

  // Trajectory Line
  if (!trajectoryLine) {
    trajectoryLine = L.polyline([gunLatLng, targetLatLng], {
      color: '#00e5ff',
      weight: 3,
      dashArray: '8, 6',
      opacity: 0.9
    }).addTo(map);

    trajectoryLine.bindTooltip('', {
      permanent: true,
      direction: 'center',
      className: 'trajectory-tooltip'
    }).openTooltip();
  }

  // Range Circles (Min 50m, Max 1250m)
  if (rangeCircles.length === 0) {
    const minCircle = L.circle(gunLatLng, {
      radius: 50,
      color: '#ff3366',
      fillColor: '#ff3366',
      fillOpacity: 0.05,
      weight: 1.5,
      dashArray: '4, 4'
    }).addTo(map);

    const maxCircle = L.circle(gunLatLng, {
      radius: 1250,
      color: '#00ff88',
      fillColor: '#00ff88',
      fillOpacity: 0.03,
      weight: 1.5,
      dashArray: '6, 6'
    }).addTo(map);

    rangeCircles = [minCircle, maxCircle];
  }

  // Load Objectives / Control Zones
  loadObjectives(cfg);

  // Update tabs
  document.querySelectorAll('.map-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.map === mapKey);
  });

  updateUI();

  // Hide loading
  setTimeout(() => {
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.pointerEvents = 'none';
  }, 200);
}

// 6. OBJECTIVES (CONTROL ZONES) OVERLAY
async function loadObjectives(cfg) {
  if (objectivesLayer) {
    map.removeLayer(objectivesLayer);
    objectivesLayer = null;
  }

  try {
    const res = await fetch(cfg.objectives);
    const data = await res.json();
    objectivesLayer = L.layerGroup();

    (data.configs || []).forEach(item => {
      const zone = item.zone;
      if (!zone || !zone.center) return;
      const x = zone.center[0];
      const y = zone.center[1];
      const r = zone.extents ? zone.extents[0] : 300;
      const name = (item.config || 'Objective').replace('DA_ControlZoneConfig_', '');

      const circle = L.circle([y, x], {
        radius: r,
        color: '#ffb703',
        fillColor: '#ffb703',
        fillOpacity: 0.08,
        weight: 1
      });

      circle.bindTooltip(`📍 ${name}`, {
        permanent: false,
        direction: 'top',
        className: 'trajectory-tooltip'
      });

      circle.on('click', () => {
        targetMarker.setLatLng([y, x]);
        updateUI();
        showToast(`Đã khóa mục tiêu vào cứ điểm: ${name}`);
      });

      objectivesLayer.addLayer(circle);
    });

    objectivesLayer.addTo(map);
  } catch (e) {
    console.warn('No objectives loaded for', cfg.id);
  }
}

// 7. CLICK MODES (SET GUN / SET TARGET)
function setClickMode(mode) {
  clickMode = mode;
  setGunModeBtn.classList.toggle('active-gun', mode === 'gun');
  setTargetModeBtn.classList.toggle('active-target', mode === 'target');
  map.getContainer().style.cursor = mode ? 'crosshair' : '';
}

setGunModeBtn.addEventListener('click', () => {
  setClickMode(clickMode === 'gun' ? null : 'gun');
  if (clickMode === 'gun') showToast("Click vào bản đồ để đặt vị trí SÚNG CỐI");
});

setTargetModeBtn.addEventListener('click', () => {
  setClickMode(clickMode === 'target' ? null : 'target');
  if (clickMode === 'target') showToast("Click vào bản đồ để đặt MỤC TIÊU");
});

centerViewBtn.addEventListener('click', () => {
  if (!gunMarker || !targetMarker) return;
  const bounds = L.latLngBounds(gunMarker.getLatLng(), targetMarker.getLatLng());
  map.fitBounds(bounds, { padding: [80, 80] });
});

// 8. FORM CONTROLS & LISTENERS
applyCoordsBtn.addEventListener('click', () => {
  const gx = parseFloat(inputGunX.value);
  const gy = parseFloat(inputGunY.value);
  const tx = parseFloat(inputTargetX.value);
  const ty = parseFloat(inputTargetY.value);

  if (!isNaN(gx) && !isNaN(gy)) gunMarker.setLatLng([gy, gx]);
  if (!isNaN(tx) && !isNaN(ty)) targetMarker.setLatLng([ty, tx]);

  updateUI();
  centerViewBtn.click();
  showToast("Đã cập nhật tọa độ!");
});

moveToTargetBtn.addEventListener('click', () => {
  if (!targetMarker) return;
  const targetLatLng = targetMarker.getLatLng();
  gunMarker.setLatLng(targetLatLng);
  updateUI();
  showToast("Đã di chuyển Súng tới vị trí Mục Tiêu!");
});

// Copy Firing Solution
copySolutionBtn.addEventListener('click', () => {
  if (!currentSolution) return;
  const s = currentSolution;
  const text = `[L81 MORTAR - ${MAP_CONFIGS[currentMapKey].name}] Cự ly cần bắn: ${s.adjustedDistance.toFixed(1)}m (Thực: ${s.dist2D.toFixed(0)}m, Bù cao: ${s.rangeCompensation >= 0 ? '+' : ''}${s.rangeCompensation.toFixed(1)}m) | Góc: ${Math.round(s.bearing)}° (${s.cardinal}) | Thước ngắm: ${s.mils} mils (${s.elevDegrees}°) | Đạn bay: ~${s.tof}s`;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Đã sao chép giải pháp bắn vào bộ nhớ tạm!");
  });
});

// Save Target History
saveTargetBtn.addEventListener('click', () => {
  if (!currentSolution) return;
  const s = currentSolution;
  savedTargets.unshift({
    name: `Mục tiêu #${savedTargets.length + 1}`,
    x: s.target.x.toFixed(1),
    y: s.target.y.toFixed(1),
    z: s.target.z.toFixed(1),
    dist: s.adjustedDistance.toFixed(0) + 'm',
    bearing: Math.round(s.bearing) + '°'
  });
  if (savedTargets.length > 8) savedTargets.pop();
  renderHistory();
  showToast("Đã lưu mục tiêu vào danh sách!");
});

function renderHistory() {
  historyList.innerHTML = '';
  if (savedTargets.length === 0) {
    historyList.innerHTML = '<div style="color:var(--text-muted);font-size:0.75rem;text-align:center;">Chưa có mục tiêu lưu</div>';
    return;
  }
  savedTargets.forEach((t) => {
    const item = document.createElement('div');
    item.className = 'spec-row';
    item.style.cursor = 'pointer';
    item.style.padding = '6px 0';
    item.innerHTML = `
      <div><strong>${t.name}</strong> (${t.x}, ${t.y})</div>
      <div style="color:var(--accent-green)">${t.dist} | ${t.bearing}</div>
    `;
    item.addEventListener('click', () => {
      targetMarker.setLatLng([parseFloat(t.y), parseFloat(t.x)]);
      updateUI();
      showToast(`Đã chuyển mục tiêu về ${t.name}`);
    });
    historyList.appendChild(item);
  });
}

// 9. MAP SELECTION BUTTONS
document.querySelectorAll('.map-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const mapKey = e.currentTarget.dataset.map;
    if (mapKey && mapKey !== currentMapKey) {
      loadMap(mapKey);
    }
  });
});

// Panel tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

    e.currentTarget.classList.add('active');
    const paneId = e.currentTarget.dataset.pane;
    const targetPane = document.getElementById(paneId);
    if (targetPane) targetPane.style.display = 'flex';
  });
});

// HUD Collapse Toggle
hudToggleBtn.addEventListener('click', () => {
  const isCollapsed = hudPanel.classList.toggle('collapsed');
  hudToggleBtn.style.display = isCollapsed ? 'flex' : 'none';
});

document.getElementById('hudCollapseBtn').addEventListener('click', () => {
  hudPanel.classList.add('collapsed');
  hudToggleBtn.style.display = 'flex';
});

// Keyboard shortcuts (1: Gun, 2: Target, Space: Center, Esc: Cancel)
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '1') setGunModeBtn.click();
  else if (e.key === '2') setTargetModeBtn.click();
  else if (e.key === ' ') { e.preventDefault(); centerViewBtn.click(); }
  else if (e.key === 'Escape') setClickMode(null);
});

// INIT ON PAGE LOAD
window.addEventListener('DOMContentLoaded', () => {
  loadMap('kavkazi');
});
