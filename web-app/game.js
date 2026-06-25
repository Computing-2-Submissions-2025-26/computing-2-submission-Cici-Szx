/**
 * Campus Tycoon game module API.
 *
 * This module contains all game rules for a simplified Monopoly-style board
 * game. It has no DOM dependencies, so it can be tested independently and used
 * by any interface.
 *
 * Exported functions:
 * - createInitialState(playerNames): create a new game state for 2 to 4 players.
 * - getCurrentPlayer(state): return the player whose turn it is.
 * - rollDice(randomFn): roll two six-sided dice, with injectable randomness.
 * - movePlayer(state, playerId, steps): move a player and award Start bonus.
 * - resolveTile(state, playerId): apply the landed tile effect.
 * - buyProperty(state, playerId): buy the current unowned property and end turn.
 * - skipBuyProperty(state, playerId): skip buying and end turn.
 * - endTurn(state): advance to the next non-bankrupt player.
 * - takeTurn(state, diceRoll): perform movement and tile resolution for a roll.
 * - checkWinner(state): return the winning player or null.
 * - getTileAtPosition(state, position): return the board tile at a board index.
 * - getPlayerProperties(state, playerId): return properties owned by a player.
 * - getPlayerNetWorth(state, playerId): return cash plus owned property values.
 */

export const STARTING_MONEY = 1000;
export const START_BONUS = 100;
export const PLAYER_COLOURS = ["#e74c3c", "#2e86de", "#27ae60", "#b7791f"];

const MAX_LOG_ENTRIES = 18;
const ACEX_WORKSHOP_TILE_ID = 12;
const FINAL_SUBMISSION_COST = 100;
const ACEX_MATERIAL_COST = 50;
const RESEARCH_BONUS = 50;
const TUTORIAL_BONUS = 100;

// These tiles are not properties. All other positions become property tiles.
const SPECIAL_TILES = {
  0: { name: "Start", type: "start" },
  4: { name: "Research", type: "research" },
  8: { name: "Tutorial Session", type: "tutorial" },
  [ACEX_WORKSHOP_TILE_ID]: { name: "ACEX Workshop", type: "acex" },
  16: { name: "Final Submission", type: "finalSubmission" },
};

export const CHANCE_CARDS = [
  { id: "chance-1", deck: "chance", name: "Successful Gizmo Demo", description: "Your Physical Computing project is presented smoothly, and the device responds naturally.", effectText: "Move forward 3 spaces.", effect: { type: "move", amount: 3 } },
  { id: "chance-2", deck: "chance", name: "Computing 2 Inspiration", description: "You suddenly come up with a new game mechanic that makes the gameplay more engaging.", effectText: "Roll the dice again.", effect: { type: "extraTurn" } },
  { id: "chance-3", deck: "chance", name: "Effective PDE User Testing", description: "User feedback helps you discover a clearer design direction.", effectText: "Receive £100.", effect: { type: "money", amount: 100 } },
  { id: "chance-4", deck: "chance", name: "Design Engineering Workshop Support", description: "You successfully book a workshop slot and can quickly move your prototype forward.", effectText: "Pay one less making cost (£50).", effect: { type: "makingCredit" } },
  { id: "chance-5", deck: "chance", name: "Successful SUV Design Research", description: "You organise your research into a clear design direction.", effectText: "Move to the nearest Research space.", effect: { type: "moveNearest", tileType: "research" } },
  { id: "chance-6", deck: "chance", name: "Automotive Design Inspiration", description: "Your design language becomes more consistent, and the concept feels more complete.", effectText: "Move forward 2 spaces and receive £80.", effect: { type: "moveAndMoney", spaces: 2, amount: 80 } },
  { id: "chance-7", deck: "chance", name: "Successful Portfolio Layout", description: "The visual style of your project pages becomes more consistent.", effectText: "Receive £120.", effect: { type: "money", amount: 120 } },
  { id: "chance-8", deck: "chance", name: "Positive Tutor Feedback", description: "Your project logic is seen as clear and full of development potential.", effectText: "Draw one extra card.", effect: { type: "drawExtraCard" } },
  { id: "chance-9", deck: "chance", name: "Stable Sustainability Design Performance", description: "Your aircraft seat project clearly communicates its sustainable design direction.", effectText: "Move forward 4 spaces.", effect: { type: "move", amount: 4 } },
  { id: "chance-10", deck: "chance", name: "Mini Segway Added to Portfolio", description: "An older project is reorganised into valuable portfolio content.", effectText: "Receive £80.", effect: { type: "money", amount: 80 } },
  { id: "chance-11", deck: "chance", name: "Football Robot Project Bonus", description: "Your robotics experience makes your portfolio more diverse.", effectText: "Move forward 3 spaces.", effect: { type: "move", amount: 3 } },
  { id: "chance-12", deck: "chance", name: "Improved Gizmo Project Quality", description: "Your interaction design becomes more complete and visually engaging.", effectText: "Receive £100.", effect: { type: "money", amount: 100 } },
  { id: "chance-13", deck: "chance", name: "Clearer PDE Project Story", description: "You successfully connect the problem, users, and solution into one clear story.", effectText: "Move to the nearest Tutorial Session space.", effect: { type: "moveNearest", tileType: "tutorial" } },
  { id: "chance-14", deck: "chance", name: "Successful Presentation Practice", description: "You explain complex content in a clearer and more natural way.", effectText: "Move forward 2 spaces.", effect: { type: "move", amount: 2 } },
  { id: "chance-15", deck: "chance", name: "Computing 2 Testing Passed", description: "Your game rules and code logic run smoothly.", effectText: "Receive £120.", effect: { type: "money", amount: 120 } },
  { id: "chance-16", deck: "chance", name: "Imperial Critique Inspiration", description: "A critique session helps you identify a key point for improvement.", effectText: "Move forward 2 spaces.", effect: { type: "move", amount: 2 } },
  { id: "chance-17", deck: "chance", name: "Strong Portfolio Cover Image", description: "Your main visual successfully attracts attention.", effectText: "Receive £150.", effect: { type: "money", amount: 150 } },
  { id: "chance-18", deck: "chance", name: "Research Summary Completed", description: "You condense complex research into a few strong keywords.", effectText: "Move to the nearest Research space.", effect: { type: "moveNearest", tileType: "research" } },
  { id: "chance-19", deck: "chance", name: "Successful Team Project Collaboration", description: "Your team divides tasks clearly and works more efficiently.", effectText: "Receive £100.", effect: { type: "money", amount: 100 } },
  { id: "chance-20", deck: "chance", name: "Stable Final Submission", description: "All files are organised and submitted on time.", effectText: "Move forward 5 spaces.", effect: { type: "move", amount: 5 } },
];

