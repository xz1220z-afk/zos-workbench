export const DEFAULT_WEATHER_LOCATION = Object.freeze({ name: '阳西', latitude: 21.75, longitude: 111.62, timezone: 'Asia/Shanghai' });

const WMO_SUMMARY = Object.freeze({
  0: '晴', 1: '晴间多云', 2: '多云', 3: '阴', 45: '有雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 95: '雷雨',
});

function number(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

function locationError(code = '') {
  if (Number(code) === 1 || code === 'PERMISSION_DENIED') return new Error('geolocation_denied');
  if (Number(code) === 2 || code === 'POSITION_UNAVAILABLE') return new Error('geolocation_unavailable');
  if (Number(code) === 3 || code === 'TIMEOUT') return new Error('geolocation_timeout');
  return new Error('geolocation_unavailable');
}

export function requestCurrentWeatherLocation({
  geolocation = globalThis.navigator?.geolocation,
  timezone = 'Asia/Shanghai',
} = {}) {
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    return Promise.reject(new Error('geolocation_unavailable'));
  }
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        const latitude = number(position?.coords?.latitude);
        const longitude = number(position?.coords?.longitude);
        if (latitude == null || longitude == null) return reject(new Error('geolocation_invalid'));
        return resolve({ name: '当前位置', latitude, longitude, timezone });
      },
      (error) => reject(locationError(error?.code)),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

export function normalizeWeather(payload = {}, location = DEFAULT_WEATHER_LOCATION, fetchedAt = new Date().toISOString()) {
  const current = payload?.current || {};
  const temperatureC = number(current.temperature_2m);
  if (temperatureC == null) throw new Error('weather_contract_invalid');
  const code = number(current.weather_code);
  return {
    state: 'ready', location: { name: String(location.name || DEFAULT_WEATHER_LOCATION.name), latitude: Number(location.latitude), longitude: Number(location.longitude) },
    temperatureC, apparentTemperatureC: number(current.apparent_temperature), windSpeedKmh: number(current.wind_speed_10m),
    weatherCode: code, summary: WMO_SUMMARY[code] || '天气待确认', fetchedAt,
  };
}

export function weatherCacheIsFresh(weather, at = new Date().toISOString(), maxAgeMs = 15 * 60 * 1000) {
  const savedAt = Date.parse(weather?.fetchedAt || '');
  const now = Date.parse(at);
  return Number.isFinite(savedAt) && Number.isFinite(now) && now >= savedAt && now - savedAt <= maxAgeMs;
}

export async function fetchSelectedWeather({ location = DEFAULT_WEATHER_LOCATION, fetchImpl = globalThis.fetch, fetchedAt = new Date().toISOString() } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('weather_fetch_unavailable');
  const endpoint = new URL('https://api.open-meteo.com/v1/forecast');
  endpoint.searchParams.set('latitude', String(location.latitude));
  endpoint.searchParams.set('longitude', String(location.longitude));
  endpoint.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m');
  endpoint.searchParams.set('timezone', location.timezone || 'Asia/Shanghai');
  const response = await fetchImpl(endpoint);
  if (!response.ok) throw new Error('weather_read_failed');
  return normalizeWeather(await response.json(), location, fetchedAt);
}
