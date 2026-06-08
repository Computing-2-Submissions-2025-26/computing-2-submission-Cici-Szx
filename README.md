# Campus Tycoon

Campus Tycoon is a simple traditional Monopoly-style browser game for four players. Players move around a 25-tile rectangular board, buy campus-themed properties, pay rent, collect bonuses, pay taxes, and try to be the last player not bankrupt.

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

Then open `http://localhost:8001`.

## Project Structure

```text
web-app/game.js              Pure game module
web-app/main.js              DOM rendering and button handling
web-app/default.css          Styling
web-app/tests/game.test.js   Mocha unit tests
web-app/assets/data          Coursework data placeholders
```

## Game Module API

The game module is in `web-app/game.js`. It is independent from the DOM and can be imported by tests, used by `main.js`, or accessed from the browser console as `window.CampusTycoonGame`.

Main exported functions:

- `createInitialState(playerNames)` creates the starting game state for 2 to 4 players.
- `getCurrentPlayer(state)` returns the active player.
- `rollDice(randomFn)` rolls two dice. The random function can be injected for tests.
- `movePlayer(state, playerId, steps)` moves a player around the loop and awards Start bonus money.
- `resolveTile(state, playerId)` applies the landed tile effect.
- `buyProperty(state, playerId)` buys an affordable unowned property.
- `skipBuyProperty(state, playerId)` skips a purchase and ends the turn.
- `endTurn(state)` advances to the next non-bankrupt player.
- `takeTurn(state, diceRoll)` performs one roll phase.
- `checkWinner(state)` returns the winner when only one player remains.
- `getTileAtPosition(state, position)` returns a tile using loop wrapping.
- `getPlayerProperties(state, playerId)` returns owned properties.
- `getPlayerNetWorth(state, playerId)` returns money plus property values.

## Unit Test Specification

The tests focus on behaviour rather than implementation details:

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

## Design Notes

The implementation keeps rules in `game.js` and rendering in `main.js`. State is represented as plain JavaScript objects, and updates return new state objects where practical. The UI uses a rectangular 25-tile board with clear player colours and visible property ownership.
