/*******************************************************************************
 * EcoViewer — Config Module                                                   *
 *                                                                             *
 * Central configuration for EcoViewer: asset paths, UI                        *
 * styles, brand colours, colour palettes, and threshold                       *
 * values.                                                                     *
 *                                                                             *
 * Usage:                                                                      *
 *   var config = require('users/rebeccasaunders/ecoviewer:ecoviewer_config'); *
 *                                                                             *
 * Authors: William Masson, Dhruv Narayan, Rebecca Saunders,                   *
 *          Ben Steer                                                          *
 *                                                                             *
 * Last Updated:- 26-06-2026                                                   *                    
 *                                                                             *
 * James Cook University — Global Ecology Lab                                  *
 *******************************************************************************/

// ─── 1. UI Styles ───────────────────────────────────────────

exports.styles = {
  mainPanel: {
    width: '380px',
    padding: '12px',
    backgroundColor: '#f7f6f2'
  },

  labelTitle: {
    fontWeight: 'bold',
    fontSize: '20px',
    color: '#1a2219'
  },
  labelSection: {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '20px 0 0 0',
    color: '#2d6e30'
  },
  labelSubsection: {
    fontWeight: 'bold',
    margin: '10px 0 0 0',
    color: '#4a5c48'
  },
  labelSmall: {
    fontSize: '11px',
    color: '#8a9e88',
    margin: '5px 0'
  },

  buttonPrimary: {
    stretch: 'horizontal',
    color: '#3d8c40'
  },
  buttonBlue: {
    stretch: 'horizontal',
    color: '#52a655'
  },
  buttonDanger: {
    stretch: 'horizontal',
    color: '#D32F2F',
    border: '1px solid #D32F2F',
    fontWeight: 'bold'
  }
};

// ─── 2. Brand Colours ───────────────────────────────────────

exports.brand = {
  bg:      '#f7f6f2',
  bg2:     '#f0ede6',
  surface: '#ffffff',
  border:  'rgba(90, 140, 70, 0.14)',
  green:   '#3d8c40',
  green2:  '#52a655',
  green3:  '#2d6e30',
  text:    '#1a2219',
  text2:   '#4a5c48',
  text3:   '#8a9e88'
};

// ─── 3. Thresholds ───────────────────────────────────────────

exports.thresholds = {
  // Climate
  dryMonthRainfall: 100, // mm — month considered "dry" below this

  // Analysis radii (metres)
  riverSearchRadius:     250,
  canopyHistogramRadius: 50,   // 100m box
  canopyContextRadius:   500,  // 1km box
  fireSearchRadius:      5000,

  // Year ranges
  climateStartYear: 2015,
  climateEndYear:   2024,
  fireStartYear:    2019,
  fireEndYear:      2024
};

// ─── 4. Asset Paths ──────────────────────────────────────────

exports.assets = {
  // Topography
  elevation:     'USGS/SRTMGL1_003',

  // Climate
  chirps:        'UCSB-CHG/CHIRPS/PENTAD',
  aridity:       'projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/global_aridity_index',
  chelsa_precip: 'projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/chelsa_rainfall_1981_2010',
  chelsa_snow:   'projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/chelsa_no_of_snow_days',
  era5_daily:    'ECMWF/ERA5_LAND/DAILY_AGGR',

  // Land cover & vegetation
  worldcover: 'ESA/WorldCover/v200',
  sbtn:       'WRI/SBTN/naturalLands/v1_1/2020',
  canopy:     'projects/sat-io/open-datasets/facebook/meta-canopy-height',
  grassland:  'projects/global-pasture-watch/assets/ggc-30m/v1/grassland_c',
  crop:       'USGS/GFSAD1000_V1',

  // Boundaries
  countries:  'FAO/GAUL/2015/level0',
  ecoregions: 'RESOLVE/ECOREGIONS/2017',

  // Water & wetlands
  gsw:    'JRC/GSW1_4/GlobalSurfaceWater',
  glwd:   'projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GLWD/GLWD_V2_DELTA_MAIN_CLASS',
  gloric: 'projects/sat-io/open-datasets/GloRiC/GloRiC_v10',

  // Coastal
  tidal:     'JCU/Murray/GIC/global_tidal_wetland_change/2019',
  aca:       'ACA/reef_habitat/v2_0',
  gmw_union: 'projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GMW/union/gmw_v3_mng_union',

  // Fire
  modis_burned: 'MODIS/061/MCD64A1',
  firms:        'FIRMS',

  // GBIF indicator species occurrences
  gbif: 'projects/ecoviewer-499604/assets/gbif_global/gbif_global_v7_1'
};