export const FATE_CARDS = [
  { id: "fate-1", deck: "fate", name: "Gizmo Debugging Failed", description: "Your Physical Computing project becomes unstable right before the demo.", effectText: "Move back 3 spaces.", effect: { type: "move", amount: -3 } },
  { id: "fate-2", deck: "fate", name: "Computing 2 Bug Appears", description: "An unexpected issue appears during gameplay, and the logic needs to be checked again.", effectText: "Skip one turn.", effect: { type: "skipTurn" } },
  { id: "fate-3", deck: "fate", name: "Unsatisfactory PDE User Feedback", description: "Users do not fully understand your design intention.", effectText: "Move back 2 spaces.", effect: { type: "move", amount: -2 } },
  { id: "fate-4", deck: "fate", name: "Workshop Slot Unavailable", description: "You need to wait for the next chance to continue making.", effectText: "Skip one turn.", effect: { type: "skipTurn" } },
  { id: "fate-5", deck: "fate", name: "Unclear SUV Design Direction", description: "Your concept still lacks a clear focus.", effectText: "Pay £100 for redesign.", effect: { type: "money", amount: -100 } },
  { id: "fate-6", deck: "fate", name: "Inconsistent Automotive Render Style", description: "The visual language between different pages is not consistent enough.", effectText: "Move back 2 spaces.", effect: { type: "move", amount: -2 } },
  { id: "fate-7", deck: "fate", name: "Portfolio Content Overloaded", description: "There is too much information on the page, making the key points unclear.", effectText: "Move to the nearest Research space.", effect: { type: "moveNearest", tileType: "research" } },
  { id: "fate-8", deck: "fate", name: "Presentation Over Time", description: "Your script is too long and exceeds the given time limit.", effectText: "Skip one turn.", effect: { type: "skipTurn" } },
  { id: "fate-9", deck: "fate", name: "Messy Sustainability Design Data", description: "The comparison information in your project needs to be reorganised.", effectText: "Pay £120.", effect: { type: "money", amount: -120 } },
  { id: "fate-10", deck: "fate", name: "Aircraft Seat Project Not Concise Enough", description: "The design highlights are not immediately clear.", effectText: "Move back 3 spaces.", effect: { type: "move", amount: -3 } },
  { id: "fate-11", deck: "fate", name: "Mini Segway Page Lacks Storyline", description: "The project content is there, but the logic is not complete enough.", effectText: "Pay £80 to revise the portfolio.", effect: { type: "money", amount: -80 } },
  { id: "fate-12", deck: "fate", name: "Football Robot Presentation Lacks Focus", description: "The project is included in the portfolio, but the visual focus is not strong enough.", effectText: "Move back 2 spaces.", effect: { type: "move", amount: -2 } },
  { id: "fate-13", deck: "fate", name: "Team Project Task Confusion", description: "Some tasks overlap, reducing the team’s overall efficiency.", effectText: "Skip one turn.", effect: { type: "skipTurn" } },
  { id: "fate-14", deck: "fate", name: "Major Revision After Critique", description: "The tutor points out that your idea needs to be more focused.", effectText: "Pay £150.", effect: { type: "money", amount: -150 } },
  { id: "fate-15", deck: "fate", name: "Research Is Too Scattered", description: "You have collected a lot of information, but there is no clear conclusion yet.", effectText: "Move back to the nearest Research space.", effect: { type: "moveNearest", tileType: "research", direction: "backward" } },
  { id: "fate-16", deck: "fate", name: "Design Development Stuck", description: "You are unsure which part should be improved next.", effectText: "Skip one turn.", effect: { type: "skipTurn" } },
  { id: "fate-17", deck: "fate", name: "Inconsistent Portfolio Style", description: "The layout and visual language vary too much between different projects.", effectText: "Pay £100.", effect: { type: "money", amount: -100 } },
  { id: "fate-18", deck: "fate", name: "Final Week Pressure", description: "Multiple projects are due at the same time, and your time management falls apart.", effectText: "Skip one turn and pay £150.", effect: { type: "skipAndPay", amount: -150 } },
  { id: "fate-19", deck: "fate", name: "Peer Review Raises Issues", description: "A classmate points out that your game rules still need balancing.", effectText: "Pay £100 to revise the rules.", effect: { type: "money", amount: -100 } },
  { id: "fate-20", deck: "fate", name: "Missing Content Before Submission", description: "You realise one page has not been properly completed.", effectText: "Move back 4 spaces.", effect: { type: "move", amount: -4 } },
];
const PROPERTY_NAMES = [
  "Dyson building",
  "Fushion cafe",
  "Boarding Room",
  "Lecture Theatre",
  "Dyson library",
  "elevator",
  "Design Studio",
  "GTA Office",
  "Tripzoid",
  "Studio 3",
  "Queen's tower",
  "Library cafe",
  "Central Library",
  "roderichill 409",
  "Kokoro",
  "Junior Common Room",
  "Senior Common room",
  "Imperial Business School",
  "Data Centre",
  "Robotics Lab",
  "Film Studio",
  "Courtyard",
  "Innovation Hub",
  "Enterprise Centre",
  "Greenhouse",
  "Observatory",
  "Podcast Booth",
  "Archive",
  "Language Centre",
  "Law Clinic",
  "Simulation Suite",
  "Nursing Ward",
  "Cyber Range",
  "AI Lab",
  "Quiet Study",
  "Exam Hall",
  "Careers Office",
  "Postgraduate Hub",
  "Research Tower",
  "Final Project",
];

