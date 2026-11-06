const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('./engine.js');
const {newGame, legal, act} = game;
const find = (s, type, pred = () => true) => legal(s).find(a => a.type === type && pred(a));
const run = (s, type, pred) => { const a = find(s, type, pred); assert.ok(a, `expected legal ${type}`); assert.equal(act(s, a).ok, true); return a; };
const dry = s => s.tiles.forEach(t => t.status = 'dry');

test('setup has the correct island, decks, hands, and starting positions for 2–4 players', () => {
  for (const count of [2,3,4]) for (let i = 0; i < 20; i++) {
    const s = newGame(count);
    assert.equal(s.tiles.length,24); assert.equal(new Set(s.tiles.map(t=>`${t.x},${t.y}`)).size,24);
    assert.equal(s.tiles.filter(t=>t.status==='flooded').length,6);
    assert.equal(s.floodDeck.length,18); assert.equal(s.floodDiscard.length,6);
    assert.equal(s.players.length,count); assert.equal(new Set(s.players.map(p=>p.role)).size,count);
    for (const p of s.players) { assert.equal(s.tiles[p.tile].start,p.role); assert.equal(p.hand.length,2); assert.ok(!p.hand.includes('rise')); }
    const all=[...s.treasureDeck,...s.treasureDiscard,...s.players.flatMap(p=>p.hand)];
    for (const t of game.TREASURES) assert.equal(all.filter(c=>c===t).length,5);
    assert.equal(all.filter(c=>c==='rise').length,3); assert.equal(all.filter(c=>c==='helicopter').length,3); assert.equal(all.filter(c=>c==='sandbag').length,2);
  }
});

test('ordinary moves, shore up, giving cards and capturing treasure cost actions', () => {
  const s=newGame(2); dry(s); s.players[0].role='messenger';
  const p=s.players[0]; const old=p.tile; const dest=find(s,'move').tile;
  run(s,'move',a=>a.tile===dest); assert.equal(p.tile,dest); assert.equal(s.actionsLeft,2);
  s.tiles[dest].status='flooded'; run(s,'shore',a=>a.tile===dest); assert.equal(s.tiles[dest].status,'dry');
  p.hand=['earth']; run(s,'give',a=>a.card==='earth' && a.player===1); assert.ok(s.players[1].hand.includes('earth')); assert.equal(s.phase,'treasure');
  const s2=newGame(2); const tile=s2.tiles.find(t=>t.treasure==='earth'); s2.players[0].tile=tile.id; tile.status='flooded'; s2.players[0].hand=['earth','earth','earth','earth'];
  run(s2,'capture'); assert.equal(s2.treasures.earth,true); assert.equal(s2.players[0].hand.length,0); assert.equal(s2.actionsLeft,2);
});

test('role powers: Explorer, Engineer, Pilot, Messenger, and Diver', () => {
  const s=newGame(2); dry(s); const p=s.players[0]; p.tile=s.tiles.find(t=>t.x===2&&t.y===2).id;
  const diag=s.tiles.find(t=>t.x===3&&t.y===3); p.role='explorer'; diag.status='flooded';
  assert.ok(find(s,'move',a=>a.tile===diag.id)); assert.ok(find(s,'shore',a=>a.tile===diag.id));
  p.role='engineer'; const own=s.tiles[p.tile], adj=s.tiles.find(t=>t.x===3&&t.y===2); own.status='flooded'; adj.status='flooded';
  run(s,'shore',a=>a.second!==undefined && [a.tile,a.second].includes(own.id) && [a.tile,a.second].includes(adj.id)); assert.equal(s.actionsLeft,2); assert.equal(own.status,'dry'); assert.equal(adj.status,'dry');
  p.role='pilot'; run(s,'fly'); assert.ok(!find(s,'fly'));
  const s2=newGame(2); dry(s2); const d=s2.players[0]; d.role='diver'; d.tile=s2.tiles.find(t=>t.x===1&&t.y===2).id;
  const mid=s2.tiles.find(t=>t.x===2&&t.y===2), far=s2.tiles.find(t=>t.x===3&&t.y===2); mid.status='sunk';
  assert.ok(find(s2,'move',a=>a.tile===far.id));
  d.role='engineer'; assert.ok(!find(s2,'move',a=>a.tile===far.id));
});

