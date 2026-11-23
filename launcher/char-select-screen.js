// The character pick, shown once after the launcher's START: four cards, and a Look row for the hero's hair colour and accessories. The pick and the look are saved
// (js/game/char-select.js) and the hero walks with them. Up / Down moves between the cards, the hair colours and the accessories; Left / Right moves along a row;
// Enter applies (on a card it starts the game). Keys stop at the screen, so the hero does not move while picking.
// Browser only: window.CharSelectScreen.run() shows it and resolves with the chosen id.
(function () {
  function run() {
    return new Promise((done) => {
      const CS = window.CharSelect, roster = CS.ROSTER;
      const look = CS.getLook();
      let sel = Math.max(0, roster.findIndex((r) => r.id === CS.getChoice()));
      let row = 0, col = 0;   // row 0: the cards (col is the chosen card), 1: the hair colours, 2: the accessories
      const rowLen = () => [roster.length, CS.HAIR.length, CS.ACCESSORIES.length][row];

      const el = document.createElement('div');
      el.id = 'charpick'; el.tabIndex = -1;
      el.innerHTML = `<h1>Who are you in TokenFall?</h1>
        <div class="cards">${roster.map((r) => `<div class="card"><img src="tokenfall-characters/sprites/${r.id}-portrait.png" alt=""><div class="name">${r.name}</div><div class="blurb">${r.blurb}</div></div>`).join('')}</div>
        <div class="look">
          <div class="row"><div class="label">Hair</div>${CS.HAIR.map((h) => `<div class="pill" data-hair="${h.id}">${h.name}</div>`).join('')}</div>
          <div class="row"><div class="label">Extras</div>${CS.ACCESSORIES.map((a) => `<div class="pill" data-acc="${a.id}">${a.name}</div>`).join('')}</div>
        </div>
        <div class="hint">Left / Right to choose · Down to customize · Enter to start</div>`;
      const cards = [...el.querySelectorAll('.card')];
      const hairPills = [...el.querySelectorAll('[data-hair]')], accPills = [...el.querySelectorAll('[data-acc]')];

      const paint = () => {
        cards.forEach((c, i) => c.classList.toggle('sel', i === sel));
        hairPills.forEach((p, i) => { p.classList.toggle('on', CS.HAIR[i].id === look.hair); p.classList.toggle('focus', row === 1 && i === col); });
        accPills.forEach((p, i) => { p.classList.toggle('on', look.acc[CS.ACCESSORIES[i].id]); p.classList.toggle('focus', row === 2 && i === col); });
        cards.forEach((c, i) => c.classList.toggle('focus', row === 0 && i === sel));
      };
      const goRow = (r) => { row = r; col = r === 1 ? Math.max(0, CS.HAIR.findIndex((h) => h.id === look.hair)) : Math.min(col, rowLen() - 1); paint(); };
      const confirm = () => { CS.setChoice(roster[sel].id); CS.setLook(look); el.remove(); done(roster[sel].id); };
      const apply = () => {
        if (row === 0) confirm();
        else if (row === 1) look.hair = CS.HAIR[col].id;
        else look.acc[CS.ACCESSORIES[col].id] = !look.acc[CS.ACCESSORIES[col].id];
        paint();
      };

      cards.forEach((c, i) => {
        c.addEventListener('mouseenter', () => { sel = i; row = 0; paint(); });
        c.addEventListener('click', () => { sel = i; confirm(); });
      });
      hairPills.forEach((p, i) => p.addEventListener('click', () => { row = 1; col = i; apply(); }));
      accPills.forEach((p, i) => p.addEventListener('click', () => { row = 2; col = i; apply(); }));

      el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        const k = e.key;
        if (k === 'ArrowDown' || k === 's') { e.preventDefault(); goRow(Math.min(2, row + 1)); }
        else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); goRow(Math.max(0, row - 1)); }
        else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); if (row === 0) sel = (sel + 1) % roster.length; else col = (col + 1) % rowLen(); paint(); }
        else if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); if (row === 0) sel = (sel + roster.length - 1) % roster.length; else col = (col + rowLen() - 1) % rowLen(); paint(); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); apply(); }
      });
      el.addEventListener('keyup', (e) => e.stopPropagation());

      document.body.appendChild(el);
      paint();
      el.focus({ preventScroll: true });
      requestAnimationFrame(() => el.classList.add('on'));
    });
  }
  window.CharSelectScreen = { run };
})();
