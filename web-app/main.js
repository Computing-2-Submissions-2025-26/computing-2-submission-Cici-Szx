import {
  buyProperty,
  createInitialState,
  discardChanceForSubmission,
  drawEndCard,
  finishTurn,
  getCurrentPlayer,
  getPlayerNetWorth,
  getPlayerProperties,
  keepDrawnCard,
  payFinalSubmissionCost,
  replaceHeldCard,
  rollDice,
  skipBuyProperty,
  takeTurn,
  useDrawnCard,
  useHeldCard,
} from "./game.js";
import * as CampusTycoonGame from "./game.js";

// Make the game module visible in browser console for marking/testing.
window.CampusTycoonGame = CampusTycoonGame;

// The game starts with four fixed players.
const DEFAULT_PLAYERS = ["player1", "player2", "player3", "player4"];

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
const playerCountDialog = document.querySelector("#player-count-dialog");
const shownMoneyEventIds = new Set();
const shownCardEventIds = new Set();
const shownTileEventIds = new Set();
let shownWinnerId = null;

// This variable stores the whole game state object.
let state = createInitialState(DEFAULT_PLAYERS.slice(0, 2));

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
    return tile.ownerId === null ? formatMoney(tile.price) : `Rent ${formatMoney(tile.rent)}`;
  }

  if (tile.type === "acex") {
    return "-£50";
  }

  if (tile.type === "research") {
    return "+£50";
  }

  if (tile.type === "tutorial") {
    return "+£100";
  }

  if (tile.type === "finalSubmission") {
    return "-£100";
  }

  if (tile.type === "tax") {
    return `-${formatMoney(tile.amount)}`;
  }

  if (tile.type === "chance") {
    return tile.amount >= 0 ? `+${formatMoney(tile.amount)}` : `-${formatMoney(Math.abs(tile.amount))}`;
  }

  if (tile.type === "bonus") {
    return `+${formatMoney(tile.amount)}`;
  }

  return tile.type === "start" ? `+${formatMoney(100)}` : "Rest";
};

const getSpecialTileDescription = (tile) => {
  if (tile.type === "acex") {
    return "When landing here, pay £50 material cost; if you cannot pay, you may skip the next action.";
  }

  if (tile.type === "research") {
    return "Landing here gives £50 for new research insight.";
  }

  if (tile.type === "tutorial") {
    return "Landing here gives £100 for useful tutor feedback.";
  }

  if (tile.type === "finalSubmission") {
    return "Pay £100 submission cost, or discard a held Chance card to cover it.";
  }

  return "";
};

const createElement = (tagName, className, textContent = "") => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
};

const fillSelect = (selectElement, options, selectedValue = "") => {
  selectElement.replaceChildren(
    ...options.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      option.selected = String(value) === String(selectedValue);
      return option;
    }),
  );
};

const drawCardButton = createElement("button", "", "Draw Card");
const useCardButton = createElement("button", "", "Use Card");
const keepCardButton = createElement("button", "", "Keep Card");
const replaceCardButton = createElement("button", "", "Replace Card");
const paySubmissionButton = createElement("button", "", "Pay Submission");
const discardChanceButton = createElement("button", "", "Discard Chance");
const endTurnButton = createElement("button", "", "End Turn");

drawCardButton.type = "button";
useCardButton.type = "button";
keepCardButton.type = "button";
replaceCardButton.type = "button";
paySubmissionButton.type = "button";
discardChanceButton.type = "button";
endTurnButton.type = "button";
rollButton.parentElement.append(
  drawCardButton,
  useCardButton,
  keepCardButton,
  replaceCardButton,
  paySubmissionButton,
  discardChanceButton,
  endTurnButton,
);

const createCardPreview = (card, compact = false) => {
  const cardElement = createElement("article", `deck-card ${card.deck} ${compact ? "compact" : ""}`);
  const title = createElement("h3", "", card.name);
  const deck = createElement("p", "card-deck", card.deck === "fate" ? "Fate" : "Chance");
  const effect = createElement("p", "card-effect", card.effectText);

  if (compact) {
    cardElement.replaceChildren(title, effect);
    return cardElement;
  }

  const description = createElement("p", "card-description", card.description);
  cardElement.replaceChildren(deck, title, description, effect);
  return cardElement;
};

const createDeckPanel = () => {
  const panel = createElement("section", "deck-panel");
  const cardDeck = createElement("div", "deck-stack mixed");
  const deckTitle = createElement("h3", "", "Fate + Chance");
  const deckCount = createElement("p", "", `${state.cardDeck.length} cards`);

  cardDeck.replaceChildren(deckTitle, deckCount);

  if (state.drawnCard) {
    const drawnWrap = createElement("div", "drawn-card");
    drawnWrap.replaceChildren(createCardPreview(state.drawnCard));
    panel.replaceChildren(cardDeck, drawnWrap);
    return panel;
  }

  const prompt = createElement(
    "p",
    "deck-prompt",
    state.phase === "drawChoice"
      ? "Draw one card before the turn ends."
      : state.phase === "heldCardWindow"
        ? "Held cards can be used before the turn fully ends."
        : "Use the drawn card or skip it.",
  );
  panel.replaceChildren(cardDeck, prompt);
  return panel;
};

