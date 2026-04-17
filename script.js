const $ = id => document.getElementById(id);

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isDesktop = !isMobile;

// Initialize elements after DOM is available
document.addEventListener('DOMContentLoaded', () => {
  const cellCarrierEl = document.getElementById('cellCarrier');
  const wifiSsidEl = document.getElementById('wifiSsid');
  if (cellCarrierEl) cellCarrierEl.textContent = 'Mobile Data';
  if (wifiSsidEl) wifiSsidEl.textContent = 'Wi-Fi Connected';
});

function show(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.add('hidden');
  });
  const screen = $(id);
  if (screen) {
    screen.style.display = 'flex';
    screen.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const permDesc = $('permDesc');
  const enableBtn = $('enableBtn');
  
  if (isMobile) {
    if (permDesc) permDesc.textContent = 'Detecting mobile network, GPS location, and compass...';
    if (enableBtn) enableBtn.textContent = 'ENABLE LOCATION';
  } else {
    if (permDesc) permDesc.textContent = 'Detecting network connection, WiFi, and network speed...';
    if (enableBtn) enableBtn.textContent = 'START ANALYSIS';
  }
  
  $('startBtn').addEventListener('click', () => {
    show('permScreen');
  });

  $('enableBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      show('app');
      initApp(false);
      return;
    }
    
    if (isMobile) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          show('app');
          initApp(true);
        },
        (err) => {
          console.warn('GPS permission error:', err.message);
          show('app');
          initApp(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      show('app');
      initApp(true);
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      result.onchange = () => {
        if (result.state === 'granted') {
          show('app');
          if (!watchId) initApp(true);
        }
      };
    });
  }

  const retryBtn = $('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (navigator.geolocation) {
         startGeo();
      }
      show('app');
      initApp(true);
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.remove('hidden');
      if (tab.dataset.tab === 'realtime' && leafletMap) {
        setTimeout(() => leafletMap.invalidateSize(), 100);
      }
    });
  });
});

function drawGauge(canvasId, value, min, max, theme) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H - 10;
  const r = Math.min(W, H * 1.6) * 0.46;
  const startAngle = Math.PI;
  const endAngle   = 2 * Math.PI;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fillAngle  = startAngle + pct * Math.PI;

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();

  const grd = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  if (theme === 'cell') {
    grd.addColorStop(0,   '#ff4d6d');
    grd.addColorStop(0.4, '#ffb300');
    grd.addColorStop(1,   '#69ff69');
  } else {
    grd.addColorStop(0,   '#ff4d6d');
    grd.addColorStop(0.4, '#ffb300');
    grd.addColorStop(1,   '#00e5ff');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.strokeStyle = grd;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();

  const tipX = cx + r * Math.cos(fillAngle);
  const tipY = cy + r * Math.sin(fillAngle);
  const dotColor = theme === 'cell' ? '#ffb300' : '#00e5ff';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.shadowColor = dotColor;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  for (let i = 0; i <= 10; i++) {
    const angle = startAngle + (i / 10) * Math.PI;
    const inner = i % 5 === 0 ? r - 16 : r - 11;
    ctx.beginPath();
    ctx.moveTo(cx + inner * Math.cos(angle), cy + inner * Math.sin(angle));
    ctx.lineTo(cx + (r - 4) * Math.cos(angle), cy + (r - 4) * Math.sin(angle));
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = i % 5 === 0 ? 1.5 : 0.8;
    ctx.stroke();
  }

  ctx.font = '8px "Share Tech Mono"';
  ctx.fillStyle = 'rgba(208,232,255,0.35)';
  ctx.textAlign = 'left';
  ctx.fillText(String(min), cx - r - 2, cy + 14);
  ctx.textAlign = 'right';
  ctx.fillText(String(max), cx + r + 2, cy + 14);
}

let wavePoints = Array(80).fill(0);
let waveCtx, waveW, waveH;

function initWave() {
  const canvas = $('waveCanvas');
  waveCtx = canvas.getContext('2d');
  waveW = canvas.offsetWidth;
  waveH = canvas.height;
  canvas.width = waveW;
}

function pushWave(v) {
  wavePoints.push(v);
  if (wavePoints.length > 80) wavePoints.shift();
  drawWave();
}

function drawWave() {
  if (!waveCtx) return;
  waveCtx.clearRect(0, 0, waveW, waveH);

  const step = waveW / (wavePoints.length - 1);

  const grd = waveCtx.createLinearGradient(0, 0, 0, waveH);
  grd.addColorStop(0, 'rgba(0,229,255,.25)');
  grd.addColorStop(1, 'rgba(0,229,255,0)');

  waveCtx.beginPath();
  wavePoints.forEach((v, i) => {
    const x = i * step;
    const y = waveH - (v / 100) * waveH * 0.85 - 4;
    i === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
  });
  waveCtx.lineTo(waveW, waveH);
  waveCtx.lineTo(0, waveH);
  waveCtx.closePath();
  waveCtx.fillStyle = grd;
  waveCtx.fill();

  waveCtx.beginPath();
  waveCtx.shadowColor = '#00e5ff';
  waveCtx.shadowBlur = 8;
  wavePoints.forEach((v, i) => {
    const x = i * step;
    const y = waveH - (v / 100) * waveH * 0.85 - 4;
    i === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
  });
  waveCtx.strokeStyle = '#00e5ff';
  waveCtx.lineWidth = 1.5;
  waveCtx.stroke();
  waveCtx.shadowBlur = 0;

  waveCtx.beginPath();
  wavePoints.forEach((v, i) => {
    const x = i * step;
    const y = waveH - (v * 0.7 / 100) * waveH * 0.85 - 4;
    i === 0 ? waveCtx.moveTo(x, y) : waveCtx.lineTo(x, y);
  });
  waveCtx.strokeStyle = 'rgba(105,255,105,.6)';
  waveCtx.lineWidth = 1;
  waveCtx.stroke();
}

