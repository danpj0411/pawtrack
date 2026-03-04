/* ============================================================
   app.js — Dog Walking Tracker
   Requires: config.js (supabase), breeds.js
============================================================ */

// ── Auth guard ─────────────────────────────────────────────
let currentUser = null;
let currentSession = null;

async function initApp() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentSession = session;
  currentUser = session.user;
  const name = currentUser.user_metadata?.display_name || currentUser.email;
  document.getElementById('user-display-name').textContent = name;
  document.getElementById('user-display-email').textContent = currentUser.email;
  populate_breed_datalist();
  await navigate('dashboard');
  hideLoading();
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ── Navigation ─────────────────────────────────────────────
const sectionMap = {
  dashboard: 'section-dashboard',
  dogs: 'section-dogs',
  walk: 'section-walk',
  calendar: 'section-calendar',
  history: 'section-history',
};

async function navigate(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const sec = document.getElementById(sectionMap[name]);
  if (sec) sec.classList.add('active');
  const link = document.querySelector(`.nav-link[data-section="${name}"]`);
  if (link) link.classList.add('active');
  document.getElementById('topbar-title').textContent = {
    dashboard: 'Dashboard', dogs: 'My Dogs', walk: 'Start a Walk',
    calendar: 'Calendar', history: 'Walk History'
  }[name] || 'PawTrack';

  // section-specific loaders
  if (name === 'dashboard') await loadDashboard();
  if (name === 'dogs') await loadDogs();
  if (name === 'walk') initWalkSection();
  if (name === 'calendar') { calCurrentDate = new Date(); await loadCalendar(); }
  if (name === 'history') await loadHistory();
}

// ── Sidebar toggle ─────────────────────────────────────────
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => navigate(link.dataset.section));
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});

// ── Toast ──────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

// ── Helpers ────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function fmtDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function fmtDist(meters) {
  if (!meters) return '0 m';
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function dogColor(color) { return color || '#4f7942'; }
function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a2e1a' : '#fff';
}

// ── Cache ──────────────────────────────────────────────────
let _dogs = null;
async function getDogs(force = false) {
  if (_dogs && !force) return _dogs;
  const { data, error } = await supabaseClient.from('dogs').select('*').eq('user_id', currentUser.id).order('name');
  if (error) { console.error(error); return []; }
  _dogs = data || [];
  return _dogs;
}
async function getWalks(dogId = null) {
  let q = supabaseClient.from('walks').select('*').eq('user_id', currentUser.id).order('started_at', { ascending: false });
  if (dogId) q = q.eq('dog_id', dogId);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data || [];
}

// ── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  const [dogs, walks] = await Promise.all([getDogs(), getWalks()]);
  const last7 = new Date(); last7.setDate(last7.getDate() - 7);
  const recentWalks = walks.filter(w => new Date(w.started_at) >= last7);
  const totalMins = walks.reduce((s, w) => s + (w.duration_seconds || 0), 0);
  const totalDist = walks.reduce((s, w) => s + (w.distance_meters || 0), 0);

  document.getElementById('stat-dogs').textContent = dogs.length;
  document.getElementById('stat-walks').textContent = walks.length;
  document.getElementById('stat-time').textContent = fmtDuration(Math.round(totalMins));
  document.getElementById('stat-week').textContent = recentWalks.length + ' walks';

  // recent walks list (last 5)
  const list = document.getElementById('recent-walks-list');
  list.innerHTML = '';
  const latest = walks.slice(0, 5);
  if (latest.length === 0) {
    list.innerHTML = '<p class="empty-msg">No walks yet — go log one! 🐾</p>';
  } else {
    latest.forEach(w => {
      const dog = dogs.find(d => d.id === w.dog_id);
      const col = dogColor(dog?.color);
      const txt = contrastColor(col);
      const div = document.createElement('div');
      div.className = 'walk-item';
      div.innerHTML = `
        <div class="walk-dog-dot" style="background:${col};color:${txt}">${initials(dog?.name || '?')}</div>
        <div class="walk-info">
          <div class="wdog">${dog?.name || 'Unknown dog'}</div>
          <div class="wmeta">${fmtDate(w.started_at)} · ${fmtTime(w.started_at)}</div>
          ${w.route && w.route.length > 2 ? '<div class="walk-has-route">📍 Route recorded</div>' : ''}
        </div>
        <div class="walk-dur">${fmtDuration(w.duration_seconds)}</div>`;
      div.addEventListener('click', () => openWalkModal(w, dogs));
      list.appendChild(div);
    });
  }

}

