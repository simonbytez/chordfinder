export default function Fret({note, included}) {
  const background = included ? 'black' : 'white';
  return <>
    <td style={{
      border: '1px solid black',
      //background,
      width: '15px',
      height: '15px'
    }}>{included ? note : ''}</td>
  </>
};