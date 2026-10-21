// TACTICAL WARDOGS MORTAR & ARTILLERY MAP CALCULATOR
// (C) 2026 - Interactive Elevation, Ballistics & Range Compensator
// Coordinates: (0, 0) strictly at bottom-left corner of each map

const MAP_CONFIGS = {
  kavkazi: {
    id: 'kavkazi',
    name: 'Bakurani',
    world: 'Kavkazi',
    width: 16320,
    height: 16320,
    rawBounds: { min: [-16320, -20400], max: [0, -4080] },
    zRange: { min: -1008.27, max: 106.47 },
    overview: 'maps/kavkazi/overview.webp',
    elevation: 'maps/kavkazi/elevation.bin',
    objectives: 'maps/kavkazi/objectives.json',
    defaultGun: [7960, 9167],
    defaultTarget: [8160, 9367]
  },
  europe: {
    id: 'europe',
    name: 'Ozeti',
    world: 'Europe',
    width: 16320,
    height: 16320,
    rawBounds: { min: [-16160, -16160], max: [160, 160] },
    zRange: { min: -1044.80, max: 0.04 },
    overview: 'maps/europe/overview.webp',
    elevation: 'maps/europe/elevation.bin',
    objectives: 'maps/europe/objectives.json',
    defaultGun: [8160, 8160],
    defaultTarget: [8410, 8360]
  },
  'north-america': {
    id: 'north-america',
    name: 'Zestafona',
    world: 'NorthAmerica',
    width: 16384,
    height: 16384,
    rawBounds: { min: [-8192, -8192], max: [8192, 8192] },
    zRange: { min: 0.0, max: 1225.0 },
    overview: 'maps/north-america/overview.webp',
    elevation: 'maps/north-america/elevation.bin',
    objectives: 'maps/north-america/objectives.json',
    defaultGun: [8192, 8192],
    defaultTarget: [8492, 8492]
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
let gunRangeCircles = [];
let gunRangeCircle = null;
let objectivesLayer = null;

let currentWeaponKey = 'mortar'; // 'mortar' or 'sph2'
let sphArcMode = 'auto'; // 'auto', 'high', 'low'
let modalWeaponKey = 'mortar';

// L81 MORTAR VERIFIED BALLISTIC FIRING TABLE (80m - 684m)
// Strictly anchored to the 17 verified in-game graduations (150 MIL to 950 MIL in 50 MIL steps)
const L81_FIRING_TABLE = [
  [80, 950],
  [110, 900],
  [132, 850],
  [187, 800],
  [240, 750],
  [290, 700],
  [340, 650],
  [385, 600],
  [430, 550],
  [470, 500],
  [510, 450],
  [545, 400],
  [578, 350],
  [609, 300],
  [637, 250],
  [661, 200],
  [684, 150]
];

// SPH-2 LOW ARC BALLISTIC TABLE (1181m - 2629m)
const SPH2_LOW_TABLE = [
  [1181,20],[1232,30],[1283,40],[1334,50],[1384,60],[1433,70],[1482,80],[1529,90],[1576,100],
  [1622,110],[1666,120],[1709,130],[1751,140],[1792,150],[1832,160],[1870,170],[1907,180],
  [1944,190],[1979,200],[2014,210],[2046,220],[2079,230],[2110,240],[2139,250],[2168,260],
  [2196,270],[2223,280],[2249,290],[2273,300],[2296,310],[2319,320],[2341,330],[2362,340],
  [2383,350],[2403,360],[2422,370],[2439,380],[2456,390],[2471,400],[2485,410],[2499,420],
  [2513,430],[2526,440],[2538,450],[2550,460],[2561,470],[2570,480],[2579,490],[2586,500],
  [2593,510],[2599,520],[2605,530],[2610,540],[2615,550],[2620,560],[2623,570],[2626,580],
  [2628,590],[2629,600]
];

// SPH-2 HIGH ARC BALLISTIC TABLE (735m - 2629m, sorted distance ascending)
const SPH2_HIGH_TABLE = [
  [735,1400],[780,1390],[825,1380],[869,1370],[913,1360],[956,1350],[999,1340],[1041,1330],
  [1083,1320],[1124,1310],[1165,1300],[1205,1290],[1245,1280],[1285,1270],[1324,1260],[1363,1250],
  [1401,1240],[1438,1230],[1475,1220],[1512,1210],[1547,1200],[1582,1190],[1616,1180],[1650,1170],
  [1684,1160],[1717,1150],[1750,1140],[1782,1130],[1813,1120],[1844,1110],[1875,1100],[1905,1090],
  [1934,1080],[1963,1070],[1991,1060],[2019,1050],[2046,1040],[2072,1030],[2098,1020],[2123,1010],
  [2147,1000],[2171,990],[2194,980],[2217,970],[2239,960],[2261,950],[2282,940],[2303,930],
  [2323,920],[2342,910],[2360,900],[2378,890],[2395,880],[2412,870],[2429,860],[2444,850],
  [2460,840],[2474,830],[2488,820],[2501,810],[2513,800],[2524,790],[2536,780],[2546,770],
  [2557,760],[2567,750],[2576,740],[2584,730],[2592,720],[2599,710],[2604,700],[2609,690],
  [2613,680],[2617,670],[2621,660],[2624,650],[2626,640],[2628,630],[2629,620],[2629,610]
];

// WEAPONS DEFINITION
const WEAPON_CONFIGS = {
  mortar: {
    id: 'mortar',
    name: 'Súng Cối L81 (81mm)',
    shortName: 'L81 MORTAR',
    minRange: 80,
    maxRange: 684,
    hasDualArc: false
  },
  sph2: {
    id: 'sph2',
    name: 'Pháo Tự Hành SPH-2 (155mm)',
    shortName: 'SPH-2 155MM',
    minRange: 780,
    maxRange: 2629,
    hasDualArc: true
  }
};

// Piecewise linear interpolation on sorted table [[dist, mil], ...]
function interpolateTable(table, distanceMeters) {
  if (!table || !table.length || isNaN(distanceMeters)) return null;
  if (distanceMeters < table[0][0] || distanceMeters > table[table.length - 1][0]) return null;

  for (let i = 0; i < table.length - 1; i++) {
    const left = table[i];
    const right = table[i + 1];
    if (distanceMeters >= left[0] && distanceMeters <= right[0]) {
      if (right[0] === left[0]) return left[1];
      const factor = (distanceMeters - left[0]) / (right[0] - left[0]);
      return left[1] + factor * (right[1] - left[1]);
    }
  }
  return table[table.length - 1][1];
}

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

  const mil = interpolateTable(L81_FIRING_TABLE, distanceMeters);
  return {
    inRange: true,
    mil,
    status: 'TRONG TẦM BẮN',
    warning: null
  };
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
const heroLabelText = document.getElementById('heroLabelText');
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

// Aim Overlay Buttons & Container
const btnAimOverlay = document.getElementById('btnAimOverlay');
const btnLiveAimOverlay = document.getElementById('btnLiveAimOverlay');
const btnTopAimOverlay = document.getElementById('btnTopAimOverlay');
const btnMiniSightAim = document.getElementById('btnMiniSightAim');
const scopeOverlay = document.getElementById('scope-overlay');
const closeScopeOverlayBtn = document.getElementById('closeScopeOverlayBtn');
const scopePipBtn = document.getElementById('scopePipBtn');
const scopeScaleDownBtn = document.getElementById('scopeScaleDownBtn');
const scopeScaleUpBtn = document.getElementById('scopeScaleUpBtn');
const scopeScaleDisplay = document.getElementById('scopeScaleDisplay');
const scopeAperture = document.getElementById('scopeAperture');
let scopeScale = 1.0;
let scopeBgMode = 'vignette';

// Click mode buttons
const setGunModeBtn = document.getElementById('setGunModeBtn');
const setTargetModeBtn = document.getElementById('setTargetModeBtn');
const centerViewBtn = document.getElementById('centerViewBtn');

// FORMAT GRID COORDINATES (e.g. x79.56 y91.67 matching game HUD with (0,0) at bottom-left)
function formatGridCoord(x, y) {
  const gx = (Math.max(0, x) / 100).toFixed(2);
  const gy = (Math.max(0, y) / 100).toFixed(2);
  return `x${gx} y${gy}`;
}

// PARSE USER INPUT COORDINATES (Supports 79.56, x79.56 or meters 7956)
function parseCoordInput(val) {
  if (typeof val === 'string') {
    val = val.replace(/[xyXY]/g, '').trim();
  }
  const num = parseFloat(val);
  if (isNaN(num)) return NaN;
  // If player entered grid coordinates (e.g. 79.56 or 114.30), convert to map meters (* 100)
  if (Math.abs(num) < 500) {
    return Math.abs(num) * 100;
  }
  return Math.abs(num);
}

// 1. ELEVATION LOOKUP LOGIC (Coordinates normalized relative to 0,0 at bottom-left)
function getElevation(x, y) {
  if (!currentElevationData) return 0;
  const cfg = MAP_CONFIGS[currentMapKey];

  // Normalized coordinate in 0..1 across map width & height
  const normX = x / cfg.width;
  const normY = y / cfg.height;

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

  const cfg = MAP_CONFIGS[currentMapKey];
  const zGunASL = Math.max(0, zGun - cfg.zRange.min);
  const zTargetASL = Math.max(0, zTarget - cfg.zRange.min);
  const dist3D = Math.hypot(dx, dy, deltaZ);

  // Bearing (0° North, 90° East, clockwise)
  let bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
  let mathDeg = (Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360;
  const cardinal = getCardinal(bearing);

  if (currentWeaponKey === 'mortar') {
    // Mortar Height Compensation: ΔD ≈ ΔZ / 1.88 ≈ 0.532 * ΔZ
    const rangeCompensation = deltaZ / 1.88;
    const adjustedDistance = Math.max(80, Math.min(684, dist2D + rangeCompensation));

    const elevSol = getMortarElevation(adjustedDistance);
    const inRange = elevSol.inRange;
    const mils = elevSol.mil !== null ? Math.round(elevSol.mil) : null;
    const elevDegrees = mils !== null ? (mils * 0.05625).toFixed(1) : '---';
    const tof = mils !== null ? (10.0 + mils * 0.01494).toFixed(1) : '--.-';
    const apexRise = inRange ? Math.round(40 + ((adjustedDistance - 80) / 604) * 260) : 40;

    return {
      weapon: 'mortar',
      gun: { x: gunPos.lng, y: gunPos.lat, z: zGun, zASL: zGunASL },
      target: { x: targetPos.lng, y: targetPos.lat, z: zTarget, zASL: zTargetASL },
      dist2D,
      dist3D,
      deltaZ,
      rangeCompensation,
      adjustedDistance,
      bearing,
      mathDeg,
      cardinal,
      mils,
      elevDegrees,
      tof,
      apexRise,
      inRange,
      status: elevSol.status,
      warning: elevSol.warning
    };
  } else {
    // SPH-2 Howitzer (155mm)
    // Range compensation for high arc: ΔD ≈ ΔZ / 1.6 ≈ 0.62 * ΔZ
    const rangeCompensation = deltaZ / 1.6;
    const adjustedDistance = dist2D + rangeCompensation;

    let inRange = adjustedDistance >= 780 && adjustedDistance <= 2629;
    let status = 'TRONG TẦM BẮN';
    let warning = null;

    if (adjustedDistance < 780) {
      inRange = false;
      status = 'DƯỚI CỰ LY TỐI THIỂU (<780m)';
      warning = 'DƯỚI 780M (VÙNG CHẾT SPH-2)';
    } else if (adjustedDistance > 2629) {
      inRange = false;
      status = 'VƯỢT CỰ LY TỐI ĐA (>2629m)';
      warning = 'VƯỢT 2629M (QUÁ TẦM BẮN)';
    }

    // High Arc solution (780m - 2629m)
    const highMilRaw = interpolateTable(SPH2_HIGH_TABLE, adjustedDistance);
    const highMil = highMilRaw !== null ? Math.round(highMilRaw) : null;
    const highDegrees = highMil !== null ? (highMil * 0.05625).toFixed(1) : '---';
    const highToF = highMil !== null ? (22.0 + (highMil - 610) / (1390 - 610) * 28.0).toFixed(1) : '--.-';
    const highApex = inRange ? Math.round(350 + ((2629 - adjustedDistance) / 1849) * 850) : 350;

    // Low Arc solution (1181m - 2629m)
    const lowMilRaw = (adjustedDistance >= 1181 && adjustedDistance <= 2629)
      ? interpolateTable(SPH2_LOW_TABLE, adjustedDistance)
      : null;
    const lowMil = lowMilRaw !== null ? Math.round(lowMilRaw) : null;
    const lowDegrees = lowMil !== null ? (lowMil * 0.05625).toFixed(1) : '---';
    const lowToF = lowMil !== null ? (11.0 + (adjustedDistance - 1181) / (2629 - 1181) * 11.0).toFixed(1) : '--.-';
    const lowApex = lowMil !== null ? Math.round(60 + ((adjustedDistance - 1181) / 1448) * 200) : 60;

    return {
      weapon: 'sph2',
      gun: { x: gunPos.lng, y: gunPos.lat, z: zGun, zASL: zGunASL },
      target: { x: targetPos.lng, y: targetPos.lat, z: zTarget, zASL: zTargetASL },
      dist2D,
      dist3D,
      deltaZ,
      rangeCompensation,
      adjustedDistance,
      bearing,
      mathDeg,
      cardinal,
      inRange,
      status,
      warning,
      highMil,
      highDegrees,
      highToF,
      highApex,
      lowMil,
      lowDegrees,
      lowToF,
      lowApex,
      sphArcMode
    };
  }
}

// 3. UPDATE MAP RANGE CIRCLES
function updateRangeCircles(gunLatLng) {
  // Clear old circles
  gunRangeCircles.forEach(c => map.removeLayer(c));
  gunRangeCircles = [];

  if (currentWeaponKey === 'mortar') {
    // Mortar 80m dead zone
    const minCircle = L.circle(gunLatLng, {
      radius: 80,
      color: '#ef4444',
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: '#ef4444',
      fillOpacity: 0.05
    }).addTo(map);
    gunRangeCircles.push(minCircle);

    // Mortar 684m max range
    const maxCircle = L.circle(gunLatLng, {
      radius: 684,
      color: '#4ade80',
      weight: 1.6,
      fillColor: '#4ade80',
      fillOpacity: 0.03
    }).addTo(map);
    gunRangeCircles.push(maxCircle);
  } else {
    // SPH-2: 780m min dead zone
    const minCircle = L.circle(gunLatLng, {
      radius: 780,
      color: '#ef4444',
      weight: 1.5,
      dashArray: '5, 5',
      fillColor: '#ef4444',
      fillOpacity: 0.04
    }).addTo(map);
    gunRangeCircles.push(minCircle);

    // SPH-2: 1181m low arc threshold
    const lowArcCircle = L.circle(gunLatLng, {
      radius: 1181,
      color: '#38bdf8',
      weight: 1.4,
      dashArray: '4, 4',
      fillColor: '#38bdf8',
      fillOpacity: 0.03
    }).addTo(map);
    gunRangeCircles.push(lowArcCircle);

    // SPH-2: 2629m max range
    const maxCircle = L.circle(gunLatLng, {
      radius: 2629,
      color: '#4ade80',
      weight: 1.6,
      fillColor: '#4ade80',
      fillOpacity: 0.02
    }).addTo(map);
    gunRangeCircles.push(maxCircle);
  }

  // Current Target Distance Ring
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
}

// 4. UPDATE UI
function updateUI() {
  if (!gunMarker || !targetMarker) return;

  const gunLatLng = gunMarker.getLatLng();
  const targetLatLng = targetMarker.getLatLng();

  currentSolution = calculateBallistics(gunLatLng, targetLatLng);
  const s = currentSolution;

  // Hero numbers
  if (heroLabelText) {
    heroLabelText.textContent = s.weapon === 'sph2'
      ? 'CỰ LY CẦN BẮN SPH-2 (ĐÃ BÙ ĐỘ CAO)'
      : 'CỰ LY CẦN ĐẶT THƯỚC NGẮM (ĐÃ BÙ ĐỘ CAO)';
  }

  if (s.inRange) {
    heroFiringRange.innerHTML = `${s.adjustedDistance.toFixed(1)} <span class="hero-unit">m</span>`;
  } else {
    heroFiringRange.innerHTML = `<span style="color:#ef4444; font-size:1.35rem;">${s.warning || 'NGOÀI TẦM'}</span>`;
  }
  heroFlatDist.textContent = `Thực: ${s.dist2D.toFixed(1)} m`;

  const compSign = s.rangeCompensation >= 0 ? '+' : '';
  const zSign = s.deltaZ >= 0 ? '+' : '';
  heroDeltaZ.textContent = `Độ cao: ${zSign}${s.deltaZ.toFixed(1)} m (${compSign}${s.rangeCompensation.toFixed(1)}m bù)`;

  // Cards
  solBearing.textContent = `${Math.round(s.bearing)}°`;
  solCardinal.textContent = `${s.cardinal} (${s.bearing.toFixed(1)}°)`;

  if (s.weapon === 'mortar') {
    if (s.inRange) {
      solElevationMils.textContent = `${s.mils}`;
      solElevationDeg.textContent = `${s.elevDegrees}° nâng nòng`;
      solToF.textContent = `~${s.tof}s`;
      solApex.textContent = `+${s.apexRise}m`;
    } else {
      solElevationMils.textContent = `---`;
      solElevationDeg.textContent = s.status;
      solToF.textContent = `---`;
      solApex.textContent = `---`;
    }
  } else {
    // SPH-2
    if (!s.inRange) {
      solElevationMils.textContent = `---`;
      solElevationDeg.textContent = s.status;
      solToF.textContent = `---`;
      solApex.textContent = `---`;
    } else {
      if (sphArcMode === 'high') {
        solElevationMils.textContent = `${s.highMil}`;
        solElevationDeg.textContent = `${s.highDegrees}° (Góc Bổng / High)`;
        solToF.textContent = `~${s.highToF}s`;
        solApex.textContent = `+${s.highApex}m`;
      } else if (sphArcMode === 'low') {
        if (s.lowMil !== null) {
          solElevationMils.textContent = `${s.lowMil}`;
          solElevationDeg.textContent = `${s.lowDegrees}° (Góc Thấp / Low)`;
          solToF.textContent = `~${s.lowToF}s`;
          solApex.textContent = `+${s.lowApex}m`;
        } else {
          solElevationMils.textContent = `---`;
          solElevationDeg.textContent = `Cần ≥ 1181m cho Góc Thấp`;
          solToF.textContent = `---`;
          solApex.textContent = `---`;
        }
      } else {
        // Auto / Both
        if (s.lowMil !== null) {
          solElevationMils.textContent = `${s.lowMil} / ${s.highMil}`;
          solElevationDeg.textContent = `Thấp: ${s.lowDegrees}° / Bổng: ${s.highDegrees}°`;
          solToF.textContent = `~${s.lowToF}s / ~${s.highToF}s`;
          solApex.textContent = `+${s.lowApex}m / +${s.highApex}m`;
        } else {
          solElevationMils.textContent = `${s.highMil}`;
          solElevationDeg.textContent = `${s.highDegrees}° (Chỉ có Góc Bổng)`;
          solToF.textContent = `~${s.highToF}s`;
          solApex.textContent = `+${s.highApex}m`;
        }
      }
    }
  }

  // Details - Formatted in game grid coordinate style (e.g. x79.60 y91.67)
  gunCoordsDisplay.textContent = `${formatGridCoord(s.gun.x, s.gun.y)} (Độ cao: ${s.gun.zASL.toFixed(1)}m)`;
  targetCoordsDisplay.textContent = `${formatGridCoord(s.target.x, s.target.y)} (Độ cao: ${s.target.zASL.toFixed(1)}m)`;
  dist3dDisplay.textContent = `${s.dist3D.toFixed(1)} m`;

  // Form Inputs sync (Game grid format: e.g. 79.60, 91.67)
  inputGunX.value = (s.gun.x / 100).toFixed(2);
  inputGunY.value = (s.gun.y / 100).toFixed(2);
  inputTargetX.value = (s.target.x / 100).toFixed(2);
  inputTargetY.value = (s.target.y / 100).toFixed(2);

  // Update Trajectory Polyline
  if (trajectoryLine) {
    trajectoryLine.setLatLngs([gunLatLng, targetLatLng]);
    trajectoryLine.setTooltipContent(
      `Cự ly: ${s.dist2D.toFixed(0)}m (Bù: ${s.adjustedDistance.toFixed(0)}m) | ${Math.round(s.bearing)}°`
    );
  }

  // Update Gun Range Rings
  updateRangeCircles(gunLatLng);
  if (gunRangeCircle) {
    gunRangeCircle.setRadius(s.dist2D);
    gunRangeCircle.setStyle({
      color: s.inRange ? '#f59e0b' : '#ef4444'
    });
  }

  // Update In-Game Gunner Sight Simulation
  updateGunnerSight(s);
  updateScopeOverlay(s);
  checkCoordsFilled();
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

// 4c. ELEVATION LADDER MARKS FOR MORTAR (80m / 950 MIL to 684m / 150 MIL)
// Strictly 17 exact marks from in-game sight reticle: 80, 110, 132, 187, 240, 290, 340, 385, 430, 470, 510, 545, 578, 609, 637, 661, 684
const LADDER_MARKS = [
  { mil: 950, r: 80, hasLabel: true },
  { mil: 900, r: 110, hasLabel: true },
  { mil: 850, r: 132, hasLabel: true },
  { mil: 800, r: 187, hasLabel: true },
  { mil: 750, r: 240, hasLabel: true },
  { mil: 700, r: 290, hasLabel: true },
  { mil: 650, r: 340, hasLabel: true },
  { mil: 600, r: 385, hasLabel: true },
  { mil: 550, r: 430, hasLabel: true },
  { mil: 500, r: 470, hasLabel: true },
  { mil: 450, r: 510, hasLabel: true },
  { mil: 400, r: 545, hasLabel: true },
  { mil: 350, r: 578, hasLabel: true },
  { mil: 300, r: 609, hasLabel: true },
  { mil: 250, r: 637, hasLabel: true },
  { mil: 200, r: 661, hasLabel: true },
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

// 4d. UPDATE GUNNER SIGHT HUD
function updateGunnerSight(sol) {
  if (!sol) return;

  drawHeadingTape(sol.bearing);

  const mortarSightStage = document.getElementById('mortarSightStage');
  const sphSightStage = document.getElementById('sphGunnerStage');
  const gunnerTitle = document.getElementById('gunnerTitle');
  const gunnerMainDist = document.getElementById('gunnerMainDist');
  const gunnerSubStats = document.getElementById('gunnerSubStats');
  const targetCoordBadge = document.getElementById('target-coord-badge');

  if (targetCoordBadge) {
    targetCoordBadge.textContent = formatGridCoord(sol.target.x, sol.target.y);
  }

  if (sol.weapon === 'mortar') {
    if (mortarSightStage) mortarSightStage.style.display = 'flex';
    if (sphSightStage) sphSightStage.style.display = 'none';
    if (gunnerTitle) gunnerTitle.textContent = 'L81 GUNNER SIGHT';

    const leftTrack = document.getElementById('ladderLeftTrack');
    const rightTrack = document.getElementById('ladderRightTrack');
    const indLeft = document.getElementById('ladderIndLeft');
    const indRight = document.getElementById('ladderIndRight');

    const currentMil = sol.mils || (sol.adjustedDistance <= 80 ? 950 : 150);
    const clampedMil = Math.max(150, Math.min(950, currentMil));
    const translateY = (clampedMil - 950) * LADDER_PX_PER_MIL;

    if (leftTrack) leftTrack.style.transform = `translateY(${translateY}px)`;
    if (rightTrack) rightTrack.style.transform = `translateY(${translateY}px)`;

    document.querySelectorAll('.ladder-row').forEach(row => {
      const rowMil = parseFloat(row.dataset.mil);
      const diff = Math.abs(rowMil - clampedMil);
      row.classList.toggle('center-active', diff <= 30);
    });

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
  } else {
    // SPH-2 ARTILLERY SIGHT
    if (mortarSightStage) mortarSightStage.style.display = 'none';
    if (sphSightStage) sphSightStage.style.display = 'flex';
    if (gunnerTitle) gunnerTitle.textContent = 'SPH-2 FIRE CONTROL SIGHT';

    const sphHighMil = document.getElementById('sphSightHighMil');
    const sphHighDeg = document.getElementById('sphSightHighDeg');
    const sphLowMil = document.getElementById('sphSightLowMil');
    const sphLowDeg = document.getElementById('sphSightLowDeg');

    if (sphHighMil) sphHighMil.textContent = sol.highMil ? `${sol.highMil} MIL` : '---';
    if (sphHighDeg) sphHighDeg.textContent = sol.highDegrees ? `${sol.highDegrees}° nâng nòng` : '---';
    if (sphLowMil) sphLowMil.textContent = sol.lowMil ? `${sol.lowMil} MIL` : (sol.adjustedDistance < 1181 ? 'K/D' : '---');
    if (sphLowDeg) sphLowDeg.textContent = sol.lowDegrees ? `${sol.lowDegrees}° nâng nòng` : (sol.adjustedDistance < 1181 ? '<1181m' : '---');

    if (!sol.inRange) {
      if (gunnerMainDist) {
        gunnerMainDist.textContent = `${Math.round(sol.adjustedDistance)} M`;
        gunnerMainDist.classList.add('out-of-range');
      }
      if (gunnerSubStats) {
        gunnerSubStats.textContent = sol.warning ? `⚠️ ${sol.warning}` : `⚠️ NGOÀI TẦM BẮN (780M-2629M)`;
        gunnerSubStats.classList.add('out-of-range');
      }
    } else {
      if (gunnerMainDist) {
        gunnerMainDist.textContent = `${Math.round(sol.adjustedDistance)} M`;
        gunnerMainDist.classList.remove('out-of-range');
      }
      if (gunnerSubStats) {
        gunnerSubStats.textContent = sol.lowMil 
          ? `THẤP: ${sol.lowMil} · BỔNG: ${sol.highMil} MIL · ${sol.bearing.toFixed(1)}°`
          : `BỔNG: ${sol.highMil} MIL · ${sol.bearing.toFixed(1)}° · ${sol.highToF}S`;
        gunnerSubStats.classList.remove('out-of-range');
      }
    }
  }
}

// ============================================================
// 4e. FULLSCREEN AIMING SIGHT OVERLAY (Z-INDEX 999999 OVER ALL LAYERS)
// ============================================================
const SCOPE_LADDER_PX_PER_MIL = 0.9;

function checkCoordsFilled() {
  const gx = parseCoordInput(inputGunX.value);
  const gy = parseCoordInput(inputGunY.value);
  const tx = parseCoordInput(inputTargetX.value);
  const ty = parseCoordInput(inputTargetY.value);
  const isFilled = !isNaN(gx) && !isNaN(gy) && !isNaN(tx) && !isNaN(ty);

  if (btnAimOverlay) {
    btnAimOverlay.style.display = isFilled ? 'flex' : 'none';
  }
  if (btnTopAimOverlay) {
    btnTopAimOverlay.style.display = isFilled ? 'flex' : 'none';
  }
  if (btnLiveAimOverlay) {
    btnLiveAimOverlay.style.display = isFilled ? 'flex' : 'none';
  }
  return isFilled;
}

function initScopeOverlayLadder() {
  const leftTrack = document.getElementById('scopeLadderTrackLeft');
  const rightTrack = document.getElementById('scopeLadderTrackRight');
  if (!leftTrack || !rightTrack) return;

  leftTrack.innerHTML = LADDER_MARKS.map(m => {
    const topPx = (950 - m.mil) * SCOPE_LADDER_PX_PER_MIL;
    return `<div class="scope-ladder-row" data-mil="${m.mil}" data-range="${m.r}" style="top: ${topPx}px;">
      <span class="scope-ladder-val">${m.r}M</span>
      <span class="scope-ladder-tick"></span>
    </div>`;
  }).join('');

  rightTrack.innerHTML = LADDER_MARKS.map(m => {
    const topPx = (950 - m.mil) * SCOPE_LADDER_PX_PER_MIL;
    return `<div class="scope-ladder-row" data-mil="${m.mil}" data-range="${m.r}" style="top: ${topPx}px;">
      <span class="scope-ladder-tick"></span>
      <span class="scope-ladder-val">${m.mil}</span>
    </div>`;
  }).join('');

  const boxTopScale = document.getElementById('scopeBoxTopScale');
  if (boxTopScale) {
    boxTopScale.innerHTML = `
      <span>165</span><span>|</span><span>180</span><span>|</span><span>195</span>
      <span>|</span><span>210</span><span>|</span><span>225</span><span>|</span><span>240</span>
    `;
  }
}

function drawScopeHeadingTape(bearing, canvasEl = null) {
  const canvas = canvasEl || document.getElementById('scopeHeadingCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const centerX = w / 2;
  const pixelsPerDeg = 3.2;

  const cardinalsMap = {
    0: 'N', 45: 'NE', 90: 'E', 135: 'SE',
    180: 'S', 225: 'SW', 270: 'W', 315: 'NW'
  };

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';

  const minDeg = Math.floor(bearing - 60);
  const maxDeg = Math.ceil(bearing + 60);

  for (let deg = minDeg; deg <= maxDeg; deg++) {
    const normDeg = ((deg % 360) + 360) % 360;
    const x = centerX + (deg - bearing) * pixelsPerDeg;

    if (x < -20 || x > w + 20) continue;

    if (normDeg % 15 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 10);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const label = cardinalsMap[normDeg] || `${normDeg}`;
      ctx.fillText(label, x, 22);
    } else if (normDeg % 5 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 5);
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }

  const centerTextEl = document.getElementById('scopeHeadingCenterText');
  if (centerTextEl) {
    centerTextEl.textContent = `${Math.round(bearing)} ${getCardinal(bearing)}`;
  }
}

function updateScopeOverlay(sol) {
  if (!sol) return;

  drawScopeHeadingTape(sol.bearing);

  const scopeSphBox = document.getElementById('scopeSphBox');
  const scopeReticleBox = document.querySelector('.scope-reticle-box');

  if (sol.weapon === 'mortar') {
    if (scopeSphBox) scopeSphBox.style.display = 'none';
    if (scopeReticleBox) scopeReticleBox.style.display = 'flex';

    const leftTrack = document.getElementById('scopeLadderTrackLeft');
    const rightTrack = document.getElementById('scopeLadderTrackRight');
    const currentMil = sol.mils || (sol.adjustedDistance <= 80 ? 950 : 150);
    const clampedMil = Math.max(150, Math.min(950, currentMil));
    const translateY = (clampedMil - 950) * SCOPE_LADDER_PX_PER_MIL;

    if (leftTrack) leftTrack.style.transform = `translateY(${translateY}px)`;
    if (rightTrack) rightTrack.style.transform = `translateY(${translateY}px)`;

    document.querySelectorAll('.scope-ladder-row').forEach(row => {
      const rowMil = parseFloat(row.dataset.mil);
      const diff = Math.abs(rowMil - clampedMil);
      row.classList.toggle('target-locked', diff <= 25);
    });

    const distText = document.getElementById('scopeCenterDistText');
    const milText = document.getElementById('scopeCenterMilText');
    if (distText) distText.textContent = `${Math.round(sol.adjustedDistance)}M`;
    if (milText) milText.textContent = `${sol.mils || 150} MIL`;
  } else {
    // SPH-2 mode
    if (scopeSphBox) scopeSphBox.style.display = 'flex';
    if (scopeReticleBox) scopeReticleBox.style.display = 'none';
    const tag = document.getElementById('scopeSphTag');
    if (tag) {
      tag.textContent = `SPH-2 155MM · BỔNG: ${sol.highMil || '---'} MIL · THẤP: ${sol.lowMil || '---'} MIL`;
    }
  }

  // Bottom HUD
  const hudDist = document.getElementById('scopeHudDist');
  const hudDistRaw = document.getElementById('scopeHudDistRaw');
  const hudMil = document.getElementById('scopeHudMil');
  const hudDeg = document.getElementById('scopeHudDeg');
  const hudBearing = document.getElementById('scopeHudBearing');
  const hudCardinal = document.getElementById('scopeHudCardinal');
  const hudToF = document.getElementById('scopeHudToF');
  const targetSummary = document.getElementById('scopeTargetSummary');

  if (hudDist) hudDist.textContent = `${sol.adjustedDistance.toFixed(1)} M`;
  if (hudDistRaw) {
    const compSign = sol.rangeCompensation >= 0 ? '+' : '';
    hudDistRaw.textContent = `Thực: ${sol.dist2D.toFixed(1)}m · Bù: ${compSign}${sol.rangeCompensation.toFixed(1)}m`;
  }
  if (hudMil) {
    hudMil.textContent = sol.weapon === 'sph2'
      ? `${sol.highMil || '---'} MIL (Bổng)`
      : `${sol.mils || '---'} MIL`;
  }
  if (hudDeg) {
    hudDeg.textContent = sol.weapon === 'sph2'
      ? `${sol.highDegrees || '---'}° nâng nòng`
      : `${sol.elevDegrees || '---'}° nâng nòng`;
  }
  if (hudBearing) hudBearing.textContent = `${sol.bearing.toFixed(1)}°`;
  if (hudCardinal) hudCardinal.textContent = sol.cardinal;
  if (hudToF) hudToF.textContent = `${sol.tof} S`;

  if (targetSummary) {
    const mText = sol.weapon === 'sph2' ? `${sol.highMil} MIL` : `${sol.mils} MIL`;
    targetSummary.textContent = `MỤC TIÊU: ${sol.adjustedDistance.toFixed(0)}M · ${mText} · HƯỚNG ${sol.bearing.toFixed(1)}° (${sol.cardinal})`;
  }
}

function openScopeOverlay() {
  // Apply any manual inputs currently in fields
  const gx = parseCoordInput(inputGunX.value);
  const gy = parseCoordInput(inputGunY.value);
  const tx = parseCoordInput(inputTargetX.value);
  const ty = parseCoordInput(inputTargetY.value);
  if (!isNaN(gx) && !isNaN(gy) && gunMarker) gunMarker.setLatLng([gy, gx]);
  if (!isNaN(tx) && !isNaN(ty) && targetMarker) targetMarker.setLatLng([ty, tx]);

  updateUI();
  if (currentSolution) updateScopeOverlay(currentSolution);

  if (scopeOverlay) {
    scopeOverlay.classList.remove('hidden');
  }
  showToast('🎯 Đã bật thước ngắm đè màn hình! Nhấn Esc để đóng.');
}

function closeScopeOverlay() {
  if (scopeOverlay) {
    scopeOverlay.classList.add('hidden');
  }
}

async function toggleScopePictureInPicture() {
  if (!('documentPictureInPicture' in window)) {
    showToast('Trình duyệt chưa hỗ trợ Document PiP (khuyên dùng Chrome/Edge 116+)');
    return;
  }

  if (window.documentPictureInPicture.window) {
    window.documentPictureInPicture.window.close();
    return;
  }

  try {
    const pipWin = await window.documentPictureInPicture.requestWindow({
      width: 700,
      height: 560
    });

    [...document.styleSheets].forEach(sheet => {
      try {
        const cssRules = [...sheet.cssRules].map(r => r.cssText).join('');
        const style = document.createElement('style');
        style.textContent = cssRules;
        pipWin.document.head.appendChild(style);
      } catch (e) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        pipWin.document.head.appendChild(link);
      }
    });

    pipWin.document.body.style.margin = '0';
    pipWin.document.body.style.padding = '0';
    pipWin.document.body.style.background = '#080d14';
    pipWin.document.body.style.overflow = 'hidden';

    const stageEl = document.getElementById('scopeStage');
    if (stageEl) {
      const clone = stageEl.cloneNode(true);
      clone.style.height = '100vh';
      clone.style.width = '100vw';
      pipWin.document.body.appendChild(clone);

      const pipCanvas = clone.querySelector('#scopeHeadingCanvas');
      if (pipCanvas && currentSolution) {
        drawScopeHeadingTape(currentSolution.bearing, pipCanvas);
      }
    }

    showToast('🖼️ Đã ghim thước ngắm Always-On-Top đè lên game!');
  } catch (err) {
    console.error('PiP Error:', err);
    showToast(`Không thể mở PiP: ${err.message}`);
  }
}

// 5. WEAPON & ARC SWITCHING
function setWeapon(weaponKey) {
  if (!WEAPON_CONFIGS[weaponKey]) return;
  currentWeaponKey = weaponKey;

  document.querySelectorAll('.weapon-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.weapon === weaponKey);
  });

  const brandTag = document.getElementById('weaponBrandTag');
  if (brandTag) brandTag.textContent = WEAPON_CONFIGS[weaponKey].shortName;

  const panelTitle = document.getElementById('panelTitleText');
  if (panelTitle) {
    panelTitle.textContent = weaponKey === 'sph2' 
      ? '🚜 BẢNG BẮN PHÁO TỰ HÀNH SPH-2' 
      : '🎯 BẢNG BẮN CỐI L81';
  }

  const sphArcSelector = document.getElementById('sphArcSelector');
  const sphNotice = document.getElementById('sphLevelNotice');
  if (sphArcSelector) sphArcSelector.style.display = weaponKey === 'sph2' ? 'flex' : 'none';
  if (sphNotice) sphNotice.style.display = weaponKey === 'sph2' ? 'block' : 'none';

  const modalBtn = document.getElementById('rangeLadderBtn');
  if (modalBtn) {
    modalBtn.textContent = weaponKey === 'sph2' ? '📊 SPH-2 Ladder' : '📊 Range Ladder';
  }

  updateUI();
  showToast(`Đã chuyển sang: ${WEAPON_CONFIGS[weaponKey].name}`);
}

function setSphArc(mode) {
  sphArcMode = mode;
  document.querySelectorAll('.arc-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.arc === mode);
  });
  updateUI();
}

// Custom Leaflet CRS with origin (0,0) at bottom-left corner of the map
function getBottomLeftCRS(height) {
  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(1, 0, -1, height)
  });
}

