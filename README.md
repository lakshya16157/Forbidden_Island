# Forbidden Island — local game

A minimal cooperative, shared-screen version for 2–4 players. Open **index.html** in a modern browser to play. No server, installation, or account is required. The browser saves the current game on this device, so reopening it resumes the expedition. Starting a new game replaces that save.

Choose an action, then choose a highlighted board tile or one of the listed options. You can also click a playable card in a hand to select its action, and click the highlighted deck to draw. The active player can take up to three actions and then draws treasure and flood cards one at a time. Any player can use a special card between events. Open “Decks & discard piles” to inspect discarded cards. “How to play” includes a quick guide and a link to the original rulebook.

To check the game engine, run `node --test engine.test.js` if Node.js is installed.

Forbidden Island is a game by Matt Leacock, published by Gamewright. This personal-use project uses original AI-generated location illustrations rather than the original game artwork. The island, card, and adventurer illustration atlases are stored locally in `assets/`.
