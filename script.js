const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
 
const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const statusEl = document.querySelector("#status");
const contentEl = document.querySelector("#weather-content");
 
const weatherCodes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Slight rain", "🌧️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Slight snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Moderate showers", "🌧️"],
  82: ["Heavy showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Thunderstorm with heavy hail", "⛈️"]
};
 
function weatherInfo(code) {
  return weatherCodes[code] || ["Conditions unavailable", "🌡️"];
}
 
function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}
 
async function fetchJson(url, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${url}?${query.toString()}`);
  if (!response.ok) throw new Error(`Weather service returned error (${response.status}).`);
  return response.json();
}
 
async function searchCity(name) {
  const data = await fetchJson(GEOCODING_URL, {
    name,
    count: "10",
    language: "en",
    format: "json"
  });
  return data.results || [];
}
 
async function getForecast(place) {
  return fetchJson(FORECAST_URL, {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "7"
  });
}
 
function formatDateTime(value) {
  if (!value) return "Time unavailable";
  return value.replace("T", " ");
}
 
function renderCurrent(place, data) {
  const current = data.current;
  const info = weatherInfo(current.weather_code);
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
 
  document.querySelector("#location-name").textContent = parts.join(", ");
  document.querySelector("#updated-time").textContent = `Local forecast time: ${formatDateTime(current.time)}`;
  document.querySelector("#condition-icon").textContent = info[1];
  document.querySelector("#current-condition").textContent = info[0];
  document.querySelector("#current-temp").textContent = `${Math.round(current.temperature_2m)}°C`;
  document.querySelector("#feels-like").textContent = `Feels like ${Math.round(current.apparent_temperature)}°C`;
  document.querySelector("#humidity").textContent = `${current.relative_humidity_2m}%`;
  document.querySelector("#wind").textContent = `${current.wind_speed_10m} km/h`;
  document.querySelector("#precipitation").textContent = `${current.precipitation} mm`;
}
 
function renderHourly(data) {
  const hourly = data.hourly;
  const list = document.querySelector("#hourly-list");
  list.replaceChildren();
 
  const currentTime = data.current.time;
  let start = hourly.time.findIndex(time => time >= currentTime);
  if (start < 0) start = 0;
  const end = Math.min(start + 24, hourly.time.length);
 
  for (let i = start; i < end; i++) {
    const info = weatherInfo(hourly.weather_code[i]);
    const card = document.createElement("article");
    card.className = "hour-card";
 
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = hourly.time[i].split("T")[1] || hourly.time[i];
 
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = info[1];
    icon.setAttribute("aria-label", info[0]);
 
    const temp = document.createElement("div");
    temp.className = "temp";
    temp.textContent = `${Math.round(hourly.temperature_2m[i])}°`;
 
    const rain = document.createElement("div");
    rain.className = "rain";
    rain.textContent = `Rain ${hourly.precipitation_probability[i] ?? "—"}%`;
 
    card.append(time, icon, temp, rain);
    list.append(card);
  }
}
 
function renderDaily(data) {
  const daily = data.daily;
  const tbody = document.querySelector("#daily-rows");
  tbody.replaceChildren();
 
  daily.time.forEach((date, i) => {
    const row = document.createElement("tr");
    const info = weatherInfo(daily.weather_code[i]);
    const values = [
      new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
      }),
      `${info[1]} ${info[0]}`,
      `${Math.round(daily.temperature_2m_min[i])}°C`,
      `${Math.round(daily.temperature_2m_max[i])}°C`,
      `${daily.precipitation_probability_max[i] ?? "—"}%`
    ];
 
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    tbody.append(row);
  });
}
 
async function loadWeather(city) {
  const trimmedCity = city.trim();
  if (!trimmedCity) {
    showStatus("Please enter a city name.", true);
    return;
  }
 
  searchButton.disabled = true;
  contentEl.classList.add("hidden");
  showStatus(`Searching weather for ${trimmedCity}...`);
 
  try {
    const places = await searchCity(trimmedCity);
    if (!places.length) {
      showStatus("City not found. Check the spelling and try again.", true);
      return;
    }
 
    // Beginner version: uses the first matching city result.
    const place = places[0];
    const forecast = await getForecast(place);
 
    renderCurrent(place, forecast);
    renderHourly(forecast);
    renderDaily(forecast);
 
    contentEl.classList.remove("hidden");
    showStatus("Weather loaded successfully.");
  } catch (error) {
    console.error(error);
    showStatus("Could not load weather. Check your internet connection and try again.", true);
  } finally {
    searchButton.disabled = false;
  }
}
 
form.addEventListener("submit", event => {
  event.preventDefault();
  loadWeather(cityInput.value);
});
 
// Load a default city when the page opens.
loadWeather("Pune");
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => {
        console.log("Service Worker registered successfully!");
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  });
}
