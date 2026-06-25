import assert from "node:assert/strict";
import {
  CHANCE_CARDS,
  FATE_CARDS,
  STARTING_MONEY,
  START_BONUS,
  buyProperty,
  checkWinner,
  createInitialState,
  drawEndCard,
  endTurn,
  finishTurn,
  getCurrentPlayer,
  getTileAtPosition,
  keepDrawnCard,
  movePlayer,
  replaceHeldCard,
  resolveTile,
  takeTurn,
  transferProperty,
  useDrawnCard,
  useHeldCard,
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
    assert.equal(state.cardDeck.length, 40);
    assert.equal(state.cardDiscard.length, 0);
    assert.equal(state.phase, "roll");
  });

  it("uses player1-style names when no names are provided", () => {
    const state = createInitialState(["", "  ", ""]);

    assert.deepEqual(state.players.map((player) => player.name), ["player1", "player2", "player3"]);
  });

  it("moves Portfolio Content Overloaded to the nearest Research space", () => {
    const card = FATE_CARDS.find(({ id }) => id === "fate-7");

    assert.equal(card.effectText, "Move to the nearest Research space.");
    assert.deepEqual(card.effect, { type: "moveNearest", tileType: "research" });
  });

  it("keeps all Chance and Fate card effects executable", () => {
    const validTypes = new Set([
      "drawExtraCard",
      "extraTurn",
      "makingCredit",
      "money",
      "move",
      "moveAndMoney",
      "moveNearest",
      "skipAndPay",
      "skipTurn",
    ]);

    [...CHANCE_CARDS, ...FATE_CARDS].forEach((card) => {
      assert.ok(card.id);
      assert.ok(card.name);
      assert.ok(card.effectText);
      assert.ok(validTypes.has(card.effect.type), `${card.id} has unsupported effect type`);

      if (card.effect.type === "money") {
        assert.equal(typeof card.effect.amount, "number");
      }

      if (card.effect.type === "move") {
        assert.equal(typeof card.effect.amount, "number");
      }

      if (card.effect.type === "moveAndMoney") {
        assert.equal(typeof card.effect.spaces, "number");
        assert.equal(typeof card.effect.amount, "number");
      }

      if (card.effect.type === "moveNearest") {
        assert.ok(["property", "research", "tutorial"].includes(card.effect.tileType));
      }

      if (card.effect.type === "skipAndPay") {
        assert.equal(typeof card.effect.amount, "number");
      }
    });
  });

  it("states the workshop support card covers one £50 making cost", () => {
    const card = CHANCE_CARDS.find(({ id }) => id === "chance-4");

    assert.equal(card.effectText, "Pay one less making cost (£50).");
    assert.deepEqual(card.effect, { type: "makingCredit" });
  });

  it("getTileAtPosition works across the 25-tile loop", () => {
    const state = createInitialState(["Ada", "Grace"]);

    assert.equal(getTileAtPosition(state, 0).name, "Start");
    assert.equal(getTileAtPosition(state, 25).name, "Start");
    assert.equal(getTileAtPosition(state, 26).id, 1);
  });

  it("does not stop a player at ACEX Workshop when passing it", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const movedState = movePlayer(state, 1, 26);

    assert.equal(movedState.players[0].position, 1);
    assert.equal(state.players[0].position, 0);
  });

  it("does not trigger special tiles that are only passed over", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const nextState = takeTurn(state, dice(9));

    assert.equal(nextState.players[0].position, 9);
    assert.equal(nextState.board[9].type, "property");
    assert.equal(nextState.cardEvents.length, 0);
    assert.equal(nextState.tileEvents[0].tileName, "Design Studio");
  });

  it("adds bonus money when passing Start without crossing ACEX first", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const nearStartState = {
      ...state,
      players: state.players.map((player) => (player.id === 1 ? { ...player, position: 24 } : player)),
    };
    const movedState = movePlayer(nearStartState, 1, 1);

    assert.equal(movedState.players[0].position, 0);
    assert.equal(movedState.players[0].money, STARTING_MONEY + START_BONUS);
  });

  it("sets buyDecision when landing on an affordable unowned property", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const nextState = takeTurn(state, dice(1));

    assert.equal(nextState.phase, "buyDecision");
    assert.equal(getCurrentPlayer(nextState).name, "Ada");
  });

  it("sets property rent from the property price", () => {
    const state = createInitialState(["Ada", "Grace"]);
    const propertyTiles = state.board.filter((tile) => tile.type === "property");

    propertyTiles.forEach((tile) => {
      assert.equal(tile.rent, Math.round(tile.price * 0.2));
    });
  });

  it("buyProperty subtracts money and assigns ownership", () => {
    const state = takeTurn(createInitialState(["Ada", "Grace"]), dice(1));
    const boughtState = buyProperty(state, 1);
    const library = boughtState.board[1];

    assert.equal(library.ownerId, 1);
    assert.deepEqual(boughtState.players[0].properties, [1]);
    assert.equal(boughtState.players[0].money, STARTING_MONEY - library.price);
    assert.equal(boughtState.phase, "drawChoice");
  });

  it("still offers an end-of-turn card draw after landing on a property", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      turnCardDrawn: true,
    };
    const landedState = takeTurn(state, dice(6));
    const boughtState = buyProperty(landedState, 1);

    assert.equal(landedState.board[landedState.players[0].position].type, "property");
    assert.equal(boughtState.phase, "drawChoice");
    assert.equal(boughtState.turnCardDrawn, false);
  });

  it("can keep a drawn card before ending the turn", () => {
    const state = takeTurn(createInitialState(["Ada", "Grace"]), dice(12));
    const drawnState = drawEndCard(state);
    const keptState = keepDrawnCard(drawnState, 1);

    assert.equal(drawnState.phase, "cardDecision");
    assert.equal(keptState.players[0].hand.length, 1);
    assert.equal(keptState.phase, "heldCardWindow");
    assert.equal(getCurrentPlayer(keptState).name, "Ada");

    const finishedState = finishTurn(keptState);
    assert.equal(finishedState.phase, "roll");
    assert.equal(getCurrentPlayer(finishedState).name, "Grace");
  });

  it("can buy property reached by a used card without drawing again", () => {
    const state = {
      ...takeTurn(createInitialState(["Ada", "Grace"]), dice(12)),
      phase: "cardDecision",
      drawnCard: {
        id: "test-forward-card",
        deck: "chance",
        name: "Test Forward Move",
        effectText: "Move forward 3 spaces.",
        effect: { type: "move", amount: 3 },
      },
    };
    const usedState = useDrawnCard(state, 1);
    const boughtState = buyProperty(usedState, 1);

    assert.equal(usedState.phase, "buyDecision");
    assert.equal(usedState.players[0].position, 15);
    assert.equal(boughtState.board[15].ownerId, 1);
    assert.equal(boughtState.phase, "heldCardWindow");
    assert.equal(getCurrentPlayer(boughtState).name, "Ada");

    const finishedState = finishTurn(boughtState);
    assert.equal(finishedState.phase, "roll");
    assert.equal(getCurrentPlayer(finishedState).name, "Grace");
  });

  it("charges rent reached by a used card without drawing again", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      currentPlayerIndex: 1,
      phase: "cardDecision",
      drawnCard: {
        id: "test-rent-card",
        deck: "chance",
        name: "Test Rent Move",
        effectText: "Move forward 1 space.",
        effect: { type: "move", amount: 1 },
      },
      players: baseState.players.map((player) =>
        player.id === 1 ? { ...player, properties: [1] } : player,
      ),
      board: baseState.board.map((tile) => (tile.id === 1 ? { ...tile, ownerId: 1 } : tile)),
    };
    const rent = state.board[1].rent;
    const nextState = useDrawnCard(state, 2);

    assert.equal(nextState.players[0].money, STARTING_MONEY + rent);
    assert.equal(nextState.players[1].money, STARTING_MONEY - rent);
    assert.deepEqual(
      nextState.moneyEvents.map((event) => event.amount),
      [-rent, rent],
    );
    assert.equal(nextState.phase, "heldCardWindow");
    assert.equal(nextState.drawnCard, null);
  });

  it("gives the Research bonus when a used card moves to Research without drawing another card", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "cardDecision",
      turnCardDrawn: true,
      drawnCard: {
        id: "test-card",
        deck: "chance",
        name: "Test Research Move",
        effectText: "Move to the nearest Research space.",
        effect: { type: "moveNearest", tileType: "research" },
      },
    };
    const nextState = useDrawnCard(state, 1);

    assert.equal(nextState.players[0].position, 4);
    assert.equal(nextState.players[0].money, STARTING_MONEY + 50);
    assert.equal(nextState.cardEvents.length, 0);
    assert.equal(nextState.phase, "heldCardWindow");
    assert.equal(getCurrentPlayer(nextState).name, "Ada");
  });

  it("gives £50 when a normal roll lands on Research", () => {
    const state = takeTurn(createInitialState(["Ada", "Grace"]), dice(4));

    assert.equal(state.cardEvents.length, 0);
    assert.equal(state.players[0].money, STARTING_MONEY + 50);
    assert.equal(state.moneyEvents[0].amount, 50);
    assert.equal(state.tileEvents.length, 1);
    assert.equal(state.tileEvents[0].tileName, "Research");
    assert.equal(state.phase, "drawChoice");
  });

  it("still offers one end-of-turn card draw after Research pays its bonus", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      suppressCardDraws: true,
      turnCardDrawn: true,
    };
    const nextState = takeTurn(state, dice(4));

    assert.equal(nextState.cardEvents.length, 0);
    assert.equal(nextState.players[0].money, STARTING_MONEY + 50);
    assert.equal(nextState.phase, "drawChoice");
  });

  it("gives £100 when a normal roll lands on Tutorial Session", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      suppressCardDraws: true,
      turnCardDrawn: true,
    };
    const nextState = takeTurn(state, dice(8));

    assert.equal(nextState.cardEvents.length, 0);
    assert.equal(nextState.players[0].money, STARTING_MONEY + 100);
    assert.equal(nextState.moneyEvents[0].amount, 100);
    assert.equal(nextState.phase, "drawChoice");
  });

  it("offers the normal end-of-turn draw after ACEX Workshop resolves", () => {
    const nextState = takeTurn(createInitialState(["Ada", "Grace"]), dice(12));

    assert.equal(nextState.players[0].position, 12);
    assert.equal(nextState.tileEvents[0].tileName, "ACEX Workshop");
    assert.equal(nextState.moneyEvents[0].amount, -50);
    assert.equal(nextState.phase, "drawChoice");
  });

  it("offers the normal end-of-turn draw after Final Submission resolves", () => {
    const nextState = takeTurn(createInitialState(["Ada", "Grace"]), dice(16));

    assert.equal(nextState.players[0].position, 16);
    assert.equal(nextState.tileEvents[0].tileName, "Final Submission");
    assert.equal(nextState.moneyEvents[0].amount, -100);
    assert.equal(nextState.phase, "drawChoice");
  });

  it("uses fate-7 to move to Research without drawing a second card", () => {
    const fateCard = FATE_CARDS.find(({ id }) => id === "fate-7");
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "cardDecision",
      turnCardDrawn: true,
      drawnCard: fateCard,
    };
    const nextState = useDrawnCard(state, 1);

    assert.equal(nextState.players[0].position, 4);
    assert.equal(nextState.cardEvents.length, 0);
    assert.equal(nextState.tileEvents.at(-1).tileName, "Research");
    assert.equal(nextState.players[0].money, STARTING_MONEY + 50);
    assert.equal(nextState.phase, "heldCardWindow");
  });

  it("marks the turn after an end-of-turn card draw", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "drawChoice",
    };
    const drawnState = drawEndCard(state);

    assert.equal(drawnState.turnCardDrawn, true);
    assert.equal(drawnState.phase, "cardDecision");
  });

  it("does not allow a second card draw in the same turn", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "drawChoice",
      turnCardDrawn: true,
    };
    const nextState = drawEndCard(state);

    assert.equal(nextState.drawnCard, null);
    assert.equal(nextState.phase, "drawChoice");
    assert.equal(nextState.cardDeck.length, 40);
  });

  it("allows the normal end-of-turn draw after Research pays its bonus", () => {
    const state = takeTurn(createInitialState(["Ada", "Grace"]), dice(4));
    const nextState = drawEndCard(state);

    assert.equal(state.players[0].money, STARTING_MONEY + 50);
    assert.equal(nextState.cardEvents.length, 1);
    assert.equal(nextState.phase, "cardDecision");
  });

  it("lets a Draw one extra card effect draw from the mixed deck", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "cardDecision",
      turnCardDrawn: true,
      cardDeck: [CHANCE_CARDS.find(({ id }) => id === "chance-3")],
      drawnCard: {
        id: "test-extra-card",
        deck: "chance",
        name: "Extra Card",
        effectText: "Draw one extra card.",
        effect: { type: "drawExtraCard" },
      },
    };
    const nextState = useDrawnCard(state, 1);

    assert.equal(nextState.cardEvents.length, 1);
    assert.equal(nextState.drawnCard.name, "Effective PDE User Testing");
    assert.equal(nextState.phase, "cardDecision");
    assert.equal(getCurrentPlayer(nextState).name, "Ada");
  });

  it("lets a Roll the dice again card immediately give the same player another roll", () => {
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "cardDecision",
      turnCardDrawn: true,
      drawnCard: CHANCE_CARDS.find(({ id }) => id === "chance-2"),
    };
    const rollState = useDrawnCard(state, 1);

    assert.equal(rollState.phase, "roll");
    assert.equal(rollState.extraRoll, true);
    assert.equal(rollState.turnCardDrawn, true);
    assert.equal(getCurrentPlayer(rollState).name, "Ada");

    const afterRollState = takeTurn(rollState, dice(1));
    const boughtState = buyProperty(afterRollState, 1);

    assert.equal(boughtState.phase, "heldCardWindow");
    assert.equal(getCurrentPlayer(boughtState).name, "Ada");
  });

  it("reshuffles discarded cards when a deck is empty", () => {
    const firstCard = createInitialState(["Ada", "Grace"]).cardDeck[0];
    const state = {
      ...createInitialState(["Ada", "Grace"]),
      phase: "drawChoice",
      cardDeck: [],
      cardDiscard: [firstCard],
    };
    const drawnState = drawEndCard(state);

    assert.equal(drawnState.drawnCard.id, firstCard.id);
    assert.equal(drawnState.cardDiscard.length, 0);
  });

  it("does not allow a player to keep more than one card", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      phase: "cardDecision",
      drawnCard: {
        id: "second-held-card",
        deck: "chance",
        name: "Second Card",
        effectText: "Receive £100.",
        effect: { type: "money", amount: 100 },
      },
      players: baseState.players.map((player) =>
        player.id === 1
          ? {
              ...player,
              hand: [
                {
                  id: "first-held-card",
                  deck: "chance",
                  name: "First Card",
                  effectText: "Receive £100.",
                  effect: { type: "money", amount: 100 },
                },
              ],
            }
          : player,
      ),
    };
    const nextState = keepDrawnCard(state, 1);

    assert.equal(nextState.players[0].hand.length, 1);
    assert.equal(nextState.phase, "cardDecision");
  });

  it("can replace a held card and immediately use the old card", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      phase: "cardDecision",
      drawnCard: {
        id: "new-held-card",
        deck: "chance",
        name: "New Held Card",
        effectText: "Receive £100.",
        effect: { type: "money", amount: 100 },
      },
      players: baseState.players.map((player) =>
        player.id === 1
          ? {
              ...player,
              hand: [
                {
                  id: "old-held-card",
                  deck: "chance",
                  name: "Old Held Card",
                  effectText: "Move forward 3 spaces.",
                  effect: { type: "move", amount: 3 },
                },
              ],
            }
          : player,
      ),
    };
    const nextState = replaceHeldCard(state, 1);

    assert.equal(nextState.players[0].hand.length, 1);
    assert.equal(nextState.players[0].hand[0].id, "new-held-card");
    assert.equal(nextState.players[0].position, 3);
    assert.equal(nextState.phase, "buyDecision");
  });

  it("does not allow a held card before the end-of-turn window", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      currentPlayerIndex: 1,
      phase: "drawChoice",
      players: baseState.players.map((player) =>
        player.id === 1
          ? {
              ...player,
              hand: [
                {
                  id: "held-test-card",
                  deck: "chance",
                  name: "Held Test Move",
                  effectText: "Move forward 3 spaces.",
                  effect: { type: "move", amount: 3 },
                },
              ],
            }
          : player,
      ),
    };
    const nextState = useHeldCard(state, 1, "held-test-card", 2);

    assert.equal(nextState.players[0].hand.length, 1);
    assert.equal(nextState.players[1].position, 0);
    assert.equal(nextState.phase, "drawChoice");
  });

  it("can use a held card on the current player in the end-of-turn window", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      currentPlayerIndex: 1,
      phase: "heldCardWindow",
      turnCardDrawn: true,
      players: baseState.players.map((player) =>
        player.id === 1
          ? {
              ...player,
              hand: [
                {
                  id: "held-test-card",
                  deck: "chance",
                  name: "Held Test Move",
                  effectText: "Move forward 3 spaces.",
                  effect: { type: "move", amount: 3 },
                },
              ],
            }
          : player,
      ),
    };
    const nextState = useHeldCard(state, 1, "held-test-card", 2);

    assert.equal(nextState.players[0].hand.length, 0);
    assert.equal(nextState.players[1].position, 3);
    assert.equal(nextState.phase, "buyDecision");
  });

  it("does not allow the current player to use a held card on themselves", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      currentPlayerIndex: 1,
      phase: "heldCardWindow",
      turnCardDrawn: true,
      players: baseState.players.map((player) =>
        player.id === 2
          ? {
              ...player,
              hand: [
                {
                  id: "self-held-test-card",
                  deck: "chance",
                  name: "Self Held Test Move",
                  effectText: "Move forward 3 spaces.",
                  effect: { type: "move", amount: 3 },
                },
              ],
            }
          : player,
      ),
    };
    const nextState = useHeldCard(state, 2, "self-held-test-card", 2);

    assert.equal(nextState.players[1].hand.length, 1);
    assert.equal(nextState.players[1].position, 0);
    assert.equal(nextState.phase, "heldCardWindow");
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
    assert.equal(nextState.moneyEvents.length, 2);
    assert.deepEqual(
      nextState.moneyEvents.map((event) => event.amount),
      [-libraryRent, libraryRent],
    );
  });

  it("increases rent by 20 when a player lands on their own property", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      players: baseState.players.map((player) =>
        player.id === 1 ? { ...player, properties: [1] } : player,
      ),
      board: baseState.board.map((tile) => (tile.id === 1 ? { ...tile, ownerId: 1 } : tile)),
    };
    const oldRent = state.board[1].rent;
    const nextState = takeTurn(state, dice(1));

    assert.equal(nextState.board[1].rent, oldRent + 20);
    assert.match(nextState.tileEvents[0].message, new RegExp(`£${oldRent} to £${oldRent + 20}`));
  });

  it("lets players trade a property at a custom price at any time", () => {
    const baseState = createInitialState(["Ada", "Grace"]);
    const state = {
      ...baseState,
      phase: "drawChoice",
      players: baseState.players.map((player) =>
        player.id === 1 ? { ...player, properties: [1] } : player,
      ),
      board: baseState.board.map((tile) => (tile.id === 1 ? { ...tile, ownerId: 1 } : tile)),
    };
    const nextState = transferProperty(state, 1, 2, 1, 275);

    assert.equal(nextState.board[1].ownerId, 2);
    assert.deepEqual(nextState.players[0].properties, []);
    assert.deepEqual(nextState.players[1].properties, [1]);
    assert.equal(nextState.players[0].money, STARTING_MONEY + 275);
    assert.equal(nextState.players[1].money, STARTING_MONEY - 275);
    assert.equal(nextState.phase, "drawChoice");
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