let leafletMap, leafletMarker, leafletAccuracyCircle;
let latestCoords = null;
let followLiveLocation = true;
let mapRotation = 0;

function applyMapRotation() {
  const mapPane = leafletMap && leafletMap.getPane('mapPane');
  if (mapPane) {
    mapPane.style.transformOrigin = '50% 50%';
    mapPane.style.transform = `rotate(${mapRotation}deg)`;
  }
}

function initMap(lat, lon) {
  if (leafletMap) {
    leafletMap.setView([lat, lon], 15);
    return;
  }
  
  const mapContainer = $('miniMap');
  if (!mapContainer) {
    console.warn('Map container not found');
    return;
  }
  
  try {
    leafletMap = L.map('miniMap', {
      center: [lat, lon],
      zoom: 15,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(leafletMap);

    const icon = L.divIcon({
      html: `<div style="
        width:20px;height:20px;
        background:#00e5ff;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 12px #00e5ff, 0 0 24px rgba(0,229,255,.5);
      "></div>`,
      className: '',
      iconAnchor: [10, 10],
    });

    leafletMarker = L.marker([lat, lon], { icon }).addTo(leafletMap);
    leafletAccuracyCircle = L.circle([lat, lon], {
      radius: 20,
      color: '#00e5ff',
      weight: 1.5,
      fillColor: '#00e5ff',
      fillOpacity: 0.15,
    }).addTo(leafletMap);

    leafletMap.on('dragstart zoomstart', () => {
      setMapFollow(false);
    });
  } catch(e) {
    console.error('Map init error:', e);
  }
}

function updateMap(lat, lon, accuracy = 0) {
  latestCoords = [lat, lon];
  if (!leafletMap) { 
    initMap(lat, lon); 
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 300);
    return; 
  }
  setTimeout(() => leafletMap.invalidateSize(), 100);
  leafletMarker.setLatLng([lat, lon]);
  if (leafletAccuracyCircle) {
    leafletAccuracyCircle.setLatLng([lat, lon]);
    leafletAccuracyCircle.setRadius(Math.max(accuracy || 0, 5));
  }
  if (followLiveLocation) {
    const targetZoom = accuracy <= 10 ? 19 : accuracy <= 25 ? 18 : accuracy <= 50 ? 17 : 16;
    leafletMap.setView([lat, lon], Math.max(leafletMap.getZoom(), targetZoom), { animate: true });
  }
}

function setMapFollow(shouldFollow) {
  followLiveLocation = shouldFollow;
  const recenterBtn = $('recenterMapBtn');
  if (recenterBtn) {
    recenterBtn.classList.toggle('hidden', shouldFollow);
  }

  if (shouldFollow && latestCoords && leafletMap) {
    leafletMap.setView(latestCoords, 15, { animate: true });
  }
}

let cellDbm  = -75;
let wifiDbm  = -65;
let cellSignalStrength = null;
let wifiSignalStrength = null;

function simSignal(current, min, max) {
  const delta = (Math.random() - 0.5) * 6;
  return Math.max(min, Math.min(max, current + delta));
}

function getRealNetworkSignal() {
  const conn = navigator.connection;
  if (!conn) return null;
  
  const signal = conn.signalStrength || conn.downlink;
  return signal;
}

const pingTargets = [
  { id: 'gw',  host: 'Gateway',   url: 'https://httpbin.org/get?_=' + Date.now() },
  { id: 'dns', host: 'DNS',        url: 'https://httpbin.org/ip?_=' + Date.now() },
  { id: 'net', host: 'Internet',   url: 'https://httpbin.org/headers?_=' + Date.now() },
  { id: 'app', host: 'Cloudflare', url: 'https://httpbin.org/uuid?_=' + Date.now() },
];

async function runPing() {
  const pingStatusEl = $('pingStatus');
  if (pingStatusEl) pingStatusEl.textContent = 'TESTING…';
  
  const MAX_MS = 300;

  for (let i = 0; i < pingTargets.length; i++) {
    const t = pingTargets[i];
    const start = performance.now();
    
    const bar = $('pb-' + t.id);
    const ms_el = $('pm-' + t.id);
    
    // Show testing state
    if (ms_el) ms_el.textContent = '...';
    if (bar) bar.style.width = '15%';
    
    try {
      const response = await fetch(t.url, { 
        cache: 'no-store', 
        mode: 'cors'
      });
      
      const ms = Math.round(performance.now() - start);
      
      if (ms_el) ms_el.textContent = ms + ' ms';
      if (bar) bar.style.width = Math.min(100, (ms / MAX_MS) * 100) + '%';
      
    } catch (e) {
      // Fallback to simulated value if network fails
      const simulated = Math.round(20 + Math.random() * 80);
      console.log('Ping ' + t.host + ' failed, using fallback:', simulated + 'ms');
      if (ms_el) ms_el.textContent = simulated + ' ms';
      if (bar) bar.style.width = Math.min(100, (simulated / MAX_MS) * 100) + '%';
    }
    
    if (i === pingTargets.length - 1) {
      if (pingStatusEl) pingStatusEl.textContent = 'DONE';
      setTimeout(() => {
        const ps = $('pingStatus');
        if (ps) ps.textContent = 'LIVE';
      }, 2000);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
}

let tpDown = 42.0, tpUp = 12.0;

function updateThroughput() {
  let baseDown = (navigator.connection && navigator.connection.downlink) ? navigator.connection.downlink * 5 : 50.0;
  let baseUp = baseDown / 3; 

  tpDown = Math.max(1.0, tpDown + (Math.random() - 0.48) * 8); 
  tpUp   = Math.max(0.5, tpUp   + (Math.random() - 0.48) * 3); 

  tpDown += (baseDown - tpDown) * 0.1;
  tpUp   += (baseUp - tpUp) * 0.1;

  const dl = $('tpDown'), ul = $('tpUp');
  if (dl) dl.textContent = tpDown.toFixed(2);
  if (ul) ul.textContent = tpUp.toFixed(2);

  const waveVal = Math.min(100, (tpDown / 100) * 100 + (Math.random() * 5));
  pushWave(waveVal);
}

let watchId = null;

function setLocationReadout(coordsText) {
  const coordsEl = $('coords');
  const mapCoordsEl = $('mapCoords');

  if (coordsEl) coordsEl.textContent = coordsText;
  if (mapCoordsEl) mapCoordsEl.textContent = coordsText;
}

function getAccuracyLabel(acc) {
  if (acc <= 12) return 'Precise GPS';
  if (acc <= 35) return 'Moderate GPS';
  return 'Low GPS';
}

function setAccuracyState(acc) {
  const mapAccEl = $('mapGpsAcc');
  if (!mapAccEl) return;
  mapAccEl.classList.remove('is-precise', 'is-medium', 'is-low');
  if (acc <= 12) {
    mapAccEl.classList.add('is-precise');
  } else if (acc <= 35) {
    mapAccEl.classList.add('is-medium');
  } else {
    mapAccEl.classList.add('is-low');
  }
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

// Tower tracking - uses real GPS to calculate distance
let simulatedTower = null;
let towerPositionLocked = false;

function generateTowerNear(lat, lon, networkType = '4G') {
  const distance = 200 + Math.random() * 800;
  const bearing = Math.random() * 2 * Math.PI;
  
  const earthRadius = 6371000;
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  
  const angularDistance = distance / earthRadius;
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
    Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const newLonRad = lonRad + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
  );
  
  return {
    lat: newLatRad * 180 / Math.PI,
    lon: newLonRad * 180 / Math.PI,
    id: Math.floor(100000 + Math.random() * 900000),
    type: networkType,
    firstSeen: Date.now()
  };
}

function updateTowerDistance(lat, lon) {
  if (!navigator.geolocation) return;
  
  let currentNetworkType = '4G';
  if (navigator.connection) {
    const conn = navigator.connection;
    const displayGen = detectNetworkGeneration(conn);
    if (displayGen !== 'UNKNOWN' && displayGen !== 'WI-FI' && displayGen !== 'LAN') {
      currentNetworkType = displayGen;
    }
  }
  
  if (!simulatedTower) {
    simulatedTower = generateTowerNear(lat, lon, currentNetworkType);
    towerPositionLocked = true;
  }
  
  let distance = haversineMeters(lat, lon, simulatedTower.lat, simulatedTower.lon);
  
  if (distance > 5000) {
    simulatedTower = generateTowerNear(lat, lon, currentNetworkType);
    distance = haversineMeters(lat, lon, simulatedTower.lat, simulatedTower.lon);
  }
  
  const towerInfoEl = $('towerInfo');
  if (towerInfoEl) {
    let distanceText;
    if (distance < 1000) {
      distanceText = Math.round(distance) + ' m';
    } else {
      distanceText = (distance / 1000).toFixed(2) + ' km';
    }
    towerInfoEl.textContent = currentNetworkType + ' · ' + distanceText;
  }
  
  const cellIdEl = $('cellId');
  if (cellIdEl && simulatedTower.id) {
    let cellIdStr = simulatedTower.id.toString();
    while (cellIdStr.length < 9) cellIdStr = '0' + cellIdStr;
    const formatted = cellIdStr.match(/.{1,3}/g)?.join(':') || cellIdStr;
    cellIdEl.textContent = formatted;
  }
}


function startGeo() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  
  const gpsAccEl = $('gpsAcc');
  const mapGpsAccEl = $('mapGpsAcc');
  const coordsEl = $('coords');
  const mapCoordsEl = $('mapCoords');
  
  if (gpsAccEl) gpsAccEl.textContent = 'Acquiring GPS...';
  if (mapGpsAccEl) mapGpsAccEl.textContent = 'Acquiring GPS...';
  if (coordsEl) coordsEl.textContent = 'Acquiring GPS...';
  if (mapCoordsEl) mapCoordsEl.textContent = 'Acquiring GPS...';
  
  watchId = navigator.geolocation.watchPosition(onGeo, onGeoErr, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
}

function onGeo(pos) {
  show('app');
  const { latitude: lat, longitude: lon, accuracy: acc, speed, heading } = pos.coords;

  if (speed !== null && speed > 0) {
    gpsHeading = heading;
  } else {
    updateGpsHeading(lat, lon);
  }

  const gpsAccEl = $('gpsAcc');
  if (gpsAccEl) {
    gpsAccEl.textContent = acc <= 10 ? `Precise GPS (±${Math.round(acc)}m)` : acc <= 30 ? `GPS (±${Math.round(acc)}m)` : `Low GPS (±${Math.round(acc)}m)`;
  }

  setLocationReadout(`${lat.toFixed(7)}, ${lon.toFixed(7)}`);

  updateMap(lat, lon, acc);
  setAccuracyState(acc);
  updateTowerDistance(lat, lon);
}

function onGeoErr(err) {
  console.warn('Geolocation error:', err.message);
  if (err.code === err.PERMISSION_DENIED) {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    show('errScreen');
  } else {
    setLocationReadout('Locating...');
    const gpsAccEl = $('gpsAcc');
    if (gpsAccEl) gpsAccEl.textContent = 'Location unavailable';
  }
}

let compassCalibrated = false;
let compassOffset = 0;
let lastGpsPos = null;
let gpsHeading = null;
let compassActive = false;
let absoluteSupported = false;

function startDeviceCompass() {
  const statusEl = $('compassStatus');
  const startBtn = $('startCompassBtn');
  const calibrateBtn = $('calibrateBtn');
  const hintEl = $('compassHint');

  if (typeof DeviceOrientationEvent === 'undefined') {
    if (statusEl) {
      statusEl.textContent = 'NOT SUPPORTED';
      statusEl.style.color = '#ff4d6d';
      statusEl.style.borderColor = 'rgba(255,77,109,0.3)';
    }
    if (hintEl) hintEl.textContent = 'Compass not supported on this device';
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          activateCompass();
        } else {
          if (statusEl) {
            statusEl.textContent = 'PERMISSION DENIED';
            statusEl.style.color = '#ff4d6d';
            statusEl.style.borderColor = 'rgba(255,77,109,0.3)';
          }
          if (hintEl) hintEl.textContent = 'Permission required for compass';
        }
      })
      .catch(err => {
        console.error('Compass permission error:', err);
        if (statusEl) {
          statusEl.textContent = 'ERROR';
          statusEl.style.color = '#ff4d6d';
        }
      });
  } else {
    activateCompass();
  }

  function activateCompass() {
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    }
    window.addEventListener('deviceorientation', handleOrientation, true);
    compassActive = true;
    
    if (statusEl) {
      statusEl.textContent = 'ACTIVE';
      statusEl.style.color = '#69ff69';
      statusEl.style.borderColor = 'rgba(105,255,105,0.3)';
    }
    if (startBtn) {
      startBtn.classList.add('hidden');
    }
    if (calibrateBtn) {
      calibrateBtn.classList.remove('hidden');
    }
    if (hintEl) hintEl.textContent = 'Move phone in figure-8 pattern to calibrate';
  }
}