// Makes one property tile object.
const createProperty = (id, name, price, rent) => ({
  id,
  name,
  type: "property",
  price,
  rent,
  ownerId: null,
});

// Later properties become more expensive and charge more rent.
const getPropertyDetails = (propertyIndex) => ({
  name: PROPERTY_NAMES[propertyIndex],
  price: 120 + propertyIndex * 16,
  rent: Math.round((120 + propertyIndex * 16) * 0.2),
});

// Builds the full 25 tile board.
const createBoard = () => {
  let propertyIndex = 0;

  return Array.from({ length: 25 }, (_, id) => {
    if (SPECIAL_TILES[id]) {
      return { id, ...SPECIAL_TILES[id] };
    }

    const property = getPropertyDetails(propertyIndex);
    propertyIndex += 1;

    return createProperty(id, property.name, property.price, property.rent);
  });
};

// Adds a message to the game log and keeps the log short.
const addLog = (state, message) => ({
  ...state,
  gameLog: [message, ...state.gameLog].slice(0, MAX_LOG_ENTRIES),
});

const ALL_CARDS = [...CHANCE_CARDS, ...FATE_CARDS];

const shuffleCards = (cards, randomFn = Math.random) => {
  const shuffledCards = [...cards];

  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    [shuffledCards[index], shuffledCards[swapIndex]] = [shuffledCards[swapIndex], shuffledCards[index]];
  }

  return shuffledCards;
};

const drawCardFromDeck = (state) => {
  const needsReshuffle = state.cardDeck.length === 0;
  const sourceDeck = needsReshuffle ? state.cardDiscard : state.cardDeck;
  const nextDeck = needsReshuffle ? shuffleCards(sourceDeck.length > 0 ? sourceDeck : ALL_CARDS) : sourceDeck;
  const [card, ...remainingCards] = nextDeck;

  return {
    state: {
      ...state,
      cardDeck: remainingCards,
      cardDiscard: needsReshuffle ? [] : state.cardDiscard,
      turnCardDrawn: true,
    },
    card,
  };
};

const discardCard = (state, card) => {
  return {
    ...state,
    cardDiscard: [card, ...state.cardDiscard],
  };
};

// Updates one player without changing the old state directly.
const updatePlayer = (state, playerId, updater) => ({
  ...state,
  players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
});

// Updates one tile without mutating the original board array.
const updateTile = (state, tileId, updater) => ({
  ...state,
  board: state.board.map((tile) => (tile.id === tileId ? updater(tile) : tile)),
});

const addMoneyEvent = (state, playerId, amount) => {
  const nextMoneyEventId = state.nextMoneyEventId ?? 1;

  return {
    ...state,
    nextMoneyEventId: nextMoneyEventId + 1,
    moneyEvents: [
      ...(state.moneyEvents ?? []),
      {
        id: nextMoneyEventId,
        playerId,
        amount,
      },
    ],
  };
};

const addCardEvent = (state, playerId, card) => {
  const nextCardEventId = state.nextCardEventId ?? 1;

  return {
    ...state,
    nextCardEventId: nextCardEventId + 1,
    cardEvents: [
      ...(state.cardEvents ?? []),
      {
        id: nextCardEventId,
        playerId,
        deck: card.deck,
        cardName: card.name,
      },
    ],
  };
};

const addTileEvent = (state, playerId, tileName, message) => {
  const nextTileEventId = state.nextTileEventId ?? 1;

  return {
    ...state,
    nextTileEventId: nextTileEventId + 1,
    tileEvents: [
      ...(state.tileEvents ?? []),
      {
        id: nextTileEventId,
        playerId,
        tileName,
        message,
      },
    ],
  };
};

