import { createSlice } from "@reduxjs/toolkit";
import { calculateHeading, haversineMeters } from "./utils";

const MAX_TRACK_POINTS = 300;
const MIN_MOVE_METERS = 5;

const initialState = {
  // tracks[source][trackKey] = [{lat,lng,t,speed}]
  tracks: {},
  // heading[source][trackKey] = deg
  heading: {},
  // moving["source:trackKey"] = true
  moving: {},
  trackTick: 0,
};

function pushTrack(state, source, trackKey, point) {
  if (!source || !trackKey) return false;
  const tNow = Number(point?.t ?? Date.now());
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  state.tracks[source] ||= {};
  const arr = state.tracks[source][trackKey] || [];
  const last = arr[arr.length - 1];

  if (last) {
    const dt = Math.abs((last.t || 0) - tNow);
    const d = haversineMeters({ lat: last.lat, lng: last.lng }, { lat, lng });
    if (dt < 800 && d < 2) return false;
  }

  arr.push({ ...point, lat, lng, t: tNow });
  if (arr.length > MAX_TRACK_POINTS) arr.splice(0, arr.length - MAX_TRACK_POINTS);

  state.tracks[source][trackKey] = arr;

  // heading from last 2 points
  if (arr.length >= 2) {
    const h = calculateHeading(arr[arr.length - 2], arr[arr.length - 1]);
    state.heading[source] ||= {};
    state.heading[source][trackKey] = h;
  }

  return true;
}

function computeIsMoving(vehicle, track) {
  // speed > 0 OR last2 distance > MIN_MOVE_METERS
  let isMoving = false;

  const sp = vehicle?.speed;
  if (sp != null && sp !== "-" && sp !== "") {
    const speedNum = parseFloat(String(sp).replace(/[^\d.]/g, ""));
    if (!Number.isNaN(speedNum) && speedNum > 0) isMoving = true;
  }

  if (!isMoving && track?.length > 1) {
    const a = track[track.length - 2];
    const b = track[track.length - 1];
    const d = haversineMeters(a, b);
    if (d > MIN_MOVE_METERS) isMoving = true;
  }
  return isMoving;
}

const tracksSlice = createSlice({
  name: "tracks",
  initialState,
  reducers: {
    ingestVehicleSamples(state, action) {
      // payload: { source, vehicles: [{trackKey, lat, lng, t, speed, heading?}] }
      const { source, vehicles } = action.payload || {};
      if (!source || !Array.isArray(vehicles)) return;

      let changed = false;

      for (const v of vehicles) {
        const trackKey = v.trackKey || v.id;
        if (!trackKey) continue;

        const did = pushTrack(state, source, trackKey, {
          lat: v.lat,
          lng: v.lng,
          t: v.t ?? v.ts ?? v.epochTime ?? v.lastUpdated ?? v.gps_datetime ?? Date.now(),
          speed: v.speed,
        });
        if (did) changed = true;

        // prefer vendor heading if track not enough
        if (!state.heading[source]?.[trackKey] && v.heading != null) {
          state.heading[source] ||= {};
          state.heading[source][trackKey] = Number(v.heading) || 0;
        }

        // compute moving
        const track = state.tracks[source]?.[trackKey] || [];
        const movingKey = `${source}:${trackKey}`;
        const isMoving = computeIsMoving(v, track);
        if (isMoving) state.moving[movingKey] = true;
        else delete state.moving[movingKey];
      }

      if (changed) state.trackTick += 1;
    },

    forceTick(state) {
      state.trackTick += 1;
    },

    clearAll(state) {
      state.tracks = {};
      state.heading = {};
      state.moving = {};
      state.trackTick = 0;
    },
  },
});

export const { ingestVehicleSamples, forceTick, clearAll } = tracksSlice.actions;
export default tracksSlice.reducer;

// selectors
export const selectTrackTick = (s) => s.tracks.trackTick;
export const selectMovingMap = (s) => s.tracks.moving;
export const selectHeading = (s, source, trackKey) => s.tracks.heading?.[source]?.[trackKey] ?? 0;
export const selectTrack = (s, source, trackKey) => s.tracks.tracks?.[source]?.[trackKey] ?? [];
