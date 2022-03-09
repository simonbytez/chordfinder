import Header from './Header';
import { accelerate, inc} from '../../lib/tone';

export default function Main() { 
  const acc = () => {
    accelerate();
  }
  return <> 
    <Header />
      <button onClick={acc}>accelerate</button>
      <button onClick={inc}>inc</button>
    </>
}