document.getElementById('quick-walk-btn').addEventListener('click', () => navigate('walk'));
document.getElementById('quick-dog-btn').addEventListener('click', () => openDogModal());

// ── DOGS SECTION ───────────────────────────────────────────
async function loadDogs() {
  const dogs = await getDogs(true);
  const walks = await getWalks();
  const grid = document.getElementById('dogs-grid');
  grid.innerHTML = '';
  if (dogs.length === 0) {
    grid.innerHTML = '<p class="empty-msg">No dogs yet — add your first furry friend! 🐶</p>';
    return;
  }
  dogs.forEach(dog => {
    const walkCount = walks.filter(w => w.dog_id === dog.id).length;
    const last7 = new Date(); last7.setDate(last7.getDate() - 7);
    const weekMins = walks.filter(w => w.dog_id === dog.id && new Date(w.started_at) >= last7)
      .reduce((s, w) => s + (w.duration_seconds || 0) / 60, 0);
    const col = dogColor(dog.color);
    const txt = contrastColor(col);
    const bd = getBreedData(dog.breed);
    let actBadge = '';
    if (bd) {
      const target = bd.walkMinsPerDay * 7;
      const ratio = target > 0 ? weekMins / target : 1;
      if (ratio < 0.5) actBadge = '<div class="dog-activity-badge badge-low">⚠️ Low activity</div>';
      else if (ratio > 1.3) actBadge = '<div class="dog-activity-badge badge-high">🚀 Very active</div>';
      else actBadge = '<div class="dog-activity-badge badge-ok">✅ On track</div>';
    }
    const card = document.createElement('div');
    card.className = 'dog-card';
    card.innerHTML = `
      <div class="dog-avatar" style="background:${col};color:${txt}">${initials(dog.name)}</div>
      <div class="dog-card-name">${dog.name}</div>
      ${dog.breed ? `<div class="dog-card-breed">${dog.breed}</div>` : ''}
      ${dog.owner_name ? `<div class="dog-card-owner">Owner: ${dog.owner_name}</div>` : ''}
      <div class="dog-walks-badge">🐾 ${walkCount} walk${walkCount !== 1 ? 's' : ''}</div>
      ${actBadge}`;
    card.addEventListener('click', () => openDogDetail(dog, walks));
    grid.appendChild(card);
  });
}

// Add dog button
document.getElementById('add-dog-btn').addEventListener('click', () => openDogModal());

function openDogModal(dog = null) {
  const modal = document.getElementById('dog-modal');
  document.getElementById('dog-modal-title').textContent = dog ? 'Edit Dog' : 'Add Dog';
  document.getElementById('dog-form').reset();
  document.getElementById('dog-id-field').value = dog?.id || '';
  if (dog) {
    document.getElementById('dog-name-input').value = dog.name || '';
    document.getElementById('dog-breed-input').value = dog.breed || '';
    document.getElementById('dog-weight-input').value = dog.weight_kg || '';
    document.getElementById('dog-age-input').value = dog.age_years || '';
    document.getElementById('dog-owner-input').value = dog.owner_name || '';
    document.getElementById('dog-color-input').value = dog.color || '#4f7942';
    document.getElementById('dog-notes-input').value = dog.notes || '';
  }
  updateBreedPreview(dog?.breed || '');
  modal.classList.remove('hidden');
}

function closeDogModal() {
  document.getElementById('dog-modal').classList.add('hidden');
}
document.getElementById('dog-modal-close').addEventListener('click', closeDogModal);
document.getElementById('dog-modal-cancel').addEventListener('click', closeDogModal);
document.getElementById('dog-modal-backdrop').addEventListener('click', closeDogModal);

document.getElementById('dog-breed-input').addEventListener('input', e => {
  updateBreedPreview(e.target.value);
});