exports.data = {
  elevation:     ee.Image('USGS/SRTMGL1_003'),
  countries:     ee.FeatureCollection('FAO/GAUL/2015/level0'),
  ecoregions:    ee.FeatureCollection('RESOLVE/ECOREGIONS/2017'),
  aridity:       ee.Image('projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/global_aridity_index'),
  chelsa_precip: ee.Image('projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/chelsa_rainfall_1981_2010'),
  chelsa_min:    ee.Image('projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/mean_min_temp_of_coldest_month'),
  chelsa_max:    ee.Image('projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/mean_max_temp_of_warmest_month'),
  chelsa_snow:   ee.Image('projects/geo-global-ecosystems-atlas/assets/additional_datasets/global/weather/chelsa_no_of_snow_days'),
  chirps:        ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD'),
  worldcover:    ee.ImageCollection('ESA/WorldCover/v200'),
  sbtn:          ee.Image('WRI/SBTN/naturalLands/v1_1/2020'),
  canopy:        ee.ImageCollection('projects/sat-io/open-datasets/facebook/meta-canopy-height'),
  grassland:     ee.ImageCollection('projects/global-pasture-watch/assets/ggc-30m/v1/grassland_c'),
  crop:          ee.Image('USGS/GFSAD1000_V1'),
  gsw:           ee.Image('JRC/GSW1_4/GlobalSurfaceWater'),
  glwd:          ee.Image('projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GLWD/GLWD_V2_DELTA_MAIN_CLASS'),
  gloric:        ee.FeatureCollection('projects/sat-io/open-datasets/GloRiC/GloRiC_v10'),
  tidal:         ee.Image('JCU/Murray/GIC/global_tidal_wetland_change/2019'),
  gmw_union:     ee.Image('projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GMW/union/gmw_v3_mng_union'),
  aca:           ee.Image('ACA/reef_habitat/v2_0'),
  modis_burned:  ee.ImageCollection('MODIS/061/MCD64A1'),
  firms:         ee.ImageCollection('FIRMS')
};

// ─── 5. Colour Palettes & Vis Params ─────────────────────────

exports.palettes = {
  aridity:        ['#000000', '#d73027', '#fdae61', '#fee090', '#abdda4', '#4575b4'],
  canopy_classes: ['d73027', 'fee08b', '1a9850'],
  canopy_height:  ['440154', '3b528b', '21918c', '5ec962', 'fde725'],
  fire_heat:      ['FFEDA0', 'FEB24C', 'F03B20', 'BD0026', '4A1486'],
  aca_benthic:    ['#ffffbe', '#e0d05e', '#b19c3a', '#668438', '#ff6161', '#9bcc4f'],
  tidal:          ['#E6E600', '#007E00', '#FFFFFF', '#710087'],
  grass:          ['ff9916', 'ffcd73'],
  glwd: [
    '0000ff', '00ffff', '00008b', '4169e1', '00ced1', 'b0c4de', 'add8e6',
    '228b22', '90ee90', '006400', '3cb371', '556b2f', '8fbc8f', '6b8e23', 'bdb76b',
    '2e8b57', '66cdaa', '483d8b', '7b68ee', 'a0522d', 'd2b48c', '4b0082', '9370db',
    '8b008b', 'ba55d3', '800000', 'cd5c5c', 'ff8c00', 'ffd700', 'f0e68c', 'eee8aa',
    'f5f5dc', '00ff00'
  ]
};

