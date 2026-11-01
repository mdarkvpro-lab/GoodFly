/** Terminal helpers for the setup scripts (secrets are typed here, never in a chat). */

/** Reads one line; with hidden = true nothing is echoed (for passwords and tokens). */
export function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") {
          if (value && !hidden) process.stdout.write("\b \b");
          value = value.slice(0, -1);
        } else {
          value += c;
          if (!hidden) process.stdout.write(c);
        }
      }
    };
    stdin.on("data", onData);
  });
}

export function setLine(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
}
