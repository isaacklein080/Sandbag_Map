// Mapbox public token.
mapboxgl.accessToken = 'pk.eyJ1IjoiaXNhYWNrbGVpbjA4MCIsImEiOiJjbXdkdGlrbDYwN2lpMnlweGNodmxiZm5pIn0.fskXR8zworn-La8h_Crecg';

// Where the sandbag data lives.
// On GitHub Pages this relative path works as is.
// In CodePen, swap it for the raw GitHub link once the repo exists, e.g.
// 'https://raw.githubusercontent.com/isaacklein080/YOUR-REPO-NAME/refs/heads/main/data/sandbags.geojson'
const DATA_URL = './data/sandbags.geojson';

// The marker. There is no sandbag emoji, so this is a small drawn sandbag.
const SANDBAG_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">' +
  '<path d="M11 7c-1.500-2-1-4 1-4 1.200 0 1.600 1 4 1s2.800-1 4-1c2 0 2.500 2 1 4z" fill="#b08d57" stroke="#5c4420" stroke-width="1.200"/>' +
  '<path d="M10.500 8.500h11c4 4 6.500 9 6.500 14 0 4-3 6.500-12 6.500S4 26.500 4 22.500c0-5 2.500-10 6.500-14z" fill="#d2b27a" stroke="#5c4420" stroke-width="1.200"/>' +
  '<path d="M10 9.500h12" stroke="#5c4420" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M9 19h14M8 23h16" stroke="#b08d57" stroke-width="1.200" stroke-linecap="round"/></svg>';

const map = new mapboxgl.Map({
  container: 'map', // container ID
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.03, 37.80], // starting position [lng, lat]
  zoom: 9 // starting zoom
});
map.addControl(new mapboxgl.NavigationControl(), 'top-right');
map.addControl(new mapboxgl.ScaleControl({
  maxWidth: 200,
  unit: 'imperial'
}), 'bottom-left');

// Text from the data is cleaned before it goes into a popup.
function clean(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

map.on('load', function() {
  map.addSource('points-data', {
    type: 'geojson',
    data: DATA_URL
  });

  // Turn the drawn sandbag into a map icon, then add the layer that uses it.
  const icon = new Image(64, 64);
  icon.onload = function() {
    map.addImage('sandbag', icon, { pixelRatio: 2 });

    map.addLayer({
      id: 'points-layer',
      type: 'symbol',
      source: 'points-data',
      layout: {
        'icon-image': 'sandbag',
        'icon-size': 1,
        'icon-allow-overlap': true
      }
    });
  };
  icon.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SANDBAG_SVG);

  map.on('click', 'points-layer', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;

    const popupContent = `
      <div>
        <h3>${clean(properties["name"])}</h3>
        <p class="popup-city">${clean(properties["city"])}</p>
        <p><strong>Address:</strong> ${clean(properties["address"])}</p>
        ${properties["notes"] ? `<p>${clean(properties["notes"])}</p>` : ''}
        ${properties["who"] ? `<p><strong>Who:</strong> ${clean(properties["who"])}</p>` : ''}
        ${properties["limit"] ? `<p><strong>Limit:</strong> ${clean(properties["limit"])}</p>` : ''}
        ${properties["phone"] ? `<p><strong>Phone:</strong> ${clean(properties["phone"])}</p>` : ''}
        ${properties["website"] ? `<p><a href="${clean(properties["website"])}" target="_blank" rel="noopener">More Information</a></p>` : ''}
      </div>
    `;

    new mapboxgl.Popup({ maxWidth: '300px' })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
  });

    map.on('mouseenter', 'points-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });


    map.on('mouseleave', 'points-layer', () => {
        map.getCanvas().style.cursor = '';
    });

});

//Transparency Panel Logic
const dataBtn = document.getElementById('data-info-btn');
const dataPanel = document.getElementById('data-panel');
const closeBtn = document.querySelector('.close-panel');

dataBtn.addEventListener('click', function() {
  dataPanel.classList.toggle('visible');
});

closeBtn.addEventListener('click', function() {
  dataPanel.classList.remove('visible');
});