exports.vis = {
  aridity: {
    min: 0, max: 10000,
    palette: ['#000000', '#d73027', '#fdae61', '#fee090', '#abdda4', '#4575b4']
  },
  gsw_seasonality: {
    bands: ['seasonality'], min: 1, max: 12,
    palette: ['#FF0000', '#FF7800', '#FFFF00', '#0000FF', '#00008B']
  },
  glwd: {
    min: 1, max: 33,
    palette: [
      '0000ff', '00ffff', '00008b', '4169e1', '00ced1', 'b0c4de', 'add8e6',
      '228b22', '90ee90', '006400', '3cb371', '556b2f', '8fbc8f', '6b8e23', 'bdb76b',
      '2e8b57', '66cdaa', '483d8b', '7b68ee', 'a0522d', 'd2b48c', '4b0082', '9370db',
      '8b008b', 'ba55d3', '800000', 'cd5c5c', 'ff8c00', 'ffd700', 'f0e68c', 'eee8aa',
      'f5f5dc', '00ff00'
    ]
  },
  tidal: {
    min: 2, max: 5,
    palette: ['#E6E600', '#007E00', '#FFFFFF', '#710087']
  },
  aca_benthic: {
    min: 11, max: 18,
    palette: ['#ffffbe', '#e0d05e', '#b19c3a', '#668438', '#ff6161', '#9bcc4f']
  },
  canopy_classes: {
    min: 0, max: 2,
    palette: ['d73027', 'fee08b', '1a9850']
  },
  canopy_height: {
    min: 0, max: 25,
    palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']
  },
  grass: {
    min: 1, max: 2,
    palette: ['ff9916', 'ffcd73']
  },
  fire_combined: {
    min: 1, max: 8,
    palette: ['FFEDA0', 'FEB24C', 'F03B20', 'BD0026', '4A1486']
  },
  gmw: {
    palette: ['#00FF00']
  }
};

// ─── 6. Legends ──────────────────────────────────────────────