$('startCompassBtn')?.addEventListener('click', startDeviceCompass);

function updateGpsHeading(lat, lon) {
  if (lastGpsPos) {
    const dLat = lat - lastGpsPos.lat;
    const dLon = lon - lastGpsPos.lon;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist > 0.00001) {
      gpsHeading = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
    }
  }
  lastGpsPos = { lat, lon };
}

function handleOrientation(event) {
  if (!compassActive) return;
  
  if (event.type === 'deviceorientationabsolute') {
    absoluteSupported = true;
  }
  if (event.type === 'deviceorientation' && absoluteSupported && !event.webkitCompassHeading) {
    return;
  }
  
  let heading = null;

  if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
    heading = event.webkitCompassHeading;
  } 
  else if (event.alpha !== null && event.alpha !== undefined) {
    heading = (360 - event.alpha) % 360;
  }

  if (heading === null || isNaN(heading) || heading < 0 || heading > 360) {
    if (gpsHeading !== null && !isNaN(gpsHeading) && gpsHeading >= 0 && gpsHeading <= 360) {
      heading = gpsHeading;
    }
  }

  if (heading !== null && !isNaN(heading) && heading >= 0 && heading <= 360) {
    heading = (heading + compassOffset) % 360;
    
    const degEl = $('compassDegree');
    const textEl = $('compassHeadingText');
    const statusEl = $('compassStatus');

    const mainDial = $('mainCompassDial');
    if (mainDial) {
      mainDial.style.transform = `rotate(${-heading}deg)`;
      mainDial.style.transition = 'transform 0.3s ease-out';
    }

    if (degEl) degEl.textContent = Math.round(heading);
    
    if (textEl) {
      const dirs = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
      const dirIndex = Math.round(heading / 45) % 8;
      textEl.textContent = dirs[dirIndex];
    }

    if (statusEl && (statusEl.textContent === 'TAP TO START' || statusEl.textContent === 'DESKTOP' || statusEl.textContent === 'CALIBRATING')) {
      statusEl.textContent = 'ACTIVE';
      statusEl.style.color = '#69ff69';
      statusEl.style.borderColor = 'rgba(105,255,105,0.3)';
    }
  }
}

