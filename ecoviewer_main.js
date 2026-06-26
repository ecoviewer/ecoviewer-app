/***************************************************************
 * EcoViewer                                                   *
 *                                                             *
 * A spatial data viewer that compiles global and regional     *
 * environmental datasets to help identify IUCN Global         *
 * Ecosystem Typology (GET) functional groups, integrated      *
 * with GBIF indicator species occurrence data.                *
 *                                                             *
 * Authors: William Masson, Dhruv Narayan, Rebecca Saunders,   *
 *          Ben Steer                                          *
 *                                                             *
 * Last Updated:- 26-06-2026                                   *                    
 *                                                             *
 * James Cook University — Global Ecology Lab                  *
 ***************************************************************/

// ─── 1. Imports ──────────────────────────────────────────────
var config = require('users/rebeccasaunders/ecoviewer:ecoviewer_config');
var fun    = require('users/rebeccasaunders/ecoviewer:ecoviewer_functions');
var snazzy = require('users/aazuspan/snazzy:styles');
snazzy.addStyle('https://snazzymaps.com/style/38830/vector', 'Dark');

// ─── 1.1 User Inputs ─────────────────────────────────────────
var DEFAULT_COORDS     = config.defaults.coords;
var MAP_ZOOM            = config.defaults.mapZoom;
var GBIF_SEARCH_RADIUS  = 25000;
var GBIF_LAND_PTS       = config.defaults.gbifLandPts;

// ─── 1.2 Core Datasets (loaded on startupr) ──────────────────
var DATA = {
  elevation:      config.data.elevation,
  slope:          ee.Terrain.slope(config.data.elevation),
  countries:      config.data.countries,
  ecoregions:     config.data.ecoregions,
  aridity:        config.data.aridity,
  chelsa_precip:  config.data.chelsa_precip,
  chelsa_min:     config.data.chelsa_min,
  chelsa_max:     config.data.chelsa_max,
  chelsa_snow:    config.data.chelsa_snow,
  lc_ESA:         config.data.worldcover.first().select('Map'),
  sbtn:           config.data.sbtn.select('classification'),
  crop:           config.data.crop.select('landcover'),

  // Extended datasets — lazy-loaded on first visit to the Water tab
  water_gsw:      null,
  wetlands_glwd:  null,
  tidal_classes:  null,
  gmw_union:      null,
  aca_benthic:    null,

  // Set when each tab first loads
  gbif: null
};

// ─── 1.3 Legends ─────────────────────────────────────────────
var ESANames        = config.legends.ESA;
var SBTNNames       = config.legends.SBTN;
var cropNames       = config.legends.crop;
var glwdNames       = config.legends.glwd;
var gloricGeomNames = config.legends.gloricGeom;
var gloricHydrNames = config.legends.gloricHydr;
var gloricPhysNames = config.legends.gloricPhys;
var acaBenthicNames = config.legends.acaBenthic;

// ─── 1.4 Map Configuration ───────────────────────────────────
Map.setOptions(config.defaults.mapStyle);
Map.style().set('cursor', config.defaults.mapCursor);

// ─── 1.5 Global State ────────────────────────────────────────
var currentPoint      = null;
var currentSection    = 'home';
var cachedStats        = null;
var isInspectorActive = false;

// ─── 2. Helper Functions ──────────────────────────────
// Pulled in from ecoviewer_functions
var parseCoords          = fun.parseCoords;
var getAridityClass      = fun.getAridityClass;
var getLatBand            = fun.getLatBand;
var makeRow               = fun.makeRow;
var makeDryMonthsRow      = fun.makeDryMonthsRow;
var makeGrowingSeasonRow  = fun.makeGrowingSeasonRow;
var getAnnualArea         = fun.getAnnualArea;
var makeLegendRow         = fun.makeLegendRow;

// ─── 2.1 Species Inspector ────────────────────────────────────
// Identifies the nearest GBIF point to a click when Inspector mode is active
function inspectSpecies(coords) {
  resultsPanel.clear();

  var inspectCard = ui.Panel({
    style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
  });
  resultsPanel.add(inspectCard);

  var exitBtn = ui.Button({
    label: 'Disable Inspector & Return',
    style: {stretch: 'horizontal', color: '#D32F2F', border: '1px solid #D32F2F', fontWeight: 'bold', margin: '0 0 10px 0'},
    onClick: function() {
      isInspectorActive = false;
      Map.layers().set(5, null); 
      renderUI();
    }
  });
  inspectCard.add(exitBtn);

  inspectCard.add(ui.Label('INDIVIDUAL SPECIES IDENTIFIER', {
    fontWeight: 'bold', fontSize: '12px', color: '#1976D2',
    border: '1px solid #1976D2', padding: '8px', margin: '0 0 10px 0',
    textAlign: 'center', stretch: 'horizontal'
  }));

  var searchingLabel = ui.Label('Searching for nearest point...', {color: 'gray'});
  inspectCard.add(searchingLabel);

  var clickPoint = ee.Geometry.Point(coords.lon, coords.lat);
  var searchZone = clickPoint.buffer(500);

  var nearest = DATA.gbif.filterBounds(searchZone)
    .map(function(f) {
      return f.set('dist_to_click', f.geometry().distance(clickPoint));
    })
    .sort('dist_to_click')
    .first();

  nearest.evaluate(function(f) {
    searchingLabel.style().set({shown: false});

    if (!f) {
      inspectCard.add(ui.Label('No point found nearby.', {color: 'red', fontWeight: 'bold'}));
      inspectCard.add(ui.Label('Try clicking closer to a dot.', {fontSize: '11px', color: 'gray'}));
      return;
    }

    // Highlight the selected point
    var highlight = ee.FeatureCollection([ee.Feature(f)]).style({
      color: '00FFFF', pointSize: 14, width: 2, fillColor: '00000000'
    });
    Map.layers().set(5, ui.Map.Layer(highlight, {}, 'Selected Point'));

    var p = f.properties;
    var addDetail = function(label, val) {
      inspectCard.add(ui.Label(label, {fontWeight: 'bold', fontSize: '11px', color: '#555', margin: '8px 0 0 0'}));
      inspectCard.add(ui.Label(val || 'N/A', {fontSize: '12px', margin: '0 0 4px 0', whiteSpace: 'pre-wrap'}));
    };

    addDetail('Species:',           p['species'] || p['indicator']);
    addDetail('Family:',            p['family']);
    addDetail('Date/Year:',         p['year']);
    addDetail('Biome/EFG:',         p['Matching EFG, Biome (full name)'] || p['Matching EFG, Biome']);
    addDetail('Coordinates:',       coords.lat.toFixed(5) + ', ' + coords.lon.toFixed(5));
    addDetail('Hex Colour:',        p['palette']);
    addDetail('Notes:',             p['notes']);

    inspectCard.add(ui.Label('__________________________', {margin: '10px 0'}));
  });
}

// ─── 3. UI Panel ──────────────────────────────────────────────
var mainPanel = ui.Panel({style: config.styles.mainPanel});
ui.root.insert(0, mainPanel);

// Target location controls (hidden on the home tab)
var targetLabel  = ui.Label('Target Location', config.styles.labelTitle);
var coordInput   = ui.Textbox({placeholder: 'lat, lon', value: DEFAULT_COORDS, style: {width: '100%'}});
var updateBtn    = ui.Button({
  label: 'Update Location & Data',
  onClick: function() {
    var coords = parseCoords(coordInput.getValue());
    if (coords) runAnalysis(coords);
    else alert('Invalid coordinate format. Please paste coordinates as decimal "lat, long".');
  }
});
var coordDivider = ui.Label('___________________________________________________');

mainPanel.add(targetLabel).add(coordInput).add(updateBtn).add(coordDivider);

// Section selector
mainPanel.add(ui.Label('Analysis Theme:', config.styles.labelSubsection));
var sectionSelect = ui.Select({
  items: [
    {label: 'EcoViewer',              value: 'home'},
    {label: 'GBIF Indicators',        value: 'gbif'},
    {label: 'Overview',               value: 'over'},
    {label: 'Climatic Info',          value: 'climate'},
    {label: 'Vegetation',             value: 'veg'},
    {label: 'Waterbodies & Wetlands', value: 'water'},
    {label: 'Fire Disturbance',       value: 'fire'}
  ],
  value: 'home',
  onChange: function(value) {
    currentSection = value;
    if (value !== 'home' && !cachedStats) {
      runAnalysis({lat: -19.3317, lon: 146.7556});
      return;
    }
    renderUI();
  },
  style: {width: '100%'}
});
mainPanel.add(sectionSelect);

