import Board from './frets/Board';
import ChordSelector from './ChordSelector';
import { appActions } from '../store/app'
import { useDispatch, useSelector } from "react-redux";

export default function Main() {
  const dispatch = useDispatch();
  const board = useSelector((state) => {
    return state.app.board;
  });

  function incArrIndex() {
    dispatch(appActions.incArrIndex());
  }

  function decArrIndex() {
    dispatch(appActions.decArrIndex());
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