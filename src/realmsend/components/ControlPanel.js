/*******************************************************
 * ControlPanel.js
 *******************************************************/
const React = require('react');

const PIECE_LIMITS = {
  wall: 1,
  flag: 1,
  brute: 1,
  scanner: 1,
  scout: 1,
  jail: 0,
  jammer: 1,
  listener: 1
};

function ControlPanel({ pieces, selectedPiece, onSelectPiece, onComplete, counts }) {
  return (
    <div style={{
      margin: '20px',
      padding: '20px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      backgroundColor: '#fff',
    }}>
      <h3>Place Pieces</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
      }}>
        {pieces.map(p => {
          const remaining = PIECE_LIMITS[p] - (counts[p] || 0);
          const disabled = remaining <= 0;
          return (
            <button
              key={p}
              onClick={() => !disabled && onSelectPiece(p)}
              style={{
                padding: '8px',
                fontWeight: selectedPiece === p ? 'bold' : 'normal',
                backgroundColor: disabled ? '#aaa' : selectedPiece === p ? '#4CAF50' : '#ddd',
                color: disabled ? '#666' : '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {`${p.toUpperCase()} (${remaining})`}
            </button>
          );
        })}
      </div>
      <button
        onClick={onComplete}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Complete Setup
      </button>
    </div>
  );
}

module.exports = ControlPanel;
