'use client';
// React hook for the Gaurav NPC. Your game owns the canvas and the loop; this just gives you the NPC object.
//
//   const npc = useGauravNPC('/tokenfall/gaurav.webp', { x: 300, y: 400 });
//   // inside your rAF loop:
//   npc.current?.update(dt, { player: { x, y }, bounds: { minX, maxX, minY, maxY } });
//   npc.current?.draw(ctx);
import { useEffect, useRef } from 'react';
import GauravLib from '../js/gaurav-npc.js';

export function useGauravNPC(src = '/tokenfall/gaurav.webp', options = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.src = src;
    ref.current = new GauravLib.NPC(img, options);
    return () => { ref.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return ref;
}

// Standalone demo component (canvas + "you" marker), handy for a quick check.
export default function GauravNPCDemo({ src = '/tokenfall/gaurav.webp', width = 860, height = 620, onSay }) {
  const box = useRef(null);
  useEffect(() => {
    const ctl = GauravLib.mount(box.current, { src, width, height, npc: { onSay } });
    return () => ctl.destroy();
  }, [src, width, height, onSay]);
  return <div ref={box} />;
}
