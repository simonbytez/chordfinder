/*******************************************************
 * Cell.js
 *
 * Shows:
 *  - The topmost piece if visible to current player
 *  - Intel overlay for certain pieces discovered
 *  - The scanner reports for the current player, e.g. "P3" with a subscript "2"
 *******************************************************/
const React = require('react');

function Cell({
  cell,
  onClick,
  isActive,
  isSelected,
  isInLOS,
  currentPlayer,
  eyeD
}) {
  const piece = cell.pieces[0] || null;
  let bgColor = '#f0f0f0';
  if (isSelected) bgColor = '#a0d8ff';
  else if (isInLOS) bgColor = '#ffffcc';

  // Check if current player owns a device here
  const ownsDevice = cell.listeningDevice[currentPlayer]
  const ownsJammer = cell.jammer[currentPlayer]

  //JARED_TODO: all this needs to be cleaned up. There are way too many cell renderings.
  if (piece) {
    const isOwnPiece = (piece.player === currentPlayer);
    if (isOwnPiece) {
      return renderPieceCell(
        cell, piece, bgColor, onClick, true, currentPlayer, 
        ownsDevice, ownsJammer
      );
    } else {
      if (isInLOS) {
        // if it's the enemy flag, do something special if you want
        if (piece.type === 'flag') {
          return renderEmptyCell(
            cell, onClick, bgColor, isActive, currentPlayer, ownsDevice, ownsJammer
          );
        }
        return renderPieceCell(
          cell, piece, bgColor, onClick, false, currentPlayer, 
          ownsDevice, ownsJammer
        );
      } else {
        // not in LOS => show intel overlay
        return renderIntelCell(
          cell, onClick, bgColor, isActive, currentPlayer, ownsDevice, ownsJammer
        );
      }
    }
  } else {
    // no piece visible
    return renderIntelCell(
      cell, onClick, bgColor, isActive, currentPlayer, ownsDevice, ownsJammer
    );
  }
}

function renderPieceCell(
  cell,
  piece,
  bgColor,
  onClick,
  isOwn,
  currentPlayer,
  ownsDevice,
  ownsJammer
) {
  const style = {
    width: 45,
    height: 45,
    border: '1px solid #999',
    backgroundColor: bgColor,
    cursor: 'pointer',
    position: 'relative',
  };

  if (isOwn && piece.type === 'flag') {
    style.background = 'radial-gradient(circle, red 20%, transparent 60%)';
  }

  return (
    <div onClick={onClick} style={style}>
      <PieceFacingLabel piece={piece} player={currentPlayer}/>
      <IntelOverlay cell={cell} player={currentPlayer} />
      {ownsDevice && <div className="device-indicator listener">📡</div>}
                          
      {ownsJammer && <div className="device-indicator jammer">🛰️</div>}
    </div>
  );
}

function renderEmptyCell(
  cell,
  onClick,
  bgColor,
  isActive,
  currentPlayer,
  ownsDevice,
  ownsJammer
) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 45,
        height: 45,
        border: '1px solid #999',
        backgroundColor: bgColor,
        cursor: isActive ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      <IntelOverlay cell={cell} player={currentPlayer} />
      {ownsDevice && <div className="device-indicator listener">📡</div>}
      {ownsJammer && <div className="device-indicator jammer" style={{ left: '20px' }}>🛰️</div>}
    </div>
  );
}

function renderIntelCell(
  cell,
  onClick,
  bgColor,
  isActive,
  currentPlayer,
  ownsDevice,
  ownsJammer
) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 45,
        height: 45,
        border: '1px solid #999',
        backgroundColor: bgColor,
        cursor: isActive ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      <IntelOverlay cell={cell} player={currentPlayer} />
      {ownsDevice && <div className="device-indicator listener">📡</div>}
      {ownsJammer && <div className="device-indicator jammer" style={{ left: '20px' }}>🛰️</div>}
    </div>
  );
}

/** Renders a piece label with rotation. E.g. "SC5" for scout #5. */
function PieceFacingLabel({ piece, player }) {
  const rotation = getRotationDegrees(piece.direction, player);
  const style = {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    position: 'absolute',
    top: '50%',
    left: '50%',
    translate: '-50% -50%',
    fontWeight: 'bold',
    fontSize: '12px',
    pointerEvents: 'none',
    color: piece.player === 1 ? 'blue' : 'green',
  };
  // or use a consts map, e.g. abbrs[piece.type]
  return <div style={style}>{piece.typeAbbr}</div>;
}

function getRotationDegrees(direction, player) {
  if(player == 1) {
    switch (direction) {
      case 'east':  return 90;
      case 'south': return 180;
      case 'west':  return 270;
      default:      return 0;
    }
  } else {
    switch (direction) {
      case 'east':  return 270;
      case 'north': return 180;
      case 'west':  return 90;
      default:      return 0;
    }
  }
}

/** 
 * Renders certain intel about pieces in this cell for the current player. 
 * e.g. "SC3(1)" meaning scout #3, age=1 
 */
function IntelOverlay({ cell, player }) {
  const intel = cell.intel[player];
  const style = {
    position: 'absolute',
    top: '20%',
    left: '50%',
    translate: '-50% -50%',
    fontWeight: 'bold',
    fontSize: '12px',
    color: intel.isCertain ? 'darkorange' : 'red',
  };

  let certainPersonIntel = false,
      certainJammerIntel = false,
      wallIntel = false,
      certainListenerIntel = false,
      jammed = false
  for(let i in intel) {
    const intelValue = intel[i]
    //is the piece id
    if(+i) {
      if(intelValue.certain && !certainPersonIntel) {
        certainPersonIntel = intelValue
      } 
    } else if (i == 'jammer' && intel[i].certain && !certainJammerIntel) { //could either be a jammer or listener
      certainJammerIntel = intelValue
    } else if (i == 'listeningDevice' && intelValue.certain && !certainListenerIntel) { //could either be a jammer or listener
      certainListenerIntel = intelValue
    } else if (i == 'wall' && intelValue.certain) { //could either be a jammer or listener
      wallIntel = intelValue
    } else if(i == 'jammed') {
      jammed = true
    }
  }

  let intelHtmlElements = []
  if(certainPersonIntel) {
    intelHtmlElements.push(<span>{certainPersonIntel.piece.typeAbbr}<sub>{certainPersonIntel.age}</sub></span>)
  }

  if(certainJammerIntel) {
    intelHtmlElements.push(<span>{'J'}<sub>{certainJammerIntel.age}</sub></span>)
  }
  if(certainListenerIntel) {
    intelHtmlElements.push(<span>{'L'}<sub>{certainListenerIntel.age}</sub></span>)
  }
  if(wallIntel) {
    intelHtmlElements.push(<span>{'W'}</span>)
  }
  if(jammed) {
    intelHtmlElements.push(<span>{'X'}</span>)
  }

  return (
    <div style={style}>
      {intelHtmlElements}
    </div>
  );
}

module.exports = Cell;
