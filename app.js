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
let gunRangeCircle = null;
let gunMinRangeCircle = null;
let gunMaxRangeCircle = null;
let objectivesLayer = null;

// L81 MORTAR VERIFIED BALLISTIC FIRING TABLE (80m - 684m)
// Source: Community extracted & verified data assets (apollyon-sys & MetaForge)
const L81_FIRING_TABLE = [
  [80, 950], [87, 940], [93, 930], [99, 920], [105, 910],
  [110, 900], [115, 890], [118, 880], [122, 870], [127, 860],
  [132, 850], [140, 840], [151, 830], [163, 820], [175, 810],
  [187, 800], [198, 790], [208, 780], [219, 770], [229, 760],
  [239, 750], [250, 740], [260, 730], [270, 720], [280, 710],
  [290, 700], [300, 690], [310, 680], [319, 670], [329, 660],
  [339, 650], [348, 640], [358, 630], [367, 620], [376, 610],
  [385, 600], [394, 590], [403, 580], [412, 570], [420, 560],
  [429, 550], [437, 540], [446, 530], [454, 520], [462, 510],
  [470, 500], [478, 490], [486, 480], [494, 470], [501, 460],
  [509, 450], [516, 440], [524, 430], [531, 420], [538, 410],
  [545, 400], [552, 390], [559, 380], [565, 370], [572, 360],
  [578, 350], [585, 340], [591, 330], [597, 320], [603, 310],
  [609, 300], [615, 290], [620, 280], [626, 270], [631, 260],
  [636, 250], [641, 240], [646, 230], [651, 220], [656, 210],
  [661, 200], [666, 190], [670, 180], [675, 170], [680, 160],
  [684, 150]
];

function getMortarElevation(distanceMeters) {
  const minMeters = 80;
  const maxMeters = 684;

  if (distanceMeters < minMeters) {
    return {
      inRange: false,
      mil: 950,
      status: 'DƯỚI CỰ LY TỐI THIỂU (<80m)',
      warning: 'DƯỚI 80M (QUÁ GẦN)'
    };
  }
  if (distanceMeters > maxMeters) {
    return {
      inRange: false,
      mil: 150,
      status: 'VƯỢT CỰ LY TỐI ĐA (>684m)',
      warning: 'VƯỢT 684M (QUÁ XA)'
    };
  }

  // Exact match
  for (let i = 0; i < L81_FIRING_TABLE.length; i++) {
    if (Math.abs(L81_FIRING_TABLE[i][0] - distanceMeters) < 0.001) {
      return {
        inRange: true,
        mil: L81_FIRING_TABLE[i][1],
        status: 'TRONG TẦM BẮN',
        warning: null
      };
    }
  }

  // Piecewise linear interpolation
  for (let i = 0; i < L81_FIRING_TABLE.length - 1; i++) {
    const left = L81_FIRING_TABLE[i];
    const right = L81_FIRING_TABLE[i + 1];
    if (distanceMeters >= left[0] && distanceMeters <= right[0]) {
      const factor = (distanceMeters - left[0]) / (right[0] - left[0]);
      const mil = left[1] + factor * (right[1] - left[1]);
      return {
        inRange: true,
        mil,
        status: 'TRONG TẦM BẮN',
        warning: null
      };
    }
  }

  return { inRange: false, mil: null, status: 'UNKNOWN', warning: null };
}

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