function updateBreedPreview(breedName) {
  const card = document.getElementById('breed-info-preview');
  const bd = getBreedData(breedName);
  if (!bd || !breedName.trim()) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const sl = activityLabel(bd.activityLevel);
  const sz = sizeBadge(bd.size);
  card.innerHTML = `
    <div class="bp-title">🐾 ${breedName}</div>
    <div class="bp-badges">
      <span class="bp-badge">${sz}</span>
      <span class="bp-badge">${sl}</span>
      <span class="bp-badge">🚶 ${bd.walkMinsPerDay} min/day</span>
      <span class="bp-badge">🦴 ${bd.idealWalksPerDay}x/day</span>
    </div>
    <div class="bp-row"><strong>Temperament:</strong> ${bd.temperament}</div>
    <div class="bp-traits">${(bd.traits || []).map(t => `<span class="bp-trait">${t}</span>`).join('')}</div>
    ${bd.healthNotes ? `<div class="bp-row"><strong>Health:</strong> ${bd.healthNotes}</div>` : ''}
    <div class="bp-fun">${bd.fun || ''}</div>`;
}

document.getElementById('dog-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dog-id-field').value;
  const payload = {
    user_id: currentUser.id,
    name: document.getElementById('dog-name-input').value.trim(),
    breed: document.getElementById('dog-breed-input').value.trim(),
    weight_kg: parseFloat(document.getElementById('dog-weight-input').value) || null,
    age_years: parseFloat(document.getElementById('dog-age-input').value) || null,
    owner_name: document.getElementById('dog-owner-input').value.trim(),
    color: document.getElementById('dog-color-input').value,
    notes: document.getElementById('dog-notes-input').value.trim(),
  };
  let error;
  if (id) {
    ({ error } = await supabaseClient.from('dogs').update(payload).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('dogs').insert(payload));
  }
  if (error) { toast('Error saving dog: ' + error.message); return; }
  _dogs = null;
  closeDogModal();
  toast(id ? 'Dog updated! 🐾' : 'Dog added! 🎉');
  await loadDogs();
});

