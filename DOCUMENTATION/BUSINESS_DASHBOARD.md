# Business Dashboard (Home Page)

The business home page is the default dashboard view (`page=home`). It is rendered by `AnalyticsHeroSection` and focuses on operational KPIs, comparative charts, and live market/weather insights.

## UI entry points

- Main component: `frontend/src/widgets/dashboard/ui/AnalyticsHeroSection.tsx`
- Page host: `frontend/src/pages/dashboard/ui/DashboardPage.tsx`
- Analytics engine: `frontend/src/widgets/dashboard/model/sales-analytics.ts`

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

### Weather forecast

Weather is resolved from device geolocation when permitted. If permission is denied or times out, the widget falls back to Kyiv coordinates and shows a non-blocking hint.

Providers:

- **Open-Meteo** (default, no API key)
- **OpenWeatherMap** (optional, API key in settings)

Views:

- Today (current conditions)
- Tomorrow
- 5-day strip

Displayed fields:

- Temperature
- Humidity
- Condition icon (clear, cloudy, rain, thunder, snow, fog)

Optional CSS weather animation can be enabled/disabled and respects `prefers-reduced-motion`.

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

- Widget visibility
- Exchange rates on/off
- Weather on/off
- Weather animation on/off
- Weather provider + OpenWeather API key
- Enabled currencies
- Enabled rate providers
- Default forecast view

Backend schema: `backend/src/domain/settings/model.ts`

Frontend types: `frontend/src/entities/settings/model/types.ts`

### Per-user overrides (browser `localStorage`)

Configured from the widget gear drawer:

- Hide specific currencies
- Hide specific rate providers
- Toggle weather visibility
- Toggle weather animation
- Choose forecast view

Storage key: `project-goods.dashboard-widget-overrides`

Merge logic: `frontend/src/widgets/dashboard/model/dashboard-widget-settings.ts`

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

`GET /api/weather/forecast?lat=50.45&lon=30.52&provider=open-meteo&apiKey=`

Response includes `current`, optional `tomorrow`, and `daily` (up to 5 days).

Backend implementation:

- `backend/src/domain/market/service.ts`
- `backend/src/domain/weather/service.ts`
- `backend/src/routes/market.routes.ts`
- `backend/src/routes/weather.routes.ts`

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