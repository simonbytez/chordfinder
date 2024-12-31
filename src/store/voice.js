import { createSlice } from "@reduxjs/toolkit";
import _, { initial } from "lodash";
import { boardView, scaleBoard } from "../guitar/data/default";
import { createSelector } from "reselect";

const initialNotes = [{
  name: 'A', num: 3,
  name: 'B', num: 3
}];

const voiceSlice = createSlice({
  name: "voice",
  initialState: {
    notes: initialNotes,
  },
  reducers: {
  },
});

export const getBoard = createSelector(
  [(state) => state.selectedNote, (state) => state.selectedType],
  (selectedNote, selectedType) => {}
);

export default voiceSlice.reducer;
export const voiceActions = voiceSlice.actions;
