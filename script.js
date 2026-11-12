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
