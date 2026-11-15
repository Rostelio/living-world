// Per-player preferences (browser storage). Never part of the game state.
import { audio } from '../audio/audio.js';

const KEY = 'livingworld.settings';
export const SETTINGS = {
  autosaveYears: 1, // 0 = off
  showWildlife: true,
  showVillagers: true,
  dayNight: true,
  weather: true,
  clouds: true,
  seasons: true,
  ambientLife: true,
  detailTrees: true,
  hdTiles: true,
  colorGrade: true,
  gradeFilter: true, // Phase 20: time-of-day saturation and contrast
  shadows: true, // Phase 20: buildings cast shadows from the sun
  sunbeams: true, // Phase 20: light shafts in the golden hours
  advisor: true, // Phase 21: the advisor's card
  gpuTerrain: true, // Phase 22: ground and water painted on the graphics card
  statusMarkers: true,
  atlas: true,
  screenShake: true,
  effectsQuality: 2, // 1 low, 2 normal, 3 high
  edgePan: false,
  uiScale: 1,
  textSize: 'normal', // Phase 22 readability: small | normal | large
  highContrast: false,
  reduceMotion: false,
  confirmWar: true,
  pauseOnBattle: false,
  tutorialDone: false,
  masterVolume: 0.8,
  musicVolume: 0.5,
  ambienceVolume: 0.8, // Phase 21: wind, surf, birds, town sounds
  sfxVolume: 0.7,
  muted: false,
  lang: 'en',
  keys: {},
  colorBlind: false,
};

export function loadSettings() {
  try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
  applySettings();
}
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(SETTINGS)); } catch { /* storage unavailable */ }
  applySettings();
}
export function applySettings() {
  document.documentElement.style.setProperty('--ui-scale', String(SETTINGS.uiScale));
  // Phase 22: readability and accessibility
  const b = document.body;
  if (b) {
    b.classList.toggle('text-small', SETTINGS.textSize === 'small');
    b.classList.toggle('text-large', SETTINGS.textSize === 'large');
    b.classList.toggle('high-contrast', !!SETTINGS.highContrast);
    b.classList.toggle('reduce-motion', !!SETTINGS.reduceMotion);
  }
  audio.setVolume({ master: SETTINGS.masterVolume, music: SETTINGS.musicVolume, sfx: SETTINGS.sfxVolume, ambience: SETTINGS.ambienceVolume ?? 0.8, muted: SETTINGS.muted });
}
