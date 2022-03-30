import Metronome from "./Metronome";
import ToneContext from "../../store/tone-context";
import { getToneJs, salsaActions } from "../../store/salsa";
import { FaPlay, FaStop } from "react-icons/fa";
import IconButton from "@mui/material/IconButton";
import { update as updateToneJs, setSamplers, toggleAccelerate } from "../../lib/tone";
import { useContext, useEffect } from "react";
import { connect, useSelector, useDispatch } from "react-redux";
import * as Tone from "tone";

export function TopToolbar(props) {
  const {
    bassSampler,
    bongoSampler,
    claveSampler,
    congaSampler,
    cowbellSampler,
    guiroSampler,
    timbaleSampler,
  } = useContext(ToneContext);

  const startStop = props.startStop;
  const isPlaying = props.isPlaying;
  const toneJs = props.toneJs;

  //Set the tonejs samplers, which come from ToneContext
  useEffect(() => {
    setSamplers(
      bassSampler,
      bongoSampler,
      claveSampler,
      congaSampler,
      cowbellSampler,
      guiroSampler,
      timbaleSampler
    );
  }, [
    bassSampler,
    bongoSampler,
    claveSampler,
    congaSampler,
    cowbellSampler,
    guiroSampler,
    timbaleSampler,
  ]);

  useEffect(() => {
    updateToneJs(toneJs);
  }, [toneJs]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center'
    }}>
      <IconButton color="inherit" aria-label="play" onClick={startStop}>
        {!isPlaying ? <FaPlay size={24} /> : <FaStop size={24} />}
      </IconButton>
      <Metronome />
      <button onClick={toggleAccelerate}>accelerate</button>
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    toneJs: getToneJs(state.salsa),
    isPlaying: state.salsa.isPlaying,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    startStop: () => dispatch(salsaActions.startStop()),
  };
};

const ConnectedTopToolbar = connect(
  mapStateToProps,
  mapDispatchToProps
)(TopToolbar);

export default ConnectedTopToolbar;