// When a player is bankrupt, their properties go back to unowned.
const releasePropertiesForPlayer = (state, playerId) => ({
  ...state,
  board: state.board.map((tile) => (tile.ownerId === playerId ? { ...tile, ownerId: null } : tile)),
  players: state.players.map((player) =>
    player.id === playerId ? { ...player, properties: [] } : player,
  ),
});

// Checks money after a payment and marks the player bankrupt if needed.
const markBankruptIfNeeded = (state, playerId) => {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || player.money >= 0 || player.bankrupt) {
    return state;
  }

  const bankruptState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    bankrupt: true,
  }));

  const releasedState = addLog(
    releasePropertiesForPlayer(bankruptState, playerId),
    `${player.name} is bankrupt and leaves the game.`,
  );
  const winner = checkWinner(releasedState);

  if (winner) {
    return addLog(
      {
        ...releasedState,
        winner,
        phase: "gameOver",
      },
      `${winner.name} wins Campus Tycoon.`,
    );
  }

  return releasedState;
};

// Positive amount adds money, negative amount removes money.
const changePlayerMoney = (state, playerId, amount) => {
  const changedState = updatePlayer(state, playerId, (player) => ({
    ...player,
    money: player.money + amount,
  }));

  return markBankruptIfNeeded(addMoneyEvent(changedState, playerId, amount), playerId);
};

// Keeps positions inside the board loop, e.g. 26 becomes 1 on a 25 tile board.
const normalisePosition = (position, boardLength) => ((position % boardLength) + boardLength) % boardLength;

const findNearestTilePosition = (state, startPosition, tileType, direction = "forward") => {
  const step = direction === "backward" ? -1 : 1;

  for (let offset = 1; offset <= state.board.length; offset += 1) {
    const position = normalisePosition(startPosition + step * offset, state.board.length);
    if (state.board[position].type === tileType) {
      return position;
    }
  }

  return startPosition;
};

const movePlayerToPosition = (state, playerId, position, messagePrefix = "moves to") => {
  const player = state.players.find(({ id }) => id === playerId);
  const destination = getTileAtPosition(state, position);

  if (!player || player.bankrupt) {
    return state;
  }

  return addLog(
    updatePlayer(state, playerId, (currentPlayer) => ({
      ...currentPlayer,
      position,
    })),
    `${player.name} ${messagePrefix} ${destination.name}.`,
  );
};

const beginEndDrawPhase = (state) => {
  const winner = checkWinner(state);

  if (winner) {
    return addLog({ ...state, winner, phase: "gameOver" }, `${winner.name} wins Campus Tycoon.`);
  }

  if (state.turnCardDrawn) {
    return beginHeldCardWindow(addLog(state, `${getCurrentPlayer(state).name} has already drawn a card this turn.`));
  }

  return { ...state, phase: "drawChoice", drawnCard: null };
};

const beginHeldCardWindow = (state) => {
  const winner = checkWinner(state);

  if (winner) {
    return addLog({ ...state, winner, phase: "gameOver" }, `${winner.name} wins Campus Tycoon.`);
  }

  return {
    ...state,
    afterCardAction: state.extraRoll ? true : false,
    suppressCardDraws: false,
    drawnCard: null,
    phase: "heldCardWindow",
  };
};

const finishAction = (state) => (state.afterCardAction ? beginHeldCardWindow(state) : beginEndDrawPhase(state));

/**
 * Creates and returns the starting game state.
 *
 * @param {string[]} playerNames - Names for 2 to 4 players.
 * @returns {object} A new serialisable game state object.
 * @throws {Error} If the player count is not between 2 and 4.
 */
export function createInitialState(playerNames) {
  if (!Array.isArray(playerNames) || playerNames.length < 2 || playerNames.length > 4) {
    throw new Error("Campus Tycoon needs between 2 and 4 players.");
  }

  const players = playerNames.map((name, index) => ({
    id: index + 1,
    name: name.trim() || `player${index + 1}`,
    color: PLAYER_COLOURS[index],
    position: 0,
    money: STARTING_MONEY,
    properties: [],
    hand: [],
    skipTurns: 0,
    makingCostCredits: 0,
    bankrupt: false,
  }));

  return {
    players,
    board: createBoard(),
    cardDeck: shuffleCards(ALL_CARDS),
    cardDiscard: [],
    moneyEvents: [],
    nextMoneyEventId: 1,
    cardEvents: [],
    nextCardEventId: 1,
    tileEvents: [],
    nextTileEventId: 1,
    turnCardDrawn: false,
    currentPlayerIndex: 0,
    turnNumber: 1,
    dice: null,
    drawnCard: null,
    gameLog: ["Welcome to Campus Tycoon. Roll the dice to begin."],
    winner: null,
    phase: "roll",
  };
}

/**
 * Returns the current player object.
 *
 * @param {object} state - Current game state.
 * @returns {object} The active player.
 */
export function getCurrentPlayer(state) {
  return state.players[state.currentPlayerIndex];
}

/**
 * Rolls two six-sided dice.
 *
 * @param {Function} [randomFn=Math.random] - Function returning a number from 0 up to 1.
 * @returns {{die1: number, die2: number, total: number}} Dice result.
 */
export function rollDice(randomFn = Math.random) {
  const rollOne = () => Math.floor(randomFn() * 6) + 1;
  const die1 = rollOne();
  const die2 = rollOne();

  return { die1, die2, total: die1 + die2 };
}

