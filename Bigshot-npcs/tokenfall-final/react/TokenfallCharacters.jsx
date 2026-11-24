'use client';
// React / Next.js wrapper. Put the sprites/ folder at public/tokenfall/sprites/.
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Lib from '../js/tokenfall-characters.js';

// Full demo widget (picker + controls). Props: character, assetsBase, width, height, scale, speed, background, keyboard, hud, onSelect, onState.
const TokenfallCharacters = forwardRef(function TokenfallCharacters(
  { character = 'murali', assetsBase = '/tokenfall/sprites/', width = 860, height = 620, scale = 1, speed = 200,
    background = '#335C44', keyboard = true, hud = true, autofocus = true, onSelect, onState, className, style }, ref) {
  const box = useRef(null), ctl = useRef(null);
  const cb = useRef({ onSelect, onState }); cb.current = { onSelect, onState };
  useEffect(() => {
    ctl.current = Lib.mount(box.current, { character, assetsBase, width, height, scale, speed, background, keyboard, hud, autofocus,
      onSelect: (id) => cb.current.onSelect && cb.current.onSelect(id), onState: (s) => cb.current.onState && cb.current.onState(s) });
    return () => { ctl.current && ctl.current.destroy(); ctl.current = null; };
  }, [assetsBase, width, height, scale, speed, background, keyboard, hud, autofocus]);
  useEffect(() => { ctl.current && ctl.current.select(character); }, [character]);
  useImperativeHandle(ref, () => ({
    select: (id) => ctl.current && ctl.current.select(id),
    do: (a) => ctl.current && ctl.current.do(a),
    get hero() { return ctl.current && ctl.current.hero; },
  }), []);
  return <div ref={box} className={className} style={style} />;
});
export default TokenfallCharacters;

// For your own game loop: const hero = useTokenfallCharacter('riya'); then hero.current.update(dt, {width,height}); hero.current.draw(ctx);
export function useTokenfallCharacter(id, assetsBase = '/tokenfall/sprites/', opts = {}) {
  const r = useRef(null);
  if (!r.current || r.current.id !== id) r.current = Lib.create(id, assetsBase, opts);
  return r;
}