test('waters rise shuffles flood discard to top, raises water and does not replace the draw', () => {
  const s=newGame(2); run(s,'endActions'); s.treasureDeck=['earth','rise'];
  const previous=s.floodDiscard.slice(); const oldWater=s.water; run(s,'drawTreasure');
  assert.equal(s.water,oldWater+1); assert.equal(s.treasureDraws,1); assert.equal(s.floodDiscard.length,0);
  assert.deepEqual(new Set(s.floodDeck.slice(-previous.length)),new Set(previous)); assert.ok(s.treasureDiscard.includes('rise'));
});

test('hand limit interrupts draws and allows a special card to be used', () => {
  const s=newGame(2); dry(s); const p=s.players[0]; p.hand=['earth','earth','fire','wind','sandbag'];
  const tile=s.tiles[0]; tile.status='flooded'; run(s,'endActions'); s.treasureDeck=['water','fire']; run(s,'drawTreasure');
  assert.equal(s.phase,'discard'); assert.equal(p.hand.length,6); run(s,'sandbag',a=>a.player===0&&a.tile===tile.id);
  assert.equal(s.phase,'treasure'); assert.equal(p.hand.length,5); assert.equal(tile.status,'dry');
});

test('flood card first floods and next sinks; occupant must swim before turn advances', () => {
  const s=newGame(2); dry(s); const t=s.tiles.find(t=>!t.treasure && t.name!=="Fools' Landing"); s.players[0].tile=t.id; s.players[0].role='engineer'; s.players[1].tile=s.tiles.find(q=>q.id!==t.id).id;
  s.phase='flood'; s.floodDraws=2; s.floodDeck=[t.id]; s.floodDiscard=[];
  run(s,'drawFlood'); assert.equal(t.status,'flooded'); assert.equal(s.phase,'flood');
  run(s,'drawFlood'); assert.equal(t.status,'sunk'); assert.equal(s.phase,'swim'); assert.equal(s.current,0);
  run(s,'swim'); assert.equal(s.phase,'actions'); assert.equal(s.current,1);
});

test('loss occurs when landing or last unclaimed treasure site sinks, or water reaches skull', () => {
  for (const target of ['landing','treasure']) {
    const s=newGame(2); dry(s); const t=target==='landing' ? s.tiles.find(t=>t.name==="Fools' Landing") : s.tiles.find(t=>t.treasure==='earth');
    if (target==='treasure') s.tiles.filter(q=>q.treasure==='earth'&&q.id!==t.id).forEach(q=>q.status='sunk');
    t.status='flooded'; s.phase='flood'; s.floodDraws=1; s.floodDeck=[t.id]; run(s,'drawFlood'); assert.equal(s.phase,'lost');
  }
  const s=newGame(2); s.water=8; s.phase='treasure'; s.treasureDraws=1; s.treasureDeck=['rise']; run(s,'drawTreasure'); assert.equal(s.phase,'lost');
});

test('helicopter moves a chosen group and escape requires all treasures and all players', () => {
  const s=newGame(2); dry(s); const landing=s.tiles.find(t=>t.name==="Fools' Landing"); const other=s.tiles.find(t=>t.id!==landing.id);
  s.players.forEach(p=>p.tile=other.id); s.players[0].hand=['helicopter','helicopter'];
  assert.ok(!find(s,'escape')); run(s,'helicopter',a=>a.player===0&&a.tile===landing.id&&a.passengers.length===2);
  assert.ok(s.players.every(p=>p.tile===landing.id)); assert.ok(!find(s,'escape'));
  Object.keys(s.treasures).forEach(t=>s.treasures[t]=true); run(s,'escape'); assert.equal(s.phase,'won');
});

test('Navigator moves the Diver through a missing space but only up to two spaces', () => {
  const s=newGame(2); dry(s); s.players[0].role='navigator'; const p=s.players[1]; p.role='diver';
  const tile=(x,y)=>s.tiles.find(t=>t.x===x&&t.y===y);
  p.tile=tile(1,2).id; tile(2,2).status='sunk'; tile(3,2).status='flooded';
  const two=tile(3,2), three=tile(4,2);
  assert.ok(find(s,'navigate',a=>a.player===1&&a.tile===two.id));
  assert.ok(!find(s,'navigate',a=>a.player===1&&a.tile===three.id));
  run(s,'navigate',a=>a.player===1&&a.tile===two.id); assert.equal(p.tile,two.id); assert.equal(s.actionsLeft,2);
});

