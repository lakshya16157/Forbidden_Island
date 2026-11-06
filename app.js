(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const gameEl = $('#game');
  const overlay = $('#overlay');
  const KEY = 'forbidden-island-local-v1';
  const symbols = { earth: '◆', wind: '✺', fire: '▲', water: '◒' };
  const treasureNames = { earth: 'Earth Stone', wind: 'Statue of the Wind', fire: 'Crystal of Fire', water: 'Ocean’s Chalice' };
  const roleColors = { explorer: '#5aa968', diver: '#292f39', pilot: '#66a9d6', engineer: '#d66055', messenger: '#c2b9b2', navigator: '#e6bd53' };
  const abilities = { diver: 'Move through connected flooded or missing tiles.', engineer: 'Shore up two tiles for one action.', explorer: 'Move and shore up diagonally.', messenger: 'Give treasure cards from anywhere.', navigator: 'Move another player up to two tiles per action.', pilot: 'Fly to any tile once per turn for one action.' };
  // Locations use individual cells of a 6-by-4 illustration atlas.
  const artworkLocations = [
    'Breakers Bridge', 'Bronze Gate', 'Cave of Embers', 'Cave of Shadows', 'Cliffs of Abandon', 'Copper Gate',
    'Coral Palace', 'Crimson Forest', 'Dunes of Deception', "Fools' Landing", 'Gold Gate', 'Howling Garden',
    'Iron Gate', 'Lost Lagoon', 'Misty Marsh', 'Observatory', 'Phantom Rock', 'Silver Gate',
    'Temple of the Moon', 'Temple of the Sun', 'Tidal Palace', 'Twilight Hollow', 'Watchtower', 'Whispering Garden'
  ];
  function artworkPosition(name) { const i = artworkLocations.indexOf(name); return i < 0 ? '0% 0%' : (i % 6 * 20) + '% ' + (Math.floor(i / 6) * 100 / 3) + '%'; }
  const typeNames = { move: 'Move', fly: 'Pilot flight', shore: 'Shore up', give: 'Give a card', capture: 'Capture treasure', navigate: 'Navigate', endActions: 'End actions', drawTreasure: 'Draw treasure', drawFlood: 'Draw flood', swim: 'Swim to safety', discard: 'Discard a card', sandbag: 'Play sandbags', helicopter: 'Helicopter lift', escape: 'Escape the island' };
  const typeIcons = { move:'↗', fly:'✈', shore:'◈', give:'⇄', capture:'✦', navigate:'➜', endActions:'✓', drawTreasure:'▤', drawFlood:'≈', swim:'≈', discard:'×', sandbag:'▰', helicopter:'✈', escape:'✦' };
  const title = s => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = null, selectedType = null, targetTile = null, cardFilter = null, notice = '';
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && saved.tiles && saved.players) state = saved; } catch (_) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  const PANEL_KEY = 'forbidden-island-hidden-panels-v1';
  let hiddenPanels = new Set();
  try { const saved = JSON.parse(localStorage.getItem(PANEL_KEY)); if (Array.isArray(saved)) hiddenPanels = new Set(saved); } catch (_) {}
  function savePanels() { try { localStorage.setItem(PANEL_KEY, JSON.stringify([...hiddenPanels])); } catch (_) {} }
  const panelClass = (id) => hiddenPanels.has(id) ? 'collapsed' : '';
  const panelToggle = (id) => `<button class="panel-toggle" data-toggle="${id}" aria-expanded="${!hiddenPanels.has(id)}" title="${hiddenPanels.has(id) ? 'Show' : 'Hide'}">${hiddenPanels.has(id) ? 'Show' : 'Hide'}</button>`;
  function tileById(id) { return state.tiles.find(t => t.id === id); }
  function cardLabel(card) { return treasureNames[card] || ({ helicopter: 'Helicopter Lift', sandbag: 'Sandbags', rise: 'Waters Rise!' })[card] || title(card); }
  function cardFace(card, owner, legal = []) {
    const icon = symbols[card] || ({ helicopter: '&#9992;', sandbag: '&#9648;', rise: '&#8776;' })[card] || '&#9670;';
    const special = card === 'helicopter' || card === 'sandbag';
    const actionable = owner !== undefined && legal.some(a =>
      (a.type === 'discard' && a.player === owner && a.card === card) ||
      (special && (a.type === card || (card === 'helicopter' && a.type === 'escape')) && a.player === owner) ||
      (owner === state.current && a.type === 'give' && a.card === card));
    const tag = actionable ? 'button' : 'span';
    const actionAttrs = actionable ? `type="button" data-hand-card="${escapeHTML(card)}" data-owner="${owner}"` : 'role="img"';
    const label = `${cardLabel(card)}${actionable ? ', choose an action' : ''}`;
    return `<${tag} class="game-card game-card--${escapeHTML(card)}" ${actionAttrs} aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"><span class="game-card-art" aria-hidden="true"></span><span class="game-card-icon" aria-hidden="true">${icon}</span><span class="game-card-name">${escapeHTML(cardLabel(card))}</span></${tag}>`;
  }
  function resetSelection() { selectedType = null; targetTile = null; cardFilter = null; }
  let history = [];
  function run(action) {
    const before = JSON.stringify(state);
    const result = ForbiddenIsland.act(state, action);
    if (!result.ok) { notice = result.error || 'That action is not available.'; }
    else { history.push(before); if (history.length > 200) history.shift(); notice = ''; resetSelection(); save(); }
    render();
  }
  function undo() {
    if (!history.length) return;
    state = JSON.parse(history.pop());
    notice = ''; resetSelection(); save(); render();
  }
  function showSetup(confirmNew = false) {
    overlay.innerHTML = `<div class="setup-overlay"><section class="setup-card" role="dialog" aria-modal="true" aria-labelledby="setup-title"><div class="eyebrow">AN ISLAND ON THE EDGE</div><h2 id="setup-title">Gather your crew.</h2><p>Work together, recover the four treasures, and escape before the island disappears.</p>${confirmNew ? '<p class="notice">Starting a new expedition replaces the saved game on this device.</p>' : ''}<form class="setup-form" id="setup-form"><label class="field">Number of players<select name="players"><option value="2">2 players</option><option value="3">3 players</option><option value="4">4 players</option></select></label><label class="field">Starting water level<select name="difficulty"><option value="novice">Novice</option><option value="normal">Normal</option><option value="elite">Elite</option><option value="legendary">Legendary</option></select></label><button class="btn btn-primary" type="submit">Start expedition <span>→</span></button>${state ? '<button class="btn btn-ghost" type="button" id="cancel-setup">Return to game</button>' : ''}</form><p class="small">A shared-screen game · Progress saves on this device</p></section></div>`;
    $('#setup-form').onsubmit = e => { e.preventDefault(); const data = new FormData(e.currentTarget); state = ForbiddenIsland.newGame(Number(data.get('players')), data.get('difficulty')); history = []; resetSelection(); notice = ''; overlay.innerHTML = ''; save(); render(); };
    if ($('#cancel-setup')) $('#cancel-setup').onclick = () => { overlay.innerHTML = ''; };
  }
  function showRules() {
    overlay.innerHTML = `<div class="setup-overlay"><section class="modal-card rules-card" role="dialog" aria-modal="true" aria-labelledby="rules-title"><div class="panel-head"><div><div class="eyebrow">FIELD GUIDE</div><h2 id="rules-title">How to play</h2></div><button class="btn btn-ghost" id="close-rules">Close ✕</button></div><div class="rules-copy"><p>Work as a team to capture all four treasures, gather everyone at Fools’ Landing, and play a Helicopter Lift to escape.</p><h3>On your turn</h3><p>Take up to three actions: move, shore up a flooded tile, give a treasure card to a player on your tile, or capture a treasure by discarding four matching cards at one of its two sites. Then draw two treasure cards and the indicated number of flood cards, one at a time.</p><h3>Watch the water</h3><p>A flooded tile sinks if drawn again. Waters Rise raises the water level and puts previously drawn flood cards back on top of the flood deck. If your tile sinks, choose a surviving tile to swim to; it may be flooded. A hand may hold at most five cards.</p><h3>Use your strengths</h3><p>Each adventurer has a special ability. Helicopter Lift and Sandbags cards may be played by their holder at any time, including between card draws, without spending an action. Select an action, then a highlighted tile or an option.</p><h3>The expedition ends</h3><p>You lose if Fools’ Landing sinks, both sites for an unclaimed treasure sink, someone cannot swim to safety, or the water reaches the skull. All hands are visible because the game is cooperative.</p><p><a href="https://fgbradleys.com/wp-content/uploads/rules/ForbiddenIsland-rules.pdf" target="_blank" rel="noopener noreferrer">Read the official rulebook ↗</a></p></div></section></div>`;
    $('#close-rules').onclick = () => { overlay.innerHTML = ''; };
  }
  function phaseDescription() {
    const p = state.players[state.current];
    if (state.phase === 'actions') return `Player ${state.current + 1} (${title(p.role)}) · ${state.actionsLeft} action${state.actionsLeft === 1 ? '' : 's'} remaining`;
    if (state.phase === 'treasure') return `Draw treasure cards · ${state.treasureDraws} remaining`;
    if (state.phase === 'flood') return `Draw flood cards · ${state.floodDraws} remaining`;
    if (state.phase === 'swim') return 'A tile sank · swim or use a Helicopter Lift';
    if (state.phase === 'discard') return 'Hand limit exceeded · discard or play a special card';
    if (state.phase === 'won') return 'The team escaped with all four treasures!';
    return 'The island has claimed the expedition.';
  }
  function render() {
    if (!state) { gameEl.innerHTML = ''; showSetup(); return; }
    const legal = ForbiddenIsland.legal(state);
    const types = [...new Set(legal.map(a => a.type))];
    if (selectedType && !types.includes(selectedType)) resetSelection();
    const selected = legal.filter(a => a.type === selectedType && (!cardFilter ||
      (selectedType === 'give' && a.card === cardFilter.card) ||
      (selectedType === 'discard' && a.player === cardFilter.owner && a.card === cardFilter.card) ||
      ((selectedType === 'helicopter' || selectedType === 'sandbag' || selectedType === 'escape') && a.player === cardFilter.owner)));
    const targets = new Set(selected.flatMap(a => [a.tile, a.second].filter(v => v !== undefined && v !== null)));
    const filtered = targetTile === null ? selected : selected.filter(a => a.tile === targetTile || a.second === targetTile);
    const options = targetTile === null ? filtered.slice(0, 36) : filtered;
    const instructions = state.phase === 'actions'
      ? 'Choose an action, then a highlighted tile.'
      : state.phase === 'treasure' || state.phase === 'flood'
        ? 'Draw from the highlighted deck or play a special card.'
        : state.phase === 'swim' ? (types.includes('swim') ? 'Choose Swim to safety or use a Helicopter Lift to rescue pawns from the sinking tile.' : 'This pawn cannot swim to safety. Use a Helicopter Lift to rescue them.')
        : state.phase === 'discard' ? 'Choose Discard a card, or play a special card from the over-limit hand.' : '';
    const tiles = [...state.tiles].sort((a,b) => a.y-b.y || a.x-b.x);
    const board = tiles.map(t => {
      const occupants = state.players.filter(p => p.tile === t.id);
      const classes = ['tile', `tile-${t.status}`, targets.has(t.id) ? 'target' : '', targetTile === t.id ? 'selected' : ''].join(' ');
      const siteLabel = t.treasure ? `, ${treasureNames[t.treasure]} treasure site` : '';
      const tileIcon = t.treasure ? symbols[t.treasure] : (t.name === "Fools' Landing" ? '&#9992;' : '');
      return `<button class="${classes}" style="grid-column:${t.x + 1};grid-row:${t.y + 1};--tile-position:${artworkPosition(t.name)}" data-tile="${t.id}" ${targets.has(t.id) ? '' : 'disabled'} aria-label="${escapeHTML(t.name)}, ${t.status}${escapeHTML(siteLabel)}${targets.has(t.id) ? ', select target' : ''}"><span class="tile-top"><span class="tile-symbol ${t.treasure ? 'site-symbol' : ''} ${t.treasure && state.treasures[t.treasure] ? 'captured' : ''}" title="${escapeHTML(t.treasure ? treasureNames[t.treasure] + ' treasure site' : (tileIcon ? 'Escape site' : ''))}">${tileIcon}</span><span class="tile-status">${t.status === 'flooded' ? 'FLOODED' : t.status === 'sunk' ? 'SUNK' : ''}</span></span><span class="tile-name">${escapeHTML(t.name)}</span><span class="pawns">${occupants.map(p => `<span class="pawn" title="${escapeHTML(title(p.role))}" style="--pawn-color:${roleColors[String(p.role).toLowerCase()] || '#fff'}">${escapeHTML(title(p.role).charAt(0))}</span>`).join('')}</span></button>`;
    }).join('');
    const playerCards = state.players.map((p,i) => `<article class="player-card role-card ${i === state.current ? 'active' : ''}" style="--pawn-color:${roleColors[String(p.role).toLowerCase()] || '#fff'}"><div class="player-top"><span class="role-portrait role-portrait--${escapeHTML(p.role)}" aria-hidden="true">${escapeHTML(title(p.role).charAt(0))}</span><div class="player-meta"><div class="player-name">P${i + 1} &middot; ${escapeHTML(title(p.role))} ${i === state.current ? '<span class="current-tag">TURN</span>' : ''}</div><div class="player-role">${escapeHTML(tileById(p.tile)?.name || '')}</div><details class="role-ability"><summary>Ability</summary><span>${escapeHTML(abilities[p.role] || '')}</span></details></div><span class="hand-count" aria-label="${p.hand.length} of 5 cards">${p.hand.length}/5</span></div><div class="hand" aria-label="Player ${i + 1} hand">${p.hand.length ? p.hand.map(c => cardFace(c, i, legal)).join('') : '<span class="small">No cards</span>'}</div></article>`);
    const players = playerCards.filter((_, i) => i % 2 === 0).join('');
    const playersRight = playerCards.filter((_, i) => i % 2 === 1).join('');
    const treasures = Object.keys(treasureNames).map(k => `<div class="treasure-item ${state.treasures[k] ? 'obtained' : ''}"><span class="treasure-symbol treasure-${k}">${symbols[k]}</span><span>${treasureNames[k]}<small>${state.treasures[k] ? 'RECOVERED' : 'NOT FOUND'}</small><span class="treasure-sites">${state.tiles.filter(t => t.treasure === k).map(t => `${escapeHTML(t.name)}${t.status === 'sunk' ? ' (sunk)' : ''}`).join(' / ')}</span></span></div>`).join('');
    const actionButtons = types.map(type => `<button class="action-button ${type === selectedType ? 'selected' : ''} ${['endActions','drawTreasure','drawFlood','escape'].includes(type) ? 'advance' : ''}" data-type="${type}" aria-pressed="${type === selectedType}"><span>${typeIcons[type] || '·'}</span>${typeNames[type] || title(type)}</button>`).join('');
    let optionHTML = '';
    // Only open the choices list when there is nothing on the board to click (or a tile needs narrowing down).
    const hasCardAlternative = cardFilter && selectedType === 'discard' && legal.some(a => a.player === cardFilter.owner && (a.type === cardFilter.card || (cardFilter.card === 'helicopter' && a.type === 'escape')));
    if (selectedType && (targets.size === 0 || targetTile !== null || hasCardAlternative)) {
      const hint = targets.size ? 'Choose a highlighted tile, or choose an option below.' : 'Choose an option below.';
      const alternatives = cardFilter && selectedType === 'discard' ? legal.filter(a => a.player === cardFilter.owner && (a.type === cardFilter.card || (cardFilter.card === 'helicopter' && a.type === 'escape'))) : [];
      const alternativeTypes = [...new Set(alternatives.map(a => a.type))];
      optionHTML = `<div class="action-choices"><div class="section-label">${escapeHTML(typeNames[selectedType] || title(selectedType))}</div><p class="helper">${targetTile !== null ? `Showing choices for ${escapeHTML(tileById(targetTile)?.name)}. <button class="inline-button" id="clear-target">Show all</button>` : hint}</p><div class="options">${options.map((a,i) => `<button class="option" data-option="${i}">${escapeHTML(a.label || title(a.type))}</button>`).join('')}${alternativeTypes.map(type => `<button class="option" data-card-choice="${type}">${type === 'escape' ? 'Escape with this card' : 'Play this card instead'}</button>`).join('')}</div>${filtered.length > options.length ? `<p class="small">Showing ${options.length} of ${filtered.length} choices. Select a highlighted destination to narrow them down.</p>` : ''}</div>`;
    }
    const log = (state.log || []).slice(0, 7).map(line => `<div class="log-entry">${escapeHTML(line)}</div>`).join('');
    const isEnd = state.phase === 'won' || state.phase === 'lost';
    const lastTreasure = state.treasureDiscard[state.treasureDiscard.length - 1];
    const lastFlood = state.floodDiscard.length ? tileById(state.floodDiscard[state.floodDiscard.length - 1]) : null;
    const deckDisplay = `<section class="panel deck-display ${panelClass('decks')}" aria-label="Card decks"><div class="panel-head"><div class="eyebrow">ISLAND DECKS</div>${panelToggle('decks')}</div><div class="panel-body"><div class="deck-row"><div class="deck-group"><button class="deck-stack deck-treasure ${state.phase === 'treasure' ? 'deck-ready' : ''}" data-deck="treasure" ${state.phase === 'treasure' ? '' : 'disabled'} aria-label="Treasure deck, ${state.treasureDeck.length} cards${state.phase === 'treasure' ? ', draw the next card' : ''}"><span class="deck-crest" aria-hidden="true">&#10022;</span><span class="deck-label">TREASURE</span><span class="deck-count">${state.treasureDeck.length}</span></button><div class="deck-discard ${lastTreasure ? '' : 'deck-discard--empty'}" aria-label="Treasure discard, ${state.treasureDiscard.length} cards">${lastTreasure ? cardFace(lastTreasure) : '<span>Discard</span>'}</div></div><div class="deck-group"><button class="deck-stack deck-flood ${state.phase === 'flood' ? 'deck-ready' : ''}" data-deck="flood" ${state.phase === 'flood' ? '' : 'disabled'} aria-label="Flood deck, ${state.floodDeck.length} cards${state.phase === 'flood' ? ', draw the next card' : ''}"><span class="deck-crest" aria-hidden="true">&#8776;</span><span class="deck-label">FLOOD</span><span class="deck-count">${state.floodDeck.length}</span></button><div class="deck-discard ${lastFlood ? '' : 'deck-discard--empty'}" aria-label="Flood discard, ${state.floodDiscard.length} cards">${lastFlood ? `<span class="game-card flood-card" role="img" aria-label="${escapeHTML(lastFlood.name)}"><span class="game-card-art flood-card-art" style="--tile-position:${artworkPosition(lastFlood.name)}"></span><span class="game-card-name">${escapeHTML(lastFlood.name)}</span></span>` : '<span>Discard</span>'}</div></div></div></div></section>`;
    const topRowHTML = `<div class="top-row"><div class="panel action-panel combined"><div class="action-main"><div class="eyebrow">${isEnd ? 'EXPEDITION COMPLETE' : 'YOUR NEXT MOVE'}</div><h2 class="panel-title">${isEnd ? (state.phase === 'won' ? 'Victory!' : 'Defeat') : 'Choose an action'}</h2><p class="helper">${escapeHTML(instructions)}</p>${notice ? `<p class="notice">${escapeHTML(notice)}</p>` : ''}<div class="action-bar">${actionButtons}</div>${optionHTML}${isEnd ? '<button class="btn btn-primary" id="end-new">Start a new game →</button>' : ''}</div>${deckDisplay}</div></div>`;
    gameEl.innerHTML = `<div class="game-layout"><aside class="sidebar left-sidebar"><div class="panel ${panelClass('crew')}"><div class="panel-head"><div><div class="eyebrow">PLAYERS ${state.players.length > 2 ? '1 &amp; 3' : '1'}</div></div>${panelToggle('crew')}</div><div class="panel-body"><div class="player-list">${players}</div></div></div></aside><section class="board-area">${topRowHTML}<div class="board-row"><div class="board-wrap"><div class="board">${board}</div></div><div class="water-box water-vertical"><span class="section-label">WATER LEVEL</span><strong>${state.floodCount} <small>flood cards</small></strong><div class="meter-track"><div class="meter-fill" style="height:${Math.min(100, (state.water + 1) / 10 * 100)}%"></div></div><span class="small">${state.water >= 9 ? "Skull reached" : `${state.water + 1} of 9`}</span></div></div><div class="panel treasures-panel ${panelClass('treasures')}"><div class="panel-head"><div><div class="eyebrow">THE MISSION</div><h2 class="panel-title">Sacred treasures</h2></div>${panelToggle('treasures')}</div><div class="panel-body"><div class="treasure-strip">${treasures}</div></div></div><div class="panel log-panel ${panelClass('log')}"><div class="panel-head"><div><div class="eyebrow">EXPEDITION JOURNAL</div><h2 class="panel-title">Recent events</h2></div>${panelToggle('log')}</div><div class="panel-body"><div class="log">${log || '<div class="log-entry">Your adventure begins.</div>'}</div></div></div></section><aside class="sidebar right-sidebar"><div class="panel ${panelClass('crew2')}"><div class="panel-head"><div><div class="eyebrow">PLAYERS ${state.players.length > 3 ? '2 &amp; 4' : '2'}</div></div>${panelToggle('crew2')}</div><div class="panel-body"><div class="player-list">${playersRight}</div></div></div></aside></div>`;
    gameEl.querySelectorAll('[data-toggle]').forEach(button => button.onclick = () => {
      const id = button.dataset.toggle;
      if (hiddenPanels.has(id)) hiddenPanels.delete(id); else hiddenPanels.add(id);
      savePanels(); render();
    });
    gameEl.querySelectorAll('[data-deck]').forEach(button => button.onclick = () => {
      const type = button.dataset.deck === 'treasure' ? 'drawTreasure' : 'drawFlood';
      const action = legal.find(a => a.type === type);
      if (action) run(action);
    });
    gameEl.querySelectorAll('[data-hand-card]').forEach(button => button.onclick = () => {
      const card = button.dataset.handCard, owner = Number(button.dataset.owner);
      const canDiscard = legal.some(a => a.type === 'discard' && a.player === owner && a.card === card);
      const canPlay = legal.some(a => a.type === card && a.player === owner);
      const canEscape = card === 'helicopter' && legal.some(a => a.type === 'escape' && a.player === owner);
      selectedType = canDiscard ? 'discard' : canPlay ? card : canEscape ? 'escape' : 'give';
      cardFilter = {owner, card}; targetTile = null;
      // One obvious action (e.g. just discarding): do it on the first click.
      const matches = legal.filter(a => a.type === selectedType && (
        (selectedType === 'give' && a.card === card) ||
        (selectedType === 'discard' && a.player === owner && a.card === card) ||
        ((selectedType === 'helicopter' || selectedType === 'sandbag' || selectedType === 'escape') && a.player === owner)));
      if (matches.length === 1 && !(canDiscard && (canPlay || canEscape))) { run(matches[0]); return; }
      render();
      gameEl.querySelector('.tile.target:not(:disabled), [data-option], [data-card-choice]')?.focus();
    });
    gameEl.querySelectorAll('[data-type]').forEach(button => button.onclick = () => {
      const type = button.dataset.type;
      const matches = legal.filter(a => a.type === type);
      if (matches.length === 1 && ['endActions','drawTreasure','drawFlood','escape'].includes(type)) { run(matches[0]); return; }
      selectedType = selectedType === type && !cardFilter ? null : type; targetTile = null; cardFilter = null; render();
      if (selectedType) gameEl.querySelector('.tile.target:not(:disabled), [data-option]')?.focus();
    });
    gameEl.querySelectorAll('[data-tile]').forEach(button => button.onclick = () => {
      const tile = Number(button.dataset.tile);
      const matches = selected.filter(a => a.tile === tile || a.second === tile);
      if (matches.length === 1) run(matches[0]); else { targetTile = tile; render(); gameEl.querySelector('[data-option]')?.focus(); }
    });
    gameEl.querySelectorAll('[data-option]').forEach(button => button.onclick = () => run(options[Number(button.dataset.option)]));
    gameEl.querySelectorAll('[data-card-choice]').forEach(button => button.onclick = () => {
      selectedType = button.dataset.cardChoice; targetTile = null; render();
      gameEl.querySelector('.tile.target:not(:disabled), [data-option]')?.focus();
    });
    if ($('#clear-target')) $('#clear-target').onclick = () => { targetTile = null; render(); };
    if ($('#end-new')) $('#end-new').onclick = () => showSetup(true);
    $('#undo-button').disabled = !history.length;
  }
  $('#undo-button').onclick = undo;
  $('#new-button').onclick = () => showSetup(!!state);
  $('#rules-button').onclick = showRules;
  render();
})();