exports.legends = {
  ESA: {
    10: 'Tree cover', 20: 'Shrubland', 30: 'Grassland', 40: 'Cropland',
    50: 'Built-up', 60: 'Bare / sparse vegetation', 70: 'Snow and ice',
    80: 'Permanent water bodies', 90: 'Herbaceous wetland', 95: 'Mangroves',
    100: 'Moss and lichen'
  },

  SBTN: {
    2: 'natural forests', 3: 'natural short vegetation', 4: 'natural water',
    5: 'mangroves', 6: 'bare', 7: 'snow',
    8: 'wet natural forests', 9: 'natural peat forests',
    10: 'wet natural short vegetation', 11: 'natural peat short vegetation',
    12: 'crop', 13: 'built', 14: 'non-natural tree cover',
    15: 'non-natural short vegetation', 16: 'non-natural water',
    17: 'wet non-natural tree cover', 18: 'non-natural peat tree cover',
    19: 'wet non-natural short vegetation', 20: 'non-natural peat short vegetation',
    21: 'non-natural bare'
  },

  crop: {
    0: 'Non-croplands',
    1: 'Croplands: irrigation major',
    2: 'Croplands: irrigation minor',
    3: 'Croplands: rainfed',
    4: 'Croplands: rainfed, minor fragments',
    5: 'Croplands: rainfed, very minor fragments'
  },

  glwd: {
    1: 'Freshwater lake', 2: 'Saline lake', 3: 'Reservoir',
    4: 'River', 5: 'Estuarine river', 6: 'Other permanent waterbody',
    7: 'Small streams', 8: 'Lacustrine, forested', 9: 'Lacustrine, non-forested',
    10: 'Riverine, regularly flooded, forested', 11: 'Riverine, regularly flooded, non-forested',
    12: 'Riverine, seasonally flooded, forested', 13: 'Riverine, seasonally flooded, non-forested',
    14: 'Riverine, seasonally saturated, forested', 15: 'Riverine, seasonally saturated, non-forested',
    16: 'Palustrine, regularly flooded, forested', 17: 'Palustrine, regularly flooded, non-forested',
    18: 'Palustrine, seasonally saturated, forested', 19: 'Palustrine, seasonally saturated, non-forested',
    20: 'Ephemeral, forested', 21: 'Ephemeral, non-forested',
    22: 'Arctic/boreal peatland forested', 23: 'Arctic/boreal peatland non-forested',
    24: 'Temperate peatland forested', 25: 'Temperate peatland non-forested',
    26: 'Tropical peatland forested', 27: 'Tropical peatland non-forested',
    28: 'Mangrove', 29: 'Saltmarsh', 30: 'Delta',
    31: 'Other coastal wetland', 32: 'Salt pan, saline/brackish wetland',
    33: 'Paddy rice'
  },

  gloricGeom: {
    11: 'No lakes/wetlands - Low stream power',
    12: 'No lakes/wetlands - High stream power',
    21: 'Lake/wetland influenced - Low stream power',
    22: 'Lake/wetland influenced - High stream power'
  },

  gloricHydr: {
    11: 'Low variability - Very low discharge',
    12: 'Low variability - Low discharge',
    13: 'Low variability - Medium discharge',
    14: 'Low variability - High discharge',
    15: 'Low variability - Very high discharge',
    21: 'Medium variability - Very low discharge',
    22: 'Medium variability - Low discharge',
    23: 'Medium variability - Medium discharge',
    24: 'Medium variability - High discharge',
    25: 'Medium variability - Very high discharge',
    31: 'High variability - Very low discharge',
    32: 'High variability - Low discharge',
    33: 'High variability - Medium discharge',
    34: 'High variability - High discharge',
    35: 'High variability - Very high discharge'
  },

  gloricPhys: {
    111: 'Low Temp - Low CMI - Low Elev',   112: 'Low Temp - Low CMI - High Elev',
    121: 'Low Temp - Med CMI - Low Elev',   122: 'Low Temp - Med CMI - High Elev',
    131: 'Low Temp - High CMI - Low Elev',  132: 'Low Temp - High CMI - High Elev',
    211: 'Med Temp - Low CMI - Low Elev',   212: 'Med Temp - Low CMI - High Elev',
    221: 'Med Temp - Med CMI - Low Elev',   222: 'Med Temp - Med CMI - High Elev',
    231: 'Med Temp - High CMI - Low Elev',  232: 'Med Temp - High CMI - High Elev',
    311: 'High Temp - Low CMI - Low Elev',  312: 'High Temp - Low CMI - High Elev',
    321: 'High Temp - Med CMI - Low Elev',  322: 'High Temp - Med CMI - High Elev',
    331: 'High Temp - High CMI - Low Elev', 332: 'High Temp - High CMI - High Elev',
    411: 'V.High Temp - Low CMI - Low Elev',  412: 'V.High Temp - Low CMI - High Elev',
    421: 'V.High Temp - Med CMI - Low Elev',  422: 'V.High Temp - Med CMI - High Elev',
    431: 'V.High Temp - High CMI - Low Elev', 432: 'V.High Temp - High CMI - High Elev'
  },

  acaBenthic: {
    11: 'Sand', 12: 'Rubble', 13: 'Rock',
    14: 'Seagrass', 15: 'Coral/Algae', 18: 'Microalgal Mats'
  }
};

// ─── 7. Default Settings ─────────────────────────────────────

exports.defaults = {
  coords:  '-19.3308, 146.7539',
  mapZoom:     15,
  gbifLandPts: true,
  mapStyle:    'SATELLITE',
  mapCursor:   'crosshair'
};