// Results and charts panels (hidden on the home tab)
var statsLabel  = ui.Label('Point Statistics', config.styles.labelSection);
mainPanel.add(statsLabel);
var resultsPanel = ui.Panel({style: {backgroundColor: 'rgba(0,0,0,0)'}});
mainPanel.add(resultsPanel);

var chartsLabel = ui.Label('Charts', config.styles.labelSection);
mainPanel.add(chartsLabel);
var chartPanel = ui.Panel({style: {backgroundColor: 'rgba(0,0,0,0)'}});
mainPanel.add(chartPanel);
// ─── 4. Run Analysis ──────────────────────────────────────────
// Samples the core (and, if needed, extended) dataset stack at the
// clicked point and caches the result for use across all tabs.
function runAnalysis(coords) {
  currentPoint = ee.Geometry.Point(coords.lon, coords.lat);
  Map.centerObject(currentPoint, MAP_ZOOM);
  coordInput.setValue(coords.lat.toFixed(5) + ', ' + coords.lon.toFixed(5), false);

  resultsPanel.clear();
  chartPanel.clear();
  resultsPanel.add(ui.Label('Analyzing...', config.styles.labelSmall));

  // Core stack — sampled on every click, used by Overview/Climate/Vegetation
  var coreStack = ee.Image.cat([
    DATA.elevation.rename('elev'),
    DATA.slope.rename('slope'),
    DATA.aridity.rename('aridity'),
    DATA.lc_ESA.rename('lc_code'),
    DATA.sbtn.rename('sbtn_code'),
    DATA.chelsa_precip.rename('ann_precip'),
    DATA.chelsa_min.rename('min_t'),
    DATA.chelsa_max.rename('max_t'),
    DATA.chelsa_snow.rename('snow_days'),
    DATA.crop.rename('crop_code')
  ]);

  // Extended stack — only sampled when on the Water tab
  var needsExtended = (currentSection === 'water');

  if (needsExtended) {
    if (!DATA.water_gsw)     DATA.water_gsw     = config.data.gsw;
    if (!DATA.wetlands_glwd) DATA.wetlands_glwd = config.data.glwd;
    if (!DATA.tidal_classes) {
      DATA.tidal_classes = config.data.tidal.select('gainType')
        .unmask(config.data.tidal.select('lossType'))
        .rename('class');
    }
    if (!DATA.gmw_union)   DATA.gmw_union   = config.data.gmw_union;
    if (!DATA.aca_benthic) DATA.aca_benthic = config.data.aca.select('benthic');
  }

  var sampleStack = needsExtended
    ? ee.Image.cat([
        coreStack,
        DATA.wetlands_glwd.rename('glwd_code'),
        DATA.water_gsw.select('seasonality').rename('gsw_season'),
        DATA.tidal_classes.rename('tidal_type'),
        DATA.gmw_union.rename('gmw_presence'),
        DATA.aca_benthic.rename('aca_benthic_code')
      ])
    : coreStack;

  sampleStack.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: currentPoint,
    scale: 30,
    bestEffort: true,
    tileScale: 4
  }).evaluate(function(stats) {
    cachedStats = stats;
    cachedStats.lat = coords.lat;
    cachedStats.lon = coords.lon;

    var nameDict = ee.Dictionary({
      ecoName: ee.Algorithms.If(
        DATA.ecoregions.filterBounds(currentPoint).size().gt(0),
        DATA.ecoregions.filterBounds(currentPoint).first().get('ECO_NAME'),
        'Unknown or Ocean'
      ),
      countryName: ee.Algorithms.If(
        DATA.countries.filterBounds(currentPoint).size().gt(0),
        DATA.countries.filterBounds(currentPoint).first().get('ADM0_NAME'),
        'Unknown or Ocean'
      )
    });

    nameDict.evaluate(function(names) {
      cachedStats.ecoName     = names.ecoName     || 'Unknown or Ocean';
      cachedStats.countryName = names.countryName || 'Unknown or Ocean';
      renderUI();
    });
  });
}

