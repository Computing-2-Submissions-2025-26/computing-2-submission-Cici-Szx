import {
  buyProperty,
  createInitialState,
  getCurrentPlayer,
  getPlayerNetWorth,
  getPlayerProperties,
  rollDice,
  skipBuyProperty,
  takeTurn,
} from "./game.js";
import * as CampusTycoonGame from "./game.js";

// Make the game module visible in browser console for marking/testing.
window.CampusTycoonGame = CampusTycoonGame;

// The game starts with four fixed players.
const DEFAULT_PLAYERS = ["Ada", "Grace", "Alan", "Katherine"];

// Get the main parts of the page that need updating.
const boardElement = document.querySelector("#board");
const playersElement = document.querySelector("#players");
const gameLogElement = document.querySelector("#game-log");
const turnStatusElement = document.querySelector("#turn-status");
const diceResultElement = document.querySelector("#dice-result");
const winnerMessageElement = document.querySelector("#winner-message");
const rollButton = document.querySelector("#roll-button");
const buyButton = document.querySelector("#buy-button");
const skipButton = document.querySelector("#skip-button");
const newGameButton = document.querySelector("#new-game-button");

// This variable stores the whole game state object.
let state = createInitialState(DEFAULT_PLAYERS);

const formatMoney = (amount) => `£${amount}`;

// Helper functions for showing property owners and colours in the UI.
const getOwnerName = (ownerId) => state.players.find((player) => player.id === ownerId)?.name ?? "Unowned";
const getOwner = (ownerId) => state.players.find((player) => player.id === ownerId) ?? null;

const hexToRgba = (hex, alpha) => {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getTileMeta = (tile) => {
  if (tile.type === "property") {
    return `Price ${formatMoney(tile.price)} | Rent ${formatMoney(tile.rent)}`;
  }

  if (tile.type === "tax") {
    return `Cost ${formatMoney(tile.amount)}`;
  }

  if (tile.type === "chance") {
    return tile.amount >= 0 ? `Gain ${formatMoney(tile.amount)}` : `Lose ${formatMoney(Math.abs(tile.amount))}`;
  }

  if (tile.type === "bonus") {
    return `Bonus ${formatMoney(tile.amount)}`;
  }

  return tile.type === "start" ? "Collect a bonus when you land here" : "No cost";
};

const createElement = (tagName, className, textContent = "") => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
};

// Draws all 25 board tiles from the current game state.
const renderBoard = () => {
  const currentPlayer = getCurrentPlayer(state);
  boardElement.replaceChildren(
    ...state.board.map((tile, index) => {
      const owner = getOwner(tile.ownerId);
      const playersOnTile = state.players.filter((player) => player.position === tile.id && !player.bankrupt);
      const hasCurrentPlayer = playersOnTile.some((player) => player.id === currentPlayer.id);

      // Classes control tile type, ownership colour, and current player highlight.
      const tileElement = createElement(
        "article",
        `tile ${tile.type} ${owner ? "owned" : ""} ${hasCurrentPlayer ? "current-tile" : ""}`,
      );

      // Owned property tiles use a light tint so the text stays readable.
      if (owner) {
        tileElement.style.setProperty("--owner-color", owner.color);
        tileElement.style.setProperty("--owner-tint", hexToRgba(owner.color, 0.14));
      }
      tileElement.setAttribute("aria-label", `${tile.name}, ${tile.type}`);

      const numberElement = createElement("div", "tile-number", String(tile.id));
      const nameElement = createElement("div", "tile-name", tile.name);
      const metaElement = createElement("div", "tile-meta", getTileMeta(tile));
      const ownerElement = createElement(
        "div",
        "tile-owner",
        tile.type === "property" ? `Owner: ${getOwnerName(tile.ownerId)}` : tile.type,
      );
      const tokensElement = createElement("div", "tokens");

      // Player tokens are coloured using the player colour stored in game state.
      tokensElement.replaceChildren(
        ...playersOnTile.map((player) => {
          const token = createElement("span", `token ${player.id === currentPlayer.id ? "current" : ""}`, player.name[0]);
          token.style.backgroundColor = player.color;
          token.title = player.name;
          return token;
        }),
      );

      tileElement.replaceChildren(numberElement, nameElement, metaElement, ownerElement, tokensElement);
      return tileElement;
    }),
  );
};

// Draws the player information panel on the right side.
const renderPlayers = () => {
  const currentPlayer = getCurrentPlayer(state);

  playersElement.replaceChildren(
    ...state.players.map((player) => {
      const properties = getPlayerProperties(state, player.id);
      const propertyNames = properties.map((tile) => tile.name).join(", ") || "None";

      // Bankrupt players are greyed out by CSS.
      const card = createElement(
        "article",
        `player-card ${player.id === currentPlayer.id ? "current" : ""} ${player.bankrupt ? "bankrupt" : ""}`,
      );
      card.style.setProperty("--player-color", player.bankrupt ? "#8a94a6" : player.color);
      const heading = createElement("h3", "");
      const nameWrap = createElement("span", "player-name");
      const colourMarker = createElement("span", "player-colour");
      const name = createElement("span", "", player.name);
      const badge = createElement(
        "span",
        "badge",
        player.bankrupt ? "Bankrupt" : player.id === currentPlayer.id ? "Current" : "Waiting",
      );

      colourMarker.setAttribute("aria-hidden", "true");
      nameWrap.replaceChildren(colourMarker, name);
      heading.replaceChildren(nameWrap, badge);
      card.replaceChildren(
        heading,
        createElement("p", "", `Money: ${formatMoney(player.money)} | Net worth: ${formatMoney(getPlayerNetWorth(state, player.id))}`),
        createElement("p", "", `Position: ${state.board[player.position].name}`),
        createElement("p", "", `Properties: ${propertyNames}`),
      );

      return card;
    }),
  );
};

// Shows the latest messages first.
const renderLog = () => {
  gameLogElement.replaceChildren(
    ...state.gameLog.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
};

// Updates turn text, dice text, winner text, and button disabled states.
const renderStatus = () => {
  const currentPlayer = getCurrentPlayer(state);
  const dice = state.dice;

  turnStatusElement.textContent =
    state.phase === "gameOver" ? "Game over" : `Turn ${state.turnNumber}: ${currentPlayer.name}`;
  diceResultElement.textContent = dice ? `Dice: ${dice.die1} + ${dice.die2} = ${dice.total}` : "Dice: not rolled yet";
  winnerMessageElement.textContent = state.winner ? `${state.winner.name} wins Campus Tycoon.` : "";

  rollButton.disabled = state.phase !== "roll";
  buyButton.disabled = state.phase !== "buyDecision";
  skipButton.disabled = state.phase !== "buyDecision";
};

// Re-render everything after the state changes.
const render = () => {
  renderBoard();
  renderPlayers();
  renderLog();
  renderStatus();
};

// Button events only call the game module, then redraw the page.
rollButton.addEventListener("click", () => {
  state = takeTurn(state, rollDice());
  render();
});

buyButton.addEventListener("click", () => {
  state = buyProperty(state, getCurrentPlayer(state).id);
  render();
});

skipButton.addEventListener("click", () => {
  state = skipBuyProperty(state, getCurrentPlayer(state).id);
  render();
});

newGameButton.addEventListener("click", () => {
  state = createInitialState(DEFAULT_PLAYERS);
  render();
});

render();
