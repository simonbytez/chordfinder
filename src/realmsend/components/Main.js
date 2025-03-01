/*******************************************************
 * App.js
 *
 * Key changes for uncertain/certain intel:
 * - Scanner logs not just cat: 'people' but also count: N.
 * - If certain intel is found (by direct LoS or capturing),
 *   we decrement the uncertain count in that cell (if any).
 * - We do shallow cloning instead of structuredClone.
 *******************************************************/
const React = require('react');
import Piece from '../lib/piece';
import abbrs, {typeCategory, NUM_ROWS, NUM_COLS} from '../lib/consts';
import { current } from '@reduxjs/toolkit';
import { DevicesFold } from '@mui/icons-material';
import { useEffect } from 'react';

const { useState } = React;

const GameBoard = require('./GameBoard');
const ControlPanel = require('./ControlPanel');
const MovementPanel = require('./MovementPanel');
const IntelLogPanel = require('./IntelLogPanel');

const PIECE_TYPES = ['wall', 'flag', 'brute', 'scout', 'jammer', 'listener', 'pawn'];

function rotateDirection(currentDir, side, player) {
  const dirs = ['north', 'east', 'south', 'west'];
  let idx = dirs.indexOf(currentDir);
  if (idx < 0) idx = 0;

  if (side === 'left') idx = (idx + dirs.length - 1) % dirs.length;
    else idx = (idx + 1) % dirs.length;
  
  return dirs[idx];
}

function resolveGlobalDirection(player, facing) {
  // If player=1, directions are normal; if player=2, invert them:
  switch (facing) {
    case 'north': return [0, -1];
    case 'south': return [0, 1];
    case 'east':  return [1, 0];
    case 'west':  return [-1, 0];
    default:      return [0, -1];
  }
}

let nextId = 1;
function genPieceId() {
  return nextId++;
}

/** Each board cell:
 * {
 *   pieces: [],
 *   listeningDevices: [],
 *   jammers: [],
 *   intel: {
 *     1: {},  // certain piece intel for player1
 *     2: {},  // certain piece intel for player2
 *   },
 * }
 */

/**
 * JARED_TOOD: gotta refactor this to be in the format of:
 * {
 *  1: {
 *    pieces: 
 *    listeningDevices:
 *    jammers:
 *    intel: {}
 *  }
 * }
 */
//JARED_TOOD: what happens when two players have listening devices in the same cell?
function createCell() {
  return {
    pieces: [],
    listeningDevice: {
      1: false,
      2: false
    },
    jammer: {
      1: false,
      2: false
    },
    intel: {
      1: {},
      2: {},
    },
  };
}

function initializeCounts() {
  return {
    player1: { wall: 0, flag: 0, brute: 0, scanner: 0, jail: 0, scout: 0, jammer: 0 },
    player2: { wall: 0, flag: 0, brute: 0, scanner: 0, jail: 0, scout: 0, jammer: 0 },
  };
}

function getLineOfSight(board, x, y, piece) {
  const [dx, dy] = resolveGlobalDirection(piece.player, piece.direction);
  const cx = x + dx, cy = y + dy;
  if (cx < 0 || cx >= NUM_COLS || cy < 0 || cy >= NUM_ROWS) return [];
  const cellPieces = board[cy][cx].pieces;
  const enemyHere = cellPieces.some(p => p.player !== piece.player);
  return [{ x: cx, y: cy, hasEnemy: enemyHere, distance: 1, isCertain: true }];
}

