#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { addShop, listShops, removeShop } from './src/storage';

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

const program = new Command();

program
  .name('shopadmin')
  .description(`${asciiArt}\nCLI for managing Shopify admin operations`)
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

      console.log('\nConfigured Shopify Stores:');
      console.log('─'.repeat(60));
      shops.forEach((shop, index) => {
        console.log(`\n${index + 1}. ${shop.name}`);
        console.log(`   URL: ${shop.url}`);
        console.log(`   Token: ${shop.accessToken.substring(0, 10)}...`);
        console.log(`   Added: ${new Date(shop.addedAt).toLocaleString()}`);
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
        console.log(`Shop "${options.name}" not found.`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error removing shop:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
