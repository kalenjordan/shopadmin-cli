#!/usr/bin/env tsx

import { Command } from 'commander';
import inquirer from 'inquirer';
import { addShop, listShops, removeShop, getShop } from './src/storage';
import { selectShop } from './src/shopify-client';
import { formatShopName, formatShopInfo } from './src/utils/colors';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const asciiArt = `
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ░                                                                                ░
  ░  ██████╗ ██╗  ██╗ ██████╗ ██████╗     █████╗ ██████╗ ███╗   ███╗██╗███╗   ██╗  ░
  ░  ██╔════╝██║  ██║██╔═══██╗██╔══██╗   ██╔══██╗██╔══██╗████╗ ████║██║████╗  ██║  ░
  ░  ███████╗███████║██║   ██║██████╔╝   ███████║██║  ██║██╔████╔██║██║██╔██╗ ██║  ░
  ░  ╚════██║██╔══██║██║   ██║██╔═══╝    ██╔══██║██║  ██║██║╚██╔╝██║██║██║╚██╗██║  ░
  ░  ███████║██║  ██║╚██████╔╝██║        ██║  ██║██████╔╝██║ ╚═╝ ██║██║██║ ╚████║  ░
  ░  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝        ╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝  ░
  ░                                                                                ░
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`;

// Load local config synchronously at startup
let defaultShopFromConfig: string | undefined;
const localConfigPath = path.join(process.cwd(), '.shopadmin.config.ts');
if (fs.existsSync(localConfigPath)) {
  try {
    // Use require for synchronous loading of TypeScript config
    const config = require(localConfigPath);
    defaultShopFromConfig = config.default?.defaultShop || config.defaultShop;
  } catch (error) {
    // Silently fail if config can't be loaded
  }
}

const program = new Command();

// Build description with default shop if available
let description = `${asciiArt}\nCLI for managing Shopify admin operations`;

if (defaultShopFromConfig) {
  const shop = getShop(defaultShopFromConfig);
  if (shop) {
    description += `\n\n${chalk.gray('Default shop:')} ${formatShopName(shop.name)}`;
  }
}

program
  .name('shopadmin')
  .description(description)
  .version('1.0.0');

