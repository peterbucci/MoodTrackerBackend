export async function fetchWeatherAndAqi(lat, lon) {
  try {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m` +
      `&temperature_unit=fahrenheit` +
      `&wind_speed_unit=mph` +
      `&precipitation_unit=mm` +
      `&timezone=auto`;

    const airUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=us_aqi` +
      `&timezone=auto`;

    const [weatherRes, airRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(airUrl),
    ]);

    if (!weatherRes.ok) {
      throw new Error(`OpenMeteo weather HTTP ${weatherRes.status}`);
    }

    const weatherJson = await weatherRes.json();
    const c = weatherJson.current;
    if (!c) return {};

    const tempF = c.temperature_2m ?? null;
    const windMph = c.wind_speed_10m ?? 0;
    const humidity = c.relative_humidity_2m ?? 0;
    const precipMm = c.precipitation ?? null;

    // --- Feels-like calc (heat index / wind chill) ---
    let feelsLikeF = tempF;
    if (tempF !== null) {
      // Heat index
      if (tempF >= 80 && humidity >= 40) {
        const T = tempF;
        const RH = humidity;
        feelsLikeF =
          -42.379 +
          2.04901523 * T +
          10.14333127 * RH -
          0.22475541 * T * RH -
          0.00683783 * T * T -
          0.05481717 * RH * RH +
          0.00122874 * T * T * RH +
          0.00085282 * T * RH * RH -
          0.00000199 * T * T * RH * RH;
      }

      // Wind chill
      if (tempF <= 50 && windMph >= 3) {
        feelsLikeF =
          35.74 +
          0.6215 * tempF -
          35.75 * Math.pow(windMph, 0.16) +
          0.4275 * tempF * Math.pow(windMph, 0.16);
      }
    }

    // --- AQI ---
    let outdoorAQI = null;
    if (airRes.ok) {
      try {
        const airJson = await airRes.json();
        const hours = airJson.hourly?.time;
        const aqiArr = airJson.hourly?.us_aqi;

        if (
          Array.isArray(hours) &&
          Array.isArray(aqiArr) &&
          hours.length &&
          aqiArr.length
        ) {
          const now = Date.now();
          let bestIdx = 0;
          let bestDiff = Infinity;

          for (let i = 0; i < hours.length; i++) {
            const t = Date.parse(hours[i]);
            if (Number.isNaN(t)) continue;
            const diff = Math.abs(t - now);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = i;
            }
          }

          outdoorAQI = aqiArr[bestIdx] ?? null;
        }
      } catch (err) {
        console.warn("Open-Meteo air-quality parse failed:", err);
      }
    } else {
      console.warn(`OpenMeteo AQI HTTP ${airRes.status}`);
    }

    return {
      weatherTempF: tempF,
      weatherFeelsLikeF: feelsLikeF,
      weatherPrecipMm: precipMm,
      outdoorAQI,
    };
  } catch (err) {
    console.warn("Open-Meteo weather/AQI fetch failed:", err);
    return {};
  }
}