// ===================================================================
// Address finder: "Find Your Nearest Sandbag Location"
//
// Privacy: the address is sent only to Mapbox Geocoding to turn it into
// a point. It is never written to storage, the URL, or the console, and
// everything else (city lookup, eligibility, distance) runs in the browser.
// ===================================================================
const BOUNDARIES_URL = './data/city-boundaries.geojson';
const FINDER_COUNTIES = { 'Alameda County': 'Alameda', 'Contra Costa County': 'Contra Costa' };
const FINDER_BBOX = '-122.45,37.45,-121.45,38.11'; // both counties
const UNCLEAR_RADIUS_MILES = 10; // how far to look for "call to confirm" sites

// --- finder logic start (no map or page access in this block) ---
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lng, lat, rings) {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false; // inside a hole
  }
  return true;
}

function pointInGeometry(lng, lat, geometry) {
  if (geometry.type === 'Polygon') return pointInPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => pointInPolygon(lng, lat, poly));
  }
  return false;
}

// Works out which city the point is in. If it is in none of the city
// boundaries it is unincorporated county land.
function findJurisdiction(lng, lat, county, boundaries) {
  let community = '';
  for (const f of boundaries.features) {
    if (!pointInGeometry(lng, lat, f.geometry)) continue;
    if (f.properties.kind === 'city') {
      return { type: 'city', name: f.properties.name, county: f.properties.county, community: '' };
    }
    community = f.properties.name;
  }
  return { type: 'unincorporated', name: '', county: county, community: community };
}

// True only when the site's own data says it serves this resident.
function siteServes(props, j) {
  if (props.eligibility === 'open') return true; // open to everyone
  if (props.eligibility === 'city') {
    const serves = props.serves || [];
    if (j.type === 'city') return serves.includes(j.name);
    return j.community !== '' && serves.includes(j.community);
  }
  if (props.eligibility === 'unincorporated') {
    return j.type === 'unincorporated' && props.serves_county === j.county;
  }
  return false; // 'unclear' or missing: never assumed eligible
}

function milesBetween(lng1, lat1, lng2, lat2) {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Same city, or both on unincorporated land in the same county.
function sameJurisdiction(a, b) {
  if (a.type !== b.type) return false;
  return a.type === 'city' ? a.name === b.name : a.county === b.county;
}

// Returns { eligible: [closest three], unclear: [local sites to call first] }.
// "Unclear" sites are ones whose data does not say who may use them. They are
// never recommended. They are listed separately, and only when the site sits
// in the resident's own city or unincorporated area.
function rankSites(lng, lat, j, sites, boundaries) {
  const withDistance = sites.features.map((f) => ({
    feature: f,
    miles: milesBetween(lng, lat, f.geometry.coordinates[0], f.geometry.coordinates[1])
  })).sort((a, b) => a.miles - b.miles);

  const eligible = withDistance.filter((s) => siteServes(s.feature.properties, j)).slice(0, 3);
  const unclear = withDistance.filter((s) => {
    const p = s.feature.properties, c = s.feature.geometry.coordinates;
    if (p.eligibility === 'city' || p.eligibility === 'unincorporated' || p.eligibility === 'open') return false;
    if (s.miles > UNCLEAR_RADIUS_MILES) return false;
    return sameJurisdiction(findJurisdiction(c[0], c[1], p.county, boundaries), j);
  }).slice(0, 3);
  return { eligible, unclear };
}

function describeJurisdiction(j) {
  if (j.type === 'city') return 'the City of ' + j.name;
  if (j.community) return j.community + ' (unincorporated ' + j.county + ' County)';
  return 'unincorporated ' + j.county + ' County';
}
// --- finder logic end ---

const finderForm = document.getElementById('finder-form');
const finderInput = document.getElementById('finder-input');
const finderSearch = document.getElementById('finder-search');
const finderStatus = document.getElementById('finder-status');
const finderResults = document.getElementById('finder-results');
const finderClear = document.getElementById('finder-clear');
let finderMarkers = [];
let finderData = null; // loaded once, on the first search

function loadFinderData() {
  if (!finderData) {
    finderData = Promise.all([
      fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error('data'); return r.json(); }),
      fetch(BOUNDARIES_URL).then((r) => { if (!r.ok) throw new Error('data'); return r.json(); })
    ]).catch((err) => { finderData = null; throw err; });
  }
  return finderData;
}

