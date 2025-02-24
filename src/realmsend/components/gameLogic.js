/**
 * If you still want the old "scanner detection" for certain choices ("wall"/"person"/"device"):
 * This is the previous code. 
 */
function getScannerDetection(board, choice) {
    const results = [];
    board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.pieces.some((p) => p.type === 'scanner')) {
          ['north', 'south', 'east', 'west'].forEach((dir) => {
            for (let d = 1; d <= 3; d++) {
              const squares = getConeSquares(x, y, dir, d);
              squares.forEach(([cx, cy]) => {
                if (
                  cx >= 0 &&
                  cx < board[0].length &&
                  cy >= 0 &&
                  cy < board.length
                ) {
                  const targetCell = board[cy][cx];
                  if (
                    (choice === 'wall' &&
                      targetCell.pieces.some((p) => p.type === 'wall')) ||
                    (choice === 'person' &&
                      targetCell.pieces.some(
                        (p) =>
                          p.type !== 'wall' && p.type !== 'scanner' && p.type !== 'jail'
                      )) ||
                    (choice === 'device' && targetCell.listeningDevice)
                  ) {
                    results.push({ x: cx, y: cy });
                  }
                }
              });
            }
          });
        }
      });
    });
    return results;
  }
  
  /**
   * Return squares in a "cone" pattern for distance=1..3:
   *  distance=1 => width=1
   *  distance=2 => width=3
   *  distance=3 => width=5
   */
  function getConeSquares(x, y, direction, distance) {
    const cells = [];
    const width = distance * 2 - 1;
    const start = -Math.floor(width / 2);
    for (let i = 0; i < width; i++) {
      let cx = x;
      let cy = y;
      switch (direction) {
        case 'north':
          cx = x + start + i;
          cy = y - distance;
          break;
        case 'south':
          cx = x + start + i;
          cy = y + distance;
          break;
        case 'east':
          cx = x + distance;
          cy = y + start + i;
          break;
        case 'west':
          cx = x - distance;
          cy = y + start + i;
          break;
      }
      cells.push([cx, cy]);
    }
    return cells;
  }
  
  module.exports = {
    getScannerDetection,
    getConeSquares,
  };
  