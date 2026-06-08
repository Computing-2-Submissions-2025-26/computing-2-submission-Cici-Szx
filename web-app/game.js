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

export const STARTING_MONEY = 650;
export const START_BONUS = 75;
export const PLAYER_COLOURS = ["#e74c3c", "#2e86de", "#27ae60", "#8e44ad"];

const MAX_LOG_ENTRIES = 18;
const SPECIAL_TILES = {
  0: { name: "Start", type: "start" },
  4: { name: "Freshers' Fair", type: "chance", amount: 50 },
  8: { name: "Tuition Fee", type: "tax", amount: 220 },
  12: { name: "Free Rest", type: "rest" },
  16: { name: "Campus Gate", type: "bonus", amount: 60 },
  20: { name: "Printing Crisis", type: "chance", amount: -160 },
  23: { name: "Society Dues", type: "tax", amount: 240 },
};
const PROPERTY_NAMES = [
  "Library",
  "Workshop",
  "Design Studio",
  "Campus Cafe",
  "Gym",
  "Accommodation",
  "Lab",
  "Student Union",
  "Seminar Room",
  "Lecture Theatre",
  "Media Suite",
  "Engineering Bay",
  "Makerspace",
  "Music Room",
  "Art Gallery",
  "Health Centre",
  "Bookshop",
  "Sports Hall",
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

const createProperty = (id, name, price, rent) => ({
  id,
  name,
  type: "property",
  price,
  rent,
  ownerId: null,
});

const getPropertyDetails = (propertyIndex) => ({
  name: PROPERTY_NAMES[propertyIndex],
  price: 90 + propertyIndex * 12,
  rent: 60 + propertyIndex * 8,
});

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

const addLog = (state, message) => ({
  ...state,
  gameLog: [message, ...state.gameLog].slice(0, MAX_LOG_ENTRIES),
});

const updatePlayer = (state, playerId, updater) => ({
  ...state,
  players: state.players.map((player) => (player.id === playerId ? updater(player) : player)),
});

const updateTile = (state, tileId, updater) => ({
  ...state,
  board: state.board.map((tile) => (tile.id === tileId ? updater(tile) : tile)),
});

const releasePropertiesForPlayer = (state, playerId) => ({
  ...state,
  board: state.board.map((tile) => (tile.ownerId === playerId ? { ...tile, ownerId: null } : tile)),
  players: state.players.map((player) =>
    player.id === playerId ? { ...player, properties: [] } : player,
  ),
});

const markBankruptIfNeeded = (state, playerId) => {
  const player = state.players.find(({ id }) => id === playerId);

  if (!player || player.money >= 0 || player.bankrupt) {
    return state;
  }

  const bankruptState = updatePlayer(state, playerId, (currentPlayer) => ({
    ...currentPlayer,
    bankrupt: true,
  }));

  return addLog(
    releasePropertiesForPlayer(bankruptState, playerId),
    `${player.name} is bankrupt and leaves the game.`,
  );
};

const changePlayerMoney = (state, playerId, amount) => {
  const changedState = updatePlayer(state, playerId, (player) => ({
    ...player,
    money: player.money + amount,
  }));

  return markBankruptIfNeeded(changedState, playerId);
};

const normalisePosition = (position, boardLength) => ((position % boardLength) + boardLength) % boardLength;

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
    name: name.trim() || `Player ${index + 1}`,
    color: PLAYER_COLOURS[index],
    position: 0,
    money: STARTING_MONEY,
    properties: [],
    bankrupt: false,
  }));

  return {
    players,
    board: createBoard(),
    currentPlayerIndex: 0,
    turnNumber: 1,
    dice: null,
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
      return addLog(
        { ...state, phase: "buyDecision" },
        `${player.name} may buy ${tile.name} for £${tile.price}.`,
      );
    }

    if (tile.ownerId === null) {
      return addLog(state, `${player.name} cannot afford ${tile.name}.`);
    }

    if (tile.ownerId === playerId) {
      return addLog(state, `${player.name} visits their own property: ${tile.name}.`);
    }

    const owner = state.players.find(({ id }) => id === tile.ownerId);
    const chargedState = changePlayerMoney(state, playerId, -tile.rent);
    const paidState = owner && !owner.bankrupt ? changePlayerMoney(chargedState, owner.id, tile.rent) : chargedState;

    return addLog(
      paidState,
      `${player.name} pays £${tile.rent} rent to ${owner?.name ?? "the bank"} for ${tile.name}.`,
    );
  }

  if (tile.type === "tax") {
    return addLog(
      changePlayerMoney(state, playerId, -tile.amount),
      `${player.name} pays £${tile.amount} for ${tile.name}.`,
    );
  }

  if (tile.type === "chance") {
    const chanceState = changePlayerMoney(state, playerId, tile.amount);
    const message =
      tile.amount >= 0
        ? `${player.name} gains £${tile.amount} from ${tile.name}.`
        : `${player.name} loses £${Math.abs(tile.amount)} from ${tile.name}.`;

    return addLog(chanceState, message);
  }

  if (tile.type === "bonus") {
    return addLog(
      changePlayerMoney(state, playerId, tile.amount),
      `${player.name} collects a £${tile.amount} ${tile.name} bonus.`,
    );
  }

  if (tile.type === "start") {
    return addLog(state, `${player.name} lands on Start.`);
  }

  return addLog(state, `${player.name} takes a calm break at ${tile.name}.`);
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

  return endTurn(addLog({ ...ownedPlayerState, phase: "roll" }, `${player.name} buys ${tile.name} for £${tile.price}.`));
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

  return endTurn(addLog({ ...state, phase: "roll" }, `${player.name} chooses not to buy this property.`));
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

  const playerCount = state.players.length;
  const offsets = Array.from({ length: playerCount }, (_, index) => index + 1);
  const nextOffset = offsets.find((offset) => {
    const nextIndex = (state.currentPlayerIndex + offset) % playerCount;
    return !state.players[nextIndex].bankrupt;
  });
  const nextPlayerIndex = (state.currentPlayerIndex + nextOffset) % playerCount;

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber: state.turnNumber + 1,
    phase: "roll",
  };
}

/**
 * Performs a complete roll phase for the current player.
 *
 * If the player lands on an affordable unowned property, the state pauses in
 * the "buyDecision" phase. Otherwise the turn is ended automatically.
 *
 * @param {object} state - Current game state.
 * @param {{die1: number, die2: number, total: number}} diceRoll - Dice result.
 * @returns {object} Updated game state.
 */
export function takeTurn(state, diceRoll) {
  if (state.phase !== "roll" || state.winner) {
    return state;
  }

  const currentPlayer = getCurrentPlayer(state);
  const movedState = movePlayer({ ...state, dice: diceRoll }, currentPlayer.id, diceRoll.total);
  const resolvedState = resolveTile(movedState, currentPlayer.id);

  if (resolvedState.phase === "buyDecision" || resolvedState.phase === "gameOver") {
    return resolvedState;
  }

  return endTurn(resolvedState);
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
