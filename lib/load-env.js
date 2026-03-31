import fs from 'fs';
import path from 'path';

let loaded = false;

function parseEnvFile(contents) {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export function loadLocalEnv() {
  if (loaded) return;

  const rootDir = process.cwd();
  const envFiles = ['.env', '.env.local'];

  for (const fileName of envFiles) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    if (!fs.statSync(filePath).isFile()) continue;
    parseEnvFile(fs.readFileSync(filePath, 'utf8'));
  }

  loaded = true;
}