$('calibrateBtn')?.addEventListener('click', () => {
  const statusEl = $('compassStatus');
  const degEl = $('compassDegree');
  const hintEl = $('compassHint');
  
  if (statusEl) {
    statusEl.textContent = 'CALIBRATING';
    statusEl.style.color = '#ffb300';
    statusEl.style.borderColor = 'rgba(255,179,0,0.3)';
  }
  
  compassOffset = 0;
  compassCalibrated = true;
  
  if (hintEl) hintEl.textContent = 'Point phone north and tap calibrate';
  
  setTimeout(() => {
    if (statusEl) {
      statusEl.textContent = 'READY';
      statusEl.style.color = '#00e5ff';
      statusEl.style.borderColor = 'rgba(0,229,255,0.3)';
    }
  }, 1500);
});

function tick() {
  const conn = navigator.connection;
  
  if (conn) {
    if (conn.type === 'cellular') {
      if (conn.signalStrength !== undefined && conn.signalStrength !== null && conn.signalStrength < 0) {
        cellDbm = conn.signalStrength;
      } else if (conn.downlink && conn.downlink > 0) {
        cellDbm = -Math.round(30 + Math.random() * 50);
      }
      wifiDbm = simSignal(wifiDbm, -90, -50);
    } else if (conn.type === 'wifi') {
      if (conn.signalStrength !== undefined && conn.signalStrength !== null && conn.signalStrength < 0) {
        wifiDbm = conn.signalStrength;
      } else if (conn.downlink && conn.downlink > 0) {
        wifiDbm = -Math.round(40 + Math.random() * 40);
      }
      cellDbm = simSignal(cellDbm, -95, -45);
    } else if (conn.type === 'ethernet') {
      cellDbm = -65;
      wifiDbm = -55;
    } else {
      cellDbm = simSignal(cellDbm, -95, -45);
      wifiDbm = simSignal(wifiDbm, -90, -50);
    }
  } else {
    cellDbm = simSignal(cellDbm, -95, -45);
    wifiDbm = simSignal(wifiDbm, -90, -50);
  }

  // Ensure signal is always in valid range (negative dBm)
  if (cellDbm > -10 || cellDbm < -120) cellDbm = -75;
  if (wifiDbm > -10 || wifiDbm < -120) wifiDbm = -65;

  const cellEl = $('cellDbm'), cellAsu = $('cellAsu');
  if (cellEl) cellEl.textContent = Math.round(cellDbm);
  if (cellAsu) cellAsu.textContent = Math.round((cellDbm + 113) / 2) + ' ASU';

  const wifiEl = $('wifiDbm'), wifiQ = $('wifiQuality');
  if (wifiEl) wifiEl.textContent = Math.round(wifiDbm);
  if (wifiQ) wifiQ.textContent = Math.round(2 * (wifiDbm + 100)) + '%';

  drawGauge('cellGauge', Math.abs(cellDbm), 45, 95, 'cell');
  drawGauge('wifiGauge', Math.abs(wifiDbm), 50, 90, 'wifi');

  updateThroughput();
}

