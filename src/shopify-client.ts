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

export async function selectShop(overrideName?: string): Promise<Shop> {
  const shops = listShops();

  if (shops.length === 0) {
    console.error('No shops configured. Use "shopadmin add" to add a shop.');
    process.exit(1);
  }

  // Check if override shop name was provided
  if (overrideName) {
    const overrideShop = getShop(overrideName);
    if (overrideShop) {
      console.log(`Using shop: ${formatShopName(overrideShop.name)} (from --shop parameter)`);
      return overrideShop;
    } else {
      console.error(`Shop "${overrideName}" not found.`);
      console.log('Available shops:');
      shops.forEach(shop => console.log(`  - ${shop.name}`));
      process.exit(1);
    }
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

  const baseClient = createAdminApiClient({
    storeDomain: shop.url.replace('https://', '').replace('http://', ''),
    accessToken: shop.accessToken,
    apiVersion: config.apiVersion
  });

  // Wrap the client to add better error handling
  const client = {
    ...baseClient,
    request: async (query: string, options?: any) => {
      const response = await baseClient.request(query, options);

      // Check if the response contains GraphQL errors
      if (response.errors?.graphQLErrors && Array.isArray(response.errors.graphQLErrors)) {
        const accessError = response.errors.graphQLErrors.find((e: any) =>
          e.extensions?.code === 'ACCESS_DENIED');

        if (accessError) {
          const field = accessError.path?.[0] || 'resource';
          throw new Error(
            `Access denied for "${field}" field.\n` +
            `Your access token does not have the required permissions.\n` +
            `Documentation: https://shopify.dev/api/usage/access-scopes`
          );
        }
      }

      return response;
    }
  };

  return client;
}