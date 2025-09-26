import fs from 'fs';
import path from 'path';
import os from 'os';
import { Shop, ShopsConfig } from './types';

const CONFIG_FILE_NAME = 'shopify-shops.js';
const CONFIG_FILE_PATH = path.join(os.homedir(), CONFIG_FILE_NAME);

function getDefaultConfig(): ShopsConfig {
  return {
    shops: []
  };
}

export function loadShops(): ShopsConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return getDefaultConfig();
    }

    delete require.cache[CONFIG_FILE_PATH];
    const config = require(CONFIG_FILE_PATH);
    return config as ShopsConfig;
  } catch (error) {
    console.error('Error loading shops config:', error);
    return getDefaultConfig();
  }
}

export function saveShops(config: ShopsConfig): void {
  const jsContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
  fs.writeFileSync(CONFIG_FILE_PATH, jsContent, 'utf8');
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
    console.log(`Updated shop: ${name}`);
  } else {
    config.shops.push(newShop);
    console.log(`Added new shop: ${name}`);
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
    console.log(`Removed shop: ${name}`);
    return true;
  }

  return false;
}