// ─── 5. Render UI ─────────────────────────────────────────────
function renderUI() {
  var isHome = (currentSection === 'home');

  // Show/hide the coordinate controls and chart panel based on section
  targetLabel.style().set({shown: !isHome});
  coordInput.style().set({shown: !isHome});
  updateBtn.style().set({shown: !isHome});
  coordDivider.style().set({shown: !isHome});
  statsLabel.style().set({shown: !isHome});
  chartsLabel.style().set({shown: !isHome});

  if (!cachedStats && currentSection !== 'home') return;

  if (currentSection === 'home') {
    resultsPanel.clear();
    chartPanel.clear();
  } else if (!cachedStats) {
    return;
  }

  // If switching to the Water tab and extended data hasn't been sampled yet, re-run analysis
  var needsExtended = (currentSection === 'water');
  if (needsExtended && cachedStats.glwd_code === undefined) {
    resultsPanel.clear();
    chartPanel.clear();
    resultsPanel.add(ui.Label('Loading data...', config.styles.labelSmall));
    runAnalysis({lat: cachedStats.lat, lon: cachedStats.lon});
    return;
  }

  resultsPanel.clear();
  chartPanel.clear();
  Map.layers().reset();

  if (currentSection !== 'home') {
    Map.setOptions(config.defaults.mapStyle);
  }

  Map.layers().set(1, ui.Map.Layer(currentPoint, {color: 'FF0000'}, 'Target'));

  // ─── Home / About ────────────────────────────────────────────
  if (currentSection === 'home') {
    DATA.gbif = ee.FeatureCollection(config.assets.gbif);
    Map.layers().reset();

    try { Map.setOptions('Dark'); } catch (e) {}
    var shuffledGBIF = DATA.gbif.randomColumn('random').sort('random');

    var styledGBIF = shuffledGBIF.map(function(f) {
      return f.set('styleParams', {
        color:     f.get('pixel value') || '#1b9e77',
        pointSize: 5,
        width:     1,
        fillColor: f.get('pixel value') || '#1b9e77'
      });
    }).style({styleProperty: 'styleParams'});

    Map.addLayer(styledGBIF, {}, 'GBIF Indicator Species');
    Map.setCenter(0, 20, 2);

    var homeCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(homeCard);

    homeCard.add(ui.Label('🌿 EcoViewer', {
      fontWeight: 'bold', fontSize: '22px', color: '#2d6e30', margin: '0 0 4px 0'
    }));
    homeCard.add(ui.Label('A reference library for the living world', {
      fontSize: '13px', color: '#4a5c48', margin: '0 0 16px 0'
    }));
    homeCard.add(ui.Label('___________________________________', {color: '#8a9e88'}));

    homeCard.add(ui.Label('What is EcoViewer?', {
      fontWeight: 'bold', fontSize: '14px', color: '#3d8c40', margin: '12px 0 6px 0'
    }));
    homeCard.add(ui.Label(
      'EcoViewer brings together the best publicly available environmental datasets ' +
      'into a single harmonised reference, queryable at any point on Earth. Built to ' +
      'support ecosystem classification under the IUCN Global Ecosystem Typology, it ' +
      'delivers instant environmental context for ecological research, biodiversity ' +
      'assessment, and conservation planning.',
      {fontSize: '12px', color: '#1a2219', whiteSpace: 'pre-wrap', margin: '0 0 12px 0'}
    ));

    homeCard.add(ui.Label('Powered by GBIF', {
      fontWeight: 'bold', fontSize: '14px', color: '#3d8c40', margin: '4px 0 6px 0'
    }));
    homeCard.add(ui.Label(
      'The map shows GBIF indicator species around the world. Each dot ' +
      'represents occurrence records colour-coded by ecosystem functional group or biome. Click ' +
      'any where on the map to launch the GBIF Indicators tab to explore species near any location.',
      {fontSize: '12px', color: '#1a2219', whiteSpace: 'pre-wrap', margin: '0 0 12px 0'}
    ));
    homeCard.add(ui.Label('___________________________________', {color: '#8a9e88'}));

    homeCard.add(ui.Label('How to Use', {
      fontWeight: 'bold', fontSize: '14px', color: '#3d8c40', margin: '12px 0 6px 0'
    }));

var steps = [
      '1.  Click anywhere on the map to jump straight into GBIF Indicators for that location.',
      '2.  Once you have a location, choose an Analysis Theme from the dropdown to explore climate, vegetation, water, fire, and GBIF data.',
      '3.  Paste or type coordinates directly into the box above any tab to jump to a specific location.',
      '4.  Some sections have buttons to load charts or run on-demand analyses — these are gated to keep things fast.',
      '5.  To identify an individual species dot, go to GBIF Indicators and enable the Species Identifier.'
    ];
    steps.forEach(function(s) {
      homeCard.add(ui.Label(s, {fontSize: '12px', color: '#1a2219', whiteSpace: 'pre-wrap', margin: '0 0 8px 0'}));
    }); 
    homeCard.add(ui.Label('___________________________________', {color: '#8a9e88', margin: '12px 0 6px 0'}));
    homeCard.add(ui.Label('Data Citation', {
      fontWeight: 'bold', fontSize: '12px', color: '#4a5c48', margin: '0 0 4px 0'
    }));
    homeCard.add(ui.Label(
      'Original GBIF dataset citation:\nGBIF.org (23 June 2026) GBIF Occurrence Download\nhttps://doi.org/10.15468/dl.sdhuv9',
      {fontSize: '11px', color: '#6a7c68', whiteSpace: 'pre-wrap', margin: '0 0 4px 0'}
    ));

    return;
  }
// ─── Overview ────────────────────────────────────────────────
  if (currentSection === 'over') {
    var box        = currentPoint.buffer(500).bounds();
    var smoothElev = DATA.elevation.convolve(ee.Kernel.gaussian({radius: 60, sigma: 40, units: 'meters'}));
    var levels     = smoothElev.divide(20).floor();
    var contours   = ee.Algorithms.CannyEdgeDetector(levels, 0.5);
    var contourVis = contours.selfMask().visualize({palette: 'FF0000', min: 1, max: 1}).clip(box);
    Map.addLayer(contourVis, {}, 'Contour Lines (20m)');

    var overCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(overCard);

    overCard.add(makeRow('Latitudinal Band', getLatBand(cachedStats.lat)));
    overCard.add(makeRow('Country',          cachedStats.countryName));
    overCard.add(makeRow('Ecoregion',        cachedStats.ecoName));
    overCard.add(makeRow('Elevation',        cachedStats.elev  ? cachedStats.elev.toFixed(0)  + ' m' : 'N/A'));
    overCard.add(makeRow('Slope',            cachedStats.slope ? cachedStats.slope.toFixed(1) + '°'  : 'N/A'));

  // ─── Climate ─────────────────────────────────────────────────
  } else if (currentSection === 'climate') {
    DATA.precip_ts  = config.data.chirps;
    DATA.daily_temp = ee.ImageCollection(config.assets.era5_daily)
      .select('temperature_2m')
      .map(function(img) {
        return img.subtract(273.15).copyProperties(img, ['system:time_start']);
      });

    Map.addLayer(DATA.aridity, config.vis.aridity, 'Aridity Index', true, 0.5);

    var climateCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(climateCard);

    climateCard.add(makeRow('Mean Max Temp',   cachedStats.max_t ? cachedStats.max_t.toFixed(1) + ' °C' : 'N/A'));
    climateCard.add(makeRow('Mean Min Temp',   cachedStats.min_t ? cachedStats.min_t.toFixed(1) + ' °C' : 'N/A'));
    climateCard.add(makeRow('Annual Precip',   cachedStats.ann_precip ? cachedStats.ann_precip.toFixed(0) + ' mm' : 'N/A'));
    if (cachedStats.snow_days > 0) {
      climateCard.add(makeRow('Snow Days', cachedStats.snow_days.toFixed(1) + ' days/yr'));
    }
    climateCard.add(makeRow('Aridity Class', getAridityClass(cachedStats.aridity)));
    climateCard.add(makeRow('Aridity Index', cachedStats.aridity ? (cachedStats.aridity * 0.0001).toFixed(4) : 'N/A'));
    climateCard.add(makeDryMonthsRow(
      DATA.precip_ts, currentPoint,
      config.thresholds.climateStartYear, config.thresholds.climateEndYear, config.thresholds.dryMonthRainfall
    ));
    climateCard.add(makeGrowingSeasonRow(
      DATA.daily_temp, currentPoint,
      config.thresholds.climateStartYear, config.thresholds.climateEndYear
    ));
    climateCard.add(ui.Label('_________________________________'));

    var chartBtn = ui.Button({
      label: 'Generate Climate Charts',
      style: config.styles.buttonBlue,
      onClick: function() {
        chartBtn.setDisabled(true);
        chartBtn.setLabel('Loading...');

        var startYear = config.thresholds.climateStartYear;
        var endYear   = config.thresholds.climateEndYear;
        var years     = [];
        for (var y = startYear; y <= endYear; y++) years.push(y);

        // ── Precipitation chart ──────────────────────────────
        var precipLoadingLabel = ui.Label('Checking precipitation data...', config.styles.labelSmall);
        chartPanel.add(precipLoadingLabel);

        var rainCol = ee.ImageCollection.fromImages(
          ee.List.sequence(1, 12).map(function(m) {
            var getRain = function(y) {
              return DATA.precip_ts
                .filter(ee.Filter.calendarRange(y, y, 'year'))
                .filter(ee.Filter.calendarRange(m, m, 'month'))
                .sum();
            };
            var yearImages = years.map(getRain);
            var pAvg = ee.ImageCollection.fromImages(yearImages).mean().rename('Average');
            var p100 = ee.Image.constant(config.thresholds.dryMonthRainfall).rename('Threshold');
            var bands = [pAvg];
            years.forEach(function(y) { bands.push(yearImages[y - startYear].rename(String(y))); });
            bands.push(p100);
            return ee.Image.cat(bands).set('system:time_start', ee.Date.fromYMD(startYear, m, 1).millis());
          })
        );

        rainCol.mean().reduceRegion({
          reducer: ee.Reducer.first(), geometry: currentPoint, scale: 5000
        }).evaluate(function(stats) {
          try { chartPanel.remove(precipLoadingLabel); } catch (e) {}
          var hasData = stats && Object.keys(stats).length > 0 && stats[Object.keys(stats)[0]] !== null;

          if (hasData) {
            var meanAnnual = stats['Average'] * 12;
            chartPanel.add(ui.Label(
              'Calculated 10-Yr Mean — Annual Precip: ' + meanAnnual.toFixed(0) + ' mm',
              {fontSize: '12px', fontWeight: 'bold', color: '#0D47A1', margin: '15px 0 0 10px'}
            ));
            chartPanel.add(ui.Chart.image.series({
              imageCollection: rainCol, region: currentPoint, reducer: ee.Reducer.mean(),
              scale: 5000, xProperty: 'system:time_start'
            }).setOptions({
              title: 'Precipitation: 10-Yr Avg vs Individual Years',
              height: '220px', hAxis: {format: 'MMM'}, vAxis: {title: 'mm'},
              series: {
                0: {color: '#D3D3D3', lineWidth: 1}, 1: {color: '#D3D3D3', lineWidth: 1},
                2: {color: '#D3D3D3', lineWidth: 1}, 3: {color: '#D3D3D3', lineWidth: 1},
                4: {color: '#D3D3D3', lineWidth: 1}, 5: {color: '#D3D3D3', lineWidth: 1},
                6: {color: '#D3D3D3', lineWidth: 1}, 7: {color: '#D3D3D3', lineWidth: 1},
                8: {color: '#D3D3D3', lineWidth: 1}, 9: {color: '#D3D3D3', lineWidth: 1},
                10: {color: '#1E88E5', lineWidth: 4}, 11: {color: '#FF9800', lineWidth: 2, lineDashStyle: [4, 4]}
              }
            }));
          } else {
            chartPanel.add(ui.Label('No precipitation data at this location.', config.styles.labelSmall));
          }
        });

        // ── Temperature chart ────────────────────────────────
        var tempLoadingLabel = ui.Label('Checking temperature data...', config.styles.labelSmall);
        chartPanel.add(tempLoadingLabel);

        var tempCol = ee.ImageCollection.fromImages(
          ee.List.sequence(1, 12).map(function(m) {
            var getTemp = function(y) {
              return DATA.daily_temp
                .filter(ee.Filter.calendarRange(y, y, 'year'))
                .filter(ee.Filter.calendarRange(m, m, 'month'))
                .mean();
            };
            var yearImages = years.map(getTemp);
            var tAvg = ee.ImageCollection.fromImages(yearImages).mean().rename('Average');
            var bands = [tAvg];
            years.forEach(function(y) { bands.push(yearImages[y - startYear].rename(String(y))); });
            return ee.Image.cat(bands).set('system:time_start', ee.Date.fromYMD(startYear, m, 1).millis());
          })
        );

        var tempStatsImg = ee.Image.cat([
          tempCol.mean(),
          tempCol.select('Average').max().rename('MaxAvg'),
          tempCol.select('Average').min().rename('MinAvg')
        ]);

        tempStatsImg.reduceRegion({
          reducer: ee.Reducer.first(), geometry: currentPoint, scale: 11132
        }).evaluate(function(stats) {
          try { chartPanel.remove(tempLoadingLabel); } catch (e) {}
          var hasData = stats && Object.keys(stats).length > 0 && stats[Object.keys(stats)[0]] !== null;

          if (hasData) {
            chartPanel.add(ui.Label(
              'Calculated 10-Yr Mean — Max month: ' + stats['MaxAvg'].toFixed(1) + ' °C | Min month: ' + stats['MinAvg'].toFixed(1) + ' °C',
              {fontSize: '12px', fontWeight: 'bold', color: '#880E4F', margin: '15px 0 0 10px'}
            ));
            chartPanel.add(ui.Chart.image.series({
              imageCollection: tempCol, region: currentPoint, reducer: ee.Reducer.mean(), scale: 11132
            }).setOptions({
              title: 'Daily Temp: 10-Yr Avg vs Individual Years',
              height: '220px', vAxis: {title: '°C'}, hAxis: {format: 'MMM'},
              series: {
                0: {color: '#D3D3D3', lineWidth: 1}, 1: {color: '#D3D3D3', lineWidth: 1},
                2: {color: '#D3D3D3', lineWidth: 1}, 3: {color: '#D3D3D3', lineWidth: 1},
                4: {color: '#D3D3D3', lineWidth: 1}, 5: {color: '#D3D3D3', lineWidth: 1},
                6: {color: '#D3D3D3', lineWidth: 1}, 7: {color: '#D3D3D3', lineWidth: 1},
                8: {color: '#D3D3D3', lineWidth: 1}, 9: {color: '#D3D3D3', lineWidth: 1},
                10: {color: '#D81B60', lineWidth: 4}
              }
            }));
          } else {
            chartPanel.add(ui.Label('No temperature data available.', config.styles.labelSmall));
          }
        });
      }
    });
    climateCard.add(chartBtn);

// ─── Vegetation ──────────────────────────────────────────────
  } else if (currentSection === 'veg') {
    DATA.canopy    = config.data.canopy;
    DATA.grassland = config.data.grassland;
    Map.addLayer(DATA.lc_ESA, {bands: ['Map']}, 'Worldcover (ESA) 2021 v200', false);

    var globalCanopy  = DATA.canopy.mosaic();
    var canopyClasses = globalCanopy.expression('(ch < 1) ? 0 : (ch < 6) ? 1 : 2', {ch: globalCanopy});
    Map.addLayer(canopyClasses, config.vis.canopy_classes, 'Tree Height Classes (Global)', true, 0.6);

    var grassImg = DATA.grassland.filterDate('2022-01-01', '2023-01-01').first().selfMask();
    Map.addLayer(grassImg, config.vis.grass, 'Dominant Grassland (2022)', true, 0.6);

    var vegCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(vegCard);

    var ESAName  = ESANames[cachedStats.lc_code]   || 'Unknown Code (' + cachedStats.lc_code + ')';
    var sbtnName = SBTNNames[cachedStats.sbtn_code] || 'Unknown Code (' + cachedStats.sbtn_code + ')';
    vegCard.add(makeRow('LC ESA',  ESAName));
    vegCard.add(makeRow('LC SBTN', sbtnName));

    vegCard.add(ui.Label('_________________________________'));
    vegCard.add(ui.Label('Canopy Height Analysis', {fontWeight: 'bold', margin: '10px 0 0 0'}));

    var calcBtn = ui.Button({
      label: 'Calculate Tree Distribution Graph',
      style: config.styles.buttonPrimary,
      onClick: function() {
        chartPanel.add(ui.Label('Calculating 100m histogram...'));

        var box100m = currentPoint.buffer(config.thresholds.canopyHistogramRadius).bounds();
        var box1km  = currentPoint.buffer(config.thresholds.canopyContextRadius).bounds();

        globalCanopy.reduceRegion({
          reducer: ee.Reducer.fixedHistogram(0, 30, 30), geometry: box100m, scale: 10, maxPixels: 1e6
        }).evaluate(function(result) {
          chartPanel.clear();
          var dataArray = result[Object.keys(result)[0]];

          if (!dataArray || dataArray.length === 0) {
            chartPanel.add(ui.Label('No data found.'));
            return;
          }

          var totalPixels = 0, pixelsAbove5 = 0, pixels1to5 = 0;
          for (var i = 0; i < dataArray.length; i++) {
            var h = dataArray[i][0], count = dataArray[i][1];
            totalPixels += count;
            if (h >= 5) pixelsAbove5 += count;
            if (h >= 1 && h < 5) pixels1to5 += count;
          }

          var chartData = [['Height (m)', 'Frequency (%)', 'Threshold (5m)']];
          var maxPercent = 0;
          for (var j = 0; j < dataArray.length; j++) {
            var height  = dataArray[j][0];
            var percent = (dataArray[j][1] / totalPixels) * 100;
            if (percent > maxPercent) maxPercent = percent;
            var thresholdVal = (Math.abs(height - 5) < 0.5) ? maxPercent : 0;
            chartData.push([height, percent, thresholdVal]);
          }

          chartPanel.add(ui.Chart(chartData, 'ComboChart', {
            title: 'Canopy Height Distribution (100m Box)',
            hAxis: {title: 'Height (m)'}, vAxis: {title: 'Frequency (%)'},
            seriesType: 'bars',
            series: {0: {color: '#1a9850'}, 1: {type: 'bars', color: 'black', visibleInLegend: true}},
            isStacked: false, bar: {groupWidth: '95%'}
          }));

          var coverPercent = (pixelsAbove5 / totalPixels) * 100;
          var shrubPercent = (pixels1to5 / totalPixels) * 100;
          chartPanel.add(ui.Label(
            '% trees above 5m (approx. canopy cover): ' + coverPercent.toFixed(2) + '%',
            {fontWeight: 'bold', margin: '10px 0 0 0', color: 'black'}
          ));
          chartPanel.add(ui.Label(
            '% short trees/shrubs (1-5m): ' + shrubPercent.toFixed(2) + '%',
            {fontWeight: 'bold', margin: '4px 0 0 0', color: '#666'}
          ));
        });

        Map.layers().add(ui.Map.Layer(globalCanopy.clip(box1km), config.vis.canopy_height, 'Canopy Height (1km Context)'));

        var outline = ee.Image().byte().paint({featureCollection: ee.FeatureCollection(box100m), color: 1, width: 3});
        Map.layers().add(ui.Map.Layer(outline, {palette: 'FF0000'}, '100m Analysis Zone'));

        Map.centerObject(box100m, 18);
      }
    });
    vegCard.add(calcBtn);

  // ─── Waterbodies & Wetlands (incl. coastal) ─────────────────
  } else if (currentSection === 'water') {
    DATA.rivers = config.data.gloric;

    var waterCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(waterCard);

    // Wetlands 
    var glwdCode = cachedStats.glwd_code;
    if (glwdCode && glwdNames[glwdCode]) {
      waterCard.add(makeRow('Wetland (GLWD)', glwdNames[glwdCode]));
    }
    Map.addLayer(DATA.wetlands_glwd.selfMask(), config.vis.glwd, 'GLWD Wetlands', true, 0.6);

    // Surface water seasonality 
    Map.addLayer(DATA.water_gsw, config.vis.gsw_seasonality, 'Water Seasonality (Red to Blue)', true);
    if (cachedStats.gsw_season > 0) {
      var suffix = (cachedStats.gsw_season === 12) ? ' (Permanent)' : ' (Seasonal)';
      waterCard.add(makeRow('Water Seasonality', cachedStats.gsw_season + ' months/yr' + suffix));
    }

    // Coastal layers
    Map.addLayer(DATA.aca_benthic, config.vis.aca_benthic, 'ACA Benthic Habitat');
    Map.addLayer(DATA.tidal_classes, {min: 2, max: 5, palette: ['#E6E600', '#007E00', '#FFFFFF', '#710087']}, 'Murray Tidal Wetlands', true, 0.7);
    Map.addLayer(DATA.gmw_union, config.vis.gmw, 'Global Mangrove Watch', true, 0.7);

    // Benthic habitat
    if (acaBenthicNames[cachedStats.aca_benthic_code]) {
      waterCard.add(makeRow('Benthic Habitat (ACA)', acaBenthicNames[cachedStats.aca_benthic_code]));
    }

    // Tidal class
    var tidalText = null;
    if (cachedStats.tidal_type === 2) tidalText = 'Tidal Flat (Mudflat)';
    else if (cachedStats.tidal_type === 3) tidalText = 'Mangrove (Tidal Dataset)';
    else if (cachedStats.tidal_type === 5) tidalText = 'Tidal Marsh';
    if (tidalText) {
      waterCard.add(makeRow('Tidal Class', tidalText));
    }

    // Mangrove
    if (cachedStats.gmw_presence === 1) {
      waterCard.add(makeRow('Mangrove (GMW)', 'Present'));
    }

    var hasAnyWaterFeature = (glwdCode && glwdNames[glwdCode]) ||
      cachedStats.gsw_season > 0 ||
      acaBenthicNames[cachedStats.aca_benthic_code] ||
      tidalText ||
      cachedStats.gmw_presence === 1;

    if (!hasAnyWaterFeature) {
      waterCard.add(ui.Label('No wetland, water, or coastal features detected at this location.', {
        fontSize: '12px', color: '#8a9e88', margin: '4px 0 8px 0'
      }));
    }

    // River network 
    var riverStatsPanel = ui.Panel();
    var riverBtn = ui.Button({
      label: 'Show River Layer & Analyze',
      style: config.styles.buttonBlue,
      onClick: function() {
        Map.addLayer(DATA.rivers, {color: '0000FF'}, 'GloRiC River Network');
        riverStatsPanel.clear();
        riverStatsPanel.add(ui.Label('Searching for nearest river (250m)...', {color: 'gray'}));

        var candidates = DATA.rivers.filterBounds(currentPoint.buffer(config.thresholds.riverSearchRadius));
        var nearestRiver = candidates.map(function(feat) {
          return feat.set('dist_to_click', feat.distance(currentPoint));
        }).sort('dist_to_click').first();

        var riverProps = ['Class_hydr', 'Class_phys', 'Class_geom', 'CMI_indx', 'Log_Q_avg'];

        ee.Algorithms.If(nearestRiver, nearestRiver.toDictionary(riverProps), null).evaluate(function(r) {
          riverStatsPanel.clear();
          if (!r) {
            riverStatsPanel.add(ui.Label('No river found within 250m.', {color: 'red'}));
            return;
          }
          riverStatsPanel.add(ui.Label('Selected River Stats:', {fontWeight: 'bold', color: '0000AA', margin: '10px 0 5px 0'}));
          riverStatsPanel.add(makeRow('Hydrology',      gloricHydrNames[r.Class_hydr] || ('Unknown (' + r.Class_hydr + ')')));
          riverStatsPanel.add(makeRow('Physiography',   gloricPhysNames[r.Class_phys] || ('Unknown (' + r.Class_phys + ')')));
          riverStatsPanel.add(makeRow('Geomorphology',  gloricGeomNames[r.Class_geom] || ('Unknown (' + r.Class_geom + ')')));
          riverStatsPanel.add(makeRow('CMI Index',      r.CMI_indx));
          riverStatsPanel.add(makeRow('Avg Discharge (Log)', r.Log_Q_avg ? r.Log_Q_avg.toFixed(2) : 'N/A'));
        });
      }
    });

    waterCard.add(ui.Label('_________________________________'));
    waterCard.add(riverBtn);
    waterCard.add(riverStatsPanel); 
  
// ─── Fire Disturbance ────────────────────────────────────────
  } else if (currentSection === 'fire') {
    DATA.modis_burned = config.data.modis_burned;
    DATA.firms        = config.data.firms;

    var fireRegion = currentPoint.buffer(config.thresholds.fireSearchRadius);
    Map.centerObject(fireRegion, 12);

    var fireCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(fireCard);

    var fireStartYear = config.thresholds.fireStartYear;
    var fireEndYear   = config.thresholds.fireEndYear;
    var fireYearRange = fireStartYear + '-' + fireEndYear;
    var dateFilter     = ee.Filter.date(fireStartYear + '-01-01', fireEndYear + '-12-31');

    fireCard.add(ui.Label('Fire Disturbance Analysis', {fontWeight: 'bold', fontSize: '16px', color: '#D32F2F', margin: '10px 0 5px 0'}));
    fireCard.add(ui.Label('Search Radius: ' + (config.thresholds.fireSearchRadius / 1000) + 'km', {fontSize: '12px', color: 'gray'}));
    fireCard.add(ui.Label('Frequency Heatmaps (' + fireYearRange + ')', {fontWeight: 'bold', margin: '15px 0 5px 0'}));

    var modisBurn = DATA.modis_burned.select('BurnDate');

    var modisFreq = modisBurn.filter(dateFilter).count().unmask(0).clip(fireRegion);
    var viirsFreq = DATA.firms.filter(dateFilter).filterBounds(fireRegion)
      .reduceToImage({properties: ['T21'], reducer: ee.Reducer.count()})
      .reproject({crs: 'EPSG:4326', scale: 250})
      .unmask(0)
      .clip(fireRegion);
    var combinedFreq = modisFreq.multiply(2).add(viirsFreq);

    Map.addLayer(fireRegion, {color: 'FF0000', fillColor: '00000000'}, 'Search Region', true, 0.5);
    Map.addLayer(combinedFreq.selfMask(), config.vis.fire_combined, 'Combined Fire Frequency', true, 0.6);
    Map.addLayer(currentPoint, {color: '00FFFF'}, 'Target Location');

    // Legend
    fireCard.add(ui.Label('Source & Frequency Legend:', {fontSize: '11px', margin: '5px 0 2px 0'}));
    fireCard.add(makeLegendRow('#FFEDA0', 'VIIRS Only', 'Active fire points (no burn scar)'));
    fireCard.add(makeLegendRow('#FEB24C', 'MODIS Only', 'Burn scar mapped (no active points)'));

    var gradientPanel = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '4px 0 0 0'}});
    gradientPanel.add(ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {bbox: [0, 0, 1, 0.1], dimensions: '100x10', format: 'png', min: 0, max: 1, palette: ['F03B20', 'BD0026', '4A1486']},
      style: {stretch: 'horizontal', margin: '0 8px 0 0', height: '16px', width: '40px', border: '1px solid #ccc'}
    }));
    gradientPanel.add(ui.Panel([
      ui.Label('Overlap / Frequent', {fontWeight: 'bold', fontSize: '11px', margin: '0 0 1px 0'}),
      ui.Label('Detected by both sensors or recurring fire', {fontSize: '10px', color: 'gray', margin: '0'})
    ]));
    fireCard.add(gradientPanel);

    // Burned area statistics
    fireCard.add(ui.Label('Burned Area Statistics', {fontWeight: 'bold', margin: '15px 0 5px 0'}));
    var loadingStats = ui.Label('Calculating precise area...', config.styles.labelSmall);
    fireCard.add(loadingStats);

    var areaCurrentYear  = getAnnualArea(modisBurn, fireEndYear);
    var historicImages   = [];
    for (var y = fireStartYear; y < fireEndYear; y++) historicImages.push(getAnnualArea(modisBurn, y));
    var nHistoricYears   = historicImages.length;
    var area5YearSum     = ee.ImageCollection(historicImages).sum().rename('area_5yr_sum');
    var combinedStats    = areaCurrentYear.addBands(area5YearSum);

    combinedStats.reduceRegion({
      reducer: ee.Reducer.sum(), geometry: fireRegion, scale: 500, maxPixels: 1e9
    }).evaluate(function(stats) {
      try { fireCard.remove(loadingStats); } catch (e) {}
      if (!stats) {
        fireCard.add(ui.Label('No data found.', {color: 'red'}));
        return;
      }

      var avgKm2          = stats.area_5yr_sum / nHistoricYears;
      var fireRadiusKm    = config.thresholds.fireSearchRadius / 1000;
      var totalBufferArea = Math.PI * fireRadiusKm * fireRadiusKm;
      var percentImpact   = (stats.area_km2 / totalBufferArea) * 100;

      fireCard.add(makeRow(fireEndYear + ' Burned Area',
        stats.area_km2.toFixed(2) + ' km² (' + percentImpact.toFixed(1) + '% of view)'));
      fireCard.add(makeRow(fireStartYear + '-' + (fireEndYear - 1) + ' Average',
        avgKm2.toFixed(2) + ' km² / year'));
      fireCard.add(ui.Label('(Calculated using precise pixel area)', {fontSize: '10px', color: 'gray', margin: '4px 0 10px 0'}));
    });

    // Burn seasonality
    fireCard.add(ui.Label('Burn Seasonality', {fontWeight: 'bold', margin: '15px 0 5px 0'}));
    var loadingLabel = ui.Label('Calculating monthly patterns...', {fontSize: '11px', color: 'gray'});
    fireCard.add(loadingLabel);

    var modisFiltered = modisBurn.filterDate(fireStartYear + '-01-01', fireEndYear + '-12-31');
    var monthlyStack = ee.ImageCollection.fromImages(
      ee.List.sequence(1, 12).map(function(m) {
        var month = ee.Number(m);
        return modisFiltered.filter(ee.Filter.calendarRange(month, month, 'month'))
          .count().unmask(0).rename(ee.String('M').cat(month.int().format()));
      })
    ).toBands();

    monthlyStack.reduceRegion({
      reducer: ee.Reducer.sum(), geometry: fireRegion, scale: 500, maxPixels: 1e9, bestEffort: true
    }).evaluate(function(result) {
      try { fireCard.remove(loadingLabel); } catch (e) {}
      if (!result) {
        fireCard.add(ui.Label('No seasonality data.', {color: 'red'}));
        return;
      }

      var counts = [];
      var keys = Object.keys(result);
      for (var i = 0; i < 12; i++) {
        var key = keys.filter(function(k) { return k.indexOf(i + '_') === 0; })[0];
        counts.push(result[key]);
      }
      var maxVal = Math.max.apply(null, counts);

      var monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      var palette = ['#FFFFFF', '#FFDD00', '#FF0000', '#8B0000'];
      var getColor = function(val) {
        if (val === 0 || maxVal === 0) return '#EEEEEE';
        var pct = val / maxVal;
        if (pct < 0.25) return palette[1];
        if (pct < 0.75) return palette[2];
        return palette[3];
      };

      var monthPanel = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '0 0 10px 0'}});
      for (var m = 0; m < 12; m++) {
        var count = counts[m];
        monthPanel.add(ui.Label({
          value: monthNames[m] + '\n' + Math.round(count),
          style: {
            backgroundColor: getColor(count),
            color: (maxVal > 0 && count / maxVal > 0.5) ? 'white' : 'black',
            width: '24px', height: '36px', margin: '1px',
            textAlign: 'center', whiteSpace: 'pre', fontSize: '10px', border: '1px solid #ccc'
          }
        }));
      }
      fireCard.add(monthPanel);
      fireCard.add(ui.Label('Values = sum of burned pixels (' + fireYearRange + ')', {fontSize: '10px', color: 'gray', margin: '-5px 0 10px 0'}));
      if (maxVal === 0) fireCard.add(ui.Label('Note: No burn scars detected in this radius.', {fontSize: '11px', color: '#555'}));
    });

    // Fire intensity chart
    chartPanel.add(ui.Label('Fire Intensity History', {fontWeight: 'bold'}));
    var chartLoader = ui.Label('Checking for fire events...', {fontSize: '11px', color: 'gray'});
    chartPanel.add(chartLoader);

    var viirsData = DATA.firms.filterDate(fireStartYear + '-01-01', fireEndYear + '-12-31')
      .filterBounds(fireRegion)
      .map(function(img) {
        var stat = img.reduceRegion({reducer: ee.Reducer.max(), geometry: fireRegion, scale: 1000, maxPixels: 1e9});
        return ee.Feature(null, {'system:time_start': img.get('system:time_start'), 'Temp': stat.get('T21')});
      })
      .filter(ee.Filter.notNull(['Temp']));

    viirsData.size().evaluate(function(count) {
      try { chartPanel.remove(chartLoader); } catch (e) {}
      if (count > 0) {
        chartPanel.add(ui.Chart.feature.byFeature({
          features: viirsData, xProperty: 'system:time_start', yProperties: ['Temp']
        }).setOptions({
          title: 'Peak Brightness Temp (' + fireYearRange + ')',
          vAxis: {title: 'Temp (Kelvin)'}, hAxis: {title: 'Date'},
          lineWidth: 0, pointSize: 4, colors: ['#D32F2F'], height: '200px', legend: {position: 'none'}
        }));
      } else {
        chartPanel.add(ui.Label('No VIIRS fire detections in this timeline.', {fontSize: '11px', color: 'gray', margin: '5px 0 15px 0'}));
      }
    });