async function openDogDetail(dog, walks) {
  const modal = document.getElementById('dog-detail-modal');
  const col = dogColor(dog.color);
  const txt = contrastColor(col);
  document.getElementById('dd-avatar').style.background = col;
  document.getElementById('dd-avatar').style.color = txt;
  document.getElementById('dd-avatar').textContent = initials(dog.name);
  document.getElementById('dd-name').textContent = dog.name;
  document.getElementById('dd-breed').textContent = dog.breed || 'Unknown breed';
  document.getElementById('dd-owner').textContent = dog.owner_name ? `Owner: ${dog.owner_name}` : '';

  // Breed info
  const breedSection = document.getElementById('dd-breed-section');
  const bd = getBreedData(dog.breed);
  if (bd) {
    breedSection.innerHTML = `
      <div class="bp-badges" style="margin-bottom:10px">
        <span class="bp-badge">${sizeBadge(bd.size)}</span>
        <span class="bp-badge">${activityLabel(bd.activityLevel)}</span>
        <span class="bp-badge">🚶 ${bd.walkMinsPerDay} min/day</span>
        <span class="bp-badge">🦴 ${bd.idealWalksPerDay}x/day</span>
        <span class="bp-badge">⚖️ ${bd.weightRangeKg[0]}–${bd.weightRangeKg[1]} kg</span>
      </div>
      <div class="bp-row"><strong>Temperament:</strong> ${bd.temperament}</div>
      <div class="bp-traits" style="margin:8px 0">${(bd.traits || []).map(t => `<span class="bp-trait">${t}</span>`).join('')}</div>
      ${bd.healthNotes ? `<div class="bp-row"><strong>Health notes:</strong> ${bd.healthNotes}</div>` : ''}
      ${bd.originalPurpose ? `<div class="bp-row" style="margin-top:6px"><strong>Original purpose:</strong> ${bd.originalPurpose}</div>` : ''}
      <div class="bp-fun">${bd.fun || ''}</div>`;
  } else {
    breedSection.innerHTML = `<p class="empty-msg">No breed data available for "${dog.breed || 'this dog'}".</p>`;
  }

  // Feeding calc
  const feedSection = document.getElementById('dd-feeding-section');
  const last7 = new Date(); last7.setDate(last7.getDate() - 7);
  const weekMins = (walks || []).filter(w => w.dog_id === dog.id && new Date(w.started_at) >= last7)
    .reduce((s, w) => s + (w.duration_seconds || 0) / 60, 0);
  if (bd && dog.weight_kg) {
    const f = calculateFeeding(dog.breed, dog.weight_kg, weekMins);
    const adjColor = f.adjustment > 0 ? '#2e7d32' : f.adjustment < 0 ? '#c62828' : '#666';
    const adjText = f.adjustment > 0 ? `+${Math.round(f.adjustment * 100)}%` : f.adjustment < 0 ? `${Math.round(f.adjustment * 100)}%` : 'Normal';
    feedSection.innerHTML = `
      <div class="feeding-card">
        <div class="feeding-title">🍖 Feeding Guide (based on activity)</div>
        <div class="feeding-main">
          <div class="feeding-num">
            <div class="feeding-num-val">${Math.round(f.kcalPerDay)}</div>
            <div class="feeding-num-lbl">kcal / day</div>
          </div>
          <div class="feeding-num">
            <div class="feeding-num-val">${Math.round(f.portionGrams)}</div>
            <div class="feeding-num-lbl">g dry food / day</div>
          </div>
        </div>
        <div class="feeding-note">${f.note}</div>
        <div class="feeding-note" style="margin-top:6px">${f.activityNote}</div>
        <span class="feeding-adjust" style="background:${adjColor}20;color:${adjColor}">Activity adjustment: ${adjText}</span>
        <div style="font-size:0.75rem;color:#a0aec0;margin-top:8px">Based on ${Math.round(weekMins)} min walked this week · Target: ${f.targetWeeklyMins} min/week</div>
      </div>`;
  } else if (!dog.weight_kg) {
    feedSection.innerHTML = `<p class="empty-msg">Add weight to dog profile to get feeding guide.</p>`;
  } else {
    feedSection.innerHTML = `<p class="empty-msg">No feeding data available.</p>`;
  }

  // Edit/Delete buttons
  document.getElementById('dd-edit-btn').onclick = () => {
    closeDogDetail();
    openDogModal(dog);
  };
  document.getElementById('dd-delete-btn').onclick = async () => {
    if (!confirm(`Delete ${dog.name} and all their walks? This cannot be undone.`)) return;
    await supabaseClient.from('dogs').delete().eq('id', dog.id);
    _dogs = null;
    closeDogDetail();
    toast('Dog removed 🐾');
    await loadDogs();
  };

  modal.classList.remove('hidden');
}
function closeDogDetail() { document.getElementById('dog-detail-modal').classList.add('hidden'); }
document.getElementById('dog-detail-close').addEventListener('click', closeDogDetail);
document.getElementById('dog-detail-close-btn').addEventListener('click', closeDogDetail);
document.getElementById('dog-detail-backdrop').addEventListener('click', closeDogDetail);

function populate_breed_datalist() {
  const dl = document.getElementById('breed-datalist');
  getAllBreedNames().forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; dl.appendChild(opt);
  });
}
function populateDogSelect(id, dogs) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="">Select a dog...</option>';
  dogs.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.name;
    sel.appendChild(opt);
  });
}

// ── WALK SECTION ───────────────────────────────────────────
let walkState = {
  active: false, dogId: null,
  startedAt: null, timerInterval: null, watchId: null,
  route: [], distanceMeters: 0, marker: null,
  polyline: null, map: null,
};

async function initWalkSection() {
  const dogs = await getDogs();
  populateDogSelect('walk-dog-select', dogs);
  setupWalkMap();
}

function setupWalkMap() {
  if (walkState.map) return;
  const mapEl = document.getElementById('live-map');
  walkState.map = L.map(mapEl, { zoomControl: true }).setView([51.505, -0.09], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(walkState.map);
  walkState.polyline = L.polyline([], { color: '#2e7d32', weight: 4, opacity: 0.85 }).addTo(walkState.map);
  // Request location to pan map to user's area
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      walkState.map.setView([pos.coords.latitude, pos.coords.longitude], 15);
    }, () => {});
  }
  document.getElementById('map-hint').classList.remove('hidden');
}

