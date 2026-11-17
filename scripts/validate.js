// Check a program JSON with the app's own parser.
// Usage (from the repo root): node scripts/validate.js [program.json]
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const programPath = process.argv[2] || path.join(root, "current.json");

// Pull the parser functions out of app.js so the check uses exactly what the app runs.
const grab = name => {
  const i = src.indexOf(name);
  let depth = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") depth++;
    if (src[k] === "}" && --depth === 0) return src.slice(i, k + 1);
  }
};
const line = start => src.split("\n").find(l => l.startsWith(start));
eval([line("const rung ="), grab("function parseHeader"), grab("function parseExercise"), grab("function parseLoad")].join("\n"));

const program = JSON.parse(fs.readFileSync(programPath, "utf8")).program;
let lines = 0;
const problems = [];

for (const [week, w] of Object.entries(program.weeks)) {
  for (const day of w.days) {
    const letters = [];
    for (const block of day.blocks) {
      const h = parseHeader(block.header);
      const where = `W${week} D${day.day} ${block.header}`;
      if (h.kind === "work") {
        if (!/^\d+(\/\d+)*[A-Z]\d+s$/.test(block.header)) problems.push(`${where}: bad header`);
        letters.push(h.letter);
        if (block.exercises.length < 2 && !/TEST/.test(block.note || "")) problems.push(`${where}: single-move block`);
      }
      for (const ex of block.exercises) {
        lines++;
        const x = parseExercise(ex, 0, h.rungs);
        const load = parseLoad(x.load);
        if (x.value == null || (load && load.raw)) problems.push(`${where}: can't parse "${ex}"`);
      }
    }
    if (letters.join("") !== "ABCDEFGH".slice(0, letters.length)) problems.push(`W${week} D${day.day}: block letters ${letters.join("")}`);
  }
}

problems.forEach(p => console.log(p));
console.log(`${lines} exercise lines checked, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
