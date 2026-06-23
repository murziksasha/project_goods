# Business Dashboard (Home Page)

The business home page is the default dashboard view (`page=home`). It is rendered by `AnalyticsHeroSection` and focuses on operational KPIs, comparative charts, and live market/weather insights.

## UI entry points

- Main component: `frontend/src/widgets/dashboard/ui/AnalyticsHeroSection.tsx`
- Page host: `frontend/src/pages/dashboard/ui/DashboardPage.tsx`
- Analytics engine: `frontend/src/widgets/dashboard/model/sales-analytics.ts`
- Market & weather widget: `frontend/src/widgets/dashboard/ui/MarketWeatherWidget.tsx`

## Header controls

### Period presets

Quick period toggles remain available:

- Today
- This month
- Last month
- This year
- Last year

Preset buttons filter sales and repair-order analytics through `buildDashboardAnalytics()`.

### Date filter (replaces Export)

The old **Export** action was removed from the business home page. Product export remains available in warehouse and clients modules.

Instead, a **Date** button opens a calendar range panel (same interaction model as accounting date filters):

- `dateFrom` / `dateTo` inputs
- Apply / Clear actions
- Active filter badge on the button

When a custom date range is applied:

- It overrides preset period toggles for all KPIs and charts
- The selected range is persisted in `localStorage` (`project-goods.analytics-date-range`)
- Charts switch to a single-series mode (no year-over-year overlay)
- Bucketing adapts to range length:
  - `<= 1 day` → hourly buckets
  - `2–62 days` → daily buckets
  - `> 62 days` → monthly buckets

Related files:

- `frontend/src/widgets/dashboard/ui/AnalyticsDateFilterPanel.tsx`
- `frontend/src/widgets/dashboard/model/analytics-date-range.ts`

## Market & Weather widget

A responsive insights block is shown between the executive header and summary KPI cards when enabled in settings.

### Collapsed mode

The widget gear drawer includes **Show rates and weather**. When turned off:

- Only the **Live insights** label and **Settings** button remain visible
- Refresh, exchange rates, and weather panels are hidden
- The **Market & weather** title is hidden

This preference is stored per user in `localStorage` (`contentVisible` override).

### Exchange rates

Data is fetched through backend proxy endpoints to avoid browser CORS limits.

Supported providers:

| Provider | Source | Data |
|----------|--------|------|
| NBU | `bank.gov.ua` | Official mid-rate |
| PrivatBank | `api.privatbank.ua` | Buy / sell |
| Monobank | `api.monobank.ua` | Buy / sell |

Supported currencies: `USD`, `EUR`, `GBP`, `PLN`.

Visual accents:

- USD official → primary blue (`#2d8ae3`)
- USD buy → green
- USD sell → orange
- EUR → teal

Exchange rates can be toggled off independently in the widget settings drawer (`exchangeRatesEnabled` override).

### Weather forecast

Weather does **not** use device geolocation. The widget always loads forecast data for a configured city preset. This keeps weather and animation working on local-network HTTP installs (`http://192.168.x.x`) where browsers block geolocation.

#### Location presets

| Preset ID | City | Coordinates (lat, lon) | Default |
|-----------|------|------------------------|---------|
| `chornomorsk` | Chornomorsk | 46.3013, 30.6531 | Yes |
| `odesa` | Odesa | 46.4825, 30.7233 | No |

Preset definitions: `frontend/src/shared/config/default-weather-location.ts`

The active preset can be chosen in:

- **Settings → Dashboard → Weather location** (server default for all users)
- **Widget → Settings → Weather location** (per-user override in `localStorage`)

The widget shows a non-blocking hint, for example: `Showing weather for Chornomorsk.` On plain HTTP LAN installs it adds `(local network mode)`.

#### Providers

- **Open-Meteo** (default, no API key)
- **OpenWeatherMap** (optional, API key in settings)

#### Views

- Today (current conditions)
- Tomorrow
- 5-day strip

#### Displayed fields

- Temperature
- Humidity
- Condition label (clear, partly-cloudy, cloudy, rain, thunder, snow, fog)

#### Weather animation

When animation is enabled, the hero forecast uses a CSS animated scene (`WeatherAnimatedScene.tsx`) instead of a static SVG icon:

- **Clear** — sun glow pulse + rotating rays
- **Partly cloudy / cloudy** — drifting clouds
- **Rain / thunder** — falling rain drops (+ lightning flash for thunder)
- **Snow** — drifting snowflakes
- **Fog** — moving fog layers

Animation is independent of location resolution and works with preset cities on LAN. It respects `prefers-reduced-motion`.

The widget settings drawer shows a side-by-side preview:

- **Static icon** — flat SVG (animation off)
- **Animated scene** — live rain preview (animation on)

Related files:

- `frontend/src/widgets/dashboard/ui/WeatherVisual.tsx`
- `frontend/src/widgets/dashboard/ui/WeatherAnimatedScene.tsx`
- `frontend/src/widgets/dashboard/ui/MarketWeatherSettingsDrawer.tsx`

### Refresh behavior

The widget refreshes data in these cases:

