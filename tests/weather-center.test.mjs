import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeather, weatherCacheIsFresh, requestCurrentWeatherLocation } from '../src/app/weather-center.mjs';

test('weather normalization uses a selected city and public forecast values only', () => {
  const weather = normalizeWeather({ current: { temperature_2m: 29.4, apparent_temperature: 32.1, weather_code: 2, wind_speed_10m: 12 } }, { name: '阳西', latitude: 21.75, longitude: 111.62 }, '2026-08-08T08:00:00Z');
  assert.equal(weather.location.name, '阳西');
  assert.equal(weather.summary, '多云');
  assert.equal(weather.temperatureC, 29.4);
  assert.equal(weatherCacheIsFresh(weather, '2026-08-08T08:10:00Z'), true);
});

test('current location is requested only on demand and never needs a saved address', async () => {
  let calls = 0;
  const geolocation = {
    getCurrentPosition(resolve) {
      calls += 1;
      resolve({ coords: { latitude: 21.743, longitude: 111.618 } });
    },
  };
  const location = await requestCurrentWeatherLocation({ geolocation, timezone: 'Asia/Shanghai' });
  assert.equal(calls, 1);
  assert.deepEqual(location, { name: '当前位置', latitude: 21.743, longitude: 111.618, timezone: 'Asia/Shanghai' });
});
