import assert from "node:assert/strict";
import {
  STARTING_MONEY,
  START_BONUS,
  buyProperty,
  checkWinner,
  createInitialState,
  endTurn,
  getCurrentPlayer,
  getTileAtPosition,
  movePlayer,
  resolveTile,
  takeTurn,
} from "../game.js";

const dice = (total) => ({ die1: 1, die2: total - 1, total });

describe("Campus Tycoon game module", () => {
  it("creates the correct number of players and board tiles", () => {
    const state = createInitialState(["Ada", "Grace", "Alan"]);

    assert.equal(state.players.length, 3);
    assert.equal(state.board.length, 25);
    assert.ok(state.board.filter((tile) => tile.type === "property").length > 15);
    assert.equal(state.players[0].money, STARTING_MONEY);
    assert.match(state.players[0].color, /^#[0-9a-f]{6}$/i);
    assert.equal(state.phase, "roll");
  });

  it("getTileAtPosition works across the 25-tile loop", () => {
    const state = createInitialState(["Ada", "Grace"]);

    assert.equal(getTileAtPosition(state, 0).name, "Start");
    assert.equal(getTileAtPosition(state, 25).name, "Start");
    assert.equal(getTileAtPosition(state, 26).id, 1);
  });

  it("moves a player around the board with wrapping", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const movedState = movePlayer(state, 1, 26);

    assert.equal(movedState.players[0].position, 1);
    assert.equal(state.players[0].position, 0);
  });

  it("adds bonus money when passing Start", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const movedState = movePlayer(state, 1, 25);

    assert.equal(movedState.players[0].position, 0);
    assert.equal(movedState.players[0].money, STARTING_MONEY + START_BONUS);
  });

  it("sets buyDecision when landing on an affordable unowned property", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const nextState = takeTurn(state, dice(1));

    assert.equal(nextState.phase, "buyDecision");
    assert.equal(getCurrentPlayer(nextState).name, "Ada");
  });

  it("buyProperty subtracts money and assigns ownership", () => {
    const state = takeTurn(createInitialState(["Ada", "Grace"]), dice(1));
    const boughtState = buyProperty(state, 1);
    const library = boughtState.board[1];

    assert.equal(library.ownerId, 1);
    assert.deepEqual(boughtState.players[0].properties, [1]);
    assert.equal(boughtState.players[0].money, STARTING_MONEY - library.price);
    assert.equal(boughtState.phase, "roll");
  });

  it("charges rent when landing on another player's property", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      currentPlayerIndex: 1,
      players: [
        {
          id: 1,
          name: "Ada",
          color: "#e74c3c",
          position: 0,
          money: STARTING_MONEY,
          properties: [1],
          bankrupt: false,
        },
        {
          id: 2,
          name: "Grace",
          color: "#2e86de",
          position: 0,
          money: STARTING_MONEY,
          properties: [],
          bankrupt: false,
        },
      ],
      board: createInitialState(["Ada", "Grace"]).board.map((tile) =>
        tile.id === 1 ? { ...tile, ownerId: 1 } : tile,
      ),
    };
    const libraryRent = state.board[1].rent;

    const nextState = takeTurn(state, dice(1));

    assert.equal(nextState.players[0].money, STARTING_MONEY + libraryRent);
    assert.equal(nextState.players[1].money, STARTING_MONEY - libraryRent);
  });

  it("marks a player bankrupt if their money falls below zero", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      currentPlayerIndex: 1,
      players: [
        { ...baseState.players[0], properties: [1] },
        { ...baseState.players[1], money: 10 },
      ],
      board: baseState.board.map((tile) => (tile.id === 1 ? { ...tile, ownerId: 1 } : tile)),
    };
    const libraryRent = state.board[1].rent;

    const nextState = takeTurn(state, dice(1));

    assert.equal(nextState.players[1].bankrupt, true);
    assert.equal(nextState.players[1].money, 10 - libraryRent);
  });

  it("endTurn skips bankrupt players", () => {
    const baseState = createInitialState(["Ada", "Grace", "Alan"]);
    const state = {
      ...baseState,
      players: baseState.players.map((player) =>
        player.id === 2 ? { ...player, bankrupt: true, money: -1 } : player,
      ),
    };

    const nextState = endTurn(state);

    assert.equal(getCurrentPlayer(nextState).name, "Alan");
  });

  it("checkWinner returns a winner when only one player is not bankrupt", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      players: [baseState.players[0], { ...baseState.players[1], bankrupt: true }],
    };

    assert.equal(checkWinner(state).name, "Ada");
  });

  it("ends a four-player game after the other three players are bankrupt", () => {
    const baseState = createInitialState(["Ada", "Grace", "Alan", "Katherine"]);
    const state = {
      ...baseState,
      players: baseState.players.map((player) =>
        player.id === 1 ? player : { ...player, bankrupt: true, money: -1 },
      ),
    };

    const nextState = endTurn(state);

    assert.equal(nextState.phase, "gameOver");
    assert.equal(nextState.winner.name, "Ada");
  });

  it("game functions do not depend on the DOM", () => {
    assert.equal(globalThis.document, undefined);

    const state = createInitialState(["Ada", "Grace"]);
    const movedState = movePlayer(state, 1, 3);
    const resolvedState = resolveTile(movedState, 1);

    assert.equal(typeof resolvedState, "object");
  });
});
