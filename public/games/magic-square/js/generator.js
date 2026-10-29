(function () {
  const previousSolutions = new Set();
  const previousPuzzleLayouts = new Set();

  function seededRandom(seedText) {
    let seed = 2166136261;
    for (let i = 0; i < seedText.length; i += 1) {
      seed ^= seedText.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    return function () {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, rng = Math.random) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function siameseOdd(n) {
    const square = Array.from({ length: n }, () => Array(n).fill(0));
    let row = 0;
    let col = Math.floor(n / 2);
    for (let value = 1; value <= n * n; value += 1) {
      square[row][col] = value;
      const nextRow = (row - 1 + n) % n;
      const nextCol = (col + 1) % n;
      if (square[nextRow][nextCol]) {
        row = (row + 1) % n;
      } else {
        row = nextRow;
        col = nextCol;
      }
    }
    return square;
  }

  function doublyEven(n) {
    const square = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => r * n + c + 1)
    );
    const max = n * n + 1;
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (r % 4 === c % 4 || (r % 4) + (c % 4) === 3) {
          square[r][c] = max - square[r][c];
        }
      }
    }
    return square;
  }

  function rotate(square) {
    const n = square.length;
    return Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => square[n - c - 1][r])
    );
  }

  function reflect(square) {
    return square.map((row) => row.slice().reverse());
  }

  function transform(square, rng = Math.random) {
    let result = square.map((row) => row.slice());
    const turns = Math.floor(rng() * 4);
    for (let i = 0; i < turns; i += 1) result = rotate(result);
    if (rng() > 0.5) result = reflect(result);
    if (result.length === 4 && rng() > 0.5) result = rotate(reflect(result));
    return result;
  }

  function createSolution(size, rng = Math.random) {
    if (size === 4) return transform(doublyEven(4), rng);
    return transform(siameseOdd(size), rng);
  }

  function hiddenCountFor(size, difficulty) {
    const table = {
      easy: { 3: 3, 4: 6, 5: 8 },
      medium: { 3: 5, 4: 9, 5: 13 },
      hard: { 3: 6, 4: 12, 5: 17 }
    };
    return table[difficulty][size];
  }

  function makePuzzle(size, difficulty = "easy", seed = null) {
    const rng = seed ? seededRandom(`${seed}:${size}:${difficulty}`) : Math.random;
    let solution;
    let givens;
    let solutionSignature;
    let layoutSignature;
    let attempts = 0;

    do {
      solution = createSolution(size, rng);
      solutionSignature = solution.flat().join("-");
      const hidden = new Set(shuffle([...Array(size * size).keys()], rng).slice(0, hiddenCountFor(size, difficulty)));
      givens = solution.map((row, r) =>
        row.map((value, c) => (hidden.has(r * size + c) ? null : value))
      );
      layoutSignature = `${size}:${difficulty}:${givens.flat().map((v) => v || "x").join("-")}`;
      attempts += 1;
      if (seed) break;
    } while (
      (previousPuzzleLayouts.has(layoutSignature) || (attempts < 20 && previousSolutions.has(solutionSignature))) &&
      attempts < 5000
    );

    previousSolutions.add(solutionSignature);
    previousPuzzleLayouts.add(layoutSignature);
    if (previousSolutions.size > 64) previousSolutions.delete(previousSolutions.values().next().value);
    if (previousPuzzleLayouts.size > 600) previousPuzzleLayouts.delete(previousPuzzleLayouts.values().next().value);

    return {
      id: seed ? `seed-${seed}-${size}-${difficulty}` : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      size,
      difficulty,
      magicSum: size * (size * size + 1) / 2,
      solution,
      givens
    };
  }

  function validateSquare(square) {
    const size = square.length;
    const magicSum = size * (size * size + 1) / 2;
    const seen = new Set(square.flat());
    if (seen.size !== size * size) return false;
    for (let n = 1; n <= size * size; n += 1) if (!seen.has(n)) return false;
    const rows = square.every((row) => row.reduce((a, b) => a + b, 0) === magicSum);
    const cols = square.every((_, c) => square.reduce((sum, row) => sum + row[c], 0) === magicSum);
    const diagA = square.reduce((sum, row, i) => sum + row[i], 0) === magicSum;
    const diagB = square.reduce((sum, row, i) => sum + row[size - i - 1], 0) === magicSum;
    return rows && cols && diagA && diagB;
  }

  function runGeneratorTests(iterations = 120) {
    const sizes = [3, 4, 5];
    const seenLayouts = new Set();
    const errors = [];
    sizes.forEach((size) => {
      for (let i = 0; i < iterations; i += 1) {
        const puzzle = makePuzzle(size, i % 3 === 0 ? "hard" : i % 2 === 0 ? "medium" : "easy");
        const signature = puzzle.solution.flat().join(",");
        if (!validateSquare(puzzle.solution)) errors.push(`Invalid ${size}x${size} square at iteration ${i}`);
        seenLayouts.add(`${size}:${signature}:${puzzle.givens.flat().map((v) => v || "x").join(",")}`);
      }
    });
    return {
      passed: errors.length === 0,
      checked: sizes.length * iterations,
      uniquePuzzleLayouts: seenLayouts.size,
      errors
    };
  }

  window.MagicGenerator = { makePuzzle, validateSquare, runGeneratorTests };
})();
