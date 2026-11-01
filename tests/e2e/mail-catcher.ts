// A tiny local SMTP server for the end-to-end tests: the site under test sends its e-mails
// here instead of Gmail, and the tests read them from a file. Nothing leaves this computer.
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MAIL_PORT = 2526;
export const MAILBOX = join(tmpdir(), "goodfly-e2e-mails.jsonl");

export function startMailCatcher() {
  writeFileSync(MAILBOX, "");
  const server = createServer((socket) => {
    let buffer = "";
    let data: string[] | null = null;
    let to: string[] = [];
    const say = (line: string) => socket.write(`${line}\r\n`);
    say("220 localhost test catcher");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let i;
      while ((i = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (data) {
          if (line === ".") {
            appendFileSync(MAILBOX, JSON.stringify({ to, raw: data.join("\n") }) + "\n");
            data = null;
            to = [];
            say("250 OK");
          } else data.push(line.startsWith("..") ? line.slice(1) : line);
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (cmd === "HELO") say("250 localhost");
        else if (line.toUpperCase().startsWith("AUTH PLAIN")) say("235 OK");
        else if (cmd === "RCPT") {
          to.push(/<([^>]*)>/.exec(line)?.[1] ?? "");
          say("250 OK");
        } else if (cmd === "DATA") {
          data = [];
          say("354 go");
        } else if (cmd === "QUIT") {
          say("221 bye");
          socket.end();
        }
        else say("250 OK");
      }
    });
    socket.on("error", () => {});
  });
  return new Promise<() => Promise<void>>((resolve) =>
    server.listen(MAIL_PORT, "127.0.0.1", () => resolve(() => new Promise((done) => server.close(() => done())))),
  );
}
