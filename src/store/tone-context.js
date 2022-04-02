import React, { useState, useEffect } from "react";
import * as Tone from "tone";

//The object passed to createContext is the default context that gets used
//when the context is not set by the context provider.
const ToneContext = React.createContext({
    bassSampler: null,
    bongoSampler: null,
    claveSampler: null,
    congaSampler: null,
    cowbellSampler: null,
    guiroSampler: null,
    pianoSampler: null,
    timbaleSampler: null
});

export const ToneContextProvider = (props) => {
  const [bassSampler, setBassSampler] = useState();
  const [bongoSampler, setBongoSampler] = useState();
  const [claveSampler, setClaveSampler] = useState();
  const [congaSampler, setCongaSampler] = useState();
  const [cowbellSampler, setCowbellSampler] = useState();
  const [guiroSampler, setGuiroSampler] = useState();
  const [pianoSampler, setPianoSampler] = useState();
  const [timbaleSampler, setTimbaleSampler] = useState();

  //This setup is done in useEffect because it cannot be done server side when the page is being built.
  //This is because Tone.js uses calls that are only available in the browser.
  useEffect(() => {
    const origin = window.location.origin;
    const bongoSampler = new Tone.Sampler({
      urls: {
        C5: "Bongo-low.wav",
        E5: "Bongo-high.wav",
      },
      release: 1,
      baseUrl: `${origin}/samples/bongo/`,
    }).toDestination();
    setBongoSampler(bongoSampler);

    const claveSampler = new Tone.Sampler({
      urls: {
        C5: "Clave.wav",
      },
      release: 1,
      baseUrl: `${origin}/samples/clave/`,
    }).toDestination();
    setClaveSampler(claveSampler);

    const congaSampler = new Tone.Sampler({
      urls: {
        C5: "conga-low.wav",
        E5: "conga-high.wav"
      },
      release: 1,
      baseUrl: `${origin}/samples/conga/`,
    }).toDestination();
    setCongaSampler(congaSampler);

    const cowbellSampler = new Tone.Sampler({
      urls: {
        C5: "Cowbell.wav"
      },
      release: 1,
      baseUrl: `${origin}/samples/cowbell/`,
    }).toDestination();
    setCowbellSampler(cowbellSampler);

    const guiroSampler = new Tone.Sampler({
      urls: {
        C5: "guiro.wav",
      },
      release: 1,
      baseUrl: `${origin}/samples/guiro/`,
    }).toDestination();
    setGuiroSampler(guiroSampler);

    const timbaleSampler = new Tone.Sampler({
      urls: {
        C5: "Timbale-shell.wav",
      },
      release: 1,
      baseUrl: `${origin}/samples/timbale/`,
    }).toDestination();
    setTimbaleSampler(timbaleSampler);

    const pianoSampler = new Tone.Sampler({
      urls: {
        'C4': "C4.mp3",
        'C#4': "Cs4.mp3",
        'D4': "D4.mp3",
        'D#4': "Ds4.mp3",
        'E4': "E4.mp3",
        'F4': "F4.mp3",
        'F#4': "Fs4.mp3",
        'G4': "G4.mp3",
        'G#4': "Gs4.mp3",
        'A4': "A4.mp3",
        'A#4': "As4.mp3",
        'B4': "B4.mp3",
      },
      release: 1,
      baseUrl: `${origin}/samples/piano/`,
    }).toDestination();
    setPianoSampler(pianoSampler);

    const bassSampler = new Tone.Sampler({
      urls: {
        "C4": "C4.wav",
        "C#4": "Cs4.wav",
        "D4": "D4.wav",
        "D#4": "Ds4.wav",
        "E4": "E4.wav",
        "F4": "F4.wav",
        "F#4": "Fs4.wav",
        "G4": "G4.wav",
        "G#4": "Gs4.wav",
        "A4": "A4.wav",
        "A#4": "As4.wav",
        "B4": "B4.wav",
      },
      release: 1,
      baseUrl: `${origin}/samples/bass/`,
    }).toDestination();
    setBassSampler(bassSampler);

    new Tone.PolySynth().toDestination();
  }, []);

  return (
    <ToneContext.Provider
      value={{
        bassSampler,
        bongoSampler,
        claveSampler,
        congaSampler,
        cowbellSampler,
        guiroSampler,
        timbaleSampler,
        pianoSampler
      }}
    >
      {props.children}
    </ToneContext.Provider>
  );
};

export default ToneContext;
