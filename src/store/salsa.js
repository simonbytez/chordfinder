import { createSlice } from "@reduxjs/toolkit";
import _ from "lodash";
import { createSelector } from "reselect";
import DEFAULT_SCORE from "../salsa/data/default-score";
import { start as startToneJs, stop as stopToneJs, startAccelerating, stopAccelerating, inc, dec } from "../lib/tone";

//Get the notes for playback
export const getToneJs = createSelector(
  [(state) => state.score, (state) => state.tempo],
  (score, tempo) => {
    let measures = score.measures;
    const partConfig = score.parts;
    const spb = 60 / tempo;
    let toneJsNotes = [];

    const toneJs = {
      notes: [],
      duration: 0,
      numMeasures: measures.length,
    };

    let measureStartingTime = 0;
    let measureTimeLength = 0;
    let loopTimeDuration = 0;
    measures.forEach((measure, measureIndex) => {
      let loopTimeDurationAddition = measure.timeSig.num * spb;
      if (measure.timeSig.type == 8) {
        loopTimeDurationAddition /= 2;
      } else if (measure.timeSig.type == 16) {
        loopTimeDurationAddition /= 4;
      }

      loopTimeDuration += loopTimeDurationAddition;
      let parts = measure.parts;
      let firstPart = true;

      parts = parts.filter((part) => partConfig[part.instrument].enabled);

      parts.forEach((part) => {
        const { voices, instrument } = part;
        let time = measureStartingTime;

        voices.forEach((voice) => {
          const notes = voice.notes;

          let numSixteenths = 0;
          notes.forEach((note, noteIndex) => {
            let noteSecondsDuration = (spb * 4) / note.duration;
            if (note.notes.length) {
              //Not a rest
              for (const tjsNote of note.notes) {
                const toneJsNote = {
                  time: `${measureIndex}:${Math.floor(numSixteenths / 4)}:${numSixteenths % 4}`,
                  note: tjsNote,
                  velocity: note.velocity,
                  instrument,
                };
                toneJsNotes.push(toneJsNote);
              }
            } else {
              //rest
              toneJsNotes.push({});
            }

            numSixteenths += (16 / note.duration);
            time += noteSecondsDuration;
          });
        });
        firstPart = false;
      });
    });

    toneJs.notes = toneJsNotes;
    toneJs.duration = loopTimeDuration;

    return toneJs;
  }
);

const salsaSlice = createSlice({
  name: "salsa",
  initialState: {
    isPlaying: false,
    tempo: 175,
    score: DEFAULT_SCORE,
    isAccelerating: false,
    interval: null
  },
  
  reducers: {
    updateTempo(state, action) {
      state.tempo = action.payload;
    },
    increaseTempo(state) {
      inc();
      state.tempo = state.tempo + 1;
    },
    decreaseTempo(state) {
      dec();
      state.tempo = state.tempo - 1;
    },
    startStop(state) {
      if (!state.isPlaying) {
        startToneJs();
      } else {
        stopToneJs();
      }

      state.isPlaying = !state.isPlaying;
    },
    toggleInstrumentEnabled(state, action) {
      state.score.parts[action.payload].enabled = !state.score.parts[action.payload].enabled
    },
    startAccelerate(state, action) {
      state.interval = action.payload;
      state.isAccelerating = true;
    },
    stopAccelerate(state) {
      clearInterval(state.interval);
      state.isAccelerating = false;
    }
  },
});

export default salsaSlice.reducer;
export const salsaActions = salsaSlice.actions;