document.getElementById('start-walk-btn').addEventListener('click', async () => {
  const dogId = document.getElementById('walk-dog-select').value;
  if (!dogId) { toast('Select a dog first!'); return; }
  if (!navigator.geolocation) { toast('GPS not supported on this device.'); return; }

  document.getElementById('start-walk-btn').disabled = true;
  document.getElementById('map-hint').classList.add('hidden');

  const dogs = await getDogs();
  const dog = dogs.find(d => d.id === dogId);
  const col = dogColor(dog?.color);
  const txt = contrastColor(col);
  document.getElementById('active-dog-avatar').style.background = col;
  document.getElementById('active-dog-avatar').style.color = txt;
  document.getElementById('active-dog-avatar').textContent = initials(dog?.name || '?');
  document.getElementById('active-dog-name').textContent = dog?.name || 'Dog';
  document.getElementById('active-dog-breed').textContent = dog?.breed || '';

  walkState.active = true;
  walkState.dogId = dogId;
  walkState.startedAt = new Date();
  walkState.route = [];
  walkState.distanceMeters = 0;
  walkState.polyline.setLatLngs([]);

  document.getElementById('pre-walk-panel').classList.add('hidden');
  document.getElementById('active-walk-panel').classList.remove('hidden');
  document.getElementById('active-walk-badge').classList.remove('hidden');

  // Timer
  walkState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - walkState.startedAt) / 1000);
    document.getElementById('live-timer').textContent = fmtDuration(elapsed);
  }, 1000);

  // GPS watch
  setGpsStatus('waiting');
  walkState.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      setGpsStatus('active');
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      if (walkState.route.length > 0) {
        const prev = walkState.route[walkState.route.length - 1];
        walkState.distanceMeters += haversine(prev[0], prev[1], lat, lon);
      }
      walkState.route.push([lat, lon]);
      walkState.polyline.addLatLng([lat, lon]);
      walkState.map.panTo([lat, lon]);

      // Marker
      if (!walkState.marker) {
        const icon = L.divIcon({ className: '', html: '<div style="background:#2e7d32;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
        walkState.marker = L.marker([lat, lon], { icon }).addTo(walkState.map);
      } else {
        walkState.marker.setLatLng([lat, lon]);
      }

      document.getElementById('live-dist').textContent = fmtDist(walkState.distanceMeters);
      document.getElementById('live-pts').textContent = walkState.route.length;
    },
    (err) => {
      setGpsStatus('error');
      console.warn('GPS error', err);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
});

function setGpsStatus(state) {
  const dot = document.getElementById('gps-status-dot');
  const label = document.getElementById('gps-status-label');
  dot.className = 'gps-dot';
  if (state === 'active') { dot.classList.add('active'); label.textContent = 'GPS active'; }
  else if (state === 'error') { dot.classList.add('error'); label.textContent = 'GPS error'; }
  else { label.textContent = 'Waiting for GPS…'; }
}

document.getElementById('finish-walk-btn').addEventListener('click', async () => {
  if (!walkState.active) return;
  const finishedAt = new Date();
  const durationSecs = Math.round((finishedAt - walkState.startedAt) / 1000);
  stopWalkTracking();

  const notes = document.getElementById('walk-notes-input').value.trim();
  const { error } = await supabaseClient.from('walks').insert({
    user_id: currentUser.id,
    dog_id: walkState.dogId,
    started_at: walkState.startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_seconds: durationSecs,
    route: walkState.route,
    distance_meters: Math.round(walkState.distanceMeters),
    notes,
  });
  if (error) { toast('Error saving walk: ' + error.message); resetWalkUI(); return; }
  toast(`Walk logged! 🐾 ${fmtDuration(durationSecs)} · ${fmtDist(walkState.distanceMeters)}`);
  resetWalkUI();
  await navigate('dashboard');
});

document.getElementById('cancel-walk-btn').addEventListener('click', () => {
  if (!confirm('Cancel this walk? Tracking data will be lost.')) return;
  stopWalkTracking();
  toast('Walk cancelled.');
  resetWalkUI();
});

function stopWalkTracking() {
  clearInterval(walkState.timerInterval);
  if (walkState.watchId !== null) navigator.geolocation.clearWatch(walkState.watchId);
  walkState.active = false;
  document.getElementById('active-walk-badge').classList.add('hidden');
}

