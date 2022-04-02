import Header from './Header';
import Instruments from './Instruments';
import { updateTempo } from '../../lib/tone';
import { useEffect } from 'react';
import { useSelector } from "react-redux";

export default function Main() {
  const tempo = useSelector(state => state.salsa.tempo);
  useEffect(() => {
    updateTempo(tempo);
  }, [tempo]);
  
  return <> 
    <Header />
    <br />
    <Instruments />
  </>
}