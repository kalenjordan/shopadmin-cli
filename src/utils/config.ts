import fs from 'fs';
import path from 'path';

export interface LocalConfig {
  defaultShop?: string;
}

export function loadLocalConfig(): LocalConfig {
  const localConfigPath = path.join(process.cwd(), '.shopadmin.config.ts');

  if (!fs.existsSync(localConfigPath)) {
    return {};
  }

  try {
    const config = require(localConfigPath);
    return {
      defaultShop: config.default?.defaultShop || config.defaultShop
    };
  } catch {
    return {};
  }
}

export function saveLocalConfig(config: LocalConfig): void {
  const localConfigPath = path.join(process.cwd(), '.shopadmin.config.ts');
  const content = `export default ${JSON.stringify(config, null, 2)};`;
  fs.writeFileSync(localConfigPath, content, 'utf8');
}

export function getLocalConfigPath(): string {
  return path.join(process.cwd(), '.shopadmin.config.ts');
}