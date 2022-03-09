import Board from './frets/Board';
import ChordSelector from './ChordSelector';
import { guitarActions } from '../../store/guitar'
import { useDispatch, useSelector } from "react-redux";

export default function Main() {
  const dispatch = useDispatch();
  const board = useSelector((state) => {
    return state.guitar.board;
  });

  function incArrIndex() {
    dispatch(guitarActions.incArrIndex());
  }

  function decArrIndex() {
    dispatch(guitarActions.decArrIndex());
  }


  return (
    <>
      <ChordSelector />
      <button type="button" onClick={decArrIndex}>prev</button>
      <button type="button" onClick={incArrIndex}>next</button>
      <Board board={board} />
    </>
  );
};