// ─── GBIF Indicators ─────────────────────────────────────────
  } else if (currentSection === 'gbif') {
    DATA.gbif = ee.FeatureCollection(config.assets.gbif);
    Map.layers().reset();
    Map.addLayer(currentPoint, {color: 'red'}, 'Target Location');

    var bufferZone = currentPoint.buffer(GBIF_SEARCH_RADIUS);
    Map.addLayer(bufferZone, {color: 'gray', fillColor: '00000000'}, 'Search Radius (' + (GBIF_SEARCH_RADIUS / 1000) + 'km)');

    var gbifCard = ui.Panel({
      style: {backgroundColor: '#ffffff', border: '1px solid rgba(90, 140, 70, 0.14)', padding: '14px', margin: '4px 0 0 0'}
    });
    resultsPanel.add(gbifCard);

    // Filter by radius first
    var localGBIF = DATA.gbif.filterBounds(bufferZone);
    var localCountries = DATA.countries.filterBounds(bufferZone);

    // 1. Apply the strict land filter to ALL points if GBIF_LAND_PTS is true
    if (GBIF_LAND_PTS) {
      var spatialFilter = ee.Filter.intersects({leftField: '.geo', rightField: '.geo', maxError: 10});
      localGBIF = ee.FeatureCollection(ee.Join.simple().apply(localGBIF, localCountries, spatialFilter));
    }

    // 2. Safely flag Marine vs Non-Marine points without relying on joins or IDs
    localGBIF = localGBIF.map(function(f) {
      var rawVal = f.get('Matching EFG, Biome');
      // Default to empty string if null to prevent crashes
      var codeStr = ee.String(ee.Algorithms.If(ee.Algorithms.IsEqual(rawVal, null), '', rawVal));
      
      // Strict match: does the string contain 'M'? (returns 1 if true, 0 if false)
      var isMarine = codeStr.index('M').neq(-1);
      
      return f.set('is_marine', isMarine);
    });

    // Easily split them using our new flag
    var marinePoints = localGBIF.filter(ee.Filter.eq('is_marine', 1));
    var nonMarinePoints = localGBIF.filter(ee.Filter.eq('is_marine', 0));

    // 3. Create a 5km shoreline filter on the fly
    var landImg = ee.Image.constant(0).paint(localCountries, 1);
    var shoreline = ee.Algorithms.CannyEdgeDetector(landImg, 0.5);
    var distToShore = shoreline.fastDistanceTransform(256).multiply(ee.Image.pixelArea().sqrt());

    var marineWithDist = distToShore.reduceRegions({
      collection: marinePoints,
      reducer: ee.Reducer.first().setOutputs(['dist_to_shore']),
      scale: 100 // 100m scale for client-side efficiency
    });

    // Keep only marine points within 5km (5000m) of the shoreline
    var validMarine = marineWithDist.filter(ee.Filter.lte('dist_to_shore', 5000));

    // 4. Re-merge the valid marine points with the untouched non-marine points
    localGBIF = nonMarinePoints.merge(validMarine);

    var styledPoints = localGBIF.map(function(f) {
      return f.set('styleParams', {
        color:     f.get('pixel value') || '#000000',
        pointSize: 6,
        width:     1,
        fillColor: f.get('pixel value') || '#000000'
      });
    }).style({styleProperty: 'styleParams'});

    Map.addLayer(styledPoints, {}, 'Indicator Species');
    Map.centerObject(bufferZone);

    gbifCard.add(ui.Label('GBIF Indicator Analysis', {fontWeight: 'bold', fontSize: '16px', color: '#2E7D32', margin: '10px 0 5px 0'}));

    // Search radius buttons
    gbifCard.add(ui.Label('Search Radius:', {fontWeight: 'bold', margin: '5px 0 5px 0'}));
    var radiusPanel = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '0 0 10px 0', stretch: 'horizontal'}});

    function makeRadiusBtn(label, radiusValue) {
      var isSelected = (GBIF_SEARCH_RADIUS === radiusValue);
      return ui.Button({
        label: (isSelected ? '● ' : '○ ') + label,
        style: {color: isSelected ? '#2E7D32' : '#555', margin: '0 2px 0 0', fontSize: '11px'},
        onClick: function() {
          if (GBIF_SEARCH_RADIUS !== radiusValue) {
            GBIF_SEARCH_RADIUS = radiusValue;
            isInspectorActive = false;
            renderUI();
          }
        }
      });
    }
    [5000, 10000, 25000, 50000, 75000, 100000, 200000, 300000, 500000, 1000000].forEach(function(r) {
      radiusPanel.add(makeRadiusBtn((r / 1000) + 'km', r));
    });
    gbifCard.add(radiusPanel);

    // Land filter indicator
    var filterStatusText = GBIF_LAND_PTS ? 'ACTIVE (ocean points removed)' : 'INACTIVE (showing all points)';
    var filterColor = GBIF_LAND_PTS ? '#2E7D32' : 'gray';
    gbifCard.add(ui.Panel([
      ui.Label('Land-Only Filter:', {fontWeight: 'bold', fontSize: '12px', margin: '0 5px 0 0'}),
      ui.Label(filterStatusText, {fontSize: '12px', color: filterColor, margin: '0'})
    ], ui.Panel.Layout.flow('horizontal'), {margin: '0 0 15px 0'}));

    // Inspector toggle
    var toggleBtn = ui.Button({
      label: isInspectorActive ? 'Disable Species Identifier' : 'Enable Species Identifier',
      style: {
        stretch: 'horizontal',
        color: isInspectorActive ? '#D32F2F' : '#1976D2',
        border: '1px solid ' + (isInspectorActive ? '#D32F2F' : '#1976D2'),
        fontWeight: 'bold'
      },
      onClick: function() {
        isInspectorActive = !isInspectorActive;
        if (!isInspectorActive) Map.layers().set(5, null);
        renderUI();
      }
    });
    gbifCard.add(toggleBtn);

    if (isInspectorActive) {
      gbifCard.add(ui.Label('MODE ACTIVE', {fontWeight: 'bold', color: 'blue', margin: '10px 0 0 0'}));
      gbifCard.add(ui.Label('Click on any colored dot on the map to inspect it.', {fontSize: '12px', color: '#333'}));
      gbifCard.add(ui.Label('(List and chart are hidden in this mode)', {fontSize: '10px', color: 'gray', margin: '4px 0'}));
      return;
    }

    gbifCard.add(ui.Label('Species Found:', {fontWeight: 'bold', margin: '10px 0'}));

    // ── Export helpers ──────────────────────────────────────────
    var formatVal = function(val) {
      if (val === undefined || val === null) return '';
      val = String(val);
      if (val.indexOf(',') >= 0 || val.indexOf('\n') >= 0) val = '"' + val.replace(/"/g, '""') + '"';
      return val;
    };
    var hasVal = function(val) {
      return val !== null && val !== undefined && val !== '' && val !== 0;
    };
    var radiusKm = GBIF_SEARCH_RADIUS / 1000;

    // ── Button 1: Region overview CSV ──────────────────────────
    var overviewStatusLabel = ui.Label('', {fontSize: '11px', color: '#8a9e88', margin: '2px 0 2px 0'});
    var overviewLinkPanel   = ui.Panel({style: {margin: '0 0 8px 0'}});

    var overviewBtn = ui.Button({
      label: 'Download Region Overview CSV',
      style: {stretch: 'horizontal', color: '#3d8c40'},
      onClick: function() {
        overviewBtn.setDisabled(true);
        overviewBtn.setLabel('Computing climate data...');
        overviewStatusLabel.setValue('Fetching monthly averages — this may take a moment...');

        var startYear = config.thresholds.climateStartYear;
        var endYear   = config.thresholds.climateEndYear;
        var numYears  = endYear - startYear + 1;

        var precipCol = config.data.chirps;
        var tempCol   = ee.ImageCollection(config.assets.era5_daily)
          .select('temperature_2m')
          .map(function(img) { return img.subtract(273.15).copyProperties(img, ['system:time_start']); });

        var monthlyPrecip = ee.List.sequence(1, 12).map(function(m) {
          return precipCol.filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
            .filter(ee.Filter.calendarRange(m, m, 'month')).sum().divide(numYears)
            .rename(ee.String('precip_m').cat(ee.Number(m).int().format()));
        });
        var monthlyTemp = ee.List.sequence(1, 12).map(function(m) {
          return tempCol.filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
            .filter(ee.Filter.calendarRange(m, m, 'month')).mean()
            .rename(ee.String('temp_m').cat(ee.Number(m).int().format()));
        });

        var climateStack = ee.Image.cat(
          ee.ImageCollection(monthlyPrecip).toBands(),
          ee.ImageCollection(monthlyTemp).toBands()
        );

        var modisBurnExport = ee.ImageCollection('MODIS/061/MCD64A1').select('BurnDate');
        var burnedArea2024 = getAnnualArea(modisBurnExport, 2024).reduceRegion({
          reducer: ee.Reducer.sum(), geometry: bufferZone, scale: 500, maxPixels: 1e9
        });

        ee.Dictionary({
          climate: climateStack.reduceRegion({reducer: ee.Reducer.mean(), geometry: currentPoint, scale: 5000, bestEffort: true}),
          burnedArea: burnedArea2024
        }).evaluate(function(combined) {
          var monthlyStats = combined.climate;
          var burnKm2      = combined.burnedArea ? combined.burnedArea.area_km2 : null;
          var monthNames   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          var csvRows      = [];

          csvRows.push('LOCATION');
          csvRows.push('Target Latitude,'  + formatVal(cachedStats.lat));
          csvRows.push('Target Longitude,' + formatVal(cachedStats.lon));
          csvRows.push('Country,'          + formatVal(cachedStats.countryName));
          csvRows.push('Ecoregion,'        + formatVal(cachedStats.ecoName));
          csvRows.push('Search Radius,'    + radiusKm + ' km');
          csvRows.push('');

          if (hasVal(cachedStats.elev) || hasVal(cachedStats.slope)) {
            csvRows.push('TOPOGRAPHY');
            if (hasVal(cachedStats.elev))  csvRows.push('Elevation (m),' + cachedStats.elev.toFixed(0));
            if (hasVal(cachedStats.slope)) csvRows.push('Slope (deg),'   + cachedStats.slope.toFixed(1));
            csvRows.push('');
          }

          csvRows.push('CLIMATE (Point Statistics)');
          if (hasVal(cachedStats.ann_precip)) csvRows.push('Annual Precipitation (mm) [CHELSA 1981-2010],' + cachedStats.ann_precip.toFixed(0));
          if (hasVal(cachedStats.min_t))      csvRows.push('Mean Min Temperature (C) [CHELSA],' + cachedStats.min_t.toFixed(1));
          if (hasVal(cachedStats.max_t))      csvRows.push('Mean Max Temperature (C) [CHELSA],' + cachedStats.max_t.toFixed(1));
          if (hasVal(cachedStats.snow_days) && cachedStats.snow_days > 0) csvRows.push('Snow Days/yr [CHELSA],' + cachedStats.snow_days.toFixed(1));
          if (hasVal(cachedStats.aridity)) {
            csvRows.push('Aridity Class [Global Aridity Index],'        + formatVal(getAridityClass(cachedStats.aridity)));
            csvRows.push('Aridity Index (raw) [Global Aridity Index],'  + (cachedStats.aridity * 0.0001).toFixed(4));
          }
          csvRows.push('');

          if (monthlyStats) {
            csvRows.push('CLIMATE (Monthly Averages ' + startYear + '-' + endYear + ')');
            csvRows.push('Month,' + monthNames.join(','));
            var precipRow = ['Avg Precip (mm) [CHIRPS]'];
            var tempRow   = ['Avg Temp (C) [ERA5-Land]'];
            var keys = Object.keys(monthlyStats);
            for (var i = 1; i <= 12; i++) {
              var pKey = keys.filter(function(k) { return k.indexOf('precip_m' + i) >= 0; })[0];
              var tKey = keys.filter(function(k) { return k.indexOf('temp_m' + i) >= 0; })[0];
              precipRow.push((pKey && monthlyStats[pKey] !== null) ? monthlyStats[pKey].toFixed(1) : '');
              tempRow.push((tKey && monthlyStats[tKey] !== null) ? monthlyStats[tKey].toFixed(1) : '');
            }
            csvRows.push(precipRow.join(','));
            csvRows.push(tempRow.join(','));
            csvRows.push('Note: Monthly precipitation from CHIRPS (pentad). Monthly temperature from ERA5-Land (daily aggregates, converted from Kelvin).');
            csvRows.push('');
          }

          var hasVeg = hasVal(cachedStats.lc_code) || hasVal(cachedStats.sbtn_code);
          if (hasVeg) {
            csvRows.push('VEGETATION AND LAND COVER');
            if (hasVal(cachedStats.lc_code))   csvRows.push('Land Cover (ESA),'  + formatVal(ESANames[cachedStats.lc_code]   || cachedStats.lc_code));
            if (hasVal(cachedStats.sbtn_code)) csvRows.push('Land Cover (SBTN),' + formatVal(SBTNNames[cachedStats.sbtn_code] || cachedStats.sbtn_code));
            csvRows.push('');
          }

          if (burnKm2 !== null && burnKm2 > 0) {
            csvRows.push('FIRE DISTURBANCE');
            csvRows.push('2024 Burned Area (MODIS),' + burnKm2.toFixed(2) + ' km² (within ' + radiusKm + 'km radius)');
            csvRows.push('');
          }

          var csvUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));

          overviewBtn.setDisabled(false);
          overviewBtn.setLabel('Download Region Overview CSV');
          overviewStatusLabel.setValue('✔ Click to download:');
          overviewStatusLabel.style().set({color: '#2E7D32'});
          overviewLinkPanel.add(ui.Label({
            value: '📄 region_overview_' + radiusKm + 'km.csv',
            style: {color: '#3d8c40', textDecoration: 'underline', margin: '2px 0 8px 4px'},
            targetUrl: csvUri
          }));
        });
      }
    });
    gbifCard.add(overviewBtn);
    gbifCard.add(overviewStatusLabel);
    gbifCard.add(overviewLinkPanel);

    // ── Button 2: GBIF records CSV (built once data loads) ─────
    var gbifStatusLabel = ui.Label('', {fontSize: '11px', color: '#8a9e88', margin: '2px 0 2px 0'});
    var gbifLinkPanel   = ui.Panel({style: {margin: '0 0 8px 0'}});
    gbifCard.add(gbifStatusLabel);
    gbifCard.add(gbifLinkPanel);

    var listContainer = ui.Panel();
