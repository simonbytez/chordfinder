import { harpActions, categoryOptions, timingCategoryOptions, getPattern } from '../../store/harp'
import { connect, useSelector, useDispatch } from "react-redux";
import Chip from "@mui/material/Chip";
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from "@mui/material/Checkbox";
import Box, {BoxProps} from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import { useState } from 'react';

function Item(props) {
  const { sx, ...other } = props;
  return (
    <Box
      sx={{
        p: 1,
        m: 1,
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#101010' : 'grey.100'),
        color: (theme) => (theme.palette.mode === 'dark' ? 'grey.300' : 'grey.800'),
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300',
        borderRadius: 2,
        fontSize: '0.875rem',
        fontWeight: '700',
        ...sx,
      }}
      {...other}
    />
  );
}

function Main({ categoryOptions, timingCategoryOptions, getPattern }) {
  const dispatch = useDispatch();
  let categories = useSelector(state => state.harp.categories);
  let options = useSelector(state => state.harp.options);
  let timings = useSelector(state => state.harp.options);
  let [pattern, setPattern] = useState();
  let [editingOptions, setEditingOptions] = useState();
  let [newCategoryLeadFollow, setNewCategoryLeadFollow] = useState("L");
  let [newOptionCategory, setNewOptionCategory] = useState(Object.keys(categories)[0]);
  let [newOptionName, setNewOptionName] = useState("");
  let [newCategoryName, setNewCategoryName] = useState("");
  let [newTimingStart, setNewTimingStart] = useState(7);
  let [newTimingEnd, setNewTimingEnd] = useState(1);
  let [optionsExpanded, setOptionsExpanded] = useState(true);
  let tsExpanded = {}
  for(let timingId in timings) {
    tsExpanded[timingId] = true;
  }
  let [timingsExpanded, setTimingsExpanded] = useState(tsExpanded)

  let patternHtml = [];

  function toggleEnableOption(optionId) {
    dispatch(harpActions.toggleEnableOption(optionId));
  }

  function toggleCategoryEnabled(categoryId) {
    dispatch(harpActions.toggleCategoryEnabled(categoryId));
  }

  function toggleTimingCategoryEnabled(timingId, categoryId) {
    dispatch(harpActions.toggleTimingCategoryEnabled({timingId, categoryId}));
  }

  function toggleEnableTimingOption(timingId, categoryId, optionId) {
    dispatch(harpActions.toggleEnableTimingOption({timingId, categoryId, optionId}));
  }

  if(pattern) {
    for(let time of pattern) {
      let leadHtml = null, followHtml = null;
      let choices = time.choices;
      for(let type in choices) {
        let actions = choices[type];
        let actionsHtml = [];
        for(let categoryId in actions) {
          let {name: categoryName} = categories[categoryId];
          let optionId = actions[categoryId];
          let {name: optionName} = options[optionId];
          actionsHtml.push(<sup>{categoryName}<sub>{optionName}</sub></sup>);
        }

        if(type == 'F') {
          followHtml = <div style={{
            display: 'block',
            padding: '0 0.3em',
            borderBottom: '0.08em solid'
          }}>{actionsHtml ?? 'X'}</div>;
        } else {
          leadHtml = <div>{actionsHtml ?? 'X'}</div>;
        }
      }

      patternHtml.push({timing: <strong style={{marginLeft: 10}}>{time.start}-{time.end}</strong>, content: <Card style={{textAlign: 'center'}}><CardContent><span style={{
        display: 'inline-block',
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: 16
      }}>{followHtml}{leadHtml}</span></CardContent></Card>});
    }
  };
  let content = [];
  for(let categoryId in categoryOptions) {
    let c = [];
    let {name: categoryName, enabled: categoryEnabled, type} = categories[categoryId];

    if(editingOptions) {
      c.push(<IconButton onClick={dispatch.bind(null, harpActions.deleteCategory(categoryId))} aria-label="delete">
        <DeleteIcon />
      </IconButton>);
    }

    c.push(<div>{`${categoryName}(${type})`}</div>);
    c.push(<Checkbox checked={categoryEnabled} onClick={toggleCategoryEnabled.bind(null, categoryId)}/>);
    categoryOptions[categoryId].forEach(option => {
      let { enabled, optionId } = option;
      c.push(<Chip onDelete={editingOptions ? dispatch.bind(null, harpActions.deleteCategoryOption(optionId)) : undefined} disabled={!categoryEnabled} size="small" variant="contained" 
                   style={{margin: 8, opacity: enabled && categoryEnabled ? 1.0 : 0.5}} onClick={toggleEnableOption.bind(null, optionId)} label={options[optionId].name} />);
    });

    content.push(<div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 8, maxWidth: '100%', flexWrap: 'wrap'}}>{c}</div>)
  }

  let timingsHtml = [];
  
  for(let tco of timingCategoryOptions) {
    let summary = null;
    let details = [];
    summary = <AccordionSummary expandIcon={<ExpandMoreIcon />}><h3 style={{textAlign: 'center', marginBottom: 8, width: '100%'}}>Timing {tco.start}-{tco.end}</h3></AccordionSummary>;
    
    for(let categoryId in tco.options) {
      const {enabled: categoryEnabled, options: timingCategoryOptions} = tco.options[categoryId];
      let c = [];

      let categoryName = categories[categoryId].name;
      c.push(<Checkbox checked={categoryEnabled} onClick={toggleTimingCategoryEnabled.bind(null, tco.id, categoryId)}/>);
      c.push(<div>{`${categoryName}(${categories[categoryId].type})`}</div>);
      timingCategoryOptions.forEach(option => {
        let {optionId, enabled: optionEnabled} = option;
        c.push(<Chip disabled={!categoryEnabled} variant="contained" 
                     style={{marginLeft: 8, opacity: optionEnabled && categoryEnabled ? 1.0 : 0.5}} onClick={toggleEnableTimingOption.bind(null, tco.id, categoryId, optionId)} label={options[optionId].name} />);
      });

      details.push(<AccordionDetails><div style={{display: 'flex', justifyContent: 'left', marginBottom: 8, alignItems: 'center', maxWidth: '100%', flexWrap: 'wrap'}}>{c}</div></AccordionDetails>)
    }

    timingsHtml.push(<Accordion style={{marginBottom: 8}} 
                                expanded={timingsExpanded[tco.id]}
                                onChange={(event, expanded) => {
                                  setTimingsExpanded(state => ({...state, [tco.id]: expanded}))
                                }}>{summary}{details}</Accordion>)

  }

  let categoryMenuItems = [];
  for(let categoryId in categories) {
    categoryMenuItems.push(<MenuItem value={categoryId}>{`${categories[categoryId].name}(${categories[categoryId].type})`}</MenuItem>);
  }
  
  function onGetPattern() {
    setPattern(getPattern());
  }

  const showPatternHtml = patternHtml.length > 0;
  return (
    <>
    <button style={{display: 'flex', margin: 'auto', marginTop: 15, marginBottom: 15}} onClick={onGetPattern}>Get Pattern</button>
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 8}}>
      Add Timing
        <TextField 
          value={newTimingStart}
          onChange={event => setNewTimingStart(event.target.value)}
          type="number"
          sx={{width: 75, marginLeft: 1}}
          label="start"
        />
      <TextField 
        value={newTimingEnd}
        onChange={event => setNewTimingEnd(event.target.value)}
        type="number"
        sx={{width: 75, marginLeft: 1}}
        label="end"
      />
      <IconButton onClick={dispatch.bind(null, harpActions.addTiming({start: newTimingStart, end: newTimingEnd}))} aria-label="add option">
        <AddCircleOutlineIcon />
      </IconButton>
      </div>
    {showPatternHtml && 
    <>
      <br />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          p: 1,
          m: 1,
          bgcolor: 'background.paper',
          borderRadius: 1,
        }}
      >
        {patternHtml.map(p => <>{p.timing}<Item>{p.content}</Item></>)}
      </Box></>}
      
    <Accordion expanded={optionsExpanded}
                                onChange={(event, expanded) => {
                                  setOptionsExpanded(expanded)
                                }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <h2 style={{textAlign: 'center', width:'100%', marginBottom: 0, marginTop: 0}}>Options</h2>
      </AccordionSummary>
      <AccordionDetails>
      <button style={{display: 'flex', margin: 'auto', marginBottom: 8}} aria-label="edit" onClick={setEditingOptions.bind(null, !editingOptions)}>
        Edit
      </button>
      <><div style={{display: 'flex', justifyContent: 'center', flexDirection: 'column'}}>
      
        <div style={{display: 'flex', justifyContent: 'center'}}>
      <Select
          labelId="demo-simple-select-label"
          id="new-option-lead-follow-type"
          value={newCategoryLeadFollow}
          label="Lead/Follow"
          size="small"
          onChange={event => setNewCategoryLeadFollow(event.target.value)}
        >
          <MenuItem value="L">Lead</MenuItem>
          <MenuItem value="F">Follow</MenuItem>
        </Select>
        <TextField style={{marginLeft: 8}} size="small" value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} id="new-category" label="Category Name" variant="outlined" />
        <IconButton onClick={dispatch.bind(null, harpActions.addCategory({type: newCategoryLeadFollow, name: newCategoryName}))} aria-label="add category">
          <AddCircleOutlineIcon />
      </IconButton>
      </div>
      <div style={{display: 'flex', justifyContent: 'center', marginTop: 8}}>
      <Select
          labelId="demo-simple-select-label"
          id="new-option-lead-follow-type"
          value={newOptionCategory}
          size="small"
          onChange={event => setNewOptionCategory(event.target.value)}
        >
          {categoryMenuItems}
        </Select>
        <TextField style={{marginLeft: 8}} size="small" value={newOptionName} onChange={event => setNewOptionName(event.target.value)} id="new-option-name" label="Option Name" variant="outlined" />
        <IconButton onClick={dispatch.bind(null, harpActions.addCategoryOption({categoryId: newOptionCategory, name: newOptionName}))} aria-label="add option">
          <AddCircleOutlineIcon />
      </IconButton>
      </div>
      </div>
      <br/></>
      {content}
      </AccordionDetails>
      </Accordion> 
      
      {timingsHtml} 
    </>
  );
};

const mapStateToProps = (state) => {
  return {
    categoryOptions: categoryOptions(state.harp),
    timingCategoryOptions: timingCategoryOptions(state.harp),
    getPattern: getPattern.bind(null, state.harp)
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
  };
};

const ConnectedMain = connect(
  mapStateToProps,
  mapDispatchToProps
)(Main);

export default ConnectedMain;