function resetWalkUI() {
  walkState.dogId = null; walkState.startedAt = null;
  walkState.route = []; walkState.distanceMeters = 0;
  if (walkState.marker) { walkState.marker.remove(); walkState.marker = null; }
  if (walkState.polyline) walkState.polyline.setLatLngs([]);
  document.getElementById('live-timer').textContent = '0m 0s';
  document.getElementById('live-dist').textContent = '0 m';
  document.getElementById('live-pts').textContent = '0';
  document.getElementById('walk-notes-input').value = '';
  document.getElementById('pre-walk-panel').classList.remove('hidden');
  document.getElementById('active-walk-panel').classList.add('hidden');
  document.getElementById('start-walk-btn').disabled = false;
  document.getElementById('map-hint').classList.remove('hidden');
  setGpsStatus('waiting');
}

// ── CALENDAR ───────────────────────────────────────────────
let calCurrentDate = new Date();

async function loadCalendar() {
  const dogs = await getDogs();
  const year = calCurrentDate.getFullYear(), month = calCurrentDate.getMonth();
  document.getElementById('cal-month-label').textContent =
    new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Fetch walks in this month
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const { data: walks } = await supabaseClient.from('walks').select('*')
    .eq('user_id', currentUser.id)
    .gte('started_at', start).lte('started_at', end);

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Pad start
  for (let i = 0; i < firstDay; i++) {
    const c = document.createElement('div');
    c.className = 'cal-cell other-month';
    grid.appendChild(c);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    if (isToday) cell.classList.add('today');
    cell.innerHTML = `<div class="cal-date">${d}</div>`;

    const dayWalks = (walks || []).filter(w => {
      const wd = new Date(w.started_at);
      return wd.getDate() === d && wd.getMonth() === month && wd.getFullYear() === year;
    });
    dayWalks.slice(0, 3).forEach(w => {
      const dog = dogs.find(dd => dd.id === w.dog_id);
      const col = dogColor(dog?.color);
      const dot = document.createElement('span');
      dot.className = 'cal-walk-dot';
      dot.style.background = col;
      dot.textContent = dog?.name || '?';
      cell.appendChild(dot);
    });
    if (dayWalks.length > 3) {
      const more = document.createElement('span');
      more.className = 'cal-walk-dot';
      more.style.background = '#718096';
      more.textContent = `+${dayWalks.length - 3} more`;
      cell.appendChild(more);
    }
    if (dayWalks.length > 0) {
      cell.addEventListener('click', () => openDayModal(d, month, year, dayWalks, dogs));
    }
    grid.appendChild(cell);
  }
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
  loadCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
  loadCalendar();
});

function openDayModal(d, month, year, walks, dogs) {
  const modal = document.getElementById('day-modal');
  const dt = new Date(year, month, d);
  document.getElementById('day-modal-title').textContent =
    dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const body = document.getElementById('day-walks-body');
  body.innerHTML = '';
  walks.forEach(w => {
    const dog = dogs.find(dd => dd.id === w.dog_id);
    const col = dogColor(dog?.color);
    const txt = contrastColor(col);
    const item = document.createElement('div');
    item.className = 'walk-item';
    item.innerHTML = `
      <div class="walk-dog-dot" style="background:${col};color:${txt}">${initials(dog?.name || '?')}</div>
      <div class="walk-info">
        <div class="wdog">${dog?.name || 'Unknown'}</div>
        <div class="wmeta">${fmtTime(w.started_at)} · ${fmtDist(w.distance_meters)}</div>
      </div>
      <div class="walk-dur">${fmtDuration(w.duration_seconds)}</div>`;
    item.addEventListener('click', () => { closeDayModal(); openWalkModal(w, dogs); });
    body.appendChild(item);
  });
  modal.classList.remove('hidden');
}
function closeDayModal() { document.getElementById('day-modal').classList.add('hidden'); }
document.getElementById('day-modal-close').addEventListener('click', closeDayModal);
document.getElementById('day-modal-close-btn').addEventListener('click', closeDayModal);
document.getElementById('day-modal-backdrop').addEventListener('click', closeDayModal);

