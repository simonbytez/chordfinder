import { guitarActions } from '../../store/guitar';
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from 'react';

export default function ScaleSelector() {
  let dispatch = useDispatch();
  const selectedRoot = useSelector(
    (state) => state.guitar.selectedRoot
  );
  const selectedScale = useSelector(
    (state) => state.guitar.selectedScale
  );

//   useEffect(() => {
//     dispatch(guitarActions.updateScale({root: "C", scale: "major"}));
//   }, [dispatch])

  function changeRoot(event) {
    dispatch(guitarActions.updateScale({root: event.target.value, scale: selectedScale}));
  }

  function changeScale(event) {
    dispatch(guitarActions.updateScale({root: selectedRoot, scale: event.target.value}));
  }

  return (
      <>
        <select id="scale-selector-root" onChange={changeRoot} value={selectedRoot}>
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

        <select id="scale-selector-type" onChange={changeScale} value={selectedScale}>
            <option value="major">major</option>
            <option value="minor">minor</option>
        </select>
    </>
  );
};