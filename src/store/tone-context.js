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
    const bassSampler = new Tone.Sampler({
      urls: {
        "C2": "C2.wav",
        "C#2": "Cs2.wav",
        "D2": "D2.wav",
        "D#2": "Ds2.wav",
        "E2": "E2.wav",
        "F2": "F2.wav",
        "F#2": "Fs2.wav",
        "G2": "G2.wav",
        "G#2": "Gs2.wav",
        "A2": "A2.wav",
        "A#2": "As2.wav",
        "B2": "B2.wav",
      },
      release: 1,
      baseUrl: `${origin}/samples/bass/`,
    }).toDestination();
    setBassSampler(bassSampler);
    
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
          A0: "A0.mp3",
          C1: "C1.mp3",
          "D#1": "Ds1.mp3",
          "F#1": "Fs1.mp3",
          A1: "A1.mp3",
          C2: "C2.mp3",
          "D#2": "Ds2.mp3",
          "F#2": "Fs2.mp3",
          A2: "A2.mp3",
          C3: "C3.mp3",
          "D#3": "Ds3.mp3",
          "F#3": "Fs3.mp3",
          A3: "A3.mp3",
          C4: "C4.mp3",
          "D#4": "Ds4.mp3",
          "F#4": "Fs4.mp3",
          A4: "A4.mp3",
          C5: "C5.mp3",
          "D#5": "Ds5.mp3",
          "F#5": "Fs5.mp3",
          A5: "A5.mp3",
          C6: "C6.mp3",
          "D#6": "Ds6.mp3",
          "F#6": "Fs6.mp3",
          A6: "A6.mp3",
          C7: "C7.mp3",
          "D#7": "Ds7.mp3",
          "F#7": "Fs7.mp3",
          A7: "A7.mp3",
          C8: "C8.mp3"
      },

      // Cela règle la durée de permanence des notes jouées
      release: 10,

      // Source locale des sons
      // baseUrl: "./audio/salamander/"

      baseUrl: "https://tonejs.github.io/audio/salamander/"
  }).toDestination();
    setPianoSampler(pianoSampler);

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
