function formatGreeting(name) {
  if (name === undefined || name === null) {
    throw new TypeError('name is required');
  }

  const trimmed = String(name).trim();
  if (trimmed.length === 0) {
    throw new RangeError('name must not be empty');
  }

  return `Hello, ${trimmed}!`;
}

module.exports = { formatGreeting };
