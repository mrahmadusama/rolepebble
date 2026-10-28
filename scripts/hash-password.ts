// Prints a hash of a password, for DOSSIER_PASSWORD. In the image:
//
//   docker run --rm -it ghcr.io/mrahmadusama/rolepebble:main hash-password
//
// and in development `docker/bin/yarn hash-password`. It asks for the
// password twice without showing it. When stdin isn't a terminal, it reads
// the password from the first line instead, so it also works in a pipe.
// Only the hash goes to stdout; prompts and messages go to stderr.

import { hashPassword } from "../src/lib/auth/password-hash";

class Cancelled extends Error {}

/** Reads a line from the terminal without showing what's typed. */
function readHidden(prompt: string): Promise<string> {
  const { stdin, stderr } = process;
  stderr.write(prompt);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      // Arrow keys and other escape sequences.
      if (chunk.startsWith("\x1b")) return;
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish();
        // Ctrl-C, or Ctrl-D on an empty line.
        if (char === "\x03" || (char === "\x04" && !value)) return finish(new Cancelled());
        if (char === "\x7f" || char === "\b") value = Array.from(value).slice(0, -1).join("");
        else if (char >= " ") value += char;
      }
    };
    stdin.on("data", onData);
  });
}

/** The first line of stdin, without its line break. */
async function readFirstLine(): Promise<string> {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.split(/\r?\n/)[0];
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const password = await readFirstLine();
    if (!password) {
      throw new Error("No password given. Run this in a terminal (with `docker run -it`), or pipe the password in.");
    }
    return password;
  }
  const password = await readHidden("Password: ");
  if (!password) throw new Error("No password entered.");
  if ((await readHidden("Same again: ")) !== password) throw new Error("The passwords don't match.");
  return password;
}

async function main() {
  try {
    const hash = await hashPassword(await readPassword());
    process.stderr.write("Set DOSSIER_PASSWORD to this, then restart Dossier:\n");
    process.stdout.write(`${hash}\n`);
  } catch (error) {
    if (!(error instanceof Cancelled)) process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}

void main();