async function geocodeAddress(text) {
  const url = 'https://api.mapbox.com/search/geocode/v6/forward?q=' + encodeURIComponent(text) +
    '&country=us&bbox=' + FINDER_BBOX + '&types=address&limit=1&autocomplete=false' +
    '&access_token=' + mapboxgl.accessToken;
  const response = await fetch(url);
  if (!response.ok) throw new Error('geocode');
  const json = await response.json();
  return json.features && json.features.length ? json.features[0] : null;
}

function setFinderStatus(message, kind) {
  finderStatus.textContent = message;
  finderStatus.className = 'finder-status' + (kind ? ' ' + kind : '');
}

function removeFinderMarkers() {
  finderMarkers.forEach((m) => m.remove());
  finderMarkers = [];
}

function addFinderPin(lngLat, className, label, offsetY) {
  const el = document.createElement('div');
  el.className = 'finder-pin ' + className;
  el.textContent = label;
  const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, offsetY] })
    .setLngLat(lngLat).addTo(map);
  finderMarkers.push(marker);
}

// Turns phone numbers in a text into tap-to-call links.
function phoneLinks(text) {
  return clean(text).replace(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g, (number) =>
    '<a href="tel:+1' + number.replace(/\D/g, '') + '">' + number + '</a>');
}

function siteCard(site, kind, label) {
  const p = site.feature.properties;
  const c = site.feature.geometry.coordinates;
  const directions = 'https://www.google.com/maps/dir/?api=1&destination=' + c[1] + ',' + c[0];
  const limited = /suppl|run out|limited/i.test(p.notes || '');
  let badges = '';
  if (kind === 'recommended') badges += '<span class="finder-badge recommended">★ Recommended: closest site that serves your address</span>';
  if (kind === 'alt') badges += '<span class="finder-badge">' + clean(label) + '. Also serves your address</span>';
  if (kind === 'unclear') badges += '<span class="finder-badge unclear">' + clean(label) + '. Call first: eligibility not confirmed</span>';
  if (limited) badges += '<span class="finder-badge supply">While supplies last</span>';

  return `
    <div class="finder-card ${kind}" data-lng="${c[0]}" data-lat="${c[1]}">
      ${badges}
      <h4>${clean(p.name)}</h4>
      <p>${clean(p.address)}</p>
      <p class="finder-distance">${site.miles.toFixed(1)} miles away (straight line)</p>
      ${p.notes ? `<p><strong>Hours and notes:</strong> ${clean(p.notes)}</p>` : ''}
      <p><strong>Who can use it:</strong> ${p.who ? clean(p.who) : 'Not stated by the agency. Contact the site before you go.'}</p>
      ${p.limit ? `<p><strong>Household limit:</strong> ${clean(p.limit)}</p>` : ''}
      ${p.phone ? `<p><strong>Phone:</strong> ${phoneLinks(p.phone)}</p>` : ''}
      <p class="finder-links">
        <a href="${directions}" target="_blank" rel="noopener">Directions</a>
        ${p.website ? `<a href="${clean(p.website)}" target="_blank" rel="noopener">Website</a>` : ''}
      </p>
    </div>`;
}

