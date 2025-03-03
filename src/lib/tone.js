import * as Tone from "tone";

let part = null;

let bassSampler = null;
let bongoSampler = null;
let claveSampler = null;
let congaSampler = null;
let cowbellSampler = null;
let guiroSampler = null;
let pianoSampler = null;
let timbaleSampler = null;

export function setSamplers(
  bassSamplerIn,
  bongoSamplerIn,
  claveSamplerIn,
  congaSamplerIn,
  cowbellSamplerIn,
  guiroSamplerIn,
  timbaleSamplerIn,
  pianoSamplerIn,
) {
  bassSampler = bassSamplerIn;
  bongoSampler = bongoSamplerIn;
  claveSampler = claveSamplerIn;
  congaSampler = congaSamplerIn;
  cowbellSampler = cowbellSamplerIn;
  guiroSampler = guiroSamplerIn;
  timbaleSampler = timbaleSamplerIn;
  pianoSampler = pianoSamplerIn;
}

export function updateTempo(tempo) {
  Tone.Transport.bpm.value = tempo / 2.0;
}

export function update(toneJsData) { 
  if (part) {
    part.dispose();
  }

  part = new Tone.Part((time, value) => {
    if (value) {
      let sampler = null;

      if (value.instrument === "bass") {
        sampler = bassSampler;
      } else if (value.instrument === "bongo") {
        sampler = bongoSampler;
      } else if (value.instrument === "clave") {
        sampler = claveSampler;
      } else if (value.instrument === "conga") {
        sampler = congaSampler;
      } else if (value.instrument === "cowbell") {
        sampler = cowbellSampler;
      } else if (value.instrument === "guiro") {
        sampler = guiroSampler;
      } else if (value.instrument === "timbale") {
        sampler = timbaleSampler;
      } else if(value.instrument === "piano") {
        sampler = pianoSampler;
      }
      
      if(sampler) {
        sampler.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity ?? 1.0
        );
      }  
    } else {
      //It's a rest
    }
  }, toneJsData.notes);
  part.loopStart = 0;
  part.loopEnd = toneJsData.notes.length;
  part.loop = true;

  part.start(0);
}

export async function start() {
  await Tone.start();
  Tone.Transport.start();
}

export async function stop() {
  Tone.Transport.stop();
}

export async function inc() {
  Tone.Transport.schedule((time) => {
    Tone.Transport.bpm.value = Tone.Transport.bpm.value + 0.5;
  }, "+4n");
}

export async function dec() {
  Tone.Transport.schedule((time) => {
    Tone.Transport.bpm.value = Tone.Transport.bpm.value - 0.5;
  }, "+4n");
}
