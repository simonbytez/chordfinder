const React = require('react');

function MovementPanel({
  player,
  selectedCell,
  actionsRemaining,
  onEndTurn,
  onScannerChoice,
  detectionResults,
  onRotateLeft,
  onRotateRight,
  jails,
  onPlantDevice,
  onPlantJammer
}) {
  const selectedPiece = selectedCell?.piece;
  const isScannerSelected = selectedPiece?.type === 'scanner';
  const isListenerSelected   = selectedPiece?.type === 'listener';
  const isJammerSelected  = selectedPiece?.type === 'jammer';

  return (
    <div
      style={{
        width: '200px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '8px',
        backgroundColor: '#fff',
      }}
    >
      <h3>Player {player} Controls</h3>
      <div>Actions left: {actionsRemaining}</div>

      {/* End Turn */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={onEndTurn}>
          End Turn
        </button>
      </div>

      {/* Rotation */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={onRotateLeft}>Rotate Left</button>
        <button onClick={onRotateRight}>Rotate Right</button>
      </div>

      {/* Scanner */}
      {isScannerSelected && (
        <div style={{ marginTop: '10px' }}>
          <div>Scan for:</div>
          <button onClick={() => onScannerChoice('person')}>People</button>
          <button onClick={() => onScannerChoice('walls')}>Walls</button>
          <button onClick={() => onScannerChoice('devices')}>Devices</button>
        </div>
      )}

      {/* Listener */}
      {isListenerSelected && (
        <div style={{ marginTop: '10px' }}>
          <button onClick={onPlantDevice}>Plant Listening Device</button>
        </div>
      )}

      {/* Jammer */}
      {isJammerSelected && (
        <div style={{ marginTop: '10px' }}>
          <button onClick={onPlantJammer}>Plant Jam Device</button>
        </div>
      )}

      {/* Jail */}
      <div style={{ marginTop: '10px' }}>
        <h4>Your Jail</h4>
        {(jails[`player${player}`] || []).map((p, idx) => (
          <div key={idx}>
            {p.type} {p.id}
          </div>
        ))}
      </div>
    </div>
  );
}

module.exports = MovementPanel;
