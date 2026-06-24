# Computing 2 Submission

This folder contains my Computing 2 web application coursework. The project is a JavaScript browser game called **Campus Tycoon**. It is based on a traditional Monopoly-style board game, but simplified so the rules are clear, testable, and suitable for the assignment.

## Submission Structure

```text
.
├── README.md
├── jsdoc.json
├── package.json
├── package-lock.json
└── web-app/
    ├── index.html
    ├── default.css
    ├── main.js
    ├── game.js
    ├── ramda.js
    ├── assets/
    │   ├── characters/
    │   ├── data/
    │   │   ├── characters.json
    │   │   ├── skills.json
    │   │   └── map1.json
    │   ├── tiles/
    │   └── ui/
    └── tests/
        └── game.test.js
```

## What Each File Contains

```text
README.md
```

This document. It explains the submission structure, the game idea, the game module API, and the unit tests.

```text
jsdoc.json
```

Configuration file for generating JSDoc documentation from `web-app/game.js`.

```text
package.json
```

Defines the project name, module type, and useful commands such as `npm test`, `npm start`, and `npm run docs`.

```text
package-lock.json
```

Locks the installed npm dependency versions, mainly Mocha and JSDoc. This should be submitted with `package.json` so the dependency versions are reproducible.

```text
web-app/index.html
```

The main HTML page for the web app. This is the browser entry point. It loads `default.css` and `main.js`.

```text
web-app/default.css
```

The stylesheet for the web app. It controls the board layout, player cards, buttons, colours, spacing, popups, and responsive layout.

```text
web-app/main.js
```

The browser interface code. It renders the board and player information, handles button clicks, shows popups, and calls functions from `game.js`. It does not contain the main game rules.

```text
web-app/game.js
```

The pure game module. It stores the board setup, player setup, game state structure, movement rules, buying rules, rent, cards, special tiles, bankruptcy, turn order, and winner checking.

```text
web-app/ramda.js
```

A small local placeholder file from the template structure. The current game uses native JavaScript methods instead of relying on Ramda.

```text
web-app/tests/game.test.js
```

Mocha unit tests for the game module. These tests check game behaviour, not DOM rendering.

```text
web-app/assets/data/characters.json
web-app/assets/data/skills.json
web-app/assets/data/map1.json
```

Small data files included for the required assets structure. The current game logic is mainly kept in `game.js` to make it easier to test.

```text
web-app/assets/characters/
web-app/assets/tiles/
web-app/assets/ui/
```

Asset folders kept for the required template structure. They currently contain placeholder `.gitkeep` files and can be used for images or icons if the project is extended.

## Game Overview

Campus Tycoon is a simplified Monopoly-style game with a university campus theme.

- There are 4 default players.
- The board has 25 rectangular tiles.
- Players roll two dice and move around the board in a loop.
- Passing or landing on Start gives bonus money.
- Most tiles are properties.
- Players can buy unowned properties if they have enough money.
- If a player lands on a property owned by another player, they pay rent.
- Tax tiles remove money.
- Bonus and chance tiles add or remove money.
- If a player's money drops below zero, they become bankrupt.
- Bankrupt players are skipped.
- The last non-bankrupt player wins.

## How To Run

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Start the web app:

```bash
npm start
```

Then open:

```text
http://localhost:8001
```

## Game Module API

The game module is in `web-app/game.js`. It is independent from the DOM and can be imported by tests, used by `main.js`, or accessed from the browser console as:

```js
window.CampusTycoonGame
```

Main exported functions:

- `createInitialState(playerNames)` creates the starting game state for 2 to 4 players.
- `getCurrentPlayer(state)` returns the active player.
- `rollDice(randomFn)` rolls two dice. The random function can be injected for tests.
- `movePlayer(state, playerId, steps)` moves a player around the loop and awards Start bonus money.
- `resolveTile(state, playerId)` applies the effect of the tile the player landed on.
- `buyProperty(state, playerId)` buys an affordable unowned property.
- `skipBuyProperty(state, playerId)` skips a property purchase and ends the turn.
- `endTurn(state)` advances to the next non-bankrupt player.
- `takeTurn(state, diceRoll)` performs a full dice roll turn.
- `checkWinner(state)` returns the winner when only one player remains.
- `getTileAtPosition(state, position)` returns a tile using loop wrapping.
- `getPlayerProperties(state, playerId)` returns all properties owned by one player.
- `getPlayerNetWorth(state, playerId)` returns money plus property values.

## Unit Test Description

The tests are in `web-app/tests/game.test.js`. They focus on behaviour rather than internal implementation.

The tests check:

- Initial state creates the correct player count and 25-tile board.
- `getTileAtPosition` wraps correctly around the loop.
- Movement wraps around the board.
- Passing or landing on Start awards money.
- Landing on an affordable unowned property enters the buy decision phase.
- Buying a property subtracts money and assigns ownership.
- Landing on another player's property charges rent.
- Players become bankrupt when money drops below zero.
- `endTurn` skips bankrupt players.
- `checkWinner` detects the last active player.
- The game module can run without the DOM.

## Implementation Notes

The main rule I followed is separation of concerns:

- `game.js` contains game state and game rules.
- `main.js` contains DOM rendering and user interaction.
- `game.test.js` tests the game module directly.

The game state is represented as plain JavaScript objects, which makes it easier to inspect in tests and in the browser console.
