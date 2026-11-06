(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof globalThis !== 'undefined') globalThis.ForbiddenIsland = api;
})(this, function () {
  'use strict';
  const TREASURES = ['earth', 'fire', 'water', 'wind'];
  const NAMES = {earth: 'Earth Stone', fire: 'Crystal of Fire', water: "Ocean's Chalice", wind: 'Statue of the Wind', helicopter: 'Helicopter Lift', sandbag: 'Sandbags', rise: 'Waters Rise!'};
  const DEFINITIONS = [
    ['Breakers Bridge'], ['Bronze Gate', null, 'engineer'], ['Cave of Embers', 'fire'], ['Cave of Shadows', 'fire'],
    ['Cliffs of Abandon'], ['Copper Gate', null, 'explorer'], ['Coral Palace', 'water'], ['Crimson Forest'],
    ['Dunes of Deception'], ["Fools' Landing", null, 'pilot'], ['Gold Gate', null, 'navigator'], ['Howling Garden', 'wind'],
    ['Iron Gate', null, 'diver'], ['Lost Lagoon'], ['Misty Marsh'], ['Observatory'], ['Phantom Rock'],
    ['Silver Gate', null, 'messenger'], ['Temple of the Moon', 'earth'], ['Temple of the Sun', 'earth'],
    ['Tidal Palace', 'water'], ['Twilight Hollow'], ['Watchtower'], ['Whispering Garden', 'wind']
  ];
  const ROLES = ['diver','engineer','explorer','messenger','navigator','pilot'];
  const ROLE_NAMES = {diver:'Diver',engineer:'Engineer',explorer:'Explorer',messenger:'Messenger',navigator:'Navigator',pilot:'Pilot'};
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; --i) { const j = Math.floor(Math.random() * (i + 1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
  function floodCount(water) { return [2,2,3,3,3,4,4,5,5][Math.min(water,8)]; }
  function note(s, text) { s.log.unshift(text); if (s.log.length > 50) s.log.length = 50; }
  function newGame(count, difficulty = 'novice') {
    count = Number(count);
    if (![2,3,4].includes(count)) throw new Error('Choose 2–4 players.');
    const difficultyLevels = {novice:0,normal:1,elite:2,legendary:3};
    const water = Object.prototype.hasOwnProperty.call(difficultyLevels, difficulty) ? difficultyLevels[difficulty] : 0;
    const coords = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((y >= 1 && y <= 4 && x >= 1 && x <= 4) || ((y === 0 || y === 5) && (x === 2 || x === 3)) || ((x === 0 || x === 5) && (y === 2 || y === 3))) coords.push([x,y]);
    const shuffled = shuffle(DEFINITIONS);
    const tiles = shuffled.map((d,i) => ({id:i,name:d[0],treasure:d[1] || null,start:d[2] || null,x:coords[i][0],y:coords[i][1],status:'dry'}));
    const floodDeck = shuffle(tiles.map(t => t.id));
    const floodDiscard = [];
    for (let i=0; i<6; i++) { const id = floodDeck.pop(); tiles[id].status = 'flooded'; floodDiscard.push(id); }
    const roles = shuffle(ROLES).slice(0,count);
    const players = roles.map((role,id) => ({id,role,tile:tiles.find(t => t.start === role).id,hand:[]}));
    let treasureDeck = shuffle([...TREASURES.flatMap(t => Array(5).fill(t)), ...Array(3).fill('helicopter'), ...Array(2).fill('sandbag')]);
    for (let r=0;r<2;r++) for (const p of players) p.hand.push(treasureDeck.pop());
    treasureDeck = shuffle([...treasureDeck, ...Array(3).fill('rise')]);
    return {tiles,players,current:0,actionsLeft:3,phase:'actions',water,floodCount:floodCount(water),treasures:{earth:false,fire:false,water:false,wind:false},treasureDeck,treasureDiscard:[],floodDeck,floodDiscard,treasureDraws:0,floodDraws:0,pilotUsed:false,swimmers:[],resumePhase:null,log:['The island is ready. Player 1 takes the first turn.']};
  }
  const tileAt = (s,x,y) => s.tiles.find(t => t.x === x && t.y === y);
  function adjacent(a,b,diagonal=false) { const dx=Math.abs(a.x-b.x), dy=Math.abs(a.y-b.y); return (dx || dy) && (diagonal ? dx <= 1 && dy <= 1 : dx+dy === 1); }
  function neighbors(s,id,diagonal=false) { return s.tiles.filter(t => adjacent(s.tiles[id],t,diagonal)); }
  function reachable(s,player) {
    const start = s.tiles[player.tile];
    if (player.role !== 'diver') return neighbors(s,player.tile,player.role === 'explorer').filter(t=>t.status !== 'sunk').map(t=>t.id);
    // The Diver can traverse chains of flooded or missing spaces and finish on any adjacent remaining tile.
    const seen = new Set([start.id]), queue = [start.id], destinations = new Set();
    while (queue.length) {
      const id = queue.shift();
      for (const t of neighbors(s,id)) {
        if (t.id !== start.id && t.status !== 'sunk') destinations.add(t.id);
        if (!seen.has(t.id) && t.status !== 'dry') { seen.add(t.id); queue.push(t.id); }
      }
    }
    return [...destinations];
  }
  function swimOptions(s, player) {
    if (player.role === 'pilot') return s.tiles.filter(t => t.status !== 'sunk').map(t=>t.id);
    if (player.role !== 'diver') return neighbors(s,player.tile,player.role === 'explorer').filter(t=>t.status !== 'sunk').map(t=>t.id);
    // Search through sunk spaces, stopping at the closest surviving tiles.
    let frontier=[player.tile], visited=new Set(frontier);
    while (frontier.length) {
      const next=[], found=[];
      for (const id of frontier) for (const t of neighbors(s,id)) {
        if (visited.has(t.id)) continue;
        visited.add(t.id);
        if (t.status !== 'sunk') found.push(t.id); else next.push(t.id);
      }
      if (found.length) return found;
      frontier=next;
    }
    return [];
  }
  function descriptor(type,label,rest={}) { return {type,label,...rest}; }
  function legal(s) {
    if (!s || ['won','lost'].includes(s.phase)) return [];
    const out=[]; const add=(type,label,rest) => out.push(descriptor(type,label,rest));
    const current=s.players[s.current];
    if (s.phase === 'actions') {
      for (const id of reachable(s,current)) add('move',`Move to ${s.tiles[id].name}`,{tile:id});
      if (current.role === 'pilot' && !s.pilotUsed) for (const t of s.tiles) if (t.status !== 'sunk' && t.id !== current.tile) add('fly',`Fly to ${t.name}`,{tile:t.id});
      const nearby=s.tiles.filter(t=>t.status === 'flooded' && (t.id === current.tile || adjacent(s.tiles[current.tile],t,current.role === 'explorer')));
      for (const t of nearby) add('shore',`Shore up ${t.name}`,{tile:t.id});
      if (current.role === 'engineer') for (let i=0;i<nearby.length;i++) for (let j=i+1;j<nearby.length;j++) add('shore',`Shore up ${nearby[i].name} and ${nearby[j].name}`,{tile:nearby[i].id,second:nearby[j].id});
      for (const p of s.players) if (p.id !== current.id && (p.tile === current.tile || current.role === 'messenger')) for (const card of new Set(current.hand.filter(c=>TREASURES.includes(c)))) add('give',`Give ${NAMES[card]} to Player ${p.id+1}`,{player:p.id,card});
      const here=s.tiles[current.tile];
      if (here.treasure && !s.treasures[here.treasure] && current.hand.filter(c=>c===here.treasure).length >= 4) add('capture',`Capture ${NAMES[here.treasure]}`,{treasure:here.treasure});
      if (current.role === 'navigator') for (const p of s.players) if (p.id !== current.id) {
        // The Navigator moves at most two spaces, even when moving the Diver.
        // Only the Diver may cross a missing first space; nobody may end there.
        const first=neighbors(s,p.tile,p.role === 'explorer').filter(t=>t.status !== 'sunk' || p.role === 'diver');
        const destinations = new Set(first.filter(t=>t.status !== 'sunk').map(t=>t.id));
        for (const mid of first) for (const end of neighbors(s,mid.id,p.role === 'explorer')) if (end.status !== 'sunk' && end.id !== p.tile) destinations.add(end.id);
        for (const id of destinations) add('navigate',`Move Player ${p.id+1} to ${s.tiles[id].name}`,{player:p.id,tile:id});
      }
      add('endActions','End actions and draw Treasure cards');
    } else if (s.phase === 'treasure') add('drawTreasure',`Draw Treasure card (${s.treasureDraws} remaining)`);
    else if (s.phase === 'flood') add('drawFlood',`Draw Flood card (${s.floodDraws} remaining)`);
    else if (s.phase === 'discard') {
      const p=s.players.find(p=>p.hand.length>5);
      if (p) for (const card of new Set(p.hand)) add('discard',`Player ${p.id+1}: discard ${NAMES[card]}`,{player:p.id,card});
    } else if (s.phase === 'swim') {
      const p=s.players[s.swimmers[0]];
      for (const id of swimOptions(s,p)) add('swim',`Player ${p.id+1} swims to ${s.tiles[id].name}`,{player:p.id,tile:id});
    }
    // Special cards are free and can be played by any holder at any point between game events.
    // A sinking tile is already removed by the time a swim is offered.
    for (const holder of s.players) {
      if (holder.hand.includes('sandbag')) for (const t of s.tiles) if (t.status === 'flooded') add('sandbag',`Player ${holder.id+1}: sandbag ${t.name}`,{player:holder.id,tile:t.id});
      if (!holder.hand.includes('helicopter')) continue;
      const landing=s.tiles.find(t=>t.name === "Fools' Landing");
      if (Object.values(s.treasures).every(Boolean) && s.players.every(p=>p.tile === landing.id) && landing.status !== 'sunk') add('escape',`Player ${holder.id+1}: escape from Fools' Landing`,{player:holder.id});
      const groups = new Map();
      // A Lift can rescue pawns from a tile that has just sunk.  It cannot
      // restore that tile, and any pawns left behind must still swim.
      for (const p of s.players) if (s.tiles[p.tile].status !== 'sunk' || (s.phase === 'swim' && s.swimmers.includes(p.id))) { if (!groups.has(p.tile)) groups.set(p.tile,[]); groups.get(p.tile).push(p.id); }
      for (const [from, ids] of groups) for (let mask=1;mask < (1<<ids.length);mask++) {
        const passengers=ids.filter((_,i)=>mask & (1<<i));
        for (const t of s.tiles) if (t.status !== 'sunk' && t.id !== from) add('helicopter',`Player ${holder.id+1}: fly ${passengers.map(i=>`P${i+1}`).join(', ')} to ${t.name}`,{player:holder.id,passengers,tile:t.id});
      }
    }
    return out;
  }
  function lose(s,reason) { s.phase='lost'; s.reason=reason; note(s,`Defeat: ${reason}`); }
  function checkOverLimit(s) {
    if (s.players.some(p=>p.hand.length>5) && s.phase !== 'discard') { s.resumePhase=s.phase; s.phase='discard'; }
    else if (!s.players.some(p=>p.hand.length>5) && s.phase === 'discard') { s.phase=s.resumePhase; s.resumePhase=null; }
  }
  function finishActions(s) { s.phase='treasure'; s.treasureDraws=2; s.actionsLeft=0; }
  function advanceTurn(s) { s.current=(s.current+1)%s.players.length; s.actionsLeft=3; s.phase='actions'; s.pilotUsed=false; note(s,`Player ${s.current+1}'s turn begins.`); }
  function resolveSwimmers(s) {
    if (!s.swimmers.length) {
      s.phase='flood';
      if (!s.floodDraws) advanceTurn(s);
      return;
    }
    // A Helicopter Lift may save a stranded pawn as its tile sinks.  If no
    // one holds one, there is no way to resolve that pawn's immediate swim.
    const stranded=s.swimmers.find(id=>!swimOptions(s,s.players[id]).length);
    if (stranded !== undefined && !s.players.some(p=>p.hand.includes('helicopter'))) lose(s,`Player ${stranded+1} cannot swim to safety.`);
  }
  function loseForSunkTile(s,tile) {
    if (tile.name === "Fools' Landing") { lose(s,"Fools' Landing sank."); return true; }
    if (tile.treasure && !s.treasures[tile.treasure] && s.tiles.filter(t=>t.treasure === tile.treasure).every(t=>t.status==='sunk')) { lose(s,`Both sites for ${NAMES[tile.treasure]} have sunk.`); return true; }
    return false;
  }
  function normalize(a) { const copy={...a}; delete copy.label; return JSON.stringify(Object.fromEntries(Object.entries(copy).sort(([a],[b])=>a.localeCompare(b)))); }
  function act(s,action) {
    const key=normalize(action || {});
    const valid=legal(s).find(a=>normalize(a)===key);
    if (!valid) return {ok:false,error:'That action is not currently available.'};
    const a=valid, p=s.players[s.current];
    const consume = () => { s.actionsLeft--; if (s.actionsLeft === 0) finishActions(s); };
    switch (a.type) {
      case 'move': case 'fly': p.tile=a.tile; if (a.type==='fly') s.pilotUsed=true; note(s,`Player ${p.id+1} ${a.type === 'fly' ? 'flies' : 'moves'} to ${s.tiles[a.tile].name}.`); consume(); break;
      case 'shore': s.tiles[a.tile].status='dry'; if (a.second !== undefined) s.tiles[a.second].status='dry'; note(s,`Player ${p.id+1} shores up ${s.tiles[a.tile].name}${a.second !== undefined ? ' and '+s.tiles[a.second].name : ''}.`); consume(); break;
      case 'give': p.hand.splice(p.hand.indexOf(a.card),1); s.players[a.player].hand.push(a.card); note(s,`Player ${p.id+1} gives ${NAMES[a.card]} to Player ${a.player+1}.`); consume(); checkOverLimit(s); break;
      case 'capture': for(let i=0;i<4;i++) { p.hand.splice(p.hand.indexOf(a.treasure),1); s.treasureDiscard.push(a.treasure); } s.treasures[a.treasure]=true; note(s,`The team captured ${NAMES[a.treasure]}!`); consume(); break;
      case 'navigate': s.players[a.player].tile=a.tile; note(s,`Player ${p.id+1} navigates Player ${a.player+1} to ${s.tiles[a.tile].name}.`); consume(); break;
      case 'endActions': finishActions(s); break;
      case 'drawTreasure': {
        if (!s.treasureDeck.length && s.treasureDiscard.length) { s.treasureDeck=shuffle(s.treasureDiscard); s.treasureDiscard=[]; }
        const card=s.treasureDeck.pop();
        if (!card) { lose(s,'No Treasure cards are available to draw.'); break; }
        // The deck is replenished immediately when its last card is drawn, before the current card is discarded.
        if (!s.treasureDeck.length && s.treasureDiscard.length) { s.treasureDeck=shuffle(s.treasureDiscard); s.treasureDiscard=[]; }
        s.treasureDraws--;
        if (card==='rise') {
          s.water++; s.floodCount=floodCount(s.water); s.floodDeck.push(...shuffle(s.floodDiscard)); s.floodDiscard=[]; s.treasureDiscard.push('rise');
          note(s,`Waters Rise! Water is at tick ${s.water+1}; draw ${s.floodCount} Flood cards.`);
          if (s.water>=9) { lose(s,'The water reached the skull.'); break; }
        } else { p.hand.push(card); note(s,`Player ${p.id+1} draws ${NAMES[card]}.`); }
        if (!s.treasureDraws) { s.phase='flood'; s.floodDraws=s.floodCount; }
        checkOverLimit(s); break;
      }
      case 'drawFlood': {
        if (!s.floodDeck.length) { s.floodDeck=shuffle(s.floodDiscard); s.floodDiscard=[]; }
        const id=s.floodDeck.pop(), t=s.tiles[id];
        if (!t) { lose(s,'No island remains.'); break; }
        s.floodDraws--;
        if (t.status==='dry') { t.status='flooded'; s.floodDiscard.push(id); note(s,`${t.name} floods.`); }
        else { t.status='sunk'; note(s,`${t.name} sinks!`); if (loseForSunkTile(s,t)) break; s.swimmers=s.players.filter(p=>p.tile===id).map(p=>p.id); if (s.swimmers.length) { s.phase='swim'; resolveSwimmers(s); if (s.phase==='lost') break; } }
        if (!s.floodDeck.length) { s.floodDeck=shuffle(s.floodDiscard); s.floodDiscard=[]; }
        if (!s.floodDraws && s.phase==='flood') advanceTurn(s);
        break;
      }
      case 'swim': s.players[a.player].tile=a.tile; s.swimmers.shift(); note(s,`Player ${a.player+1} swims to ${s.tiles[a.tile].name}.`); resolveSwimmers(s); break;
      case 'discard': { const hand=s.players[a.player].hand; hand.splice(hand.indexOf(a.card),1); s.treasureDiscard.push(a.card); note(s,`Player ${a.player+1} discards ${NAMES[a.card]}.`); checkOverLimit(s); break; }
      case 'sandbag': { const hand=s.players[a.player].hand; hand.splice(hand.indexOf('sandbag'),1); s.treasureDiscard.push('sandbag'); s.tiles[a.tile].status='dry'; note(s,`Player ${a.player+1} uses Sandbags on ${s.tiles[a.tile].name}.`); checkOverLimit(s); break; }
      case 'helicopter': { const hand=s.players[a.player].hand; hand.splice(hand.indexOf('helicopter'),1); s.treasureDiscard.push('helicopter'); for (const id of a.passengers) s.players[id].tile=a.tile; note(s,`Player ${a.player+1} uses a Helicopter Lift to ${s.tiles[a.tile].name}.`); if (s.phase==='swim') { s.swimmers=s.swimmers.filter(id=>!a.passengers.includes(id)); resolveSwimmers(s); } checkOverLimit(s); break; }
      case 'escape': { const hand=s.players[a.player].hand; hand.splice(hand.indexOf('helicopter'),1); s.treasureDiscard.push('helicopter'); s.phase='won'; note(s,`The team escapes with all four treasures!`); break; }
    }
    return {ok:true};
  }
  return {newGame,legal,act,TREASURES,NAMES,ROLE_NAMES};
});
