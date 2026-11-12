/*
 * SpriteCharacter — tiny, dependency-free player for the character sprite sheets.
 * Works in plain HTML (classic <script> or ES module) and in React/Vue/Svelte.
 *
 *   const hero = new SpriteCharacter(data, image)   // data = spritesheet.json, image = loaded <img>
 *   hero.x = 200; hero.y = 300;                     // feet position, in canvas px
 *   hero.setInput({ left: true, run: false });      // held keys
 *   hero.trigger('jump');                           // one-shot / toggle actions (see data.actions)
 *   hero.update(dtMs, { width, height });           // each frame
 *   hero.draw(ctx, scale);                          // draws at hero.x / hero.y
 */
class SpriteCharacter {
  constructor(data, image, opts = {}) {
    this.data = data;
    this.image = image;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.dir = opts.dir ?? 'down';
    this.speed = opts.speed ?? 200;   // walk speed, px per second (at scale 1)
    this.scale = opts.scale ?? 1;
    this.input = { up: false, down: false, left: false, right: false, run: false };
    this.moving = false;
    this.anim = 'idle';
    this.t = 0;            // time in current animation (ms)
    this.pose = null;      // 'crouch' | 'faint' (toggles)
    this.oneShot = null;   // { name, t, until }
  }

  has(action) { return this.data.actions.indexOf(action) >= 0 || !!this.data.animations[action + '_down']; }

  setInput(partial) { Object.assign(this.input, partial); }

  trigger(action) {
    if (!this.has(action)) return;
    if (action === 'crouch' || action === 'faint') {
      this.pose = this.pose === action ? null : action;
      this.oneShot = null; this.t = 0; return;
    }
    if (action === 'run' || action === 'ride') { this.input.run = !this.input.run; return; }
    if (this.oneShot && this.oneShot.name === 'jump') return;
    this.pose = null;
    const until = action === 'emote' ? 1000 : this._total(action + '_' + this.dir);
    this.oneShot = { name: action, t: 0, until };
  }

  _total(key) {
    const a = this.data.animations[key];
    return a ? a.durations.reduce((s, d) => s + d, 0) : 0;
  }

  update(dt, bounds) {
    const i = this.input;
    const dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    const dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      if (this.pose === 'faint' || (this.pose === 'crouch' && !this.has('sneak'))) this.pose = null;
      if (this.oneShot && this.oneShot.name !== 'jump') this.oneShot = null;
      const ride = i.run && this.has('ride');
      const mult = this.pose === 'crouch' ? 0.45 : i.run ? (ride ? 2.6 : 1.8) : 1;
      const len = Math.hypot(dx, dy);
      const v = this.speed * this.scale * mult * dt / 1000;
      this.x += dx / len * v;
      this.y += dy / len * v;
      this.dir = dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (bounds) {
        const m = this.data.anchor.x * 0.8 * this.scale;
        this.x = Math.max(m, Math.min(bounds.width - m, this.x));
        this.y = Math.max(170 * this.scale, Math.min(bounds.height - 10 * this.scale, this.y));
      }
    }
    if (this.oneShot) {
      this.oneShot.t += dt;
      if (this.oneShot.t >= this.oneShot.until) this.oneShot = null;
    }
    // pick animation
    let next;
    if (this.oneShot) next = this.oneShot.name;
    else if (this.pose === 'faint') next = 'faint';
    else if (this.pose === 'crouch') next = this.moving ? 'sneak' : 'crouch';
    else if (this.moving) next = i.run ? (this.has('ride') ? 'ride' : 'run') : 'walk';
    else next = 'idle';
    if (next !== this.anim) { this.anim = next; this.t = 0; } else this.t += dt;
  }

  /** current { row, col, lift } — useful if you render with CSS or a game engine */
  frame() {
    const a = this.data.animations[this.anim + '_' + this.dir] || this.data.animations['idle_' + this.dir];
    let t = this.oneShot ? this.oneShot.t : this.t;
    const total = a.durations.reduce((s, d) => s + d, 0);
    t = a.loop ? t % total : Math.min(t, total - 1);
    let col = 0;
    for (; col < a.durations.length - 1; col++) { if (t < a.durations[col]) break; t -= a.durations[col]; }
    let lift = 0;
    if (this.anim === 'jump' && this.oneShot) {
      const jt = this.oneShot.t;
      if (jt > 80 && jt < 460) lift = Math.sin((jt - 80) / 380 * Math.PI) * this.data.jumpHeight;
    }
    if (this.anim === 'emote' && this.oneShot) lift = Math.abs(Math.sin(this.oneShot.t / 1000 * Math.PI * 3)) * 14;
    if (this.anim === 'ride') lift = (Math.floor(this.t / 80) % 2) ? 1 : 0;
    return { row: a.row, col, lift };
  }

  draw(ctx, scale = this.scale) {
    const { cell, anchor } = this.data;
    const f = this.frame();
    // shadow
    const s = 1 - f.lift / 180;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 3 * scale, 38 * scale * s, 9 * scale * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, f.col * cell.w, f.row * cell.h, cell.w, cell.h,
      Math.round(this.x - anchor.x * scale), Math.round(this.y - (anchor.y + f.lift) * scale),
      Math.round(cell.w * scale), Math.round(cell.h * scale));
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = SpriteCharacter;
else if (typeof window !== 'undefined') window.SpriteCharacter = SpriteCharacter;
