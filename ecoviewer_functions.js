/*******************************************************************************
 * EcoViewer — Functions Module                                                *
 *                                                                             *
 * Reusable helper functions for the EcoViewer app.                            *
 * No dependencies on global viewer variables.                                 *
 *                                                                             *
 * Usage:                                                                      *
 *   var fun = require('users/rebeccasaunders/ecoviewer:ecoviewer_functions'); *
 *                                                                             *
 * Authors: William Masson, Dhruv Narayan, Rebecca Saunders,                   *
 *          Ben Steer                                                          *
 *                                                                             *
 * Last Updated:- 26-06-2026                                                   *                    
 *                                                                             *
 * James Cook University — Global Ecology Lab                                  *
 *******************************************************************************/
// ─── 1. Coordinate Functions ──────────────────────────────────

// Splits a "lat, lon" string into a {lat, lon} object
exports.parseCoords = function(str) {
  var parts = str.split(',');
  if (parts.length === 2) {
    return {
      lat: parseFloat(parts[0].trim()),
      lon: parseFloat(parts[1].trim())
    };
  }
  return null;
};

// ─── 2. Classification Functions ──────────────────────────────

// Converts an aridity index value to a class label (FAO-based)
// Note: source dataset is scaled by 1e6, so 300 ≈ 0.03 ≈ Hyper-Arid
exports.getAridityClass = function(value) {
  if (value === null || value === undefined) return 'No Data';
  if (value === 0)    return 'Unknown/Water';
  if (value < 300)    return 'Hyper-Arid (Red)';
  if (value < 2000)   return 'Arid (Orange)';
  if (value < 5000)   return 'Semi-Arid (Yellow)';
  if (value < 6500)   return 'Dry Sub-Humid (Pale Yellow)';
  return 'Humid (Pale Blue)';
};

// Converts a latitude value into a latitudinal band label
exports.getLatBand = function(lat) {
  var abs  = Math.abs(lat);
  var hemi = (lat >= 0) ? 'North' : 'South';
  if (abs <= 23.5) return hemi + ' Tropical';
  if (abs <= 35)   return hemi + ' Sub-Tropical';
  if (abs <= 66.5) return hemi + ' Temperate';
  return hemi + ' Polar';
};

// ─── 3. UI Row & Label Helpers ─────────────────────────────────

// Creates a two-column key:value row for the results panel
exports.makeRow = function(key, value) {
  return ui.Panel([
    ui.Label(key + ':', {fontWeight: 'bold', width: '130px', color: '#555'}),
    ui.Label(String(value), {width: '170px', whiteSpace: 'normal'})
  ], ui.Panel.Layout.flow('horizontal'), {stretch: 'horizontal'});
};

// Creates a coloured swatch + label/sub-label row, used for legends
exports.makeLegendRow = function(color, label, subtext) {
  var colorBox = ui.Label({
    style: {backgroundColor: color, padding: '8px', margin: '0 8px 0 0', border: '1px solid #ccc'}
  });
  var textPanel = ui.Panel({
    widgets: [
      ui.Label(label,   {fontWeight: 'bold', fontSize: '11px', margin: '0 0 1px 0'}),
      ui.Label(subtext, {fontSize: '10px', color: 'gray', margin: '0'})
    ],
    style: {margin: '0'}
  });
  return ui.Panel({
    widgets: [colorBox, textPanel],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '0 0 6px 0'}
  });
};

// Brand-styled section heading
exports.makeHeading = function(text, size) {
  return ui.Label(text, {
    fontWeight: 'bold',
    fontSize: size || '14px',
    color: '#3d8c40',
    margin: '12px 0 6px 0'
  });
};

// Brand-styled body text
exports.makeBodyText = function(text) {
  return ui.Label(text, {
    fontSize: '12px',
    color: '#1a2219',
    whiteSpace: 'pre-wrap',
    margin: '0 0 12px 0'
  });
};

// Brand-styled section divider
exports.makeDivider = function() {
  return ui.Label('___________________________________', {color: '#8a9e88'});
};

// ─── 4. Climate Calculation Functions ──────────────────────────

/**
 * Calculates the average number of dry months per year at a point.
 * Used to help identify dry forests per the Global Ecosystem Typology:
 * "Tropical-subtropical dry forests and thickets are characterised by
 * fertile substrates and seasonally dry conditions (~1800mm per year,
 * with a period of 3-6 months receiving less than 100mm per month)."
 *
 * @param {ee.ImageCollection} precipCol - CHIRPS precipitation collection
 * @param {ee.Geometry.Point}  point     - target point
 * @param {number} startYear            - start year for averaging
 * @param {number} endYear              - end year for averaging
 * @param {number} [threshold=100]      - mm threshold for a "dry" month
 * @returns {ui.Panel} row, hidden automatically if no valid data
 */
