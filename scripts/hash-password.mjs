// Creates the values for ADMIN_PASSWORD_HASH and SESSION_SECRET.
// Run:  npm run hash-password
// Type your chosen admin password when asked (it is not shown on screen).
// Copy the two printed lines into Hostinger (Web App -> Environment variables)
// and/or your local .env file. The password itself is never stored anywhere.
// Must match the format in src/server/auth.ts.
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const fromStdin = !process.stdin.isTTY;
let password;
if (fromStdin) {
  password = (await new Promise((r) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c)).on("end", () => r(d));
  })).replace(/\r?\n$/, "");
} else {
  password = await ask("New admin password (min 12 characters): ");
  const again = await ask("Type it again: ");
  if (password !== again) {
    console.error("Passwords do not match. Nothing was created.");
    process.exit(1);
  }
}

if (password.length < 12) {
  console.error("Please use at least 12 characters. Nothing was created.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log("\nCopy these two lines (keep them private):\n");
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString("hex")}`);
