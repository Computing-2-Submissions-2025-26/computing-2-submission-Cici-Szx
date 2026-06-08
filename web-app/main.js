import {
  START_BONUS,
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

window.CampusTycoonGame = CampusTycoonGame;

const DEFAULT_PLAYERS = ["Ada", "Grace", "Alan", "Katherine"];

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

let state = createInitialState(DEFAULT_PLAYERS);

const formatMoney = (amount) => `£${amount}`;

const getOwner = (ownerId) => state.players.find((player) => player.id === ownerId) ?? null;

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

const getTileMetaLabel = (tile) => {
  if (tile.type === "property") {
    return `${formatMoney(tile.price)}\nRent ${formatMoney(tile.rent)}`;
  }

  if (tile.type === "tax") {
    return `Pay ${formatMoney(tile.amount)}`;
  }

  if (tile.type === "chance") {
    return tile.amount >= 0 ? `+${formatMoney(tile.amount)}` : `-${formatMoney(Math.abs(tile.amount))}`;
  }

  if (tile.type === "bonus") {
    return `+${formatMoney(tile.amount)}`;
  }

  return tile.type === "start" ? `+${formatMoney(START_BONUS)}` : "Rest";
};

const createElement = (tagName, className, textContent = "") => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
};

const getBoardSideCounts = (totalTiles) => {
  const baseCount = Math.floor(totalTiles / 4);
  const extraTiles = totalTiles % 4;

  return [0, 1, 2, 3].map((sideIndex) => baseCount + (sideIndex < extraTiles ? 1 : 0));
};

const getBoardPathRect = (index, totalTiles) => {
  const [topCount, rightCount, bottomCount, leftCount] = getBoardSideCounts(totalTiles);
  const ringSize = 20;
  const rightHeight = 100 - ringSize;
  const bottomWidth = 100 - ringSize;
  const leftHeight = 100 - ringSize * 2;

  if (index < topCount) {
    const width = 100 / topCount;
    return { side: "top", x: index * width, y: 0, width, height: ringSize };
  }

  if (index < topCount + rightCount) {
    const sideIndex = index - topCount;
    const height = rightHeight / rightCount;
    return { side: "right", x: 100 - ringSize, y: ringSize + sideIndex * height, width: ringSize, height };
  }

  if (index < topCount + rightCount + bottomCount) {
    const sideIndex = index - topCount - rightCount;
    const width = bottomWidth / bottomCount;
    return { side: "bottom", x: bottomWidth - (sideIndex + 1) * width, y: 100 - ringSize, width, height: ringSize };
  }

  const sideIndex = index - topCount - rightCount - bottomCount;
  const height = leftHeight / leftCount;
  return { side: "left", x: 0, y: 100 - ringSize - (sideIndex + 1) * height, width: ringSize, height };
};

const renderBoard = () => {
  const currentPlayer = getCurrentPlayer(state);
  boardElement.replaceChildren(
    ...state.board.map((tile, index) => {
      const owner = getOwner(tile.ownerId);
      const playersOnTile = state.players.filter((player) => player.position === tile.id && !player.bankrupt);
      const hasCurrentPlayer = playersOnTile.some((player) => player.id === currentPlayer.id);
      const pathRect = getBoardPathRect(index, state.board.length);
      const tileElement = createElement(
        "article",
        `tile ${pathRect.side}-tile ${tile.type} ${owner ? "owned" : ""} ${hasCurrentPlayer ? "current-tile" : ""}`,
      );

      tileElement.style.setProperty("--tile-x", `${pathRect.x}%`);
      tileElement.style.setProperty("--tile-y", `${pathRect.y}%`);
      tileElement.style.setProperty("--tile-width", `${pathRect.width}%`);
      tileElement.style.setProperty("--tile-height", `${pathRect.height}%`);
      if (owner) {
        tileElement.style.setProperty("--owner-color", owner.color);
      }
      tileElement.setAttribute("aria-label", `${tile.name}, ${tile.type}`);
      tileElement.title = `${tile.name} | ${getTileMeta(tile)}`;

      const startMarkerElement =
        tile.type === "start" ? createElement("div", "start-marker", "START") : null;
      const nameElement = createElement("div", "tile-name", tile.name);
      const metaElement = createElement("div", "tile-meta", getTileMetaLabel(tile));
      const detailsElement = createElement("div", "tile-details");
      const tokensElement = createElement("div", "tokens");

      detailsElement.replaceChildren(metaElement);

      tokensElement.replaceChildren(
        ...playersOnTile.map((player) => {
          const token = createElement("span", `token ${player.id === currentPlayer.id ? "current" : ""}`, player.name[0]);
          token.style.backgroundColor = player.color;
          token.title = player.name;
          return token;
        }),
      );

      tileElement.replaceChildren(
        ...(startMarkerElement ? [startMarkerElement] : []),
        nameElement,
        detailsElement,
        tokensElement,
      );
      return tileElement;
    }),
  );
};

const renderPlayers = () => {
  const currentPlayer = getCurrentPlayer(state);

  playersElement.replaceChildren(
    ...state.players.map((player) => {
      const properties = getPlayerProperties(state, player.id);
      const propertyNames = properties.map((tile) => tile.name).join(", ") || "None";
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

const renderLog = () => {
  gameLogElement.replaceChildren(
    ...state.gameLog.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
};

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

const render = () => {
  renderBoard();
  renderPlayers();
  renderLog();
  renderStatus();
};

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
