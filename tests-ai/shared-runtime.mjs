// Common runtime stays in a separately maintained checkout.
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
const root = process.env.AI_E2E_WRAPPER_ROOT;
if (!root || !path.isAbsolute(root)) throw new Error('Run npm run test:ai with an absolute AI_E2E_WRAPPER_ROOT.');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const local = JSON.parse(await fs.readFile(new URL('../.ai-e2e.local.json', import.meta.url), 'utf8'));
if (pkg.name !== local.packageName) throw new Error('Unexpected shared wrapper package');
const require = createRequire(path.join(root, 'package.json'));
const playwright = require('@playwright/test');
const runtime = await import(pathToFileURL(path.join(root, 'runtime/index.mjs')).href);
export const test = playwright.test;
export const expect = playwright.expect;
export const runGoal = runtime.runGoal;