/**
 * Returns the board tile at a given position.
 *
 * @param {object} state - Current game state.
 * @param {number} position - Board position.
 * @returns {object} Board tile at the normalised position.
 */
export function getTileAtPosition(state, position) {
  return state.board[normalisePosition(position, state.board.length)];
}

export function executeCard(state, playerId, card) {
  if (!card) {
    return state;
  }

  const player = state.players.find(({ id }) => id === playerId);
  const effect = card.effect;

  if (!player || player.bankrupt) {
    return state;
  }

  let nextState = addLog(state, `${player.name} uses ${card.name}: ${card.effectText}`);

  if (effect.type === "money") {
    return changePlayerMoney(nextState, playerId, effect.amount);
  }

  if (effect.type === "move") {
    const movedState = movePlayer(nextState, playerId, effect.amount);
    return resolveTile(movedState, playerId);
  }

  if (effect.type === "moveAndMoney") {
    const movedState = movePlayer(nextState, playerId, effect.spaces);
    const resolvedState = resolveTile(movedState, playerId);
    return changePlayerMoney(resolvedState, playerId, effect.amount);
  }

  if (effect.type === "moveNearest") {
    const position = findNearestTilePosition(state, player.position, effect.tileType, effect.direction);
    const movedState = movePlayerToPosition(nextState, playerId, position);
    return resolveTile(movedState, playerId);
  }

  if (effect.type === "skipTurn") {
    return updatePlayer(nextState, playerId, (currentPlayer) => ({
      ...currentPlayer,
      skipTurns: currentPlayer.skipTurns + 1,
    }));
  }

  if (effect.type === "skipAndPay") {
    const skippedState = updatePlayer(nextState, playerId, (currentPlayer) => ({
      ...currentPlayer,
      skipTurns: currentPlayer.skipTurns + 1,
    }));
    return changePlayerMoney(skippedState, playerId, effect.amount);
  }

  if (effect.type === "makingCredit") {
    return updatePlayer(nextState, playerId, (currentPlayer) => ({
      ...currentPlayer,
      makingCostCredits: currentPlayer.makingCostCredits + 1,
    }));
  }

  if (effect.type === "extraTurn") {
    return {
      ...nextState,
      afterCardAction: true,
      drawnCard: null,
      extraRoll: true,
      phase: "roll",
      suppressCardDraws: false,
      turnCardDrawn: true,
    };
  }

  if (effect.type === "drawExtraCard") {
    const draw = drawCardFromDeck(nextState);
    return addLog(
      {
        ...addCardEvent(draw.state, playerId, draw.card),
        drawnCard: draw.card,
        phase: "cardDecision",
      },
      `${player.name} draws an extra card: ${draw.card.name}.`,
    );
  }

  return nextState;
}

/**
 * Moves a player around the board and awards money for passing or landing on Start.
 *
 * @param {object} state - Current game state.
 * @param {number} playerId - Player id to move.
 * @param {number} steps - Number of spaces to move.
 * @returns {object} Updated game state.
 */
export function movePlayer(state, playerId, steps) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || player.bankrupt) {
    return state;
  }

  const oldPosition = player.position;
  const rawPosition = oldPosition + steps;
  const newPosition = normalisePosition(rawPosition, state.board.length);

  // Passing or landing back on Start gives the player bonus money.
  const passedStart = rawPosition >= state.board.length;
  const destination = getTileAtPosition(state, newPosition);

  const movedState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    position: newPosition,
  }));

  const bonusState = passedStart ? changePlayerMoney(movedState, playerId, START_BONUS) : movedState;
  const bonusMessage = passedStart ? ` and collects £${START_BONUS} for passing Start` : "";

  return addLog(
    bonusState,
    `${player.name} moves ${steps} spaces to ${destination.name}${bonusMessage}.`,
  );
}

/**
 * Applies the effect of the tile the player has landed on.
 *
 * @param {object} state - Current game state.
 * @param {number} playerId - Player id resolving the tile.
 * @returns {object} Updated game state.
 */