// 6. MAP INITIALIZATION & SWITCHING
async function loadMap(mapKey) {
  const cfg = MAP_CONFIGS[mapKey];
  if (!cfg) return;

  currentMapKey = mapKey;
  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.pointerEvents = 'auto';

  // Load 2048x2048 uint16 elevation buffer
  try {
    const res = await fetch(cfg.elevation);
    const buf = await res.arrayBuffer();
    currentElevationData = new Uint16Array(buf);
  } catch (e) {
    console.error('Failed to load elevation for', mapKey, e);
    currentElevationData = null;
  }

  // Bounds strictly from (0,0) at bottom-left to (height, width) at top-right
  const southWest = L.latLng(0, 0);
  const northEast = L.latLng(cfg.height, cfg.width);
  const bounds = L.latLngBounds(southWest, northEast);

  if (!map) {
    map = L.map('map', {
      crs: getBottomLeftCRS(cfg.height),
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false
    });

    // Mouse move coordinate tracker (Grid format x79.56 y91.67)
    map.on('mousemove', (e) => {
      const zRaw = getElevation(e.latlng.lng, e.latlng.lat);
      const cfgNow = MAP_CONFIGS[currentMapKey];
      const zASL = Math.max(0, zRaw - cfgNow.zRange.min);
      footerPos.textContent = formatGridCoord(e.latlng.lng, e.latlng.lat);
      footerElev.textContent = `Độ cao: ${zASL.toFixed(1)} m`;
    });

    // Map click handler for interactive placement
    map.on('click', (e) => {
      if (clickMode === 'gun') {
        gunMarker.setLatLng(e.latlng);
        setClickMode(null);
        updateUI();
        showToast("Đã đặt vị trí Súng [G]!");
      } else if (clickMode === 'target') {
        targetMarker.setLatLng(e.latlng);
        setClickMode(null);
        updateUI();
        showToast("Đã đặt vị trí Mục tiêu [T]!");
      }
    });
  } else {
    map.options.crs = getBottomLeftCRS(cfg.height);
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
      title: 'Vị trí Súng [G] (Kéo thả để di chuyển)'
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

  // Trajectory Line
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

  // Range rings
  updateRangeCircles(gunLatLng);

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

// 7. OBJECTIVES & TOWERS OVERLAY (Converted relative to 0,0 at bottom-left)
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
      // Convert raw UE5 coordinates to (0,0 at bottom-left) map coordinates
      const rawX = zone.center[0];
      const rawY = zone.center[1];
      const x = rawX - cfg.rawBounds.min[0];
      const y = rawY - cfg.rawBounds.min[1];

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

// 8. METAFORGE STYLE G & T BADGES
function createMortarIcon() {
  const html = `
    <div class="metaforge-marker marker-gun" title="Vị trí Súng [G] (Kéo thả để đổi vị trí)">
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

// 9. CLICK MODES (SET GUN / SET TARGET)
function setClickMode(mode) {
  clickMode = mode;
  setGunModeBtn.classList.toggle('active-gun', mode === 'gun');
  setTargetModeBtn.classList.toggle('active-target', mode === 'target');
  map.getContainer().style.cursor = mode ? 'crosshair' : '';
}

setGunModeBtn.addEventListener('click', () => {
  setClickMode(clickMode === 'gun' ? null : 'gun');
  if (clickMode === 'gun') showToast("Click vào bản đồ để đặt vị trí SÚNG [G]");
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

// 10. FORM CONTROLS & LISTENERS
applyCoordsBtn.addEventListener('click', () => {
  const gx = parseCoordInput(inputGunX.value);
  const gy = parseCoordInput(inputGunY.value);
  const tx = parseCoordInput(inputTargetX.value);
  const ty = parseCoordInput(inputTargetY.value);

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
  const gunStr = formatGridCoord(s.gun.x, s.gun.y);
  const targetStr = formatGridCoord(s.target.x, s.target.y);
  const mapName = MAP_CONFIGS[currentMapKey].name;

  let text = '';
  if (s.weapon === 'mortar') {
    text = s.inRange
      ? `[L81 MORTAR - ${mapName}] Súng: ${gunStr} -> Mục tiêu: ${targetStr} | Cự ly cần bắn: ${s.adjustedDistance.toFixed(1)}m (Thực: ${s.dist2D.toFixed(0)}m, Bù cao: ${s.rangeCompensation >= 0 ? '+' : ''}${s.rangeCompensation.toFixed(1)}m) | Hướng: ${Math.round(s.bearing)}° (${s.cardinal}) | Thước ngắm: ${s.mils} MIL (${s.elevDegrees}°) | Đạn bay: ~${s.tof}s`
      : `[L81 MORTAR - ${mapName}] Súng: ${gunStr} -> Mục tiêu: ${targetStr} | ⚠️ ${s.warning} (Cự ly: ${s.adjustedDistance.toFixed(0)}m ngoài khoảng 80m - 684m) | Hướng: ${Math.round(s.bearing)}° (${s.cardinal})`;
  } else {
    // SPH-2
    const lowPart = s.lowMil !== null ? ` | Góc Thấp: ${s.lowMil} MIL (${s.lowDegrees}°, ~${s.lowToF}s)` : '';
    text = s.inRange
      ? `[SPH-2 HOWITZER - ${mapName}] Súng: ${gunStr} -> Mục tiêu: ${targetStr} | Cự ly: ${s.adjustedDistance.toFixed(1)}m (Thực: ${s.dist2D.toFixed(0)}m) | Hướng: ${Math.round(s.bearing)}° (${s.cardinal}) | Góc Bổng: ${s.highMil} MIL (${s.highDegrees}°, ~${s.highToF}s)${lowPart}`
      : `[SPH-2 HOWITZER - ${mapName}] Súng: ${gunStr} -> Mục tiêu: ${targetStr} | ⚠️ ${s.warning} (Cự ly: ${s.adjustedDistance.toFixed(0)}m ngoài khoảng 780m - 2629m) | Hướng: ${Math.round(s.bearing)}° (${s.cardinal})`;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast("Đã sao chép giải pháp bắn vào bộ nhớ tạm!");
  });
});

// Save Target History
saveTargetBtn.addEventListener('click', () => {
  if (!currentSolution) return;
  const s = currentSolution;
  const wName = s.weapon === 'sph2' ? 'SPH-2' : 'L81';
  const elevStr = s.weapon === 'sph2' 
    ? (s.lowMil ? `L:${s.lowMil}/H:${s.highMil} MIL` : `H:${s.highMil} MIL`)
    : `${s.mils} MIL`;

  savedTargets.unshift({
    name: `Mục tiêu #${savedTargets.length + 1} (${wName})`,
    rawX: s.target.x,
    rawY: s.target.y,
    coord: formatGridCoord(s.target.x, s.target.y),
    zASL: s.target.zASL.toFixed(1),
    dist: s.adjustedDistance.toFixed(0) + 'm',
    bearing: Math.round(s.bearing) + '°',
    elev: elevStr
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
      <div><strong>${t.name}</strong> (${t.coord})</div>
      <div style="color:var(--accent-amber)">${t.dist} | ${t.bearing} | ${t.elev || ''}</div>
    `;
    item.addEventListener('click', () => {
      targetMarker.setLatLng([t.rawY, t.rawX]);
      updateUI();
      showToast(`Đã chuyển mục tiêu về ${t.name}`);
    });
    historyList.appendChild(item);
  });
}

// Weapon Buttons
document.querySelectorAll('.weapon-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const wKey = e.currentTarget.dataset.weapon;
    setWeapon(wKey);
  });
});

// Arc Mode Buttons for SPH-2
document.querySelectorAll('.arc-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const arc = e.currentTarget.dataset.arc;
    setSphArc(arc);
  });
});

// Map selection buttons
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

// 11. RANGE LADDER MODAL CONTROLS & TABLE RENDERING
const rangeLadderBtn = document.getElementById('rangeLadderBtn');
const rangeLadderModal = document.getElementById('range-ladder-modal');
const closeLadderModalBtn = document.getElementById('closeLadderModalBtn');
const ladderSearchInput = document.getElementById('ladderSearchInput');
const ladderTableBody = document.getElementById('ladderTableBody');

function renderLadderTable(filterText = '') {
  if (!ladderTableBody) return;
  const term = filterText.toLowerCase().trim();

  const summaryEl = document.getElementById('ladderModalSummary');
  const titleEl = document.getElementById('ladderModalTitle');
  const hintEl = document.getElementById('ladderHint');
  const theadEl = document.getElementById('ladderTableHead');

  document.querySelectorAll('.modal-w-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.wmodal === modalWeaponKey);
  });

  if (modalWeaponKey === 'mortar') {
    if (titleEl) titleEl.textContent = 'BẢNG TRA THƯỚC NGẮM - SÚNG CỐI L81 (80M - 684M)';
    if (hintEl) hintEl.textContent = '💡 Quy tắc ngắm cối: Cự ly càng gần thì số MIL càng lớn (nâng nòng dốc). Cự ly xa số MIL càng nhỏ.';
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="summary-pill"><span class="pill-k">CỰ LY HIỆU QUẢ</span><span class="pill-v">80 m — 684 m</span></div>
        <div class="summary-pill"><span class="pill-k">THƯỚC NGẮM (ELEVATION)</span><span class="pill-v">950 MIL → 150 MIL</span></div>
        <div class="summary-pill"><span class="pill-k">TỶ LỆ BÙ CAO ĐỘ</span><span class="pill-v">ΔD ≈ +0.532 × ΔZ</span></div>
        <div class="summary-pill"><span class="pill-k">THỜI GIAN BAY (ToF)</span><span class="pill-v">12.2 s — 24.2 s</span></div>
      `;
    }
    if (theadEl) {
      theadEl.innerHTML = `
        <tr>
          <th>CỰ LY (M)</th>
          <th>THƯỚC NGẮM (MIL)</th>
          <th>THỜI GIAN BAY (ToF)</th>
          <th>GÓC NÂNG NÒNG</th>
          <th>ĐẶC ĐIỂM QUỸ ĐẠO</th>
        </tr>
      `;
    }

    // Find closest mark to active solution
    let closestMortarIdx = -1;
    let minMortarDiff = Infinity;
    if (currentSolution && currentSolution.weapon === 'mortar' && currentSolution.inRange) {
      L81_FIRING_TABLE.forEach(([r], idx) => {
        const diff = Math.abs(currentSolution.adjustedDistance - r);
        if (diff < minMortarDiff) {
          minMortarDiff = diff;
          closestMortarIdx = idx;
        }
      });
    }

    const rowsHtml = L81_FIRING_TABLE.map(([r, mil], idx) => {
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

      const isActive = idx === closestMortarIdx;

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
  } else {
    // SPH-2 table
    if (titleEl) titleEl.textContent = 'BẢNG TRA THƯỚC NGẮM - PHÁO TỰ HÀNH SPH-2 (780M - 2629M)';
    if (hintEl) hintEl.textContent = '💡 Quy tắc SPH-2: Góc Thấp (Low Arc) bay thẳng nhanh từ 1181m. Góc Bổng (High Arc) cầu vồng vượt địa hình từ 780m.';
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="summary-pill"><span class="pill-k">TẦM BẮN TOÀN BỘ</span><span class="pill-v">780 m — 2629 m</span></div>
        <div class="summary-pill"><span class="pill-k">GÓC THẤP (LOW ARC)</span><span class="pill-v">20 → 600 MIL (≥1181m)</span></div>
        <div class="summary-pill"><span class="pill-k">GÓC BỔNG (HIGH ARC)</span><span class="pill-v">1390 → 610 MIL (≥780m)</span></div>
        <div class="summary-pill"><span class="pill-k">THỜI GIAN BAY (ToF)</span><span class="pill-v">11 s — 50 s</span></div>
      `;
    }
    if (theadEl) {
      theadEl.innerHTML = `
        <tr>
          <th>CỰ LY (M)</th>
          <th>GÓC THẤP (LOW MIL)</th>
          <th>GÓC BỔNG (HIGH MIL)</th>
          <th>ToF THẤP / BỔNG</th>
          <th>QUỸ ĐẠO KHUYÊN DÙNG</th>
        </tr>
      `;
    }

    const sampleRanges = [780];
    for (let d = 800; d <= 2600; d += 50) sampleRanges.push(d);
    sampleRanges.push(2629);

    const rowsHtml = sampleRanges.map(r => {
      const highMilRaw = interpolateTable(SPH2_HIGH_TABLE, r);
      const highMil = highMilRaw !== null ? Math.round(highMilRaw) : null;
      const lowMilRaw = (r >= 1181) ? interpolateTable(SPH2_LOW_TABLE, r) : null;
      const lowMil = lowMilRaw !== null ? Math.round(lowMilRaw) : null;

      const lowTof = lowMil !== null ? (11.0 + (r - 1181) / (2629 - 1181) * 11.0).toFixed(1) : null;
      const highTof = highMil !== null ? (22.0 + (highMil - 610) / (1390 - 610) * 28.0).toFixed(1) : null;

      let trait = 'Tùy chọn Góc Thấp hoặc Bổng';
      if (r < 1181) trait = 'Chỉ có Góc Bổng (High Arc)';
      else if (r >= 2200) trait = 'Tầm xa tối đa';

      if (term) {
        const match = `${r}`.includes(term) || (highMil && `${highMil}`.includes(term)) || (lowMil && `${lowMil}`.includes(term)) || trait.toLowerCase().includes(term);
        if (!match) return '';
      }

      const isActive = currentSolution && currentSolution.weapon === 'sph2' && currentSolution.inRange && Math.abs(currentSolution.adjustedDistance - r) < 26;

      const lowDisplay = lowMil !== null ? `${lowMil} MIL` : '<span style="color:var(--text-muted);font-size:0.75rem;">N/A (&lt;1181m)</span>';
      const highDisplay = highMil !== null ? `${highMil} MIL` : '---';
      const tofDisplay = lowTof ? `~${lowTof}s / ~${highTof}s` : `~${highTof}s`;

      return `
        <tr class="${isActive ? 'active-bracket' : ''}">
          <td class="col-range">${r} m</td>
          <td style="color:#38bdf8; font-weight:700; font-family:var(--font-mono);">${lowDisplay}</td>
          <td style="color:#f59e0b; font-weight:700; font-family:var(--font-mono);">${highDisplay}</td>
          <td class="col-tof">${tofDisplay}</td>
          <td><span class="badge-tag-bracket">${trait}</span></td>
        </tr>
      `;
    }).filter(Boolean).join('');

    ladderTableBody.innerHTML = rowsHtml || `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Không tìm thấy cự ly phù hợp</td></tr>`;
  }
}

// Modal weapon switcher
document.querySelectorAll('.modal-w-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    modalWeaponKey = e.currentTarget.dataset.wmodal;
    renderLadderTable(ladderSearchInput ? ladderSearchInput.value : '');
  });
});

if (rangeLadderBtn && rangeLadderModal) {
  rangeLadderBtn.addEventListener('click', () => {
    modalWeaponKey = currentWeaponKey;
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

// Scope Overlay buttons & controls
if (btnAimOverlay) btnAimOverlay.addEventListener('click', openScopeOverlay);
if (btnLiveAimOverlay) btnLiveAimOverlay.addEventListener('click', openScopeOverlay);
if (btnTopAimOverlay) btnTopAimOverlay.addEventListener('click', openScopeOverlay);
if (btnMiniSightAim) btnMiniSightAim.addEventListener('click', openScopeOverlay);
if (closeScopeOverlayBtn) closeScopeOverlayBtn.addEventListener('click', closeScopeOverlay);
if (scopePipBtn) scopePipBtn.addEventListener('click', toggleScopePictureInPicture);

// Scope Background Mode switcher
document.querySelectorAll('.scope-mode-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.scope-mode-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    const mode = e.currentTarget.dataset.bg;
    scopeBgMode = mode;
    if (scopeOverlay) {
      scopeOverlay.classList.remove('mode-vignette', 'mode-semitransparent', 'mode-transparent');
      scopeOverlay.classList.add(`mode-${mode}`);
    }
  });
});

// Scope Scale controls
if (scopeScaleDownBtn) {
  scopeScaleDownBtn.addEventListener('click', () => {
    scopeScale = Math.max(0.6, Math.round((scopeScale - 0.05) * 100) / 100);
    if (scopeAperture) scopeAperture.style.setProperty('--scope-scale', scopeScale);
    if (scopeScaleDisplay) scopeScaleDisplay.textContent = `${Math.round(scopeScale * 100)}%`;
  });
}

if (scopeScaleUpBtn) {
  scopeScaleUpBtn.addEventListener('click', () => {
    scopeScale = Math.min(1.6, Math.round((scopeScale + 0.05) * 100) / 100);
    if (scopeAperture) scopeAperture.style.setProperty('--scope-scale', scopeScale);
    if (scopeScaleDisplay) scopeScaleDisplay.textContent = `${Math.round(scopeScale * 100)}%`;
  });
}

// Input fields dynamic check for filled coordinates
[inputGunX, inputGunY, inputTargetX, inputTargetY].forEach(inp => {
  if (inp) {
    inp.addEventListener('input', checkCoordsFilled);
    inp.addEventListener('change', checkCoordsFilled);
    inp.addEventListener('keyup', checkCoordsFilled);
  }
});

// Keyboard shortcuts (1: Gun, 2: Target, Space: Center, Esc: Cancel/Close Modal, Z: Toggle Scope)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && scopeOverlay && !scopeOverlay.classList.contains('hidden')) {
    closeScopeOverlay();
    return;
  }
  if (e.key === 'Escape' && rangeLadderModal && !rangeLadderModal.classList.contains('hidden')) {
    rangeLadderModal.classList.add('hidden');
    return;
  }
  if (e.target.tagName === 'INPUT') return;
  if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (scopeOverlay) {
      if (scopeOverlay.classList.contains('hidden')) openScopeOverlay();
      else closeScopeOverlay();
    }
    return;
  }
  if (e.key === '1') setGunModeBtn.click();
  else if (e.key === '2') setTargetModeBtn.click();
  else if (e.key === ' ') { e.preventDefault(); centerViewBtn.click(); }
  else if (e.key === 'Escape') setClickMode(null);
});

// INIT ON PAGE LOAD
window.addEventListener('DOMContentLoaded', () => {
  initGunnerSightLadder();
  initScopeOverlayLadder();
  checkCoordsFilled();
  loadMap('kavkazi');
});