function App({playerNumber, 
              isMyTurn, 
              onSetupComplete, 
              onGameStateUpdate,
              gameState}) {
  const [board, setBoard] = useState(gameState.board);
  const [counts, setCounts] = useState(initializeCounts());
  const [currentPlayer, setCurrentPlayer] = useState(playerNumber);
  const [phase, setPhase] = useState(gameState.phase);

  useEffect(() => {
    setPhase(gameState.phase)
  }, [gameState.phase])

  useEffect(() => {
    setBoard(gameState.board)
  }, [gameState.board])

  const [selectedPieceType, setSelectedPieceType] = useState('wall');
  const [selectedCell, setSelectedCell] = useState(null);

  const [actionsRemaining, setActionsRemaining] = useState(2);
  const [jails, setJails] = useState({ player1: [], player2: [] });
  const [detectionResults, setDetectionResults] = useState([]);
  const [freeRotationUsed, setFreeRotationUsed] = useState(false);

  const [intelLogs, setIntelLogs] = useState({ 1: [], 2: [] });

  function logIntelForPlayer(player, message) {
    setIntelLogs(prev => {
      const updated = { ...prev };
      updated[player] = [...updated[player], message];
      return updated;
    });
  }

  function isJammed(board, x, y, player) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let col = 0; col < NUM_COLS; col++) {
        // If the opponent has a jammer at (col, row)...
        if (board[row][col].jammer[player]) {
          // Check if (x,y) is within 1 cell in both directions
          if (Math.abs(col - x) <= 1 && Math.abs(row - y) <= 1) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // =========================
  // PHASE & TURN MANAGEMENT
  // =========================

  function nextPhase() {
    if (phase === 'setup') {
      setActionsRemaining(2);
      setFreeRotationUsed(false);
      onSetupComplete(currentPlayer)
    }
  }

  function endTurn(newBoard) {
    // increment certain intel ages & uncertain scan report ages
    newBoard = incrementIntelAgesForPlayer(newBoard, currentPlayer);

    const finishing = currentPlayer;
    setIntelLogs(prev => ({
      ...prev,
      [finishing]: [], // clear logs for finishing player
    }));

    setActionsRemaining(2);
    setSelectedCell(null);
    setDetectionResults([]);
    setFreeRotationUsed(false);
    clearJammedIntel(newBoard, currentPlayer)
    // check listening devices
    checkListeningDevices(newBoard);
    onGameStateUpdate(newBoard, 3 - currentPlayer, 'movement')
  }

  function incrementIntelAgesForPlayer(oldBoard, player) {
    const newBoard = [...oldBoard];
    for (let y = 0; y < NUM_ROWS; y++) {
      newBoard[y] = [...newBoard[y]];
      for (let x = 0; x < NUM_COLS; x++) {
        const cellCopy = { ...newBoard[y][x] };
        const pIntel = { ...cellCopy.intel[player] };
        for (let key in pIntel) {
          const value = pIntel[key]
          if(value && value.age != null) {
            value.age++;
          }
        }
        newBoard[y][x] = cellCopy;
      }
    }
    return newBoard;
  }

  // =========================
  // BOARD CLICKS
  // =========================

  function handleCellClick(x, y) {
    if (phase === 'setup') {
      handleSetupClick(x, y);
    } else if (phase === 'movement') {
      handleMovementClick(x, y);
    }
  }

  // =========================
  // SETUP PHASE
  // =========================

  function handleSetupClick(x, y) {
    const newBoard = [...board];
    newBoard[y] = [...newBoard[y]];
    const cellCopy = { ...newBoard[y][x] };
    const pKey = `player${currentPlayer}`;
    const newCounts = { ...counts };
    const plyCount = { ...newCounts[pKey] };
    if((currentPlayer == 1 && y < 8) || (currentPlayer == 2 && y > 4)) {
      return
    } else if(cellCopy.pieces && cellCopy.pieces[0]) {
      if (cellCopy.pieces[0].type == selectedPieceType) {
        cellCopy.pieces = []
        plyCount[selectedPieceType] = (plyCount[selectedPieceType] || 0) - 1;
        newCounts[pKey] = plyCount;
        setCounts(newCounts)
        newBoard[y][x] = cellCopy;
        gameState.board = newBoard
      } 

      return
    }

    
    plyCount[selectedPieceType] = (plyCount[selectedPieceType] || 0) + 1;
    newCounts[pKey] = plyCount;

    const newPiece = new Piece(currentPlayer, selectedPieceType, currentPlayer == 1 ? 'north' : 'south');
    newPiece.id = genPieceId();
    if (selectedPieceType === 'listener') newPiece.deviceCount = 0;
    if (selectedPieceType === 'jammer') newPiece.jammerCount = 0;

    cellCopy.pieces = [...cellCopy.pieces, newPiece];
    newBoard[y][x] = cellCopy;

    gameState.board = newBoard
    setCounts(newCounts);
  }

  // =========================
  // MOVEMENT PHASE
  // =========================

  function handleMovementClick(x, y) {
    const cellPieces = board[y][x].pieces;
    let piece = cellPieces[0]
    if (!selectedCell) {
      // select a piece
      if (cellPieces.length > 0 && piece.player === currentPlayer) {
        if (piece.type === 'jail' || piece.type == 'wall') return;

        if (piece.type == 'scout') {
          setActionsRemaining(4);
        } else {
          setActionsRemaining(2);
        }

        if (piece.type === 'listener' && piece.deviceCount == null) {
          piece.deviceCount = 0;
        }
        if (piece.type === 'jammer' && piece.jammerCount == null) {
          piece.jammerCount = 0;
        }

        setSelectedCell({ x, y, piece });
        const los = getLineOfSight(board, x, y, piece)
        if(los.length) {
          const ex = los[0].x;
          const ey = los[0].y;
          const enemyPiece = board[ey][ex].pieces[0];
          if(enemyPiece && enemyPiece.player != currentPlayer)
            updateIntel(board, currentPlayer, ey, ex, enemyPiece, true);
          else {
            updateIntel(board, currentPlayer, ey, ex, false, true);
          }

          const listeningDevice = board[ey][ex].listeningDevice[3 - currentPlayer]
          const jammer = board[ey][ex].jammer[3 - currentPlayer]

          /**
           * these intel updates really need to be one call
           */
            // certain intel discovered

          updateListeningDeviceIntel(board, currentPlayer, ey, ex, listeningDevice, true)
          updateJammerIntel(board, currentPlayer, ey, ex, jammer, true)
        }  

        setDetectionResults(los);
      }
    } else {
      let selectedPiece = selectedCell.piece
      // move the selected piece
      if(!piece || (piece.type != 'wall' && selectedPiece.type != 'scout') || selectedPiece.type == 'brute') {
        movePiece(selectedCell.x, selectedCell.y, x, y);
      }
    }
  }

  function movePiece(fx, fy, tx, ty) {
    let newBoard = [...board];
    newBoard[fy] = [...newBoard[fy]];
    newBoard[ty] = [...newBoard[ty]];

    const fromCell = { ...newBoard[fy][fx] };
    const toCell = { ...newBoard[ty][tx] };

    fromCell.pieces = [...fromCell.pieces];
    toCell.pieces = [...toCell.pieces];

    if (fromCell.pieces.length === 0) return;
    const piece = fromCell.pieces[0];
    if (piece.player !== currentPlayer) return;

    const [vdx, vdy] = resolveGlobalDirection(piece.player, piece.direction);
    const dx = tx - fx, dy = ty - fy;
    if (dx !== vdx || dy !== vdy) return;

    // if not scout, capture
    const enemy = toCell.pieces.find(p => p.player !== currentPlayer);
    if (enemy) {
      toCell.pieces = toCell.pieces.filter(p => p !== enemy);
      capturePiece(enemy);
      removeIntel(newBoard, currentPlayer, enemy.id);
    }

    toCell.pieces.push(piece);
    fromCell.pieces.splice(0, 1);

    newBoard[fy][fx] = fromCell;
    newBoard[ty][tx] = toCell;

    setSelectedCell({ x: tx, y: ty, piece });

    // re-check LoS
    const los = getLineOfSight(newBoard, tx, ty, piece);
    if(los.length) {
      setDetectionResults(los);

      const ex = los[0].x;
      const ey = los[0].y;
      const enemyPiece = newBoard[ey][ex].pieces[0];
      const listeningDevice = newBoard[ey][ex].listeningDevice[3 - currentPlayer]
      const jammer = newBoard[ey][ex].jammer[3 - currentPlayer]

    /**
     * these intel updates really need to be one call
     */
      // certain intel discovered

    //JARED_TODO: Do I need to say when something has been jammed?
      if(enemyPiece && enemyPiece.player != currentPlayer)
        updateIntel(newBoard, currentPlayer, ey, ex, enemyPiece, true);

      updateListeningDeviceIntel(newBoard, currentPlayer, ey, ex, listeningDevice, true)
      updateJammerIntel(newBoard, currentPlayer, ey, ex, jammer, true)
    }
      
    gameState.board = newBoard

    setActionsRemaining(prev => {
      const next = prev - 1;
      if (next <= 0) {
        endTurn(newBoard);
        return next;
      }
      return next;
    });
  }

  // =========================
  // CAPTURE & INTEL
  // =========================

  function capturePiece(enemyPiece) {
    const yourKey = `player${currentPlayer}`;
    const newJails = { ...jails };
    const arr = [...newJails[yourKey], enemyPiece];
    newJails[yourKey] = arr;
    setJails(newJails);
  }

  function updateJammedIntel(board, player, y, x) {
    board[y][x].intel[player].jammed = true
  }

  function clearJammedIntel(board, player) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let col = 0; col < NUM_COLS; col++) {
        delete board[row][col].intel[player].jammed
      }
    }
  }

  function updateIntel(board, player, cy, cx, piece, certain, age) {
    const pieceId = piece && piece.id;

    // Add the intel if you are certain of the piece OR
    // if uncertain and there's no certain intel about it elsewhere.

    if(pieceId) {
      board[cy][cx].intel[player][pieceId] = {
        piece,
        age: age || 0,
        certain,
      };

      if(certain) {
        //delete the uncertain intel
        delete board[cy][cx].intel[player][-1]
      }
    } else {
      //No pieces, delete prior intel
      const intel = board[cy][cx].intel[player]
      for(let i in intel) {
        if(+i) {
          delete board[cy][cx].intel[player][i]
        }
      }
    }
  }

  function wallIntel(board, player, y, x) {
    board[y][x].intel[player].wall = true
  }

  function updateJammerIntel(board, player, y, x, jammer, certain) {
    if(jammer) {
      board[y][x].intel[player].jammer = {
        certain, 
        age: 0
      }
    } else {
      board[y][x].intel[player].jammer = false
    }
  }

  function updateListeningDeviceIntel(board, player, y, x, listeningDevice, certain) {
    if(listeningDevice) {
      board[y][x].intel[player].listeningDevice = {
        certain, 
        age: 0
      }
    } else {
      board[y][x].intel[player].listeningDevice = false
    }
  }

  /** Remove certain intel references about an enemy piece ID. */
  function removeIntel(boardRef, player, id) {
    for (let y = 0; y < NUM_ROWS; y++) {
      for (let x = 0; x < NUM_COLS; x++) {
        let cell = boardRef[y][x]
        if (cell.intel[player][id]) {
          delete cell.intel[player][id];
        }
      }
    }
  }

  //JARED_TODO: Need to orient the scanner intel in the direction that it was taken.

  //JARED_TODO: this shouldn't activate if jammed. 
  //Rather, notify user of intel that didn't generate when it's their turn.

  //JARED_TODO: this is highly inefficient.
  function checkListeningDevices(b) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let col = 0; col < NUM_COLS; col++) {
        const c = b[row][col];
        if (c.listeningDevice[3 - currentPlayer]) {
            let coverage = getListener3x3(col, row)
            for(let cov of coverage) {
              let piece = b[cov.y][cov.x].pieces[0]
              if(isJammed(b, cov.x, cov.y, currentPlayer)) {
                //updateJammedIntel(b, 3 - currentPlayer, cov.y, cov.x)
              } else if (piece && piece.player == currentPlayer) {
                updateIntel(b, 3 - currentPlayer, cov.y, cov.x, piece, true);
                logIntelForPlayer(3 - currentPlayer, 
                  `Your listening device detected an enemy ${piece.type} at (${cov.x}, ${cov.y}).`
                );
              }
            }   
        }
      }
    }
  }

  // =========================
  // LISTENING & JAM DEVICES
  // =========================

  function handlePlantDevice() {
    if (!selectedCell) return;
    const { x, y, piece } = selectedCell;
    if (piece.type !== 'listener') return;
    if (actionsRemaining <= 0) return;

    if (piece.deviceCount == null) piece.deviceCount = 0;
    if (piece.deviceCount >= 3) {
      alert('Max 3 devices placed.');
      return;
    }

    const newBoard = [...board];
    newBoard[y] = [...newBoard[y]];
    const cellCopy = { ...newBoard[y][x] };

    cellCopy.listeningDevice[currentPlayer] = true
    newBoard[y][x] = cellCopy;

    piece.deviceCount++;

    gameState.board = newBoard
    setSelectedCell({ x, y, piece });

    setActionsRemaining(prev => {
      const next = prev - 1;
      if (next <= 0) {
        endTurn(newBoard);
        return next;
      }
      return next;
    });
  }

  function getListener3x3(x, y) {
    let squares = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = x + dx, cy = y + dy;
        if (cx >= 0 && cx < NUM_ROWS && cy >= 0 && cy < NUM_COLS) {
          squares.push({ x: cx, y: cy });
        }
      }
    }
    return squares;
  }

  function getScanner3x3(x, y, direction) {
    const squares = [];

    let xRange, yRange

    let player1 = currentPlayer == 1

    if(direction == 'north') {
      xRange = [-1, 1]
      yRange = [-2, -1]
    } else if(direction == 'east') {
      xRange = [1, 2]
      yRange = [-1, 1]
    } else if(direction == 'south') {
      xRange = [-1, 1]
      yRange = [1, 2]
    } else if(direction == 'west') {
      xRange = [-1, -2]
      yRange = [-1, 1]
    }

    for (let dx = xRange[0]; dx <= xRange[1]; dx++) {
      for (let dy = yRange[0]; dy <= yRange[1]; dy++) {
        const cx = x + dx, cy = y + dy;
        if (cx >= 0 && cx < NUM_ROWS && cy >= 0 && cy < NUM_COLS) {
          squares.push({ x: cx, y: cy });
        }
      }
    }
    return squares;
  }

  function handlePlantJammer() {
    if (!selectedCell) return;
    const { x, y, piece } = selectedCell;
    if (piece.type !== 'jammer') return;
    if (actionsRemaining <= 0) return;

    if (piece.jammerCount == null) piece.jammerCount = 0;
    if (piece.jammerCount >= 3) {
      alert('Max 3 jam devices placed.');
      return;
    }

    const newBoard = [...board];
    newBoard[y] = [...newBoard[y]];
    const cellCopy = { ...newBoard[y][x] };
    cellCopy.jammer[currentPlayer] = true
    newBoard[y][x] = cellCopy;

    gameState.board = board

    setSelectedCell({ x, y, piece });

    setActionsRemaining(prev => {
      const next = prev - 1;
      if (next <= 0) {
        endTurn(newBoard);
        return next;
      }
      return next;
    });
  }

  // =========================
  // SCANNER
  // =========================

  function handleScannerChoice(choice) {
    if (!selectedCell) return;
    const { x, y, piece } = selectedCell;
    if (piece.type !== 'scanner') return;

    const newBoard = [...board];
    const squares = getScanner3x3(x, y, piece.direction);
    squares.forEach(({ x: sx, y: sy }) => {
      //JARED_TODO: I think I should say portions of the scan were jammed. Or should I?
      if (isJammed(board, sx, sy, 3 - currentPlayer)) {
        updateJammedIntel(board, currentPlayer, sy, sx)
        return
      }
      if (sx === x && sy === y) return;
      
      const c = newBoard[sy][sx];
       // skip scanner's own cell
      if(choice == 'devices') {
        //It shouldn't ever pick up on the jammer cause it will be jammed in the code above it. 
        //So, I do believe this code won't be hit. But, I'm not worrying about changing it now.
          updateJammerIntel(newBoard, currentPlayer, sy, sx, c.jammer[3 - currentPlayer], true)
          updateListeningDeviceIntel(newBoard, currentPlayer, sy, sx, c.listeningDevice[3 - currentPlayer], true)
      } else {
        const enemy = newBoard[sy][sx].pieces.find(
          p => p.player != currentPlayer && typeCategory(p.type) == choice
        );

        updateIntel(newBoard, currentPlayer, sy, sx, enemy || false, true)
      } /*else if(choice == 'walls') {
        const wall = newBoard[sy][sx].pieces.find(
          p => p.player !== currentPlayer && p.category == 'wall'
        );
        
        if(wall) {
          wallIntel(newBoard, currentPlayer, sy, sx, wall, true)
        }
      }*/
    });

    gameState.board = board

    updateIntel(newBoard, 3 - currentPlayer, y, x, piece, true)

    setActionsRemaining(prev => {
      const next = prev - 1;
      if (next <= 0) endTurn(newBoard);
      return next;
    });
  }

  // =========================
  // ROTATION
  // =========================

  function handleRotate(side) {
    if (!selectedCell) return;
    const newBoard = [...board];
    newBoard[selectedCell.y] = [...newBoard[selectedCell.y]];
    const cellCopy = { ...newBoard[selectedCell.y][selectedCell.x] };

    cellCopy.pieces = [...cellCopy.pieces];
    const piece = cellCopy.pieces[0];

    piece.direction = rotateDirection(piece.direction, side, currentPlayer);

    newBoard[selectedCell.y][selectedCell.x] = cellCopy;
    gameState.board = board
    setSelectedCell({ x: selectedCell.x, y: selectedCell.y, piece });

    // re-check LoS
    const los = getLineOfSight(newBoard, selectedCell.x, selectedCell.y, piece);
    if(los.length) {
      setDetectionResults(los);
      const ex = los[0].x;
      const ey = los[0].y;
      const enemyPiece = newBoard[ey][ex].pieces[0];
      const listeningDevice = newBoard[ey][ex].listeningDevice[3 - currentPlayer]
      const jammer = newBoard[ey][ex].jammer[3 - currentPlayer]
  
      /**
       * these intel updates really need to be one call
       */
        // certain intel discovered
      if(enemyPiece && enemyPiece.player != currentPlayer) {
        updateIntel(newBoard, currentPlayer, ey, ex, enemyPiece, true);
        // if(enemyPiece.category == 'wall') {
        //   wallIntel(newBoard, currentPlayer, ey, ex)
        // }
      } else {
        updateIntel(board, currentPlayer, ey, ex, false, true);
      }
      updateListeningDeviceIntel(newBoard, currentPlayer, ey, ex, listeningDevice, true)
      updateJammerIntel(newBoard, currentPlayer, ey, ex, jammer, true)
    }

    if (!freeRotationUsed) {
      setFreeRotationUsed(true);
    } else {
      setActionsRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) {
          endTurn(newBoard);
          return next;
        }
        return next;
      });
    }
  }

  // =========================
  // RENDER
  // =========================

  let title = null
  if(phase === 'setup') {
    if(isMyTurn) {
      title = 'Setup (bottom five rows)'
    } else {
      title = `Waiting on other player set up`
    }
  } else if(!isMyTurn) {
    title = 'Waiting on other player'
  } else {
    title = 'Your turn!'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{fontSize: '24px'}}>{title}</div>
      <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
        {(phase == 'movement' || isMyTurn) && <GameBoard
          board={board}
          onCellClick={handleCellClick}
          isActive={phase === 'setup' || phase === 'movement'}
          selectedCell={selectedCell}
          isMyTurn={isMyTurn}
          detectionResults={detectionResults}
          currentPlayer={currentPlayer}
        />}
        {phase === 'movement' && isMyTurn && (
          <MovementPanel
            player={currentPlayer}
            selectedCell={selectedCell}
            actionsRemaining={actionsRemaining}
            onEndTurn={endTurn.bind(this, board)}
            onScannerChoice={handleScannerChoice}
            detectionResults={detectionResults}
            onRotateLeft={() => handleRotate('left')}
            onRotateRight={() => handleRotate('right')}
            jails={jails}
            onPlantDevice={handlePlantDevice}
            onPlantJammer={handlePlantJammer}
          />
        )}
      </div>
      {phase === 'setup' && isMyTurn && (
        <ControlPanel
          pieces={PIECE_TYPES}
          selectedPiece={selectedPieceType}
          onSelectPiece={setSelectedPieceType}
          onComplete={nextPhase}
          counts={counts[`player${currentPlayer}`]}
        />
      )}
    </div>
  );
}

module.exports = App;
