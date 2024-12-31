import ToneContext from "../../store/tone-context";
import { useContext, useEffect, useState } from "react";
import { update as updateToneJs, setSamplers, doIt, 
         inc, dec, start as startToneJs, stop as stopToneJs } from "../../lib/tone";

const STARTING_MIDI = 24;

function getNote(midi) {
  let r = ((midi - STARTING_MIDI) % 12);
  let octave = Math.floor((midi - STARTING_MIDI) / 12) + 1;
  let note = '';

  if(r == 0) {
    note = 'C';
  } else if(r == 1) {
    note = 'C#';
  } else if(r == 2) {
    note = 'D';
  } else if(r == 3) {
    note = 'D#';
  } else if(r == 4) {
    note = 'E';
  } else if(r == 5) {
    note = 'F';
  } else if(r == 6) {
    note = 'F#';
  } else if(r == 7) {
    note = 'G';
  } else if(r == 8) {
    note = 'G#';
  } else if(r == 9) {
    note = 'A';
  } else if(r == 10) {
    note = 'A#';
  } else if(r == 11) {
    note = 'B';
  }

  return `${note}${octave}`;
}

export default function Main() {
  const {
    bassSampler,
    bongoSampler,
    claveSampler,
    congaSampler,
    cowbellSampler,
    guiroSampler,
    pianoSampler,
    timbaleSampler,
  } = useContext(ToneContext);

  const [hover, setHover] = useState(0);
  const [ascend, setAscend] = useState(0);
  const [playbackNotes, setPlaybackNotes] = useState([]);

  function play() { 
    
  //{instrument: 'piano', note, duration: 16, time: playbackNotes.length}
    let notes = [];
    let secs = 0;
    playbackNotes.forEach(note => {
      notes.push({instrument: 'piano', note: note.note, duration: 16, time: secs});
      secs++;
    })

    for(let i = 1; i <= ascend; i++) {
      playbackNotes.forEach(({midi}) => {
        notes.push({instrument: 'piano', note: getNote(midi + i), duration: 16, time: secs});
        secs++;
      })
    }

    for(let i = ascend - 1; i >= 0; i--) {
      playbackNotes.forEach(({midi}) => {
        notes.push({instrument: 'piano', note: getNote(midi + i), duration: 16, time: secs});
        secs++;
      })
    }

    console.log(`playing: ${JSON.stringify(playbackNotes)}`);
    updateToneJs({notes})
    startToneJs();
  }

  async function addKey(midi) {
    pianoSampler.triggerAttack(getNote(midi));
    setPlaybackNotes([
      ...playbackNotes,
      {midi, note: getNote(midi)}
     ])
  }

  function deleteKey(index) {
    let newState = [...playbackNotes];
    newState.splice(index, 1);
    setPlaybackNotes(newState);
  }

  let numWhiteKeys = 0, numBlackKeys = 0;
  let keyLis = [];
  for(let i = STARTING_MIDI; i <= 108; i++) {
    let r = ((i - STARTING_MIDI) % 12);
    let octave = Math.floor((i - STARTING_MIDI) / 12) + 1;
    let key = null, left = 0, top = 0, width = 0, height = 0,
        WHITE_WIDTH = 20, BLACK_WIDTH = 10, WHITE_HEIGHT = 80, BLACK_HEIGHT = (2 * WHITE_HEIGHT) / 3,
        background = undefined;

    if([0, 2, 4, 5, 7, 9, 11].includes(r)) {
      key = "white";
      numWhiteKeys++;
      left = numWhiteKeys * WHITE_WIDTH;
      width = WHITE_WIDTH;
      height = WHITE_HEIGHT;
    } else {
      key = "black";
      numBlackKeys++;
      background = 'black';
      width = BLACK_WIDTH; 
      height = BLACK_HEIGHT;
      left = (numWhiteKeys * WHITE_WIDTH) + (WHITE_WIDTH - (BLACK_WIDTH / 2));
    }
    
    keyLis.push(<div i={i} key={key} onClick={addKey.bind(null, i)} style={{
      position: 'absolute',
      width, height, left, top,
      zIndex: key == 'black' ? 1 : 0,
      border: '1px solid black',
      background: hover == i ? '#cdcdcd' : background,
    }} onMouseEnter={setHover.bind(null, i)} onMouseLeave={setHover.bind(null, 0)} className={key} octave={octave} />);
  }

//Set the tonejs samplers, which come from ToneContext
useEffect(() => {
  setSamplers(
    bassSampler,
    bongoSampler,
    claveSampler,
    congaSampler,
    cowbellSampler,
    guiroSampler,
    timbaleSampler,
    pianoSampler
  );
}, [
  bassSampler,
    bongoSampler,
    claveSampler,
    congaSampler,
    cowbellSampler,
    guiroSampler,
    timbaleSampler,
    pianoSampler
]);

return <>
  <div>
  {keyLis}
  <div style={{margin: 'auto',
    marginTop: '100px',
    textAlign: 'center',
    border: '1px solid black',
    width: '50px',
    padding: '6px'}} onClick={play}>play</div>
  </div>
  <div style={{textAlign: 'center'}}>ascend: <input type="number" onInput = { e => { 
    let value = e.target.value ? +e.target.value : 0;  
       setAscend(value)
    }} value={ascend} /></div>
  <br/>
  
  {playbackNotes.map((note, index) => <div key={Math.random().toString()} style={{textAlign: 'center', marginTop: 6}}><span style={{textAlign: 'center'}} 
                                  key={Math.random().toString()}>{note.note}
                              </span>
                              <button style={{marginLeft: 6}} onClick={deleteKey.bind(null, index)}>x</button><br/>
                              </div>)}
  
</>
}