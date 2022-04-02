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
    <Instruments />
    <div style={{textAlign: 'center', margin: 8}}>Turn off silent mode.</div>
    <div style={{textAlign: 'center', margin: 8}}>Tap the instruments to mute/play.</div>
  </>
}