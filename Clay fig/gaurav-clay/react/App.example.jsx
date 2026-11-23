import { useRef, useState } from 'react';
import GauravClay from './GauravClay';

export default function App() {
  const hero = useRef(null);
  const [state, setState] = useState(null);
  return (
    <div style={{ padding: 24, background: '#15131D', minHeight: '100vh', color: '#EDE9F7' }}>
      <GauravClay ref={hero} src="/tokenfall/gaurav-clay.webp" onState={setState} />
      <p>{state ? `${state.label} · facing ${state.dir}` : 'Loading…'}</p>
      <button onClick={() => hero.current.do('jump')}>Jump from outside</button>
    </div>
  );
}