function showFinderResults(lng, lat, matched, j, ranked) {
  let html = `<p class="finder-where"><strong>Found:</strong> ${clean(matched)}<br>
    This address appears to be in <strong>${clean(describeJurisdiction(j))}</strong>.
    If that is wrong, call the site before you go.</p>`;

  if (ranked.eligible.length) {
    html += siteCard(ranked.eligible[0], 'recommended', '');
    if (ranked.eligible.length > 1) {
      html += '<h4 class="finder-section-title">Other sites that serve your address</h4>';
      ranked.eligible.slice(1).forEach((s, i) => { html += siteCard(s, 'alt', String(i + 2)); });
    }
  } else {
    html += `<p class="finder-status error">We could not confirm a sandbag site that serves
      ${clean(describeJurisdiction(j))}. Contact your city or county public works department
      to ask where residents can get sandbags.</p>`;
  }

  if (ranked.unclear.length) {
    html += `<h4 class="finder-section-title">Nearby sites to confirm first</h4>
      <p class="finder-note">These sites are in your area, but the agency does not say who may
      use them. Call before you go.</p>`;
    ranked.unclear.forEach((s, i) => { html += siteCard(s, 'unclear', '?' + (i + 1)); });
  }

  html += '<p class="finder-note">Supplies can run out during storms and many sites are unstaffed. Distances are straight-line, not driving distance.</p>';
  finderResults.innerHTML = html;
  finderClear.hidden = false;

  // Map: resident's location, the recommended site, and the other options.
  removeFinderMarkers();
  const bounds = new mapboxgl.LngLatBounds([lng, lat], [lng, lat]);
  addFinderPin([lng, lat], 'home', '', 8);
  ranked.eligible.forEach((s, i) => {
    const c = s.feature.geometry.coordinates;
    addFinderPin(c, i === 0 ? 'recommended' : 'alt', i === 0 ? '★ Recommended' : String(i + 1), -18);
    bounds.extend(c);
  });
  ranked.unclear.forEach((s) => {
    addFinderPin(s.feature.geometry.coordinates, 'unclear', '?', -18);
    if (!ranked.eligible.length) bounds.extend(s.feature.geometry.coordinates);
  });
  const wide = window.innerWidth > 600;
  map.fitBounds(bounds, {
    padding: wide ? { top: 150, bottom: 60, left: 400, right: 60 } : { top: 40, bottom: 40, left: 40, right: 40 },
    maxZoom: 14
  });
}

function clearFinder() {
  finderInput.value = '';
  finderResults.innerHTML = '';
  setFinderStatus('', '');
  finderClear.hidden = true;
  removeFinderMarkers();
  finderInput.focus();
}

finderForm.addEventListener('submit', async function(event) {
  event.preventDefault();
  const text = finderInput.value.trim();
  if (text.length < 5) {
    setFinderStatus('Please enter a street address and city, for example "1 Frank H Ogawa Plaza, Oakland".', 'error');
    return;
  }

  finderResults.innerHTML = '';
  removeFinderMarkers();
  finderClear.hidden = true;
  finderSearch.disabled = true;
  setFinderStatus('Searching…', 'loading');

  try {
    const [found, data] = await Promise.all([geocodeAddress(text), loadFinderData()]);
    const sites = data[0], boundaries = data[1];

    if (!found) {
      setFinderStatus('We could not find that address in Alameda or Contra Costa County. Check the spelling and include the street number and city.', 'error');
      return;
    }
    const props = found.properties;
    const county = FINDER_COUNTIES[(props.context && props.context.district && props.context.district.name) || ''];
    if (!county) {
      setFinderStatus('That address appears to be outside Alameda and Contra Costa Counties. This map only covers those two counties.', 'error');
      return;
    }

    const lng = found.geometry.coordinates[0], lat = found.geometry.coordinates[1];
    const j = findJurisdiction(lng, lat, county, boundaries);
    const ranked = rankSites(lng, lat, j, sites, boundaries);
    setFinderStatus('', '');
    showFinderResults(lng, lat, props.full_address || text, j, ranked);
  } catch (err) {
    setFinderStatus('Something went wrong with the search. Check your connection and try again.', 'error');
  } finally {
    finderSearch.disabled = false;
  }
});

finderClear.addEventListener('click', clearFinder);

// Clicking a result card moves the map to that site.
finderResults.addEventListener('click', function(event) {
  if (event.target.closest('a')) return;
  const card = event.target.closest('.finder-card');
  if (!card) return;
  map.flyTo({ center: [Number(card.dataset.lng), Number(card.dataset.lat)], zoom: 15 });
});
