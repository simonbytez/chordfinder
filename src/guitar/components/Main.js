import Board from './frets/Board';
import ChordSelector from './ChordSelector';
import ScaleSelector from './ScaleSelector';
import { guitarActions } from '../../store/guitar'
import { useDispatch, useSelector } from "react-redux";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import {useState} from 'react';

export default function Main() {
  const dispatch = useDispatch();
  const board = useSelector((state) => {
    return state.guitar.board;
  });

  function incArrIndex() {
    dispatch(guitarActions.incArrIndex());
  }

  function decArrIndex() {
    dispatch(guitarActions.decArrIndex());
  }

  function TabPanel(props) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box style={{paddingTop: 16}} p={0}>{children}</Box>
        )}
      </div>
    );
  }

  const [type, setType] = useState(0);

  const handleTypeChange = (event, newType) => {
    setType(newType);
  };

  return (
    <>
      <Tabs
        value={type}
        onChange={handleTypeChange}
      >
        <Tab
          label="chords"
        />
        <Tab
          label="scales"
        />
      </Tabs>
      <div id="composeButtonsTabPanel" style={{ margin: "auto" }}>
        <TabPanel value={type} index={0}>
          <ChordSelector />
          <button type="button" onClick={decArrIndex}>prev</button>
          <button type="button" onClick={incArrIndex}>next</button>
        </TabPanel>
        <TabPanel value={type} index={1}>
          <ScaleSelector />
        </TabPanel>
      </div>
      <Board board={board} />
    </>
  );
};