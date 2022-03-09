import Fret from './Fret';

export default function Row({frets}) {
    return <>
      <tr key={Math.random().toString()}>
              {frets.map(
                note => <Fret key={Math.random().toString()} note={note.note} included={note.included} />
              )}
      </tr>
    </>
  };