gbifCard.add(listContainer);
    listContainer.add(ui.Label('Scanning...', {color: 'gray'}));

    // ── Disclaimer ─────────────────────────────────────────────
    gbifCard.add(ui.Label('___________________________________', {color: '#8a9e88', margin: '12px 0 6px 0'}));
    gbifCard.add(ui.Label('ℹ️ Performance Notes', {
      fontWeight: 'bold', fontSize: '11px', color: '#555', margin: '0 0 4px 0'
    }));
    gbifCard.add(ui.Label(
      '• Search radius can be set up to 1000km but performs best within 100km — larger radii may be slow to load.',
      {fontSize: '10px', color: '#888', whiteSpace: 'pre-wrap', margin: '0 0 3px 0'}
    ));
    gbifCard.add(ui.Label(
      '• GBIF record exports are capped at 5,000 points. At larger radii this limit may be hit, which can cause the export to be incomplete or the app to become unresponsive.',
      {fontSize: '10px', color: '#888', whiteSpace: 'pre-wrap', margin: '0 0 3px 0'}
    ));
    gbifCard.add(ui.Label(
      '• If the app feels slow or unresponsive, try reducing the search radius before exporting.',
      {fontSize: '10px', color: '#888', whiteSpace: 'pre-wrap', margin: '0 0 8px 0'}
    ));

    gbifCard.add(ui.Label('___________________________________', {color: '#8a9e88', margin: '4px 0 6px 0'}));
    gbifCard.add(ui.Label('Data Citation', {
      fontWeight: 'bold', fontSize: '12px', color: '#4a5c48', margin: '0 0 4px 0'
    }));
    gbifCard.add(ui.Label(
      'Original GBIF dataset citation:\nGBIF.org (23 June 2026) GBIF Occurrence Download\nhttps://doi.org/10.15468/dl.sdhuv9',
      {fontSize: '11px', color: '#6a7c68', whiteSpace: 'pre-wrap', margin: '0 0 4px 0'}
    ));
    localGBIF.evaluate(function(fc) {
      listContainer.clear();

      if (!fc || fc.features.length === 0) {
        listContainer.add(ui.Label('No indicator species found nearby.', {color: 'gray'}));
        return;
      }

      var years   = fc.features.map(function(f) { return Number(f.properties['year']); }).filter(function(y) { return y > 0; });
      var minYear = years.length ? Math.min.apply(null, years) : 'N/A';
      var maxYear = years.length ? Math.max.apply(null, years) : 'N/A';

      var headerPanel = ui.Panel({style: {border: '1px solid #ddd', margin: '0 0 6px 0', padding: '8px', backgroundColor: '#f9f9f9'}});
      headerPanel.add(ui.Label('Total Records: ' + fc.features.length, {fontWeight: 'bold', fontSize: '12px'}));
      headerPanel.add(ui.Label('Date Range: ' + minYear + ' - ' + maxYear, {fontSize: '11px', color: '#555'}));
      listContainer.add(headerPanel);

      var gbifExportBtn = ui.Button({
        label: 'Download ' + fc.features.length + ' GBIF Records CSV',
        style: {stretch: 'horizontal', color: '#1565C0'},
        onClick: function() {
          gbifExportBtn.setDisabled(true);
          gbifExportBtn.setLabel('Building CSV...');

          var columns = ['decimallatitude', 'decimallongitude', 'species', 'family', 'year',
                         'Matching EFG, Biome', 'Matching EFG, Biome (full name)', 'pixel value', 'Notes', 'Indicator'];
          var headers = ['decimallatitude', 'decimallongitude', 'Species', 'Family', 'Year',
                         'Matching EFG or Biome', 'Matching EFG or Biome (full name)', 'Palette', 'Notes', 'Indicator'];
          var gbifRows = [headers.join(',')];
          fc.features.forEach(function(f) {
            var p = f.properties;
            gbifRows.push(columns.map(function(col) { return formatVal(p[col]); }).join(','));
          });

          var csvUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(gbifRows.join('\n'));

          gbifExportBtn.setDisabled(false);
          gbifExportBtn.setLabel('Download ' + fc.features.length + ' GBIF Records CSV');
          gbifStatusLabel.setValue('✔ Click to download:');
          gbifStatusLabel.style().set({color: '#2E7D32'});
          gbifLinkPanel.add(ui.Label({
            value: '📄 gbif_records_' + radiusKm + 'km.csv',
            style: {color: '#1565C0', textDecoration: 'underline', margin: '2px 0 4px 4px'},
            targetUrl: csvUri
          }));
        }
      });
      listContainer.add(gbifExportBtn);

      // Ecosystem distribution chart (only for larger result sets)
      if (fc.features.length > 10) {
        var ecoStats = {};
        fc.features.forEach(function(f) {
          var p = f.properties;
          var biome = p['Matching EFG, Biome (full name)'] || p['Matching EFG, Biome'] || 'Unknown';
          var color = p['pixel value'] || '#1b9e77';
          if (!ecoStats[biome]) ecoStats[biome] = {count: 0, color: color};
          ecoStats[biome].count += 1;
        });

        var dataTable = [['Ecosystem', 'Count', {role: 'style'}]];
        Object.keys(ecoStats)
          .sort(function(a, b) { return ecoStats[b].count - ecoStats[a].count; })
          .forEach(function(biome) { dataTable.push([biome, ecoStats[biome].count, ecoStats[biome].color]); });

        listContainer.add(ui.Chart(dataTable, 'BarChart').setOptions({
          title: 'Ecosystem Distribution',
          hAxis: {title: 'Count', format: '0', minValue: 0}, vAxis: {title: 'Ecosystem'},
          legend: {position: 'none'}, height: '180px'
        }));
      }

      // Species list
      fc.features.forEach(function(f) {
        var p      = f.properties;
        var color  = p['pixel value'] || '#000000';
        var name   = p['species'] || p['Indicator'] || 'Unknown';
        var biome  = p['Matching EFG, Biome (full name)'] || p['Matching EFG, Biome'] || 'N/A';
        var family = p['family'] || '';
        var year   = p['year'] || '';

        var colorBox = ui.Label({style: {backgroundColor: color, padding: '8px', margin: '4px 8px 0 0', border: '1px solid #999', width: '24px', height: '24px'}});
        var infoPanel = ui.Panel({
          widgets: [
            ui.Label(name,  {fontWeight: 'bold', fontSize: '12px', margin: '0'}),
            ui.Label(biome, {fontSize: '10px', color: '#555', margin: '0'}),
            ui.Label(family + ' (' + year + ')', {fontSize: '9px', color: '#777', margin: '0'})
          ],
          style: {margin: '0'}
        });

        listContainer.add(ui.Panel({
          widgets: [colorBox, infoPanel],
          layout: ui.Panel.Layout.flow('horizontal'),
          style: {margin: '0 0 5px 0', border: '1px solid #eee', padding: '4px'}
        }));
      });
    });
  }
}

// ─── 6. Startup ───────────────────────────────────────────────
Map.onClick(function(coords) {
  if (currentSection === 'gbif' && isInspectorActive) {
    inspectSpecies(coords);
    return;
  }


  if (currentSection === 'home') {
    currentSection = 'gbif';
    sectionSelect.setValue('gbif', false);
  }

  runAnalysis(coords);
});


renderUI();