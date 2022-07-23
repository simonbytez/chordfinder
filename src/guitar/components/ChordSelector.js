import { guitarActions } from '../../store/guitar';
import { useDispatch, useSelector } from "react-redux";

export default function Main() {
  let dispatch = useDispatch();
  const selectedNote = useSelector(
    (state) => state.guitar.selectedNote
  );
  const selectedType = useSelector(
    (state) => state.guitar.selectedType
  );

  function changeNote(event) {
    dispatch(guitarActions.updateChordType({note: event.target.value, type: selectedType}));
  }

  function changeType(event) {
    dispatch(guitarActions.updateChordType({note: selectedNote, type: event.target.value}));
  }

  return (
      <>
        <select id="chord-selector-root" onChange={changeNote} value={selectedNote}>
            <option value="C">C</option>
            <option value="C#">C#</option>
            <option value="D">D</option>
            <option value="D#">D#</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="F#">F#</option>
            <option value="G">G</option>
            <option value="G#">G#</option>
            <option value="A">A</option>
            <option value="A#">A#</option>
            <option value="B">B</option>
        </select>

        <select id="chord-selector-type" onChange={changeType} value={selectedType}>
            <option value="major">major</option>
            <option value="major6">major6</option>
            <option value="major7">major7</option>
            <option value="major9">major9</option>
            <option value="major11">major11</option>
            <option value="minor">minor</option>
            <option value="minor6">minor6</option>
            <option value="minor7">minor7</option>
            <option value="minor9">minor9</option>
            <option value="minor11">minor11</option>
            <option value="2">2</option>
            <option value="7">7</option>
            <option value="9">9</option>
            <option value="11">11</option>
            <option value="sus">sus</option>
        </select>
    </>
  );
};