const getTileLayout = (index) => {
  const topHeight = 100 / 7;
  const topWidth = 100 / 7;
  const sideHeight = (100 - topHeight * 2) / 6;
  const bottomWidth = 100 / 6;

  if (index <= 6) {
    return {
      x: index * topWidth,
      y: 0,
      width: topWidth,
      height: topHeight,
      sideClass: "top-tile",
    };
  }

  if (index <= 12) {
    return {
      x: 100 - topWidth,
      y: topHeight + (index - 7) * sideHeight,
      width: topWidth,
      height: sideHeight,
      sideClass: "right-tile",
    };
  }

  if (index <= 18) {
    return {
      x: 100 - (index - 12) * bottomWidth,
      y: 100 - topHeight,
      width: bottomWidth,
      height: topHeight,
      sideClass: "bottom-tile",
    };
  }

  return {
    x: 0,
    y: 100 - topHeight - (index - 18) * sideHeight,
    width: topWidth,
    height: sideHeight,
    sideClass: "left-tile",
  };
};

// Draws all 25 board tiles from the current game state.
const renderBoard = () => {
  const currentPlayer = getCurrentPlayer(state);
  boardElement.replaceChildren(
    createDeckPanel(),
    ...state.board.map((tile, index) => {
      const owner = getOwner(tile.ownerId);
      const playersOnTile = state.players.filter((player) => player.position === tile.id && !player.bankrupt);
      const hasCurrentPlayer = playersOnTile.some((player) => player.id === currentPlayer.id);
      const tileLayout = getTileLayout(index);

      // Classes control tile type, ownership colour, and current player highlight.
      const tileElement = createElement(
        "article",
        `tile ${tile.type} ${tileLayout.sideClass} ${owner ? "owned" : ""} ${hasCurrentPlayer ? "current-tile" : ""}`,
      );
      tileElement.style.setProperty("--tile-x", `${tileLayout.x}%`);
      tileElement.style.setProperty("--tile-y", `${tileLayout.y}%`);
      tileElement.style.setProperty("--tile-width", `${tileLayout.width}%`);
      tileElement.style.setProperty("--tile-height", `${tileLayout.height}%`);

      // Owned property tiles use a light tint so the text stays readable.
      if (owner) {
        tileElement.style.setProperty("--owner-color", owner.color);
        tileElement.style.setProperty("--owner-tint", hexToRgba(owner.color, 0.14));
      }
      tileElement.setAttribute("aria-label", `${tile.name}, ${tile.type}`);
      const specialDescription = getSpecialTileDescription(tile);
      if (specialDescription) {
        tileElement.tabIndex = 0;
        tileElement.dataset.tooltip = specialDescription;
      }

      const nameElement = createElement("div", "tile-name", tile.name);
      const metaElement = createElement("div", "tile-meta", getTileMeta(tile));
      const tokensElement = createElement("div", "tokens");

      // Player tokens are coloured using the player colour stored in game state.
      tokensElement.replaceChildren(
        ...playersOnTile.map((player) => {
          const token = createElement("span", `token ${player.id === currentPlayer.id ? "current" : ""}`);
          token.style.backgroundColor = player.color;
          token.title = player.name;
          return token;
        }),
      );

      tileElement.replaceChildren(nameElement, metaElement, tokensElement);
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
      const hand = createElement("div", "held-cards");
      hand.replaceChildren(
        ...player.hand.map((heldCard) => {
          const heldCardElement = createCardPreview(heldCard, true);
          if (state.phase === "heldCardWindow" && player.id !== currentPlayer.id) {
            const useHeldButton = createElement("button", "small-button", "Use");
            useHeldButton.type = "button";
            useHeldButton.addEventListener("click", () => {
              state = useHeldCard(state, player.id, heldCard.id, currentPlayer.id);
              render();
            });
            heldCardElement.append(useHeldButton);
          }
          return heldCardElement;
        }),
      );

      card.replaceChildren(
        heading,
        createElement("p", "", `Money: ${formatMoney(player.money)} | Net worth: ${formatMoney(getPlayerNetWorth(state, player.id))}`),
        createElement("p", "", `Position: ${state.board[player.position].name}`),
        createElement("p", "", `Properties: ${propertyNames}`),
        hand,
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

const renderMoneyPopups = () => {
  const newMoneyEvents = (state.moneyEvents ?? []).filter((event) => !shownMoneyEventIds.has(event.id));

  newMoneyEvents.forEach((event, index) => {
    const player = state.players.find(({ id }) => id === event.playerId);
    if (!player) {
      return;
    }

    shownMoneyEventIds.add(event.id);
    const popup = createElement(
      "div",
      `money-popup ${event.amount >= 0 ? "positive" : "negative"}`,
      `${player.name} ${event.amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(event.amount))}`,
    );
    popup.style.setProperty("--player-color", player.color);
    popup.style.setProperty("--popup-index", String(index));
    document.body.append(popup);
    window.setTimeout(() => popup.remove(), 2000);
  });
};

const renderCardPopups = () => {
  (state.cardEvents ?? []).forEach((event) => {
    if (shownCardEventIds.has(event.id)) {
      return;
    }

    const player = state.players.find(({ id }) => id === event.playerId);
    if (!player) {
      return;
    }

    shownCardEventIds.add(event.id);
    const popup = createElement(
      "div",
      `card-popup ${event.deck}`,
      `${player.name} draws ${event.deck === "fate" ? "Fate" : "Chance"}: ${event.cardName}`,
    );
    document.body.append(popup);
    window.setTimeout(() => popup.remove(), 2000);
  });
};

const renderTilePopups = () => {
  (state.tileEvents ?? []).forEach((event) => {
    if (shownTileEventIds.has(event.id)) {
      return;
    }

    const player = state.players.find(({ id }) => id === event.playerId);
    if (!player) {
      return;
    }

    shownTileEventIds.add(event.id);
    const popup = createElement("div", "tile-event-popup", `${event.tileName}: ${event.message}`);
    popup.style.setProperty("--player-color", player.color);
    document.body.append(popup);
    window.setTimeout(() => popup.remove(), 2000);
  });
};

const renderWinnerPopup = () => {
  if (!state.winner || shownWinnerId === state.winner.id) {
    return;
  }

  shownWinnerId = state.winner.id;
  const popup = createElement("div", "winner-popup");
  const content = createElement("section", "winner-card");
  const title = createElement("h2", "", `${state.winner.name} wins!`);
  const message = createElement("p", "", "Campus Tycoon champion");
  const closeButton = createElement("button", "", "Celebrate");

  closeButton.type = "button";
  closeButton.addEventListener("click", () => popup.remove());
  content.replaceChildren(title, message, closeButton);
  popup.replaceChildren(content);
  document.body.append(popup);
};

// Updates turn text, dice text, winner text, and button disabled states.
const renderStatus = () => {
  const currentPlayer = getCurrentPlayer(state);
  const dice = state.dice;
  const canKeepDrawnCard = state.phase === "cardDecision" && currentPlayer.hand.length < 1;
  const canReplaceHeldCard = state.phase === "cardDecision" && currentPlayer.hand.length >= 1;
  const canDrawEndCard = state.phase === "drawChoice" && !state.turnCardDrawn;
  const controlStates = [
    [rollButton, state.phase === "roll"],
    [buyButton, state.phase === "buyDecision"],
    [skipButton, state.phase === "buyDecision"],
    [drawCardButton, canDrawEndCard],
    [useCardButton, state.phase === "cardDecision"],
    [keepCardButton, canKeepDrawnCard],
    [replaceCardButton, canReplaceHeldCard],
    [paySubmissionButton, state.phase === "finalSubmissionDecision"],
    [discardChanceButton, state.phase === "finalSubmissionDecision"],
    [endTurnButton, state.phase === "heldCardWindow"],
  ];

  turnStatusElement.textContent =
    state.phase === "gameOver" ? "Game over" : `Turn ${state.turnNumber}: ${currentPlayer.name}`;
  diceResultElement.textContent = dice ? `Dice: ${dice.die1} + ${dice.die2} = ${dice.total}` : "Dice: not rolled yet";
  winnerMessageElement.textContent = state.winner ? `${state.winner.name} wins Campus Tycoon.` : "";

  controlStates.forEach(([button, isActive]) => {
    button.disabled = !isActive;
    button.hidden = !isActive;
  });
};

// Re-render everything after the state changes.
const render = () => {
  renderBoard();
  renderPlayers();
  renderLog();
  renderStatus();
  renderMoneyPopups();
  renderCardPopups();
  renderTilePopups();
  renderWinnerPopup();
};

const startGame = (playerCount) => {
  shownMoneyEventIds.clear();
  shownCardEventIds.clear();
  shownTileEventIds.clear();
  shownWinnerId = null;
  state = createInitialState(DEFAULT_PLAYERS.slice(0, playerCount));
  render();
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

drawCardButton.addEventListener("click", () => {
  state = drawEndCard(state);
  render();
});

useCardButton.addEventListener("click", () => {
  state = useDrawnCard(state, getCurrentPlayer(state).id);
  render();
});

keepCardButton.addEventListener("click", () => {
  state = keepDrawnCard(state, getCurrentPlayer(state).id);
  render();
});

replaceCardButton.addEventListener("click", () => {
  state = replaceHeldCard(state, getCurrentPlayer(state).id);
  render();
});

paySubmissionButton.addEventListener("click", () => {
  state = payFinalSubmissionCost(state, getCurrentPlayer(state).id);
  render();
});

discardChanceButton.addEventListener("click", () => {
  state = discardChanceForSubmission(state, getCurrentPlayer(state).id);
  render();
});

endTurnButton.addEventListener("click", () => {
  state = finishTurn(state);
  render();
});

newGameButton.addEventListener("click", () => {
  playerCountDialog.showModal();
});

playerCountDialog.addEventListener("close", () => {
  const selectedCount = Number(playerCountDialog.returnValue) || 2;
  startGame(selectedCount);
});

playerCountDialog.showModal();
render();
