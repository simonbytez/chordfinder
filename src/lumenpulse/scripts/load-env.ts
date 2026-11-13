import { config } from "dotenv";

// Next.js reads .env.local itself; the CLI scripts need to do it by hand. Import
// this first so the variables are set before anything else is evaluated.
config({ path: [".env.local", ".env"], quiet: true });
