// Small local placeholder for the coursework template.
// The game uses native array methods and object spread instead of depending on Ramda.
export const identity = (value) => value;
export const pipe =
  (...functions) =>
  (initialValue) =>
    functions.reduce((value, fn) => fn(value), initialValue);
