const React = require('react');
const Cell = require('./Cell');

function GameBoard({
  board,
  onCellClick,
  isActive,
  selectedCell,
  detectionResults,
  currentPlayer,
  isMyTurn
}) {
  const size = board.length;
  const displayBoard =
    +currentPlayer === 2
      ? board.slice().reverse().map(row => row.slice().reverse())
      : board;

  const detectionSet = new Set(detectionResults.map(d => `${d.x},${d.y}`));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${size}, 45px)`,
      gap: 0,
    }}>
      {displayBoard.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          let realY = rowIndex;
          let realX = colIndex;
          if (+currentPlayer === 2) {
            realY = size - 1 - rowIndex;
            realX = size - 1 - colIndex;
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
        })
      )}
    </div>
  );
}

module.exports = GameBoard;
