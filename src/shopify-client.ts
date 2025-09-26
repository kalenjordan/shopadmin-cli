import { createAdminApiClient } from '@shopify/admin-api-client';
import { Shop } from './types';
import { getShop, listShops, loadShops } from './storage';
import { formatShopName, formatShopInfo } from './utils/colors';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';

interface LocalConfig {
  defaultShop?: string;
}

function loadLocalConfig(): LocalConfig | null {
  const localConfigPath = path.join(process.cwd(), '.shopadmin.config.ts');

  if (!fs.existsSync(localConfigPath)) {
    return null;
  }

  try {
    const config = require(localConfigPath);
    return config.default || config;
  } catch (error) {
    // Silently fail if config can't be loaded
    return null;
  }
}

export async function selectShop(): Promise<Shop> {
  const shops = listShops();

  if (shops.length === 0) {
    console.error('No shops configured. Use "shopadmin add" to add a shop.');
    process.exit(1);
  }

  // Check for local config default shop
  const localConfig = loadLocalConfig();
  if (localConfig?.defaultShop) {
    const defaultShop = getShop(localConfig.defaultShop);
    if (defaultShop) {
      console.log(`Using default shop from .shopadmin.config.ts: ${formatShopName(defaultShop.name)}`);
      return defaultShop;
    }
  }

  if (shops.length === 1) {
    console.log(`Using shop: ${formatShopName(shops[0].name)}`);
    return shops[0];
  }

  const { shopName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'shopName',
      message: 'Select a shop:',
      choices: shops.map(s => ({
        name: formatShopInfo(s.name, s.url),
        value: s.name
      }))
    }
  ]);

  return getShop(shopName)!;
}

export function createShopifyClient(shop: Shop) {
  // Get API version from config
  const config = loadShops();

  if (!config.apiVersion) {
    throw new Error(
      'API version not configured. Please add "apiVersion" to your ~/shopadmin.config.ts file.\n' +
      'Example: "apiVersion": "2025-10"'
    );
  }

  const client = createAdminApiClient({
    storeDomain: shop.url.replace('https://', '').replace('http://', ''),
    accessToken: shop.accessToken,
    apiVersion: config.apiVersion
  });

  return client;
}