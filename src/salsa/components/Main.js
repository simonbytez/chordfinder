import Header from './Header';
import Instruments from './Instruments';
import { accelerate, inc, updateTempo } from '../../lib/tone';
import { useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";

export default function Main() {
  const tempo = useSelector(state => state.salsa.tempo);
  useEffect(() => {
    updateTempo(tempo);
  }, [tempo]);
  const acc = () => {
    accelerate();
  }
  return <> 
    <Header />
    <br />
    <Instruments />
  </>
}