function formatEffectiveType(netType) {
  if (!netType) return 'UNKNOWN';
  if (netType === 'slow-2g') return '2G';
  return netType.toUpperCase();
}

// Enhanced network generation detection
function detectNetworkGeneration(connection) {
  if (!connection) return 'UNKNOWN';
  
  const { effectiveType, type, downlink, rtt } = connection;
  
  if (type === 'wifi') return 'WI-FI';
  if (type === 'ethernet') return 'LAN';
  
  // Default generation based on effectiveType
  let generation = 'UNKNOWN';
  
  // Map effectiveType to generation
  if (effectiveType) {
    switch (effectiveType) {
      case 'slow-2g':
        generation = '2G';
        break;
      case '2g':
        generation = '2G';
        break;
      case '3g':
        generation = '3G';
        break;
      case '4g':
        generation = '4G';
        break;
      default:
        generation = effectiveType.toUpperCase();
    }
  }
  
  // Enhance detection for cellular networks using downlink speed
  if (!type || type === 'cellular') {
    // Use downlink speed (in Mbps) to better differentiate
    if (downlink && downlink > 0) {
      if (downlink >= 100) {
        generation = '5G';
      } else if (downlink >= 50) {
        generation = '4G+';
      } else if (downlink >= 20) {
        generation = '4G';
      } else if (downlink >= 5) {
        generation = '3G';
      } else if (downlink >= 1) {
        generation = '2G';
      }
      // If downlink is less than 1, keep existing generation
    }
    
    // Also consider RTT (round-trip time) for better accuracy
    if (rtt && rtt < 30) {
      // Very low latency suggests 5G or 4G+
      if (generation === '4G+' || generation === '4G') {
        generation = '5G';
      } else if (generation === '3G') {
        generation = '4G';
      }
    }
  }
  
  // If still UNKNOWN, make a best guess based on type
  if (generation === 'UNKNOWN') {
    if (!type || type === 'cellular') {
      // Default to 4G for cellular as it's most common nowadays
      generation = '4G';
    }
  }
  
  return generation;
}

function updateNetworkType() {
  const conn = navigator.connection;
  if (!conn) return;

  const cellCarrier = $('cellCarrier');
  const wifiSsid = $('wifiSsid');
  const cellGen = $('cellGen');
  const wifiGen = $('wifiGen');
  const displayGen = detectNetworkGeneration(conn);

  if (cellGen) {
    if (conn.type === 'cellular' || (!conn.type && displayGen !== 'WI-FI' && displayGen !== 'LAN')) {
      cellGen.textContent = displayGen;
    } else {
      cellGen.textContent = 'Cellular';
    }
  }

  if (wifiGen) {
    if (conn.type === 'wifi') {
      wifiGen.textContent = 'Wi-Fi';
    } else {
      wifiGen.textContent = 'Wi-Fi';
    }
  }

  if (conn.type === 'wifi') {
    if (cellCarrier) cellCarrier.textContent = 'Mobile Data';
    if (wifiSsid) {
      wifiSsid.textContent = conn.ssid || 'Wi-Fi Connected';
    }
    updateWifiDetails(conn);
  } else if (conn.type === 'cellular') {
    if (cellCarrier) cellCarrier.textContent = 'Connected with Cellular';
    if (wifiSsid) wifiSsid.textContent = 'Wi-Fi Off';
  } else if (conn.type === 'ethernet') {
    if (cellCarrier) cellCarrier.textContent = 'Mobile Data';
    if (wifiSsid) wifiSsid.textContent = 'Ethernet';
  } else {
    if (cellCarrier) cellCarrier.textContent = 'Mobile Data';
    if (wifiSsid) wifiSsid.textContent = 'Wi-Fi';
  }
  
  const netTypeEl = $('netType');
  const netEffectiveEl = $('netEffective');
  const netRttEl = $('netRtt');
  const netSaverEl = $('netSaver');
  
  if (netTypeEl) netTypeEl.textContent = conn.type ? conn.type.toUpperCase() : '--';
  if (netEffectiveEl) netEffectiveEl.textContent = conn.effectiveType ? conn.effectiveType.toUpperCase() : '--';
  if (netRttEl) netRttEl.textContent = conn.rtt ? conn.rtt + ' ms' : '-- ms';
  if (netSaverEl) netSaverEl.textContent = conn.saveData ? 'ON' : 'OFF';
  
  updateNetQualityBadge(conn);
}

function updateNetQualityBadge(conn) {
  const badge = $('netQualityBadge');
  const text = $('netQualityText');
  if (!badge || !text) return;
  
  badge.classList.remove('medium', 'poor');
  
  let quality = 'GOOD';
  let rtt = conn ? conn.rtt : null;
  
  if (rtt !== null) {
    if (rtt < 50) {
      quality = 'EXCELLENT';
    } else if (rtt < 100) {
      quality = 'GOOD';
      badge.classList.add('medium');
    } else if (rtt < 200) {
      quality = 'FAIR';
      badge.classList.add('medium');
    } else {
      quality = 'POOR';
      badge.classList.add('poor');
    }
  } else if (conn && conn.downlink) {
    if (conn.downlink >= 20) {
      quality = 'GOOD';
    } else if (conn.downlink >= 5) {
      quality = 'FAIR';
      badge.classList.add('medium');
    } else {
      quality = 'POOR';
      badge.classList.add('poor');
    }
  }
  
  text.textContent = quality;
}

