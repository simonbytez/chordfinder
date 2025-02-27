/*******************************************************
 * IntelLogPanel.js
 *
 * A simple panel that displays a list of intel messages
 * for the current player. 
 *******************************************************/
const React = require('react');

function IntelLogPanel({ currentPlayer, logs }) {
  return (
    <div
      style={{
        width: '200px',
        marginRight: '10px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: '#fff',
      }}
    >
      <h3>Player {currentPlayer} Intel</h3>
      {logs.length === 0 && (
        <div style={{ fontStyle: 'italic', color: '#999' }}>
          No new intel
        </div>
      )}
      {logs.map((msg, i) => (
        <div key={i} style={{ marginBottom: '6px' }}>
          • {msg}
        </div>
      ))}
    </div>
  );
}

module.exports = IntelLogPanel;