// ── HISTORY ────────────────────────────────────────────────
async function loadHistory() {
  const dogs = await getDogs();
  const dogFilter = document.getElementById('history-dog-filter').value;
  let walks = await getWalks(dogFilter || null);

  // populate filter select
  const sel = document.getElementById('history-dog-filter');
  const existing = [...sel.options].map(o => o.value);
  if (!existing.includes('')) {
    const all = document.createElement('option');
    all.value = ''; all.textContent = 'All dogs';
    sel.insertBefore(all, sel.firstChild);
  }
  dogs.forEach(d => {
    if (!existing.includes(d.id)) {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.name;
      sel.appendChild(opt);
    }
  });

  const container = document.getElementById('history-list');
  container.innerHTML = '';
  if (walks.length === 0) {
    container.innerHTML = '<p class="empty-msg">No walks recorded yet.</p>';
    return;
  }

  // Group by date
  const groups = {};
  walks.forEach(w => {
    const key = new Date(w.started_at).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  });

  Object.entries(groups).forEach(([dateStr, dayWalks]) => {
    const g = document.createElement('div');
    g.className = 'history-group';
    g.innerHTML = `<div class="history-group-date">${dateStr}</div>`;
    dayWalks.forEach(w => {
      const dog = dogs.find(d => d.id === w.dog_id);
      const col = dogColor(dog?.color);
      const txt = contrastColor(col);
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="walk-dog-dot" style="background:${col};color:${txt}">${initials(dog?.name || '?')}</div>
        <div class="history-info">
          <div class="history-dog">${dog?.name || 'Unknown'}</div>
          <div class="history-meta">${fmtTime(w.started_at)}${w.notes ? ' · ' + w.notes.slice(0, 40) : ''}</div>
        </div>
        <div class="history-right">
          <div class="history-dur">${fmtDuration(w.duration_seconds)}</div>
          <div class="history-dist">${fmtDist(w.distance_meters)}</div>
        </div>`;
      card.addEventListener('click', () => openWalkModal(w, dogs));
      g.appendChild(card);
    });
    container.appendChild(g);
  });
}

document.getElementById('history-dog-filter').addEventListener('change', loadHistory);

// ── WALK DETAIL MODAL ──────────────────────────────────────
let walkDetailMap = null;
let walkDetailPolyline = null;

function openWalkModal(walk, dogs) {
  const modal = document.getElementById('walk-modal');
  const dog = dogs.find(d => d.id === walk.dog_id);
  document.getElementById('wm-title').textContent = `${dog?.name || 'Unknown'}'s Walk`;
  document.getElementById('wm-date').textContent = fmtDate(walk.started_at);
  document.getElementById('wm-time').textContent = fmtTime(walk.started_at);
  document.getElementById('wm-duration').textContent = fmtDuration(walk.duration_seconds);
  document.getElementById('wm-distance').textContent = fmtDist(walk.distance_meters);
  document.getElementById('wm-notes').textContent = walk.notes || '—';

  const mapEl = document.getElementById('walk-detail-map');
  const hasRoute = walk.route && walk.route.length > 1;

  if (hasRoute) {
    mapEl.classList.remove('hidden');
    if (!walkDetailMap) {
      walkDetailMap = L.map(mapEl).setView(walk.route[0], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(walkDetailMap);
      walkDetailPolyline = L.polyline([], { color: '#2e7d32', weight: 4 }).addTo(walkDetailMap);
    } else {
      walkDetailMap.invalidateSize();
    }
    walkDetailPolyline.setLatLngs(walk.route);
    walkDetailMap.fitBounds(walkDetailPolyline.getBounds(), { padding: [24, 24] });
  } else {
    mapEl.classList.add('hidden');
  }

  document.getElementById('wm-delete-btn').onclick = async () => {
    if (!confirm('Delete this walk?')) return;
    await supabaseClient.from('walks').delete().eq('id', walk.id);
    closeWalkModal();
    toast('Walk deleted.');
    await loadHistory();
  };

  modal.classList.remove('hidden');
  // Invalidate map size after modal animation
  if (hasRoute) setTimeout(() => walkDetailMap && walkDetailMap.invalidateSize(), 220);
}
function closeWalkModal() { document.getElementById('walk-modal').classList.add('hidden'); }
document.getElementById('walk-modal-close').addEventListener('click', closeWalkModal);
document.getElementById('walk-modal-close-btn').addEventListener('click', closeWalkModal);
document.getElementById('walk-modal-backdrop').addEventListener('click', closeWalkModal);

// ── INIT ───────────────────────────────────────────────────
initApp();