function updateWifiDetails(conn) {
  if (conn && conn.type === 'wifi') {
    const ssid = conn.ssid || 'Connected Wi-Fi';
    const channelWidth = conn.downlinkMax ? Math.round(conn.downlinkMax / 100) * 20 : 80;
    const frequency = conn.downlink > 0 ? (conn.downlink > 6 ? '5 GHz' : '2.4 GHz') : '5 GHz';
    const standard = conn.downlink >= 100 ? 'WiFi 6' : conn.downlink >= 50 ? '802.11ac' : '802.11n';
    
    const ssidEl = $('wifiSsid');
    const chEl = document.querySelector('#wifiCard .gc-det-row:nth-child(1) .gc-det-val');
    const freqEl = document.querySelector('#wifiCard .gc-det-row:nth-child(2) .gc-det-val');
    const stdEl = document.querySelector('#wifiCard .gc-det-row:nth-child(3) .gc-det-val');
    
    if (ssidEl) ssidEl.textContent = ssid;
    if (chEl) chEl.textContent = channelWidth + ' MHz';
    if (freqEl) freqEl.textContent = frequency;
    if (stdEl) stdEl.textContent = standard;
  }
}

if (navigator.connection) {
  navigator.connection.addEventListener('change', updateNetworkType);
}

window.addEventListener('online', updateNetworkType);
window.addEventListener('offline', updateNetworkType);

let stState = 'IDLE'; 
let speedTestRunId = 0;

const SPEEDTEST_CONFIG = {
  pingUrl: 'https://www.google.com/generate_204',
  downloadUrls: [
    'https://speed.cloudflare.com/__down?bytes=25000000',
    'https://speed.cloudflare.com/__down?bytes=50000000',
  ],
  uploadUrl: 'https://speed.cloudflare.com/__up',
  pingSamples: 5,
  testTimeout: 30000,
  minTestDuration: 8000,
  uploadChunkSize: 2000000,
};

function getConnectionSpeed() {
  const conn = navigator.connection;
  if (!conn) return null;
  
  const downlink = conn.downlink;
  const effectiveType = conn.effectiveType;
  const rtt = conn.rtt;
  
  return { downlink, effectiveType, rtt };
}

function estimateSpeedFromConnection() {
  const conn = getConnectionSpeed();
  if (!conn || !conn.downlink) return null;
  
  return {
    estimatedDown: conn.downlink,
    estimatedUp: conn.downlink * 0.3
  };
}

function formatMbpsValue(value) {
  return `${value.toFixed(2)} <small>Mbps</small>`;
}

function formatMBpsValue(value) {
  return `${value.toFixed(2)} <small>MB/s</small>`;
}

function setSpeedMetric(idMbps, idMBps, mbps) {
  const safeMbps = Number.isFinite(mbps) ? Math.max(0, mbps) : 0;
  const megaBytesPerSecond = safeMbps / 8;
  $(idMbps).innerHTML = formatMbpsValue(safeMbps);
  $(idMBps).innerHTML = formatMBpsValue(megaBytesPerSecond);
}

function setSpeedStatus(statusText, color, borderColor) {
  const status = $('stStatus');
  status.textContent = statusText;
  status.style.color = color;
  status.style.borderColor = borderColor;
}

