# Coursework Notes

This project is a JavaScript web app for a simplified traditional Monopoly-style board game.

Important files:

- `web-app/game.js` contains the pure game state and rules.
- `web-app/main.js` handles DOM rendering and user interaction only.
- `web-app/default.css` contains the visual styling.
- `web-app/tests/game.test.js` contains Mocha unit tests.

When changing the project, keep game logic out of the DOM layer and update tests for behaviour changes.