// METAFORGE STYLE G & T CIRCLE BADGES
function createMortarIcon() {
  const html = `
    <div class="metaforge-marker marker-gun" title="Vị trí Súng cối [G] (Kéo thả để đổi vị trí)">
      <span>G</span>
    </div>
  `;
  return L.divIcon({
    html: html,
    className: 'custom-div-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function createTargetIcon() {
  const html = `
    <div class="metaforge-marker marker-target" title="Mục tiêu [T] (Kéo thả để đổi vị trí)">
      <span>T</span>
    </div>
  `;
  return L.divIcon({
    html: html,
    className: 'custom-div-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
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
  // Impact angle beta ≈ 62°, tan(62°) ≈ 1.88
  // Delta distance compensation: ΔD = ΔZ / tan(62°) ≈ 0.532 * ΔZ
  const tanImpactAngle = 1.88;
  const rangeCompensation = deltaZ / tanImpactAngle;
  const adjustedDistance = dist2D + rangeCompensation;

  // L81 Range Ladder & Firing Table solution (80m - 684m)
  const elevSol = getMortarElevation(adjustedDistance);
  const inRange = elevSol.inRange;
  const mils = elevSol.mil !== null ? Math.round(elevSol.mil) : null;
  const elevDegrees = mils !== null ? (mils * 0.05625).toFixed(1) : '---';
  const tof = mils !== null ? (10.0 + mils * 0.01494).toFixed(1) : '--.-';

  // Apex altitude
  const apexRise = inRange ? 40 + ((adjustedDistance - 80) / 604) * 260 : 40;
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
    apexZ,
    inRange,
    status: elevSol.status,
    warning: elevSol.warning
  };
}

// 3. UPDATE HUD & UI
function updateUI() {
  if (!gunMarker || !targetMarker) return;

  const gunLatLng = gunMarker.getLatLng();
  const targetLatLng = targetMarker.getLatLng();

  currentSolution = calculateBallistics(gunLatLng, targetLatLng);

  // Hero numbers
  if (currentSolution.inRange) {
    heroFiringRange.innerHTML = `${currentSolution.adjustedDistance.toFixed(1)} <span class="hero-unit">m</span>`;
  } else {
    heroFiringRange.innerHTML = `<span style="color:#ef4444; font-size:1.4rem;">${currentSolution.warning || 'NGOÀI TẦM'}</span>`;
  }
  heroFlatDist.textContent = `Thực: ${currentSolution.dist2D.toFixed(1)} m`;

  const compSign = currentSolution.rangeCompensation >= 0 ? '+' : '';
  const zSign = currentSolution.deltaZ >= 0 ? '+' : '';
  heroDeltaZ.textContent = `Độ cao: ${zSign}${currentSolution.deltaZ.toFixed(1)} m (${compSign}${currentSolution.rangeCompensation.toFixed(1)}m bù)`;

  // Cards
  solBearing.textContent = `${Math.round(currentSolution.bearing)}°`;
  solCardinal.textContent = `${currentSolution.cardinal} (${currentSolution.bearing.toFixed(1)}°)`;

  if (currentSolution.inRange) {
    solElevationMils.textContent = `${currentSolution.mils}`;
    solElevationDeg.textContent = `${currentSolution.elevDegrees}° nâng nòng`;
    solToF.textContent = `~${currentSolution.tof}s`;
    solApex.textContent = `+${Math.round(currentSolution.apexZ)}m`;
  } else {
    solElevationMils.textContent = `---`;
    solElevationDeg.textContent = currentSolution.status;
    solToF.textContent = `---`;
    solApex.textContent = `---`;
  }

  // Details
  gunCoordsDisplay.textContent = `X: ${currentSolution.gun.x.toFixed(1)}, Y: ${currentSolution.gun.y.toFixed(1)} (Z: ${currentSolution.gun.z.toFixed(1)}m)`;
  targetCoordsDisplay.textContent = `X: ${currentSolution.target.x.toFixed(1)}, Y: ${currentSolution.target.y.toFixed(1)} (Z: ${currentSolution.target.z.toFixed(1)}m)`;
  dist3dDisplay.textContent = `${currentSolution.dist3D.toFixed(1)} m`;

  // Form Inputs sync
  inputGunX.value = currentSolution.gun.x.toFixed(1);
  inputGunY.value = currentSolution.gun.y.toFixed(1);
  inputTargetX.value = currentSolution.target.x.toFixed(1);
  inputTargetY.value = currentSolution.target.y.toFixed(1);

  // Update Trajectory Polyline (Clean dashed line matching Metaforge)
  if (trajectoryLine) {
    trajectoryLine.setLatLngs([gunLatLng, targetLatLng]);
    trajectoryLine.setTooltipContent(
      `Cự ly: ${currentSolution.dist2D.toFixed(0)}m (Bù: ${currentSolution.adjustedDistance.toFixed(0)}m) | ${Math.round(currentSolution.bearing)}°`
    );
  }

  // Update Gun Range Rings: Min (80m), Max (684m), and Target Distance
  if (gunMinRangeCircle) {
    gunMinRangeCircle.setLatLng(gunLatLng);
  }
  if (gunMaxRangeCircle) {
    gunMaxRangeCircle.setLatLng(gunLatLng);
  }
  if (gunRangeCircle) {
    gunRangeCircle.setLatLng(gunLatLng);
    gunRangeCircle.setRadius(currentSolution.dist2D);
    gunRangeCircle.setStyle({
      color: currentSolution.inRange ? '#f59e0b' : '#ef4444'
    });
  }

  // Redraw Terrain Cross-Section Canvas
  drawCrossSection();

  // Update In-Game Gunner Sight Simulation
  updateGunnerSight(currentSolution);
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
  terrainGrad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
  terrainGrad.addColorStop(1, 'rgba(10, 16, 26, 0.9)');
  ctx.fillStyle = terrainGrad;
  ctx.fill();

  // Terrain line
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2 * window.devicePixelRatio;
  ctx.stroke();

  // 2. Draw Parabolic Shell Trajectory
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const arcZ = currentSolution.gun.z + (currentSolution.target.z - currentSolution.gun.z) * t + 4 * (currentSolution.apexZ - Math.max(currentSolution.gun.z, currentSolution.target.z)) * t * (1 - t);
    const px = mapX(t);
    const py = mapY(arcZ);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * window.devicePixelRatio;
  ctx.setLineDash([4 * window.devicePixelRatio, 4 * window.devicePixelRatio]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Gun & Target Dots
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(mapX(0), mapY(currentSolution.gun.z), 5 * window.devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(mapX(1), mapY(currentSolution.target.z), 5 * window.devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();
}

// 4b. DRAW HEADING TAPE (GUNNER SIGHT)
function drawHeadingTape(bearing) {
  const canvas = document.getElementById('headingTapeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const centerX = w / 2;
  const pixelsPerDeg = 2.4;

  const cardinalsMap = {
    0: 'N', 45: 'NE', 90: 'E', 135: 'SE',
    180: 'S', 225: 'SW', 270: 'W', 315: 'NW'
  };

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';

  const minDeg = Math.floor(bearing - 45);
  const maxDeg = Math.ceil(bearing + 45);

  for (let deg = minDeg; deg <= maxDeg; deg++) {
    const normDeg = ((deg % 360) + 360) % 360;
    const x = centerX + (deg - bearing) * pixelsPerDeg;

    if (x < -15 || x > w + 15) continue;

    if (normDeg % 15 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 7);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const label = cardinalsMap[normDeg] || `${normDeg}`;
      ctx.fillText(label, x, 18);
    } else if (normDeg % 5 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 4);
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// 4c. ELEVATION LADDER MARKS (80m / 950 MIL to 684m / 150 MIL)
const LADDER_MARKS = [
  { mil: 950, r: 80, hasLabel: true },
  { mil: 900, r: 110, hasLabel: false },
  { mil: 850, r: 132, hasLabel: true },
  { mil: 800, r: 187, hasLabel: true },
  { mil: 750, r: 240, hasLabel: true },
  { mil: 700, r: 290, hasLabel: false },
  { mil: 650, r: 340, hasLabel: true },
  { mil: 600, r: 385, hasLabel: false },
  { mil: 550, r: 429, hasLabel: true },
  { mil: 500, r: 470, hasLabel: false },
  { mil: 450, r: 509, hasLabel: true },
  { mil: 400, r: 545, hasLabel: false },
  { mil: 350, r: 578, hasLabel: true },
  { mil: 300, r: 609, hasLabel: false },
  { mil: 250, r: 636, hasLabel: true },
  { mil: 200, r: 661, hasLabel: false },
  { mil: 150, r: 684, hasLabel: true }
];

const LADDER_PX_PER_MIL = 0.56;

function initGunnerSightLadder() {
  const leftTrack = document.getElementById('ladderLeftTrack');
  const rightTrack = document.getElementById('ladderRightTrack');
  if (!leftTrack || !rightTrack) return;

  leftTrack.innerHTML = LADDER_MARKS.map(m => {
    const topPx = (950 - m.mil) * LADDER_PX_PER_MIL;
    const content = m.hasLabel
      ? `<span class="ladder-num">${m.r}</span><span class="ladder-dash"></span>`
      : `<span class="ladder-dash-only"></span>`;
    return `<div class="ladder-row" data-mil="${m.mil}" style="top: ${topPx}px;">${content}</div>`;
  }).join('');

  rightTrack.innerHTML = LADDER_MARKS.map(m => {
    const topPx = (950 - m.mil) * LADDER_PX_PER_MIL;
    const content = m.hasLabel
      ? `<span class="ladder-dash"></span><span class="ladder-num">${m.mil}</span>`
      : `<span class="ladder-dash-only"></span>`;
    return `<div class="ladder-row" data-mil="${m.mil}" style="top: ${topPx}px;">${content}</div>`;
  }).join('');
}

// 4d. UPDATE GUNNER SIGHT HUD (RETICLE FIXED AT CENTER, LADDER MOVES UP/DOWN)
function updateGunnerSight(sol) {
  if (!sol) return;

  drawHeadingTape(sol.bearing);

  const leftTrack = document.getElementById('ladderLeftTrack');
  const rightTrack = document.getElementById('ladderRightTrack');
  const indLeft = document.getElementById('ladderIndLeft');
  const indRight = document.getElementById('ladderIndRight');
  const gunnerMainDist = document.getElementById('gunnerMainDist');
  const gunnerSubStats = document.getElementById('gunnerSubStats');
  const targetCoordBadge = document.getElementById('target-coord-badge');

  // Slide Ladder Tracks up/down relative to fixed center needles (at Y = 75px)
  const currentMil = sol.mils || (sol.adjustedDistance <= 80 ? 950 : 150);
  const clampedMil = Math.max(150, Math.min(950, currentMil));
  const translateY = (clampedMil - 950) * LADDER_PX_PER_MIL;

  if (leftTrack) leftTrack.style.transform = `translateY(${translateY}px)`;
  if (rightTrack) rightTrack.style.transform = `translateY(${translateY}px)`;

  // Highlight rows close to center needles
  document.querySelectorAll('.ladder-row').forEach(row => {
    const rowMil = parseFloat(row.dataset.mil);
    const diff = Math.abs(rowMil - clampedMil);
    row.classList.toggle('center-active', diff <= 30);
  });

  // Range validity formatting
  if (!sol.inRange) {
    if (gunnerMainDist) {
      gunnerMainDist.textContent = `${Math.round(sol.adjustedDistance)} M`;
      gunnerMainDist.classList.add('out-of-range');
    }
    if (gunnerSubStats) {
      gunnerSubStats.textContent = sol.warning ? `⚠️ ${sol.warning}` : `⚠️ NGOÀI TẦM BẮN (80M-684M)`;
      gunnerSubStats.classList.add('out-of-range');
    }
    if (indLeft) indLeft.classList.add('out-of-range');
    if (indRight) indRight.classList.add('out-of-range');
  } else {
    if (gunnerMainDist) {
      gunnerMainDist.textContent = `${Math.round(sol.adjustedDistance)} M`;
      gunnerMainDist.classList.remove('out-of-range');
    }
    if (gunnerSubStats) {
      gunnerSubStats.textContent = `${sol.mils} MIL · ${sol.bearing.toFixed(1)}° · ${sol.tof} S`;
      gunnerSubStats.classList.remove('out-of-range');
    }
    if (indLeft) indLeft.classList.remove('out-of-range');
    if (indRight) indRight.classList.remove('out-of-range');
  }

  if (targetCoordBadge) {
    targetCoordBadge.textContent = `x${(sol.target.x / 100).toFixed(2)} y${(sol.target.y / 100).toFixed(2)}`;
  }
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
        showToast("Đã đặt vị trí Súng cối [G]!");
      } else if (clickMode === 'target') {
        targetMarker.setLatLng(e.latlng);
        setClickMode(null);
        updateUI();
        showToast("Đã đặt vị trí Mục tiêu [T]!");
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

  // Initialize Markers (MetaForge style G & T)
  const gunLatLng = L.latLng(cfg.defaultGun[1], cfg.defaultGun[0]);
  const targetLatLng = L.latLng(cfg.defaultTarget[1], cfg.defaultTarget[0]);

  if (!gunMarker) {
    gunMarker = L.marker(gunLatLng, {
      icon: createMortarIcon(),
      draggable: true,
      title: 'Vị trí Súng cối [G] (Kéo thả để di chuyển)'
    }).addTo(map);

    gunMarker.on('drag', updateUI);
  } else {
    gunMarker.setLatLng(gunLatLng);
  }

  if (!targetMarker) {
    targetMarker = L.marker(targetLatLng, {
      icon: createTargetIcon(),
      draggable: true,
      title: 'Mục tiêu bắn [T] (Kéo thả để di chuyển)'
    }).addTo(map);

    targetMarker.on('drag', updateUI);
  } else {
    targetMarker.setLatLng(targetLatLng);
  }

  // Trajectory Line (Dashed line matching screenshot)
  if (!trajectoryLine) {
    trajectoryLine = L.polyline([gunLatLng, targetLatLng], {
      color: '#ffffff',
      weight: 2,
      dashArray: '5, 5',
      opacity: 0.95
    }).addTo(map);

    trajectoryLine.bindTooltip('', {
      permanent: true,
      direction: 'center',
      className: 'trajectory-tooltip'
    }).openTooltip();
  }

  // 1. Min Range Circle around G (80m dashed red/amber)
  if (!gunMinRangeCircle) {
    gunMinRangeCircle = L.circle(gunLatLng, {
      radius: 80,
      color: '#ef4444',
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: '#ef4444',
      fillOpacity: 0.05
    }).addTo(map);
  } else {
    gunMinRangeCircle.setLatLng(gunLatLng);
  }

  // 2. Max Range Circle around G (684m solid amber)
  if (!gunMaxRangeCircle) {
    gunMaxRangeCircle = L.circle(gunLatLng, {
      radius: 684,
      color: '#f59e0b',
      weight: 1.6,
      fillColor: '#f59e0b',
      fillOpacity: 0.03
    }).addTo(map);
  } else {
    gunMaxRangeCircle.setLatLng(gunLatLng);
  }

  // 3. Current Target Distance Ring
  if (!gunRangeCircle) {
    gunRangeCircle = L.circle(gunLatLng, {
      radius: 176,
      color: '#f59e0b',
      weight: 1,
      dashArray: '3, 4',
      fillOpacity: 0
    }).addTo(map);
  } else {
    gunRangeCircle.setLatLng(gunLatLng);
  }

  // Load Objectives / Control Zones & Towers
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

// 6. OBJECTIVES & TOWERS OVERLAY (DIAMOND BADGES)
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
      const name = (item.config || 'Objective')
        .replace('DA_ControlZoneConfig_', '')
        .replace('_', ' ');

      // Diamond Tower Badge Icon matching Metaforge
      const towerHtml = `
        <div class="tower-marker-container">
          <div class="tower-diamond">
            <svg viewBox="0 0 24 24"><path d="M12 2L4 22h16L12 2zm0 4.5l5.2 13H6.8L12 6.5z"/></svg>
          </div>
          <div class="tower-label">${name}</div>
        </div>
      `;

      const diamondIcon = L.divIcon({
        html: towerHtml,
        className: 'custom-div-icon',
        iconSize: [80, 42],
        iconAnchor: [40, 9]
      });

      const marker = L.marker([y, x], { icon: diamondIcon });
      marker.on('click', () => {
        targetMarker.setLatLng([y, x]);
        updateUI();
        showToast(`Đã khóa mục tiêu vào: ${name}`);
      });

      objectivesLayer.addLayer(marker);
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
  if (clickMode === 'gun') showToast("Click vào bản đồ để đặt vị trí SÚNG CỐI [G]");
});

setTargetModeBtn.addEventListener('click', () => {
  setClickMode(clickMode === 'target' ? null : 'target');
  if (clickMode === 'target') showToast("Click vào bản đồ để đặt MỤC TIÊU [T]");
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
  const text = s.inRange
    ? `[L81 MORTAR - ${MAP_CONFIGS[currentMapKey].name}] Cự ly cần bắn: ${s.adjustedDistance.toFixed(1)}m (Thực: ${s.dist2D.toFixed(0)}m, Bù cao: ${s.rangeCompensation >= 0 ? '+' : ''}${s.rangeCompensation.toFixed(1)}m) | Hướng: ${Math.round(s.bearing)}° (${s.cardinal}) | Thước ngắm: ${s.mils} MIL (${s.elevDegrees}°) | Đạn bay: ~${s.tof}s`
    : `[L81 MORTAR - ${MAP_CONFIGS[currentMapKey].name}] ⚠️ ${s.warning} (Cự ly: ${s.adjustedDistance.toFixed(0)}m ngoài khoảng 80m - 684m) | Hướng: ${Math.round(s.bearing)}° (${s.cardinal})`;
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
      <div style="color:var(--accent-amber)">${t.dist} | ${t.bearing}</div>
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

// Gunner Sight Minimize Toggle
const gunnerMinBtn = document.getElementById('gunnerMinBtn');
const gunnerSightBox = document.getElementById('gunner-sight-box');
if (gunnerMinBtn && gunnerSightBox) {
  gunnerMinBtn.addEventListener('click', () => {
    gunnerSightBox.classList.toggle('minimized');
    gunnerMinBtn.textContent = gunnerSightBox.classList.contains('minimized') ? '⤢' : '—';
  });
}

// RANGE LADDER MODAL CONTROLS & TABLE RENDERING
const rangeLadderBtn = document.getElementById('rangeLadderBtn');
const rangeLadderModal = document.getElementById('range-ladder-modal');
const closeLadderModalBtn = document.getElementById('closeLadderModalBtn');
const ladderSearchInput = document.getElementById('ladderSearchInput');
const ladderTableBody = document.getElementById('ladderTableBody');

function renderLadderTable(filterText = '') {
  if (!ladderTableBody) return;
  const term = filterText.toLowerCase().trim();

  const rowsHtml = L81_FIRING_TABLE.map(([r, mil]) => {
    const tof = (10.0 + mil * 0.01494).toFixed(1);
    const elevDeg = (mil * 0.05625).toFixed(1);
    let trait = 'Tầm trung chuẩn';
    if (r <= 110) trait = 'Góc siêu cao (Lob cự ly gần)';
    else if (r <= 187) trait = 'Tầm gần - dốc cao';
    else if (r >= 600) trait = 'Tầm xa tối đa (Hạ nòng)';
    else if (r >= 450) trait = 'Tầm xa';

    if (term) {
      const match = `${r}`.includes(term) || `${mil}`.includes(term) || trait.toLowerCase().includes(term);
      if (!match) return '';
    }

    const isActive = currentSolution && currentSolution.inRange && Math.abs(currentSolution.adjustedDistance - r) < 6;

    return `
      <tr class="${isActive ? 'active-bracket' : ''}">
        <td class="col-range">${r} m</td>
        <td class="col-mil">${mil} MIL</td>
        <td class="col-tof">${tof} s</td>
        <td>${elevDeg}°</td>
        <td><span class="badge-tag-bracket">${trait}</span></td>
      </tr>
    `;
  }).filter(Boolean).join('');

  ladderTableBody.innerHTML = rowsHtml || `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Không tìm thấy cự ly phù hợp</td></tr>`;
}

if (rangeLadderBtn && rangeLadderModal) {
  rangeLadderBtn.addEventListener('click', () => {
    renderLadderTable(ladderSearchInput ? ladderSearchInput.value : '');
    rangeLadderModal.classList.remove('hidden');
  });
}

if (closeLadderModalBtn && rangeLadderModal) {
  closeLadderModalBtn.addEventListener('click', () => {
    rangeLadderModal.classList.add('hidden');
  });
}

if (rangeLadderModal) {
  rangeLadderModal.addEventListener('click', (e) => {
    if (e.target === rangeLadderModal) {
      rangeLadderModal.classList.add('hidden');
    }
  });
}

if (ladderSearchInput) {
  ladderSearchInput.addEventListener('input', (e) => {
    renderLadderTable(e.target.value);
  });
}

// Keyboard shortcuts (1: Gun, 2: Target, Space: Center, Esc: Cancel/Close Modal)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && rangeLadderModal && !rangeLadderModal.classList.contains('hidden')) {
    rangeLadderModal.classList.add('hidden');
    return;
  }
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '1') setGunModeBtn.click();
  else if (e.key === '2') setTargetModeBtn.click();
  else if (e.key === ' ') { e.preventDefault(); centerViewBtn.click(); }
  else if (e.key === 'Escape') setClickMode(null);
});

// INIT ON PAGE LOAD
window.addEventListener('DOMContentLoaded', () => {
  initGunnerSightLadder();
  loadMap('kavkazi');
});