export function resolveTile(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || player.bankrupt) {
    return state;
  }

  const tile = getTileAtPosition(state, player.position);

  if (tile.type === "property") {
    if (tile.ownerId === null && player.money >= tile.price) {
      const message = `${player.name} may buy ${tile.name} for £${tile.price}.`;
      return addLog(
        addTileEvent({ ...state, phase: "buyDecision" }, playerId, tile.name, message),
        message,
      );
    }

    if (tile.ownerId === null) {
      const message = `${player.name} cannot afford ${tile.name}.`;
      return addLog(addTileEvent(state, playerId, tile.name, message), message);
    }

    // Owned by the same player, so nothing happens.
    if (tile.ownerId === playerId) {
      const newRent = tile.rent + 20;
      const message = `${player.name} improves ${tile.name}. Rent increases from £${tile.rent} to £${newRent}.`;
      return addLog(
        addTileEvent(
          updateTile(state, tile.id, (currentTile) => ({
            ...currentTile,
            rent: newRent,
          })),
          playerId,
          tile.name,
          message,
        ),
        message,
      );
    }

    // Owned by another player, so rent is paid.
    const owner = state.players.find(({ id }) => id === tile.ownerId);
    const chargedState = changePlayerMoney(state, playerId, -tile.rent);
    const paidState = owner && !owner.bankrupt ? changePlayerMoney(chargedState, owner.id, tile.rent) : chargedState;

    const message = `${player.name} pays £${tile.rent} rent to ${owner?.name ?? "the bank"} for ${tile.name}.`;

    return addLog(addTileEvent(paidState, playerId, tile.name, message), message);
  }

  if (tile.type === "acex") {
    if (player.makingCostCredits > 0) {
      const creditedState = updatePlayer(state, playerId, (currentPlayer) => ({
        ...currentPlayer,
        makingCostCredits: currentPlayer.makingCostCredits - 1,
      }));

      const message = `${player.name} uses workshop support and avoids the £${ACEX_MATERIAL_COST} ACEX material fee.`;
      return addLog(addTileEvent(creditedState, playerId, tile.name, message), message);
    }

    const paidState = changePlayerMoney(state, playerId, -ACEX_MATERIAL_COST);
    const afterPayment = paidState.players.find(({ id }) => id === playerId);
    const skippedState =
      afterPayment && afterPayment.money < 0
        ? updatePlayer(paidState, playerId, (currentPlayer) => ({
            ...currentPlayer,
            skipTurns: currentPlayer.skipTurns + 1,
          }))
        : paidState;

    const message = `${player.name} stops at ACEX Workshop and pays £${ACEX_MATERIAL_COST} for materials.`;
    return addLog(addTileEvent(skippedState, playerId, tile.name, message), message);
  }

  if (tile.type === "research") {
    const message = `${player.name} reaches Research and receives £${RESEARCH_BONUS}.`;
    return addLog(
      addTileEvent(changePlayerMoney(state, playerId, RESEARCH_BONUS), playerId, tile.name, message),
      message,
    );
  }

  if (tile.type === "tutorial") {
    const message = `${player.name} attends Tutorial Session and receives £${TUTORIAL_BONUS}.`;
    return addLog(
      addTileEvent(changePlayerMoney(state, playerId, TUTORIAL_BONUS), playerId, tile.name, message),
      message,
    );
  }

  if (tile.type === "finalSubmission") {
    if (player.hand.some((card) => card.deck === "chance")) {
      const message = `${player.name} can discard a held Chance card or pay £${FINAL_SUBMISSION_COST} for Final Submission.`;
      return addLog(
        addTileEvent({ ...state, phase: "finalSubmissionDecision" }, playerId, tile.name, message),
        message,
      );
    }

    const message = `${player.name} pays £${FINAL_SUBMISSION_COST} submission cost.`;
    return addLog(
      addTileEvent(changePlayerMoney(state, playerId, -FINAL_SUBMISSION_COST), playerId, tile.name, message),
      message,
    );
  }

  if (tile.type === "start") {
    const message = `${player.name} lands on Start.`;
    return addLog(addTileEvent(state, playerId, tile.name, message), message);
  }

  const message = `${player.name} takes a calm break at ${tile.name}.`;
  return addLog(addTileEvent(state, playerId, tile.name, message), message);
}

/**
 * Allows a player to buy the unowned property they are standing on.
 *
 * The purchase ends the player's turn.
 *
 * @param {object} state - Current game state.
 * @param {number} playerId - Buying player id.
 * @returns {object} Updated game state.
 */
export function buyProperty(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || player.bankrupt || state.phase !== "buyDecision") {
    return state;
  }

  const tile = getTileAtPosition(state, player.position);

  if (tile.type !== "property" || tile.ownerId !== null || player.money < tile.price) {
    return state;
  }

  const paidState = changePlayerMoney(state, playerId, -tile.price);
  const ownedTileState = updateTile(paidState, tile.id, (currentTile) => ({
    ...currentTile,
    ownerId: playerId,
  }));
  const ownedPlayerState = updatePlayer(ownedTileState, playerId, (currentPlayer) => ({
    ...currentPlayer,
    properties: [...currentPlayer.properties, tile.id],
  }));

  return finishAction(addLog({ ...ownedPlayerState, phase: "roll" }, `${player.name} buys ${tile.name} for £${tile.price}.`));
}

/**
 * Skips buying the property under the current player and ends the turn.
 *
 * @param {object} state - Current game state.
 * @param {number} playerId - Player id skipping the purchase.
 * @returns {object} Updated game state.
 */
export function skipBuyProperty(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || state.phase !== "buyDecision") {
    return state;
  }

  return finishAction(addLog({ ...state, phase: "roll" }, `${player.name} chooses not to buy this property.`));
}

