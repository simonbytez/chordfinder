import Metronome from "./Metronome";
import ToneContext from "../../store/tone-context";
import { getToneJs, salsaActions } from "../../store/salsa";
import { FaPlay, FaStop } from "react-icons/fa";
import IconButton from "@mui/material/IconButton";
import { update as updateToneJs, setSamplers, inc, dec } from "../../lib/tone";
import { useContext, useEffect } from "react";
import { connect, useSelector, useDispatch } from "react-redux";

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
  const isAccelerating = props.isAccelerating;
  const dispatch = useDispatch();

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

  function toggleAccelerate() {
    if(props.isAccelerating) {
      dispatch(salsaActions.stopAccelerate());
    } else {
      const interval = setInterval(() => {
        dispatch(salsaActions.increaseTempo());
      }, 7000);
  
      dispatch(salsaActions.startAccelerate(interval));
    } 
  }

  return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex'}}>
          <div style={{marginRight: 8}}>
            <IconButton color="inherit" aria-label="play" onClick={startStop}>
              {!isPlaying ? <FaPlay size={24} /> : <FaStop size={24} />}
            </IconButton>
          </div>
          <Metronome />
        </div>
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 15}}>
          <button style={{height: 34}} onClick={toggleAccelerate}>{props.isAccelerating ? 'stop accelerating' : 'accelerate'}</button>
          <button style={{height: 34, marginLeft: 8}} onClick={() => dispatch(salsaActions.decreaseTempo())}>tempo -</button>
          <button style={{height: 34, marginLeft: 8}} onClick={() => dispatch(salsaActions.increaseTempo())}>tempo +</button>
        </div>
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    toneJs: getToneJs(state.salsa),
    isPlaying: state.salsa.isPlaying,
    isAccelerating: state.salsa.isAccelerating
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
