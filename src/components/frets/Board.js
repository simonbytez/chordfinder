import Row from './Row';

export default function Board({board}) {
    const rows = Object.keys(board)
                       .map(stringNum => 
                       <Row key={Math.random().toString()} frets={board[stringNum]} />);
    return (
      <table>
          <tbody>
            {rows}
          </tbody>
      </table>
    );
  };