program
  .command('add')
  .description('Add a new Shopify store')
  .option('-s, --subdomain <subdomain>', 'Store subdomain (e.g., your-store or your-store.myshopify.com)')
  .option('-t, --token <token>', 'Access token for the store')
  .option('-n, --name <name>', 'Store name (optional, defaults to subdomain)')
  .action(async (options) => {
    try {
      // Helper function to extract subdomain and generate name
      const processSubdomain = (input: string) => {
        // Remove https:// or http:// if present
        let subdomain = input.replace(/^https?:\/\//, '');
        // Remove .myshopify.com if present
        subdomain = subdomain.replace(/\.myshopify\.com.*$/, '');
        // Remove any trailing slashes or paths
        subdomain = subdomain.split('/')[0];
        return subdomain;
      };

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'subdomain',
          message: 'Store subdomain (e.g., your-store or your-store.myshopify.com):',
          when: !options.subdomain,
          validate: (input) => input.trim() !== '' || 'Store subdomain is required'
        },
        {
          type: 'password',
          name: 'token',
          message: 'Access token for the store:',
          mask: '*',
          when: !options.token,
          validate: (input) => input.trim() !== '' || 'Access token is required'
        }
      ]);

      // Extract subdomain and build URL
      const subdomain = processSubdomain(options.subdomain || answers.subdomain);
      const url = `https://${subdomain}.myshopify.com`;

      // Use provided name or default to subdomain
      const name = options.name || subdomain;
      const token = options.token || answers.token;

      // TODO: If config.apiVersion is not set, prompt user to select from available API versions
      // const config = loadShops();
      // if (!config.apiVersion) {
      //   const { apiVersion } = await inquirer.prompt([...]);
      //   config.apiVersion = apiVersion;
      //   saveShops(config);
      // }

      addShop(name, url, token);
    } catch (error) {
      console.error('Error adding shop:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all configured Shopify stores')
  .action(() => {
    try {
      const shops = listShops();
      if (shops.length === 0) {
        console.log('No shops configured yet. Use "shopadmin add" to add a shop.');
        return;
      }

      // Get the default shop from local config
      let defaultShopName: string | undefined;
      const localConfigPath = path.join(process.cwd(), '.shopadmin.config.ts');
      if (fs.existsSync(localConfigPath)) {
        try {
          const config = require(localConfigPath);
          defaultShopName = config.default?.defaultShop || config.defaultShop;
        } catch (error) {
          // Silently fail
        }
      }

      console.log('\nConfigured Shopify Stores:');
      console.log('─'.repeat(60));
      shops.forEach((shop, index) => {
        const isDefault = shop.name === defaultShopName;
        const defaultBadge = isDefault ? chalk.inverse(' DEFAULT ') + ' ' : '';
        console.log(`\n${index + 1}. ${defaultBadge}${formatShopName(shop.name)}`);
        console.log(`   ${chalk.gray('URL:')} ${shop.url}`);
        console.log(`   ${chalk.gray('Token:')} ${shop.accessToken.substring(0, 10)}...`);
        console.log(`   ${chalk.gray('Added:')} ${new Date(shop.addedAt).toLocaleString()}`);
      });
      console.log('');
    } catch (error) {
      console.error('Error listing shops:', error);
      process.exit(1);
    }
  });

program
  .command('remove')
  .description('Remove a Shopify store')
  .requiredOption('-n, --name <name>', 'Store name to remove')
  .action((options) => {
    try {
      const removed = removeShop(options.name);
      if (!removed) {
        console.log(`Shop ${formatShopName(options.name)} not found.`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error removing shop:', error);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show detailed information about a shop')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-v, --verbose', 'Show additional details like shop ID')
  .action(async (options) => {
    // Select shop at CLI level
    const shop = await selectShop(options.shop);

    // Import dynamically to avoid loading everything at startup
    const { showShopInfo } = await import('./src/commands/shop-info');
    await showShopInfo({ ...options, shop });
  });

program
  .command('default')
  .description('Set the default shop for this directory')
  .action(async () => {
    try {
      const shops = listShops();

      if (shops.length === 0) {
        console.log('No shops configured yet. Use "shopadmin add" to add a shop.');
        process.exit(1);
      }

      // Check if there's already a local config
      const localConfigPath = path.join(process.cwd(), '.shopadmin.config.ts');
      let currentDefault: string | undefined;

      if (fs.existsSync(localConfigPath)) {
        try {
          const config = require(localConfigPath);
          currentDefault = config.default?.defaultShop || config.defaultShop;
        } catch (error) {
          // Silently fail
        }
      }

      // Prompt for shop selection
      const { shopName } = await inquirer.prompt([
        {
          type: 'list',
          name: 'shopName',
          message: currentDefault
            ? `Select a shop (current: ${formatShopName(currentDefault)}):`
            : 'Select a shop:',
          choices: shops.map(s => ({
            name: formatShopInfo(s.name, s.url),
            value: s.name
          }))
        }
      ]);

      // Save the local config
      const localConfig = {
        defaultShop: shopName
      };

      const content = `export default ${JSON.stringify(localConfig, null, 2)};`;
      fs.writeFileSync(localConfigPath, content, 'utf8');

      console.log(`\n✓ Set default shop to ${formatShopName(shopName)}`);
      console.log(`  Configuration saved to: ${chalk.gray(localConfigPath)}`);

    } catch (error) {
      console.error('Error setting default shop:', error);
      process.exit(1);
    }
  });

// Product command with subcommands
const product = program
  .command('product')
  .description('Manage product data');

// Product metafields subcommand
const productMetafields = product
  .command('metafields')
  .description('Manage product metafields');

productMetafields
  .command('delete-unstructured')
  .description('Delete metafields without definitions')
  .option('-v, --verbose', 'Show all GraphQL queries and responses')
  .option('-f, --force', 'Delete all unstructured metafields without prompting')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .action(async (options) => {
    // Select shop at CLI level
    const shop = await selectShop(options.shop);

    // Import dynamically to avoid loading everything at startup
    const { deleteUnstructuredMetafields } = await import('./src/commands/metafield-definitions');
    await deleteUnstructuredMetafields({ ...options, shop, resourceType: 'product' });
  });

// Metafield command with subcommands
const metafield = program
  .command('metafield')
  .description('Manage metafields');

metafield
  .command('delete-unstructured')
  .description('Delete metafields without definitions')
  .option('--variants', 'Delete variant metafields instead of product metafields')
  .option('-v, --verbose', 'Show all GraphQL queries and responses')
  .option('-f, --force', 'Delete all unstructured metafields without prompting')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .action(async (options) => {
    // Select shop at CLI level
    const shop = await selectShop(options.shop);

    // Import dynamically to avoid loading everything at startup
    const { deleteUnstructuredMetafields } = await import('./src/commands/metafield-definitions');
    const resourceType = options.variants ? 'variant' : 'product';
    await deleteUnstructuredMetafields({ ...options, shop, resourceType });
  });

program.parse(process.argv);
