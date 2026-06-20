# EcoViewer — GEE App Scripts

This repo contains the Google Earth Engine (GEE) JavaScript code that powers the **EcoViewer** app 


---

## What's in here

```
ecoviewer_main.js          ← the app itself (UI, tabs, map logic, click handling)
ecoviewer_config.js        ← asset paths, colour palettes, styling, thresholds
ecoviewer_functions.js     ← reusable helper functions (no UI state)
```

### How the files relate

GEE scripts don't run from GitHub — they live and run inside the [Google Earth Engine Code Editor](https://code.earthengine.google.com). This repo is a version-controlled backup/reference copy of that code.

All three files live together in the same GEE repository (`users/rebeccasaunders/ecoviewer`) and `ecoviewer_main.js` pulls the other two in with GEE's `require()`:

```js
var config = require('users/rebeccasaunders/ecoviewer:ecoviewer_config');
var fun    = require('users/rebeccasaunders/ecoviewer:ecoviewer_functions');
```

| File | Purpose |
|---|---|
| `ecoviewer_config.js` | Every asset path, colour, and threshold value the app uses |
| `ecoviewer_functions.js` | Small reusable functions (styled rows, climate calculations) with no dependency on app state |
| `ecoviewer_main.js` | Builds the UI, switches between tabs, handles map clicks |

Most changes (colours, dataset paths, thresholds) only require editing `ecoviewer_config.js`.

---

## Editing / running this code

1. Go to [code.earthengine.google.com](https://code.earthengine.google.com)
2. Open the `ecoviewer` repository in the Scripts panel
3. Open `ecoviewer_main.js` and click **Run**
4. To publish/update the live app: **Apps → Manage Apps**


---

## Tabs in the app

- **Overview** — country, ecoregion, elevation, slope
- **Climate** — temperature, precipitation, aridity, dry season, growing season
- **Vegetation** — land cover (ESA WorldCover, SBTN), canopy height
- **Waterbodies & Wetlands** — wetlands, surface water, rivers, coastal habitat (mangroves, tidal, reef)
- **Fire Disturbance** — burned area, fire frequency, seasonality
- **GBIF Indicators** — indicator species occurrences, species inspector tool, CSV export (region overview + GBIF records)

---

## Map styling

The dark home-tab basemap uses the [Snazzy Maps GEE library](https://github.com/aazuspan/snazzy) by Aaron Zuspan.
