// src/store/uiSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  selectedVendor: "all",
  selectedIalert2Key: "",

  showStops: true,
  showAllPolylines: true,
  showMovingFlow: true,
  denseMode: false,

  active: null,
  center: { lat: 13.0827, lng: 80.2707 },

  loading: false,
  error: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSelectedVendor(state, action) {
      state.selectedVendor = action.payload || "all";
    },
    setSelectedIalert2Key(state, action) {
      state.selectedIalert2Key = action.payload || "";
    },
    setToggle(state, action) {
      const { key, value } = action.payload || {};
      if (!key) return;
      state[key] = !!value;
    },
    setActive(state, action) {
      state.active = action.payload || null;
      if (state.active?.lat && state.active?.lng) {
        state.center = { lat: state.active.lat, lng: state.active.lng };
      }
    },
    setLoading(state, action) {
      state.loading = !!action.payload;
    },
    setError(state, action) {
      state.error = action.payload ? String(action.payload) : null;
    },
  },
});

export const {
  setSelectedVendor,
  setSelectedIalert2Key,
  setToggle,
  setActive,
  setLoading,
  setError,
} = uiSlice.actions;

export default uiSlice.reducer;
