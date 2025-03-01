const React = require('react');
const Cell = require('./Cell');
import { NUM_ROWS, NUM_COLS } from '../lib/consts';

function GameBoard({
  board,
  onCellClick,
  isActive,
  selectedCell,
  detectionResults,
  currentPlayer,
  isMyTurn
}) {
  const displayBoard =
    +currentPlayer === 2
      ? board.slice().reverse().map(row => row.slice().reverse())
      : board;

  const detectionSet = new Set(detectionResults.map(d => `${d.x},${d.y}`));

  let elements = []
  for(let row of displayBoard) {
    
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {displayBoard.map((row, rowIndex) => <div key={rowIndex} style={{display: 'flex'}}>{
        row.map((cell, colIndex) => {
          let realY = rowIndex;
          let realX = colIndex;
          if (+currentPlayer === 2) {
            realY = NUM_ROWS - 1 - rowIndex;
            realX = NUM_COLS - 1 - colIndex;
          }
          const isInLOS = detectionSet.has(`${realX},${realY}`);
          const isSelected =
            selectedCell &&
            selectedCell.x === realX &&
            selectedCell.y === realY;

          return (
            <Cell
              key={`${realX}-${realY}`}
              eyeD={`${realX}-${realY}`}
              cell={cell}
              onClick={() => isActive && onCellClick(realX, realY)}
              isActive={isActive}
              isSelected={isSelected}
              isInLOS={isInLOS}
              isMyTurn={isMyTurn}
              currentPlayer={currentPlayer}
            />
          );
        })}</div>
      )}
    </div>
  );
}

module.exports = GameBoard;