async function measurePing(samples, runId) {
  const results = [];

  for (let i = 0; i < samples; i++) {
    if (runId !== speedTestRunId) throw new Error('cancelled');
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${SPEEDTEST_CONFIG.pingUrl}?t=${Date.now()}-${i}`, {
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      results.push(performance.now() - start);
    } catch (err) {
      console.warn('Ping measurement failed:', err.message);
    }
  }

  if (results.length === 0) {
    const conn = getConnectionSpeed();
    if (conn && conn.rtt) {
      return { ping: conn.rtt, jitter: conn.rtt * 0.2 };
    }
    return { ping: 50, jitter: 10 };
  }

  const avg = results.reduce((sum, value) => sum + value, 0) / results.length;
  const jitter = results.length > 1
    ? results.slice(1).reduce((sum, value, index) => sum + Math.abs(value - results[index]), 0) / (results.length - 1)
    : 0;

  return { ping: avg, jitter };
}

async function measureDownload(runId, onProgress) {
  const samples = [];
  let maxSpeed = 0;
  const minDuration = SPEEDTEST_CONFIG.minTestDuration;
  const startTime = performance.now();

  for (const url of SPEEDTEST_CONFIG.downloadUrls) {
    if (runId !== speedTestRunId) throw new Error('cancelled');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SPEEDTEST_CONFIG.testTimeout);
      
      const response = await fetch(`${url}&t=${Date.now()}`, {
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error('Download test unavailable');
      }

      const reader = response.body.getReader();
      let loaded = 0;
      const testStartTime = performance.now();
      let lastUpdate = testStartTime;
      let lastLoaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        const now = performance.now();
        const windowElapsed = (now - lastUpdate) / 1000;
        
        if (windowElapsed >= 0.25 || done) {
          const windowMbps = ((loaded - lastLoaded) * 8) / Math.max(windowElapsed, 0.001) / 1_000_000;
          const currentSpeed = maxSpeed === 0 ? windowMbps : (windowMbps * 0.7 + maxSpeed * 0.3);
          if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;
          
          onProgress(currentSpeed);
          lastUpdate = now;
          lastLoaded = loaded;
        }
        
        if (runId !== speedTestRunId) {
          reader.cancel();
          throw new Error('cancelled');
        }
      }

      samples.push(maxSpeed);
    } catch (err) {
      console.warn('Download test failed:', err.message);
      break;
    }
    
    if (performance.now() - startTime < minDuration && url !== SPEEDTEST_CONFIG.downloadUrls[SPEEDTEST_CONFIG.downloadUrls.length - 1]) {
      continue;
    }
  }

  if (samples.length > 0) {
    return Math.max(...samples);
  }

  const estimated = estimateSpeedFromConnection();
  if (estimated) {
    return estimated.estimatedDown;
  }

  const conn = getConnectionSpeed();
  if (conn && conn.downlink) {
    return conn.downlink;
  }

  return 10;
}

function measureUpload(runId, onProgress) {
  return new Promise(async (resolve, reject) => {
    if (runId !== speedTestRunId) {
      reject(new Error('cancelled'));
      return;
    }

    const testSizes = [5000000, 10000000, 15000000];
    let bestSpeed = 0;
    let totalTests = 0;
    let successfulTests = 0;
    const minTests = 2;
    const minDuration = 10000;
    const overallStart = performance.now();

    for (let i = 0; i < testSizes.length; i++) {
      const bytes = testSizes[i];
      
      if (runId !== speedTestRunId) {
        reject(new Error('cancelled'));
        return;
      }

      const testStart = performance.now();

      try {
        const payload = new Uint8Array(bytes);
        for (let j = 0; j < payload.length; j++) {
          payload[j] = Math.floor(Math.random() * 256);
        }

        const xhr = new XMLHttpRequest();
        const startTime = performance.now();
        let lastUpdate = startTime;
        let lastLoaded = 0;

        xhr.open('POST', `${SPEEDTEST_CONFIG.uploadUrl}?bytes=${bytes}&t=${Date.now()}_${i}`, true);
        xhr.timeout = SPEEDTEST_CONFIG.testTimeout;

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          
          const now = performance.now();
          const windowElapsed = (now - lastUpdate) / 1000;
          
          if (windowElapsed >= 0.25 || event.loaded === event.total) {
            const windowMbps = ((event.loaded - lastLoaded) * 8) / Math.max(windowElapsed, 0.001) / 1_000_000;
            
            const currentSpeed = bestSpeed === 0 ? windowMbps : (windowMbps * 0.7 + bestSpeed * 0.3);
            if (currentSpeed > bestSpeed) bestSpeed = currentSpeed;
            
            onProgress(currentSpeed);
            lastUpdate = now;
            lastLoaded = event.loaded;
          }
        };

        const uploadComplete = new Promise((resolveXHR, rejectXHR) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 400) {
              const elapsedSec = Math.max((performance.now() - startTime) / 1000, 0.001);
              const finalSpeed = (bytes * 8) / elapsedSec / 1_000_000;
              successfulTests++;
              resolveXHR(Math.max(finalSpeed, bestSpeed));
            } else {
              rejectXHR(new Error('Upload failed'));
            }
          };

          xhr.onerror = () => rejectXHR(new Error('Upload test unavailable'));
          xhr.ontimeout = () => rejectXHR(new Error('Upload timeout'));
          xhr.onabort = () => rejectXHR(new Error('cancelled'));
        });

        xhr.send(payload);
        
        await uploadComplete;
        totalTests++;
        
        if (successfulTests >= minTests && (performance.now() - overallStart) >= minDuration) {
          break;
        }
        
      } catch (err) {
        console.warn('Upload test failed:', err.message);
      }
    }

    if (successfulTests > 0) {
      resolve(bestSpeed);
      return;
    }

    const estimated = estimateSpeedFromConnection();
    if (estimated) {
      onProgress(estimated.estimatedUp);
      resolve(estimated.estimatedUp);
      return;
    }

    const conn = getConnectionSpeed();
    if (conn && conn.downlink) {
      const speed = conn.downlink * 0.3;
      onProgress(speed);
      resolve(speed);
      return;
    }

    const speed = 5;
    onProgress(speed);
    resolve(speed);
  });
}

async function runSpeedTest() {
  if (stState !== 'IDLE' && stState !== 'DONE') {
    console.log('Speed test already running, state:', stState);
    return;
  }
  
  speedTestRunId += 1;
  const runId = speedTestRunId;
  console.log('Starting speed test run', runId);

  const conn = getConnectionSpeed();
  const estimated = estimateSpeedFromConnection();
  
  const btn = $('startSpeedTestBtn');
  const mainVal = $('stMainVal');
  const mainUnit = $('stMainUnit');

  $('stPing').innerHTML = '-- <small>ms</small>';
  $('stJitter').innerHTML = '-- <small>ms</small>';
  $('stDl').innerHTML = '-- <small>Mbps</small>';
  $('stDlBytes').innerHTML = '-- <small>MB/s</small>';
  $('stUl').innerHTML = '-- <small>Mbps</small>';
  $('stUlBytes').innerHTML = '-- <small>MB/s</small>';
  btn.classList.add('hidden');
  mainUnit.textContent = 'Mbps';
  mainVal.textContent = '0.0';
  drawGauge('stGauge', 0, 0, 300, 'wifi');

  try {
    stState = 'PING';
    setSpeedStatus('MEASURING PING...', '#ffb300', 'rgba(255,179,0,0.3)');
    const { ping, jitter } = await measurePing(SPEEDTEST_CONFIG.pingSamples, runId);
    if (runId !== speedTestRunId) {
      console.log('Test cancelled during ping');
      return;
    }
    $('stPing').innerHTML = `${ping.toFixed(1)} <small>ms</small>`;
    $('stJitter').innerHTML = `${jitter.toFixed(1)} <small>ms</small>`;
    console.log(`Ping: ${ping.toFixed(1)}ms, Jitter: ${jitter.toFixed(1)}ms`);

    stState = 'DL';
    setSpeedStatus('DOWNLOADING...', '#00e5ff', 'rgba(0,229,255,0.3)');
    const dlMbps = await measureDownload(runId, currentMbps => {
      if (runId !== speedTestRunId) return;
      mainVal.textContent = currentMbps.toFixed(1);
      setSpeedMetric('stDl', 'stDlBytes', currentMbps);
      drawGauge('stGauge', currentMbps, 0, 300, 'wifi');
    });
    if (runId !== speedTestRunId) {
      console.log('Test cancelled during download');
      return;
    }
    mainVal.textContent = dlMbps.toFixed(1);
    setSpeedMetric('stDl', 'stDlBytes', dlMbps);
    drawGauge('stGauge', dlMbps, 0, 300, 'wifi');
    console.log(`Download: ${dlMbps.toFixed(2)} Mbps`);

    stState = 'UL';
    setSpeedStatus('UPLOADING...', '#69ff69', 'rgba(105,255,105,0.3)');
    const ulMbps = await measureUpload(runId, currentMbps => {
      if (runId !== speedTestRunId) return;
      mainVal.textContent = currentMbps.toFixed(1);
      setSpeedMetric('stUl', 'stUlBytes', currentMbps);
      drawGauge('stGauge', currentMbps, 0, 300, 'cell');
    });
    
    mainVal.textContent = ulMbps.toFixed(1);
    setSpeedMetric('stUl', 'stUlBytes', ulMbps);
    drawGauge('stGauge', ulMbps, 0, 300, 'cell');

    stState = 'DONE';
    setSpeedStatus('TEST COMPLETE', '#d0e8ff', 'rgba(208,232,255,0.2)');
    console.log(`Speed test completed - Ping: ${ping}ms, DL: ${dlMbps}Mbps, UL: ${ulMbps}Mbps`);
  } catch (error) {
    console.error('Speed test error:', error);
    
    stState = 'DONE';
    
    const conn = getConnectionSpeed();
    const estimated = estimateSpeedFromConnection();
    
    if (estimated) {
      setSpeedStatus('ESTIMATED', '#ffb300', 'rgba(255,179,0,0.3)');
      
      const { ping, jitter } = await measurePing(2, runId).catch(() => ({ ping: conn?.rtt || 50, jitter: 10 }));
      $('stPing').innerHTML = `${ping.toFixed(1)} <small>ms</small>`;
      $('stJitter').innerHTML = `${jitter.toFixed(1)} <small>ms</small>`;
      
      const dlEst = estimated.estimatedDown;
      const ulEst = estimated.estimatedUp;
      
      mainVal.textContent = dlEst.toFixed(1);
      setSpeedMetric('stDl', 'stDlBytes', dlEst);
      drawGauge('stGauge', dlEst, 0, 300, 'wifi');
    } else {
      setSpeedStatus('TEST FAILED', '#ff4d6d', 'rgba(255,77,109,0.3)');
      $('stJitter').innerHTML = `<small>Network unavailable</small>`;
    }
  } finally {
    if (runId === speedTestRunId) {
      btn.classList.remove('hidden');
      btn.querySelector('.ss-btn-text').textContent = 'TEST AGAIN';
      if (stState !== 'DONE' && stState !== 'IDLE') {
        stState = 'DONE';
      }
    }
  }
}

$('startSpeedTestBtn').addEventListener('click', runSpeedTest);

const recenterMapBtn = $('recenterMapBtn');
if (recenterMapBtn) {
  recenterMapBtn.addEventListener('click', () => {
    setMapFollow(true);
  });
}

const zoomInBtn = $('zoomInBtn');
if (zoomInBtn) {
  zoomInBtn.addEventListener('click', () => {
    if (leafletMap) leafletMap.zoomIn();
  });
}

const zoomOutBtn = $('zoomOutBtn');
if (zoomOutBtn) {
  zoomOutBtn.addEventListener('click', () => {
    if (leafletMap) leafletMap.zoomOut();
  });
}


function initApp(useGPS = true) {
  try {
    initWave();
    updateNetworkType(); 
    tick();
    runPing();
    setInterval(tick, 2000);
    setInterval(runPing, 12000);
    setInterval(updateClock, 1000);
    updateClock();
    
    if (!navigator.onLine) {
      $('gpsAcc').textContent = 'Offline';
      $('mapGpsAcc').textContent = 'Offline';
    }
    
    if (useGPS && navigator.geolocation) {
      startGeo();
    } else {
      setLocationReadout('Location unavailable');
      const gpsAccEl = $('gpsAcc');
      const mapGpsAccEl = $('mapGpsAcc');
      const mapCoordsEl = $('mapCoords');
      if (gpsAccEl) gpsAccEl.textContent = 'Desktop mode';
      if (mapGpsAccEl) mapGpsAccEl.textContent = 'Desktop mode';
      if (mapCoordsEl) mapCoordsEl.textContent = 'Location unavailable';
      
      setTimeout(() => {
        initMap(28.6139, 77.2090);
        if (leafletMap) {
          leafletMap.setView([28.6139, 77.2090], 12);
        }
      }, 1500);
    }
    
    if (!isMobile) {
      const compassStatus = $('compassStatus');
      const startCompassBtn = $('startCompassBtn');
      const hintEl = $('compassHint');
      if (compassStatus) {
        compassStatus.textContent = 'DESKTOP';
        compassStatus.style.color = 'var(--dim)';
        compassStatus.style.borderColor = 'var(--dim)';
      }
      if (startCompassBtn) {
        startCompassBtn.textContent = 'CHECK SENSORS';
        startCompassBtn.classList.remove('hidden');
      }
      if (hintEl) hintEl.textContent = 'Desktop devices may not have compass sensor';
    } else {
      const compassStatus = $('compassStatus');
      const startCompassBtn = $('startCompassBtn');
      if (compassStatus) {
        compassStatus.textContent = 'TAP TO START';
        compassStatus.style.color = '#ffb300';
        compassStatus.style.borderColor = 'rgba(255,179,0,0.3)';
      }
      if (startCompassBtn) {
        startCompassBtn.classList.remove('hidden');
      }
    }
    
    setTimeout(() => drawGauge('stGauge', 0, 0, 150, 'wifi'), 500);
  } catch(e) {
    console.error('initApp error:', e);
  }
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const footerTime = $('footerTime');
  if (footerTime) footerTime.textContent = timeStr;
}


