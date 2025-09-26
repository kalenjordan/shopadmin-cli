import fs from 'fs';
import path from 'path';
import os from 'os';
import { Shop, ShopsConfig } from './types';
import { formatShopName } from './utils/colors';

const CONFIG_FILE_NAME = 'shopadmin.config.ts';
const CONFIG_FILE_PATH = path.join(os.homedir(), CONFIG_FILE_NAME);

function getDefaultConfig(): ShopsConfig {
  return {
    shops: []
    // TODO: Prompt for API version selection when adding first shop
  };
}

export function loadShops(): ShopsConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return getDefaultConfig();
    }

    // Use require to import the TypeScript module
    delete require.cache[CONFIG_FILE_PATH]; // Clear cache to get fresh data
    const configModule = require(CONFIG_FILE_PATH);
    const config = configModule.default || configModule;

    return config as ShopsConfig;
  } catch (error) {
    console.error('Error loading shops config:', error);
    return getDefaultConfig();
  }
}

export function saveShops(config: ShopsConfig): void {
  const tsContent = `export default ${JSON.stringify(config, null, 2)};`;
  fs.writeFileSync(CONFIG_FILE_PATH, tsContent, 'utf8');
}

export function addShop(name: string, url: string, accessToken: string): void {
  const config = loadShops();

  const existingShopIndex = config.shops.findIndex(shop => shop.name === name);

  const newShop: Shop = {
    name,
    url: url.replace(/\/$/, ''), // Remove trailing slash
    accessToken,
    addedAt: new Date().toISOString()
  };

  if (existingShopIndex !== -1) {
    config.shops[existingShopIndex] = newShop;
    console.log(`Updated shop: ${formatShopName(name)}`);
  } else {
    config.shops.push(newShop);
    console.log(`Added new shop: ${formatShopName(name)}`);
  }

  saveShops(config);
  console.log(`Shop configuration saved to: ${CONFIG_FILE_PATH}`);
}

export function listShops(): Shop[] {
  const config = loadShops();
  return config.shops;
}

export function getShop(name: string): Shop | undefined {
  const config = loadShops();
  return config.shops.find(shop => shop.name === name);
}

export function removeShop(name: string): boolean {
  const config = loadShops();
  const initialLength = config.shops.length;
  config.shops = config.shops.filter(shop => shop.name !== name);

  if (config.shops.length < initialLength) {
    saveShops(config);
    console.log(`Removed shop: ${formatShopName(name)}`);
    return true;
  }

  return false;
}