#!/usr/bin/env tsx

import { Command } from 'commander';
import inquirer from 'inquirer';
import { addShop, listShops, removeShop, getShop } from './src/storage';
import { selectShop } from './src/shopify-client';
import { formatShopName, formatShopInfo } from './src/utils/colors';
import { loadLocalConfig, saveLocalConfig, getLocalConfigPath } from './src/utils/config';
import { ASCII_ART, LINE_SEPARATORS } from './src/constants';
import chalk from 'chalk';

// Load local config synchronously at startup
const { defaultShop: defaultShopFromConfig } = loadLocalConfig();

const program = new Command();

// Build description with default shop if available
let description = `${ASCII_ART}\nCLI for managing Shopify admin operations`;

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

// Shop command with subcommands
const shop = program
  .command('shop')
  .description('Manage Shopify stores');

shop
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

shop
  .command('list')
  .description('List all configured Shopify stores')
  .action(() => {
    try {
      const shops = listShops();
      if (shops.length === 0) {
        console.log('No shops configured yet. Use "shopadmin shop add" to add a shop.');
        return;
      }

      // Get the default shop from local config
      const { defaultShop: defaultShopName } = loadLocalConfig();

      console.log('\nConfigured Shopify Stores:');
      console.log(LINE_SEPARATORS.THIN);
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

shop
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

shop
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

shop
  .command('default')
  .description('Set the default shop for this directory')
  .action(async () => {
    try {
      const shops = listShops();

      if (shops.length === 0) {
        console.log('No shops configured yet. Use "shopadmin shop add" to add a shop.');
        process.exit(1);
      }

      // Check if there's already a local config
      const { defaultShop: currentDefault } = loadLocalConfig();

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
      saveLocalConfig({ defaultShop: shopName });

      console.log(`\n✓ Set default shop to ${formatShopName(shopName)}`);
      console.log(`  Configuration saved to: ${chalk.gray(getLocalConfigPath())}`);

    } catch (error) {
      console.error('Error setting default shop:', error);
      process.exit(1);
    }
  });

// Product command with subcommands
const product = program
  .command('product')
  .description('Manage product data');

product
  .command('create')
  .description('Create a random product and publish to online store')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-v, --verbose', 'Show detailed progress')
  .option('-l, --limit <number>', 'Number of products to create (default: 1)', '1')
  .action(async (options) => {
    const shop = await selectShop(options.shop);
    const { createProduct } = await import('./src/commands/product-create');
    await createProduct({ ...options, shop });
  });

product
  .command('get <handleOrId>')
  .description('Get a product by handle or ID')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-v, --verbose', 'Show detailed progress and GraphQL responses')
  .action(async (handleOrId, options) => {
    const shop = await selectShop(options.shop);
    const { getProduct } = await import('./src/commands/product-get');
    await getProduct({ ...options, handleOrId, shop });
  });

product
  .command('list')
  .description('List products ordered by updated date (descending)')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-l, --limit <number>', 'Number of products to fetch (default: 5)', '5')
  .option('-v, --verbose', 'Show detailed progress and GraphQL responses')
  .action(async (options) => {
    const shop = await selectShop(options.shop);
    const { listProducts } = await import('./src/commands/product-list');
    await listProducts({ ...options, shop });
  });

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
    const shop = await selectShop(options.shop);
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
    const shop = await selectShop(options.shop);
    const { deleteUnstructuredMetafields } = await import('./src/commands/metafield-definitions');
    const resourceType = options.variants ? 'variant' : 'product';
    await deleteUnstructuredMetafields({ ...options, shop, resourceType });
  });

// Customer command with subcommands
const customer = program
  .command('customer')
  .description('Manage customer data');

customer
  .command('download')
  .description('Download customers with order history to JSON')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-o, --output <file>', 'Output file path (default: customers-{timestamp}.json)')
  .option('-l, --limit <number>', 'Maximum number of orders to download (default: 5000)', '5000')
  .option('-v, --verbose', 'Show progress and API calls')
  .action(async (options) => {
    const shop = await selectShop(options.shop);
    const { downloadCustomers } = await import('./src/commands/customer-download');
    await downloadCustomers({ ...options, shop });
  });

// Order command with subcommands
const order = program
  .command('order')
  .description('Manage orders');

order
  .command('create')
  .description('Create a new order interactively')
  .option('-s, --shop <name>', 'Shop name to use (overrides default)')
  .option('-v, --verbose', 'Show detailed progress')
  .action(async (options) => {
    const shop = await selectShop(options.shop);
    const { createOrder } = await import('./src/commands/order-create');
    await createOrder({ ...options, shop });
  });

program.parse(process.argv);