1. Initial page load (`refetchOnMount: 'always'`)
2. Topbar **Last sync** (full page reload)
3. Widget **Refresh** button (soft invalidation via React Query)

During refresh:

- The refresh button shows a spinning icon and `Refreshing data...` label
- A loader overlay appears above existing content (stale-while-revalidate)
- Skeleton placeholders animate for rates and weather panels
- Initial load (no cached data) uses inline skeleton loader panels

Loader component:

- `frontend/src/widgets/dashboard/ui/MarketWeatherLoader.tsx`

Query cache TTL on frontend and backend proxy cache: **15 minutes**.

## Settings model

Settings use a two-layer model:

### Server defaults (`dashboardPreferences` in App Settings)

Configured in **Settings → Dashboard**:

| Field | Description |
|-------|-------------|
| `marketWeatherEnabled` | Show/hide the entire widget |
| `exchangeRatesEnabled` | Default exchange rates visibility |
| `weatherEnabled` | Default weather visibility |
| `weatherAnimationEnabled` | Default weather animation |
| `defaultWeatherLocation` | `chornomorsk` or `odesa` |
| `weatherProvider` | `open-meteo` or `openweather` |
| `openWeatherApiKey` | Required when OpenWeatherMap is selected |
| `currencies` | Enabled currency codes |
| `rateProviders` | Enabled rate providers (`nbu`, `privat`, `mono`) |
| `defaultForecastView` | `today`, `tomorrow`, or `fiveDay` |

Backend schema: `backend/src/domain/settings/model.ts`

Frontend types: `frontend/src/entities/settings/model/types.ts`

Normalization: `frontend/src/entities/settings/model/dashboardPreferences.ts`

Legacy settings that stored manual latitude/longitude are migrated to the nearest preset (`odesa` when old Odesa coordinates are detected; otherwise `chornomorsk`).

### Per-user overrides (browser `localStorage`)

Configured from the widget gear drawer:

| Override | Description |
|----------|-------------|
| `contentVisible` | Show/hide all widget content (header-only collapsed mode) |
| `exchangeRatesEnabled` | Toggle exchange rates panel |
| `hiddenCurrencies` | Hide specific currencies |
| `hiddenProviders` | Hide specific rate providers |
| `weatherEnabled` | Toggle weather panel |
| `weatherLocation` | `chornomorsk` or `odesa` |
| `weatherAnimationEnabled` | Toggle animated weather scene |
| `forecastView` | Today / tomorrow / 5-day view |

Storage key: `project-goods.dashboard-widget-overrides`

Merge logic: `frontend/src/widgets/dashboard/model/dashboard-widget-settings.ts`

Coordinates helper (preset → lat/lon, no geolocation): `frontend/src/widgets/dashboard/model/useWeatherForecast.ts`

## API endpoints

### Market rates

`GET /api/market/rates?providers=nbu,privat&currencies=USD,EUR`

Response:

```json
{
  "quotes": [
    {
      "currency": "USD",
      "provider": "nbu",
      "official": 41.25,
      "fetchedAt": "2026-06-23T09:00:00.000Z"
    }
  ]
}
```

### Weather forecast

`GET /api/weather/forecast?lat=46.3013&lon=30.6531&provider=open-meteo&apiKey=`

The frontend passes coordinates from the selected location preset. Backend fallback coordinates (when `lat`/`lon` are invalid): Chornomorsk.

Response includes `current`, optional `tomorrow`, and `daily` (up to 5 days).

Backend implementation:

- `backend/src/domain/market/service.ts`
- `backend/src/domain/weather/service.ts`
- `backend/src/routes/market.routes.ts`
- `backend/src/routes/weather.routes.ts`

## Local network requirements

| Layer | Requirement |
|-------|-------------|
| Client → app server | Must reach `/api/market/rates` and `/api/weather/forecast` |
| Server → internet | Must reach external rate and weather APIs (outbound HTTPS) |
| Device geolocation | **Not required** — preset city is always used |

If weather or rates show as unavailable, verify backend outbound internet access (firewall, Docker network, proxy).

## Responsive layout

| Breakpoint | Layout |
|------------|--------|
| Desktop | Two-column widget grid (rates + weather) |
| Tablet | Two-column with reduced spacing |
| Mobile | Stacked panels, horizontal scroll strips for rate cards and 5-day forecast |

Overflow safety:

- `min-width: 0` on grid children
- Horizontal scroll for compact strips
- `clamp()` typography for rate values

## Related tests

- `frontend/src/widgets/dashboard/model/analytics-date-range.test.ts`
- `frontend/src/widgets/dashboard/model/sales-analytics.test.ts`
- `backend/src/domain/market/service.test.ts`
- `backend/src/domain/weather/service.test.ts`

## Operational notes

- Restart backend after deploy so `/api/market/rates` and `/api/weather/forecast` routes are available.
- External provider failures return partial results when possible; panel-level empty states are shown per provider.
- Hide the entire widget via **Settings → Dashboard → Show market & weather widget**.
- Save **Settings → Dashboard** after changing the default weather location so all users receive the new preset on next settings load.