export function transferProperty(state, sellerId, buyerId, tileId, price) {
  const seller = state.players.find(({ id }) => id === sellerId);
  const buyer = state.players.find(({ id }) => id === buyerId);
  const tile = state.board.find(({ id }) => id === tileId);
  const tradePrice = Number(price);

  if (
    state.phase === "gameOver" ||
    !seller ||
    !buyer ||
    seller.bankrupt ||
    buyer.bankrupt ||
    sellerId === buyerId ||
    !tile ||
    tile.type !== "property" ||
    tile.ownerId !== sellerId ||
    !Number.isFinite(tradePrice) ||
    tradePrice < 0
  ) {
    return state;
  }

  if (buyer.money < tradePrice) {
    return addLog(state, `${buyer.name} cannot afford £${tradePrice} for ${tile.name}.`);
  }

  const buyerPaidState = changePlayerMoney(state, buyerId, -tradePrice);
  const sellerPaidState = changePlayerMoney(buyerPaidState, sellerId, tradePrice);
  const transferredTileState = updateTile(sellerPaidState, tileId, (currentTile) => ({
    ...currentTile,
    ownerId: buyerId,
  }));
  const withoutSellerPropertyState = updatePlayer(transferredTileState, sellerId, (currentPlayer) => ({
    ...currentPlayer,
    properties: currentPlayer.properties.filter((propertyId) => propertyId !== tileId),
  }));
  const withBuyerPropertyState = updatePlayer(withoutSellerPropertyState, buyerId, (currentPlayer) => ({
    ...currentPlayer,
    properties: currentPlayer.properties.includes(tileId)
      ? currentPlayer.properties
      : [...currentPlayer.properties, tileId],
  }));

  return addLog(
    withBuyerPropertyState,
    `${seller.name} sells ${tile.name} to ${buyer.name} for £${tradePrice}.`,
  );
}

export function payFinalSubmissionCost(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || state.phase !== "finalSubmissionDecision") {
    return state;
  }

  return finishAction(
    addLog(
      changePlayerMoney({ ...state, phase: "roll" }, playerId, -FINAL_SUBMISSION_COST),
      `${player.name} pays £${FINAL_SUBMISSION_COST} submission cost.`,
    ),
  );
}

export function discardChanceForSubmission(state, playerId, cardId = null) {
  const player = state.players.find(({ id }) => id === playerId);
  const card = player?.hand.find((heldCard) => heldCard.deck === "chance" && (!cardId || heldCard.id === cardId));

  if (!player || !card || state.phase !== "finalSubmissionDecision") {
    return state;
  }

  const updatedState = updatePlayer({ ...state, phase: "roll" }, playerId, (currentPlayer) => ({
    ...currentPlayer,
    hand: currentPlayer.hand.filter((heldCard) => heldCard.id !== card.id),
  }));

  return finishAction(
    addLog(discardCard(updatedState, card), `${player.name} discards ${card.name} to cover the Final Submission cost.`),
  );
}

export function drawEndCard(state) {
  if (state.phase !== "drawChoice" || state.turnCardDrawn) {
    return state;
  }

  const player = getCurrentPlayer(state);
  const draw = drawCardFromDeck(state);
  const cardDeckName = draw.card.deck === "fate" ? "Fate" : "Chance";

  return addLog(
    {
      ...addCardEvent(draw.state, player.id, draw.card),
      drawnCard: draw.card,
      phase: "cardDecision",
    },
    `${player.name} draws ${cardDeckName}: ${draw.card.name}.`,
  );
}

export function keepDrawnCard(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || state.phase !== "cardDecision" || !state.drawnCard) {
    return state;
  }

  if (player.hand.length >= 1) {
    return addLog(state, `${player.name} already has a held card and cannot keep another one.`);
  }

  const keptState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    hand: [...currentPlayer.hand, state.drawnCard],
  }));

  return beginHeldCardWindow(
    addLog(
      { ...keptState, drawnCard: null },
      `${player.name} keeps ${state.drawnCard.name} for later.`,
    ),
  );
}

export function replaceHeldCard(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);
  const heldCard = player?.hand[0];
  const drawnCard = state.drawnCard;

  if (!player || !heldCard || !drawnCard || state.phase !== "cardDecision") {
    return state;
  }

  const replacedState = updatePlayer(
    {
      ...state,
      phase: "roll",
      drawnCard: null,
      afterCardAction: true,
      suppressCardDraws: true,
    },
    playerId,
    (currentPlayer) => ({
      ...currentPlayer,
      hand: [drawnCard],
    }),
  );
  const usedState = executeCard(
    addLog(replacedState, `${player.name} replaces ${heldCard.name} with ${drawnCard.name}; ${heldCard.name} is used immediately.`),
    playerId,
    heldCard,
  );

  if (usedState.phase === "cardDecision" || usedState.phase === "buyDecision" || usedState.phase === "finalSubmissionDecision") {
    return discardCard(usedState, heldCard);
  }

  if (usedState.extraRoll) {
    return discardCard(usedState, heldCard);
  }

  return beginHeldCardWindow(discardCard({ ...usedState, afterCardAction: false, suppressCardDraws: false }, heldCard));
}

export function useDrawnCard(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || state.phase !== "cardDecision" || !state.drawnCard) {
    return state;
  }

  const card = state.drawnCard;
  const usedState = executeCard(
    { ...state, phase: "roll", drawnCard: null, afterCardAction: true, suppressCardDraws: true },
    playerId,
    card,
  );

  if (usedState.phase === "cardDecision" || usedState.phase === "buyDecision" || usedState.phase === "finalSubmissionDecision") {
    return discardCard(usedState, card);
  }

  if (usedState.extraRoll) {
    return discardCard(usedState, card);
  }

  return beginHeldCardWindow(discardCard({ ...usedState, afterCardAction: false, suppressCardDraws: false }, card));
}

