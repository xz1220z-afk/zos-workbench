import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeather, weatherCacheIsFresh } from '../src/app/weather-center.mjs';

test('weather normalization uses a selected city and public forecast values only', () => {
  const weather = normalizeWeather({ current: { temperature_2m: 29.4, apparent_temperature: 32.1, weather_code: 2, wind_speed_10m: 12 } }, { name: '阳西', latitude: 21.75, longitude: 111.62 }, '2026-08-08T08:00:00Z');
  assert.equal(weather.location.name, '阳西');
  assert.equal(weather.summary, '多云');
  assert.equal(weather.temperatureC, 29.4);
  assert.equal(weatherCacheIsFresh(weather, '2026-08-08T08:10:00Z'), true);
});