exports.makeDryMonthsRow = function(precipCol, point, startYear, endYear, threshold) {
  threshold = threshold || 100;
  var numYears = endYear - startYear + 1;

  var valueLabel = ui.Label('Calculating...', {width: '160px', whiteSpace: 'normal', color: '#999'});
  var row = ui.Panel([
    ui.Label('Dry Months (<' + threshold + 'mm):', {fontWeight: 'bold', width: '130px', color: '#555'}),
    valueLabel
  ], ui.Panel.Layout.flow('horizontal'), {stretch: 'horizontal'});

  ee.List.sequence(1, 12).map(function(m) {
    var avgMonthlyRain = precipCol
      .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
      .filter(ee.Filter.calendarRange(m, m, 'month'))
      .sum()
      .divide(numYears);

    return avgMonthlyRain.reduceRegion({
      reducer: ee.Reducer.mean(), geometry: point, scale: 5000, bestEffort: true
    }).values().get(0);
  }).evaluate(function(values) {
    if (!values) {
      row.style().set({shown: false});
      return;
    }

    var dryCount = 0, validMonthsCount = 0;
    values.forEach(function(v) {
      if (v !== null && v !== undefined) {
        validMonthsCount += 1;
        if (v < threshold) dryCount += 1;
      }
    });

    if (validMonthsCount === 0) {
      row.style().set({shown: false});
      return;
    }

    valueLabel.setValue(dryCount + ' months/yr (' + startYear + '-' + endYear + ')');
    valueLabel.style().set({color: '#000'});
  });

  return row;
};

/**
 * Calculates average growing season length and temperature at a point.
 * Used to differentiate alpine (T6) biome ecosystems per the GET:
 * "Tundra is delimited by the physiological temperature limits of trees,
 * which are excluded where the growing season (days >0.9°C) is less than
 * 90-94 days, with mean temperatures less than 6.5°C across the growing
 * season."
 *
 * Shows a "T6 Biome Alert" if tundra conditions are met; the row is
 * hidden entirely for warm/tropical climates.
 *
 * @param {ee.ImageCollection} tempCol - daily temperature collection (°C)
 * @param {ee.Geometry.Point}  point   - target point
 * @param {number} startYear          - start year for averaging
 * @param {number} endYear            - end year for averaging
 * @returns {ui.Panel} row
 */
exports.makeGrowingSeasonRow = function(tempCol, point, startYear, endYear) {
  var numYears = endYear - startYear + 1;

  var titleLabel = ui.Label('Growing Season (>0.9°C):', {fontWeight: 'bold', width: '130px', color: '#555'});
  var valueLabel = ui.Label('Calculating...', {width: '160px', whiteSpace: 'normal', color: '#999'});
  var row = ui.Panel([titleLabel, valueLabel], ui.Panel.Layout.flow('horizontal'), {stretch: 'horizontal'});

  var growingDays = tempCol
    .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
    .select([0])
    .map(function(img) { return img.updateMask(img.gt(0.9)); });

  var statsImage = ee.Image.cat([
    growingDays.count().divide(numYears).rename('dayCount'),
    growingDays.mean().rename('meanTemp')
  ]);

  statsImage.reduceRegion({
    reducer: ee.Reducer.first(), geometry: point, scale: 11132
  }).evaluate(function(stats) {
    if (!stats || stats.dayCount === null || stats.dayCount === undefined) {
      valueLabel.setValue('No data');
      return;
    }

    var days    = stats.dayCount;
    var avgTemp = (stats.meanTemp === null) ? 0 : stats.meanTemp;

    if (Math.round(days) >= 365 || avgTemp > 10) {
      row.style().set({shown: false});
      return;
    }

    var isTundra = (days < 94 || avgTemp < 6.5);
    valueLabel.setValue(days.toFixed(0) + ' days/yr | ' + avgTemp.toFixed(1) + '°C avg');

    if (isTundra) {
      titleLabel.setValue('T6 Biome Alert (' + numYears + '-Yr):');
      titleLabel.style().set({color: '#d9534f'});
      valueLabel.style().set({color: '#d9534f', fontWeight: 'bold'});
    } else {
      valueLabel.style().set({color: '#000'});
    }
  });

  return row;
};

// ─── 5. Fire Analysis Helpers ──────────────────────────────────

// Returns a single-band image of burned area (km²) for a given year
exports.getAnnualArea = function(modisBurn, year) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end   = ee.Date.fromYMD(year, 12, 31);
  return modisBurn
    .filterDate(start, end)
    .select('BurnDate')
    .max()
    .gt(0)
    .multiply(ee.Image.pixelArea())
    .divide(1e6)
    .rename('area_km2');
};