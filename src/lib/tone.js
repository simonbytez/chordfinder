import * as Tone from "tone";

let part = null;

let bongoSampler = null;
let claveSampler = null;
let congaSampler = null;
let cowbellSampler = null;
let guiroSampler = null;
let timbaleSampler = null;

let accelerateLoop = null;

export function setSamplers(
  bongoSamplerIn,
  claveSamplerIn,
  congaSamplerIn,
  cowbellSamplerIn,
  guiroSamplerIn,
  timbaleSamplerIn
) {
  bongoSampler = bongoSamplerIn;
  claveSampler = claveSamplerIn;
  congaSampler = congaSamplerIn;
  cowbellSampler = cowbellSamplerIn;
  guiroSampler = guiroSamplerIn;
  timbaleSampler = timbaleSamplerIn;
}

export function update(toneJsData) {
  Tone.Transport.bpm.value = 70;
  if (part) {
    part.dispose();
  }

  part = new Tone.Part((time, value) => {
    if (value) {
      if (value.instrument === "bongo") {
        // the value is an object which contains both the note and the velocity
        bongoSampler.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity ?? 1.0
        );
      } else if (value.instrument === "clave") {
        // the value is an object which contains both the note and the velocity
        claveSampler.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity ?? 1.0
        );
      } else if (value.instrument === "conga") {
        congaSampler.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity ?? 1.0
        );
      } else if (value.instrument === "cowbell") {
        cowbellSampler.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity ?? 1.0
        );
      } else if (value.instrument === "guiro") {
        guiroSampler.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          value.velocity ?? 1.0
        );
      } else if (value.instrument === "timbale") {
        timbaleSampler.triggerAttackRelease(
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
  part.loopEnd = "1m";
  part.loop = true;

  part.start(0);
}

export async function start() {
  await Tone.start();
  Tone.Transport.start();
  accelerateLoop = window.setInterval(inc, 7000);
}

export async function stop() {
  Tone.Transport.stop();
  clearInterval(accelerateLoop);
}

export async function accelerate() {
  Tone.Transport.bpm.rampTo(120, 10);
}

export async function inc() {
  Tone.Transport.schedule((time) => {
    Tone.Transport.bpm.value = Tone.Transport.bpm.value + 1;
  }, "+4n");
}
