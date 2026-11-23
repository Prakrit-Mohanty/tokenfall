'use client';
// React / Next.js wrapper for the Gaurav Clay sprite player.
// Put sprites/gaurav-clay.webp in /public/tokenfall/ (or pass `src`).
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import GauravClayLib from '../js/gaurav-clay.js';

const GauravClay = forwardRef(function GauravClay(
  { src = '/tokenfall/gaurav-clay.webp', width = 860, height = 620, scale = 1, speed = 200,
    background = '#335C44', buttons = true, keyboard = true, hud = true, autofocus = true, onState,
    className, style },
  ref
) {
  const box = useRef(null);
  const ctl = useRef(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    ctl.current = GauravClayLib.mount(box.current, {
      src, width, height, scale, speed, background, buttons, keyboard, hud, autofocus,
      onState: (s) => onStateRef.current && onStateRef.current(s),
    });
    return () => { ctl.current && ctl.current.destroy(); ctl.current = null; };
  }, [src, width, height, scale, speed, background, buttons, keyboard, hud, autofocus]);

  useImperativeHandle(ref, () => ({
    do: (name) => ctl.current && ctl.current.do(name),         // 'jump'
    setInput: (o) => ctl.current && ctl.current.hero.setInput(o), // { left: true, run: true }
    get hero() { return ctl.current && ctl.current.hero; },
    get canvas() { return ctl.current && ctl.current.canvas; },
  }), []);

  return <div ref={box} className={className} style={style} />;
});

export default GauravClay;
