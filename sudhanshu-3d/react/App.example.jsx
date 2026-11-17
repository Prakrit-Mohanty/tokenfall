import { useRef, useState } from 'react';
import Sudhanshu3D from './Sudhanshu3D';

export default function App() {
  const hero = useRef(null);
  const [state, setState] = useState(null);
  return (
    <div style={{ padding: 24, background: '#15131D', minHeight: '100vh', color: '#EDE9F7' }}>
      <Sudhanshu3D ref={hero} src="/tokenfall/sudhanshu3d.webp" onState={setState} />
      <p>{state ? `${state.label} · facing ${state.dir}` : 'Loading…'}</p>
      <button onClick={() => hero.current.do('celebrate')}>Celebrate from outside</button>
    </div>
  );
}
