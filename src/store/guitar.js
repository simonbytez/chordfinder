import { createSlice } from "@reduxjs/toolkit";
import _ from "lodash";
import { boardView } from "./defaultState";
import { createSelector } from "reselect";

const chordDiffs = {
  major: [4, 3],
  major6: [4, 3, 2],
  major7: [4, 3, 4],
  major9: [4, 3, 4, 3],
  major11: [4, 7, 3, 3],
  minor: [3, 4],
  minor6: [3, 4, 2],
  minor7: [3, 4, 3],
  minor9: [3, 4, 3, 4],
  minor11: [3, 7, 3, 3],
  2: [2, 5],
  7: [4, 3, 3],
  9: [4, 3, 3, 4],
  11: [4, 3, 3, 4, 3],
  sus: [5, 2]
};

const noteValues = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

function getInitialChordArrangements() {
  let board = boardView;
  return getChordArrangements(board, ['c', 'e', 'g']);
}

function getInitialBoard() {
  let board = boardView;
  let arrangements = getInitialChordArrangements();
  updateBoardChord(board, arrangements, 0);
  return board;
}

function updateBoardChord(board, arrangements, arrIndex) {
  let arrangement = arrangements[arrIndex];
  Object.keys(board).forEach((stringNum) => {
    let selectedFretIndex = arrangement[stringNum] ?? -1;

    for(let fretIndex = 0; fretIndex < board[stringNum].length; fretIndex++) {
      board[stringNum][fretIndex].included = fretIndex === selectedFretIndex;
    }
  });
}

function getChordArrangements(board, chordNotes) {
  let retval = [];
  let boardKeys = Object.keys(board);
  for(let i = boardKeys.length - 1; i > 1; i--) {
    let currentConfig = {};
    let results = [];
    let stringNum = boardKeys[i];

    _getChordArrangements(board, chordNotes, chordNotes[0], stringNum, stringNum, currentConfig, results, false);
    retval = retval.concat(results);
  }

  return retval;
}

function _getChordArrangements(board, chordNotes, rootNote, stringNum, rootString, currentConfig, results, gotRoot) {
  if(stringNum === 0) {
    let minIndex = 7;
    let maxIndex = -1;

    let prevIndex = -1;
    let fretSet = new Set();
    let notesLeft = chordNotes.slice();
    let prevNote = '';
    for(const key in currentConfig) {
      let entry = board[key][currentConfig[key]];
      if(entry.note === prevNote) {
        return false;
      }

      notesLeft = notesLeft.filter(key => key != entry.note)
      prevNote = entry.note;

      ///////////////////////////////

      let value = currentConfig[key];
      fretSet.add(value);
      if(value < minIndex && value !== 0) {
        minIndex = value;
      } 
      
      if(value > maxIndex) {
        maxIndex = value;
      } 

      prevIndex = currentConfig[key];
    }

    // let prevIndex = -1;
    // let fretSet = new Set();
    // for(const key in currentConfig) {
    //   let value = currentConfig[key];
    //   fretSet.add(value);
    //   if(value < minIndex && value !== 0) {
    //     minIndex = value;
    //   } 
      
    //   if(value > maxIndex) {
    //     maxIndex = value;
    //   } 

    //   prevIndex = currentConfig[key];
    // }

    //This needs to change to not reject valid configurations with muted strings
    if(maxIndex - minIndex > 3) {
      //console.log('maxInex - minIndex > 3: ' + JSON.stringify(currentConfig));
      for(const key in currentConfig) {
        let value = currentConfig[key];
        if(value - minIndex > 3) {
          if(key === rootString) {
            return false;
          }

          delete currentConfig[key];
        }
      }

      //console.log('after deleted: ' + JSON.stringify(currentConfig));

      let notesLeft = chordNotes.slice();
      for(const key in currentConfig) {
        let note = board[key][currentConfig[key]].note;
        notesLeft.splice(notesLeft.indexOf(note), 1);
      }

      //console.log('notes left: ' + JSON.stringify(notesLeft));

      return notesLeft.length === 0;
    }

    let inverted = {};
    for(const key in currentConfig) {
      let value = currentConfig[key];
      if(!inverted[value]) {
        inverted[value] = [+key]
      } else {
        inverted[value].push(+key);
      }
    }

    let maxInvertedIndex = Math.max(...Object.keys(inverted));

    for(let i in inverted) {
      if(inverted[i].length > 1) {
        let min = Math.min(...inverted[i]);
        let max = Math.max(...inverted[i]);
        for(let j = min + 1; j < max; j++) {
          if(currentConfig[j] < i && currentConfig[j] != 0 && maxInvertedIndex > i) {
            return false;
          }
        }
      }
    }

    let numFingers = fretSet.size;

    if(numFingers > 4) {
      return false;
    } else if(notesLeft.length > 0) {
      return false;
    }

    return true;
  }
  
  let frets = board[stringNum];

  for(let i = 0; i < frets.length; i++) {
    let note = frets[i].note;
    if(!gotRoot ? 
        note === rootNote : 
        chordNotes.includes(note)) {
      let newConfig = {
        [stringNum]: i,
        ...currentConfig
      };

      let result = _getChordArrangements(board, chordNotes, rootNote, stringNum - 1, rootString, newConfig, results, gotRoot || frets[i].note === rootNote);

      if(result) {
        results.push(newConfig);
      }
    }
  }
}

const guitarSlice = createSlice({
  name: "guitar",
  initialState: {
    board: getInitialBoard(),
    chordArrangements: getInitialChordArrangements(),
    arrIndex: 0,
    selectedNote: "C",
    selectedType: "major",
  },
  reducers: {
    incArrIndex(state) {
      state.arrIndex++;
      state.arrIndex = state.arrIndex % state.chordArrangements.length;
      updateBoardChord(state.board, state.chordArrangements, state.arrIndex);
    },
    decArrIndex(state) {
      state.arrIndex--;
      if(state.arrIndex < 0) {
        state.arrIndex = state.arrIndex + state.chordArrangements.length;
      }
      updateBoardChord(state.board, state.chordArrangements, state.arrIndex);
    },
    updateChordType(state, action) {
      let selectedNote = action.payload.note;
      let selectedType = action.payload.type;
      state.selectedNote = selectedNote;
      state.selectedType = selectedType;

      let selectedNoteVal = noteValues[selectedNote];
      let diffs = chordDiffs[selectedType];

      let chordValues = [selectedNote.toLowerCase()];
      let val = selectedNoteVal;
      for (let diff of diffs) {
        val = (val + diff) % 12;
        chordValues.push(
          Object.keys(noteValues)
            .find((key) => noteValues[key] == val)
            .toLowerCase()
        );
      }
      let results = getChordArrangements(state.board, chordValues);
      state.chordArrangements = results;
      updateBoardChord(state.board, state.chordArrangements, 0);
    },
  },
});

export const getBoard = createSelector(
  [(state) => state.selectedNote, (state) => state.selectedType],
  (selectedNote, selectedType) => {}
);

export default guitarSlice.reducer;
export const guitarActions = guitarSlice.actions;
