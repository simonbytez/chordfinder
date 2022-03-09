import React, { useState, useEffect } from "react";
import * as Tone from "tone";

//The object passed to createContext is the default context that gets used
//when the context is not set by the context provider.
const ToneContext = React.createContext({
  bongoSampler: null,
    claveSampler: null,
    congaSampler: null,
    cowbellSampler: null,
    guiroSampler: null,
    timbaleSampler: null
});

export const ToneContextProvider = (props) => {
  const [bongoSampler, setBongoSampler] = useState();
  const [claveSampler, setClaveSampler] = useState();
  const [congaSampler, setCongaSampler] = useState();
  const [cowbellSampler, setCowbellSampler] = useState();
  const [guiroSampler, setGuiroSampler] = useState();
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

    new Tone.PolySynth().toDestination();
  }, []);

  return (
    <ToneContext.Provider
      value={{
        bongoSampler,
        claveSampler,
        congaSampler,
        cowbellSampler,
        guiroSampler,
        timbaleSampler
      }}
    >
      {props.children}
    </ToneContext.Provider>
  );
};

export default ToneContext;