export function useHeldCard(state, ownerId, cardId, targetPlayerId = ownerId) {
  const owner = state.players.find(({ id }) => id === ownerId);
  const card = owner?.hand.find((heldCard) => heldCard.id === cardId);
  const currentPlayer = getCurrentPlayer(state);

  if (
    !owner ||
    !card ||
    state.phase !== "heldCardWindow" ||
    ownerId === currentPlayer.id ||
    targetPlayerId !== currentPlayer.id
  ) {
    return state;
  }

  const withoutCardState = updatePlayer(state, ownerId, (player) => ({
    ...player,
    hand: player.hand.filter((heldCard) => heldCard.id !== cardId),
  }));
  const usedState = executeCard(
    { ...withoutCardState, phase: "roll", afterCardAction: true, suppressCardDraws: true },
    targetPlayerId,
    card,
  );

  if (usedState.phase === "cardDecision" || usedState.phase === "buyDecision" || usedState.phase === "finalSubmissionDecision") {
    return discardCard(usedState, card);
  }

  if (usedState.extraRoll) {
    return discardCard(usedState, card);
  }

  return beginHeldCardWindow(discardCard({ ...usedState, afterCardAction: false, suppressCardDraws: false }, card));
}

export function finishTurn(state) {
  if (state.phase !== "heldCardWindow") {
    return state;
  }

  return endTurn(state);
}

/**
 * Returns the winning player if only one non-bankrupt player remains.
 *
 * @param {object} state - Current game state.
 * @returns {object|null} Winning player or null.
 */
export function checkWinner(state) {
  const activePlayers = state.players.filter((player) => !player.bankrupt);
  return activePlayers.length === 1 ? activePlayers[0] : null;
}

/**
 * Advances the turn to the next non-bankrupt player and checks for a winner.
 *
 * @param {object} state - Current game state.
 * @returns {object} Updated game state.
 */
export function endTurn(state) {
  const winner = checkWinner(state);

  if (winner) {
    return addLog({ ...state, winner, phase: "gameOver" }, `${winner.name} wins Campus Tycoon.`);
  }

  if (state.extraTurnPlayerId && getCurrentPlayer(state).id === state.extraTurnPlayerId) {
    return addLog(
      {
        ...state,
        extraTurnPlayerId: null,
        drawnCard: null,
        suppressCardDraws: false,
        turnCardDrawn: false,
        phase: "roll",
      },
      `${getCurrentPlayer(state).name} gets another roll.`,
    );
  }

  const playerCount = state.players.length;
  const offsets = Array.from({ length: playerCount }, (_, index) => index + 1);

  // Find the next player who is still active.
  const nextOffset = offsets.find((offset) => {
    const nextIndex = (state.currentPlayerIndex + offset) % playerCount;
    return !state.players[nextIndex].bankrupt;
  });
  const nextPlayerIndex = (state.currentPlayerIndex + nextOffset) % playerCount;

  const nextState = {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber: state.turnNumber + 1,
    drawnCard: null,
    suppressCardDraws: false,
    turnCardDrawn: false,
    phase: "roll",
  };

  const nextPlayer = nextState.players[nextPlayerIndex];

  if (nextPlayer.skipTurns > 0) {
    return endTurn(
      addLog(
        updatePlayer(nextState, nextPlayer.id, (player) => ({
          ...player,
          skipTurns: player.skipTurns - 1,
        })),
        `${nextPlayer.name} skips this turn.`,
      ),
    );
  }

  return nextState;
}

/**
 * Performs a complete roll phase for the current player.
 *
 * If the player lands on a property, the turn continues into the normal end-of-turn
 * flow without a separate purchase decision.
 *
 * @param {object} state - Current game state.
 * @param {{die1: number, die2: number, total: number}} diceRoll - Dice result.
 * @returns {object} Updated game state.
 */
export function takeTurn(state, diceRoll) {
  if (state.phase !== "roll" || state.winner) {
    return state;
  }

  const turnState = {
    ...state,
    afterCardAction: false,
    drawnCard: null,
    extraRoll: false,
    suppressCardDraws: false,
    turnCardDrawn: state.extraRoll ? state.turnCardDrawn : false,
  };
  const currentPlayer = getCurrentPlayer(turnState);

  // A turn means move first, then resolve the tile landed on.
  const movedState = movePlayer({ ...turnState, dice: diceRoll }, currentPlayer.id, diceRoll.total);
  const resolvedState = resolveTile(movedState, currentPlayer.id);

  if (
    resolvedState.phase === "buyDecision" ||
    resolvedState.phase === "cardDecision" ||
    resolvedState.phase === "finalSubmissionDecision" ||
    resolvedState.phase === "gameOver"
  ) {
    return resolvedState;
  }

  return beginEndDrawPhase(resolvedState);
}

/**
 * Returns all properties owned by a player.
 *
 * @param {object} state - Current game state.
 * @param {number} playerId - Owner player id.
 * @returns {object[]} Property tiles owned by the player.
 */
export function getPlayerProperties(state, playerId) {
  return state.board.filter((tile) => tile.type === "property" && tile.ownerId === playerId);
}

/**
 * Returns a player's net worth as cash plus owned property purchase values.
 *
 * @param {object} state - Current game state.
 * @param {number} playerId - Player id.
 * @returns {number} Net worth total.
 */
export function getPlayerNetWorth(state, playerId) {
  const player = state.players.find(({ id }) => id === playerId);
  const propertyValue = getPlayerProperties(state, playerId).reduce((total, tile) => total + tile.price, 0);

  return player ? player.money + propertyValue : 0;
}
