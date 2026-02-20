import { configureStore } from "@reduxjs/toolkit";
import vehiclesReducer from "./vehiclesSlice";
import tracksReducer from "./tracksSlice";
import uiReducer from "./uiSlice";

export const store = configureStore({
  reducer: {
    vehicles: vehiclesReducer,
    tracks: tracksReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: false, // we store Maps/refs-like objects? keep false to avoid noise
    }),
});