test('a stranded ordinary pawn loses; Explorer and Pilot have escape options', () => {
  for (const role of ['engineer','explorer','pilot']) {
    const s=newGame(2); dry(s); const p=s.players[0]; p.role=role;
    s.players.forEach(p=>p.hand=[]);
    const t=s.tiles.find(t=>t.x===2&&t.y===2); p.tile=t.id; s.players[1].tile=s.tiles.find(q=>q.id!==t.id).id; t.name='Test island'; t.treasure=null; t.status='flooded';
    for (const q of s.tiles) if (Math.abs(q.x-t.x)+Math.abs(q.y-t.y)===1) q.status='sunk';
    s.phase='flood'; s.floodDraws=1; s.floodDeck=[t.id]; s.floodDiscard=[]; run(s,'drawFlood');
    if (role==='engineer') assert.equal(s.phase,'lost');
    else { assert.equal(s.phase,'swim'); assert.ok(find(s,'swim',a=>a.player===0)); }
  }
});

test('a Helicopter Lift can rescue stranded players from a sinking tile, but Sandbags cannot save it', () => {
  const s=newGame(2); dry(s);
  const t=s.tiles.find(t=>t.x===2&&t.y===2); t.name='Test island'; t.treasure=null; t.status='flooded';
  s.players[0].role='engineer'; s.players[0].tile=t.id; s.players[0].hand=['sandbag'];
  s.players[1].tile=s.tiles.find(q=>q.id!==t.id).id; s.players[1].hand=['helicopter'];
  for (const q of s.tiles) if (Math.abs(q.x-t.x)+Math.abs(q.y-t.y)===1) q.status='sunk';
  s.phase='flood'; s.floodDraws=1; s.floodDeck=[t.id]; s.floodDiscard=[];
  run(s,'drawFlood');
  assert.equal(s.phase,'swim'); assert.equal(t.status,'sunk');
  assert.ok(!find(s,'sandbag',a=>a.tile===t.id));
  assert.ok(!find(s,'swim',a=>a.player===0));
  const destination=s.tiles.find(q=>q.status==='dry');
  run(s,'helicopter',a=>a.player===1 && a.tile===destination.id && a.passengers.length===1 && a.passengers[0]===0);
  assert.equal(s.players[0].tile,destination.id); assert.equal(s.phase,'actions'); assert.equal(t.status,'sunk');
  assert.ok(s.treasureDiscard.includes('helicopter'));
});

test('leaving a stranded swimmer behind after the last helicopter is used loses the game', () => {
  const s=newGame(2); dry(s);
  const t=s.tiles.find(t=>t.x===2&&t.y===2); t.name='Test island'; t.treasure=null; t.status='flooded';
  s.players.forEach(p=>{p.role='engineer'; p.tile=t.id; p.hand=[];}); s.players[1].hand=['helicopter'];
  for (const q of s.tiles) if (Math.abs(q.x-t.x)+Math.abs(q.y-t.y)===1) q.status='sunk';
  s.phase='flood'; s.floodDraws=1; s.floodDeck=[t.id]; s.floodDiscard=[];
  run(s,'drawFlood'); assert.equal(s.phase,'swim');
  run(s,'helicopter',a=>a.passengers.length===1 && a.passengers[0]===1);
  assert.equal(s.phase,'lost'); assert.match(s.reason,/cannot swim/);
});

test('deck exhaustion shuffles discards immediately and consecutive rises intensify once', () => {
  const s=newGame(2); s.phase='treasure'; s.treasureDraws=2;
  s.treasureDeck=['rise']; s.treasureDiscard=['rise'];
  const oldFlood=s.floodDeck.slice(), oldDiscard=s.floodDiscard.slice();
  run(s,'drawTreasure'); assert.deepEqual(s.treasureDeck,['rise']); assert.deepEqual(s.treasureDiscard,['rise']);
  const intensified=s.floodDeck.slice(); assert.deepEqual(new Set(intensified.slice(-oldDiscard.length)),new Set(oldDiscard));
  run(s,'drawTreasure'); assert.equal(s.water,2); assert.equal(s.phase,'flood');
  assert.deepEqual(s.floodDeck,intensified); assert.equal(s.floodDeck.length,oldFlood.length+oldDiscard.length);
});

