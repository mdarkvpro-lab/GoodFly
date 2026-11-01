import { startMailCatcher } from "./mail-catcher";

export default async function globalSetup() {
  return startMailCatcher();
}
