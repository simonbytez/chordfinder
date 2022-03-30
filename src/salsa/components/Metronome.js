import { useState } from "react";
import Grid from "@mui/material/Grid";
import Slider from "@mui/material/Slider";
import Input from "@mui/material/Input";
import { salsaActions } from "../../store/salsa";
import { useDispatch, useSelector } from "react-redux";

export default function Metronome(props) {
  const dispatch = useDispatch();
  const tempo = useSelector((state) => state.salsa.tempo);
  const [value, setValue] = useState(tempo * 2);

  const handleSliderChange = (_, newValue) => {
    setValue(newValue);
    dispatch(salsaActions.updateTempo(newValue / 2.0));
  };

  const handleInputChange = (event) => {
    const newValue = Number(event.target.value);
    setValue(event.target.value === "" ? "" : newValue);
    dispatch(salsaActions.updateTempo(newValue / 2.0));
  };

  function getValidValue(valueIn) {
    if (valueIn < 1) {
      return 1;
    } else if (valueIn > 999) {
      return 999;
    } else {
      return valueIn;
    }
  }

  const handleBlur = () => {
    const validValue = getValidValue(value);
    setValue(validValue);
  };

  return (
      <div>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Slider
              sx={{ width: 150 }}
              value={typeof value === "number" ? value : 0}
              onChange={handleSliderChange}
              min={100}
              max={300}
              default={tempo}
              aria-labelledby="input-slider"
            />
          </Grid>
          <Grid item>
            <Input
              value={value}
              margin="dense"
              onChange={handleInputChange}
              onBlur={handleBlur}
              inputProps={{
                step: 1,
                min: 40,
                max: 250,
                type: "number",
                "aria-labelledby": "input-slider",
                pattern: "\\d*",
              }}
            />
          </Grid>
        </Grid>
      </div>
  );
}