test('water levels and difficulty starts match the water meter', () => {
  for (const [difficulty,tick,count] of [['novice',0,2],['normal',1,2],['elite',2,3],['legendary',3,3]]) {
    const s=newGame(2,difficulty); assert.equal(s.water,tick); assert.equal(s.floodCount,count);
  }
  const s=newGame(2);
  for (const [tick,count] of [[1,2],[2,3],[3,3],[4,3],[5,4],[6,4],[7,5],[8,5]]) {
    s.phase='treasure'; s.treasureDraws=1; s.treasureDeck=['rise'];
    run(s,'drawTreasure'); assert.equal(s.water,tick); assert.equal(s.floodCount,count); assert.equal(s.floodDraws,count);
  }
});

test('a gift that exceeds the hand limit interrupts the turn until the recipient resolves it', () => {
  const s=newGame(2); s.players[0].role='messenger'; s.players[0].hand=['earth'];
  s.players[1].hand=['fire','fire','wind','water','sandbag'];
  run(s,'give',a=>a.player===1 && a.card==='earth');
  assert.equal(s.phase,'discard'); assert.equal(s.actionsLeft,2); assert.equal(s.players[1].hand.length,6);
  assert.ok(!find(s,'move')); run(s,'discard',a=>a.player===1 && a.card==='fire');
  assert.equal(s.phase,'actions'); assert.equal(s.actionsLeft,2); assert.equal(s.players[1].hand.length,5);
});

test('captured treasure sites may both sink and escape can occur from flooded Fools Landing', () => {
  const s=newGame(2); dry(s); const sites=s.tiles.filter(t=>t.treasure==='earth');
  s.treasures.earth=true; sites[0].status='sunk'; sites[1].status='flooded';
  s.players.forEach(p=>{p.tile=s.tiles.find(t=>!sites.includes(t)).id; p.hand=[];});
  s.phase='flood'; s.floodDraws=1; s.floodDeck=[sites[1].id];
  run(s,'drawFlood'); assert.notEqual(s.phase,'lost'); assert.equal(sites[1].status,'sunk');
  Object.keys(s.treasures).forEach(t=>s.treasures[t]=true);
  const landing=s.tiles.find(t=>t.name==="Fools' Landing"); landing.status='flooded';
  s.players.forEach(p=>{p.tile=landing.id;}); s.players[0].hand=['helicopter'];
  run(s,'escape',a=>a.player===0); assert.equal(s.phase,'won');
});

test('invalid actions leave the game unchanged', () => {
  const s=newGame(2); const before=JSON.stringify(s);
  assert.equal(act(s,{type:'move',tile:999}).ok,false); assert.equal(JSON.stringify(s),before);
  assert.equal(act(s,{type:'capture',treasure:'earth'}).ok,false); assert.equal(JSON.stringify(s),before);
});

test('only the eight official sites permit capturing their matching treasure', () => {
  const s = newGame(2);
  const sites = {
    earth: ['Temple of the Moon', 'Temple of the Sun'],
    fire: ['Cave of Embers', 'Cave of Shadows'],
    water: ['Coral Palace', 'Tidal Palace'],
    wind: ['Howling Garden', 'Whispering Garden']
  };
  assert.equal(s.tiles.filter(tile => tile.treasure).length, 8);
  for (const [treasure, names] of Object.entries(sites)) {
    assert.deepEqual(s.tiles.filter(tile => tile.treasure === treasure).map(tile => tile.name).sort(), names.slice().sort());
    s.players[0].hand = Array(4).fill(treasure);
    for (const tile of s.tiles) {
      s.players[0].tile = tile.id;
      for (const status of ['dry', 'flooded']) {
        tile.status = status;
        const captures = game.legal(s).filter(action => action.type === 'capture');
        assert.equal(captures.length, Number(names.includes(tile.name)), `${treasure}: ${tile.name}, ${status}`);
        if (captures.length) assert.equal(captures[0].treasure, treasure);
      }
    }
  }
});
