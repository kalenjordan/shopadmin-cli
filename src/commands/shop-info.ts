import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import chalk from 'chalk';

interface CommandOptions {
  shop: Shop;
  verbose?: boolean;
}

const SHOP_INFO_QUERY = `
  query {
    shop {
      name
      email
      primaryDomain {
        host
        url
      }
      plan {
        displayName
        partnerDevelopment
        shopifyPlus
      }
      currencyCode
      timezoneAbbreviation
      unitSystem
      weightUnit
      myshopifyDomain
      id
      createdAt
      features {
        storefront
      }
      billingAddress {
        country
        province
        city
      }
    }
  }
`;

export async function showShopInfo(options: CommandOptions) {
  const { shop, verbose = false } = options;

  try {
    const client = createShopifyClient(shop);

    console.log('\nFetching shop information...\n');

    // Fetch shop info from Shopify API
    const response = await client.request(SHOP_INFO_QUERY);

    if (response.errors) {
      console.error('❌ GraphQL Errors:', response.errors);
      throw new Error('Failed to fetch shop information');
    }

    const shopData = response.data.shop;

    // Display shop information
    console.log('═'.repeat(80));
    console.log(chalk.bold(`\n📍 Shop Information: ${formatShopName(shop.name)}\n`));
    console.log('─'.repeat(80));

    // Basic Information
    console.log(chalk.cyan('Basic Information:'));
    console.log(`  ${chalk.gray('Store Name:')} ${shopData.name}`);
    console.log(`  ${chalk.gray('Shop ID:')} ${shopData.id.split('/').pop()}`);
    console.log(`  ${chalk.gray('Email:')} ${shopData.email}`);
    console.log(`  ${chalk.gray('Primary Domain:')} ${shopData.primaryDomain.host}`);
    console.log(`  ${chalk.gray('MyShopify Domain:')} ${shopData.myshopifyDomain}`);
    console.log(`  ${chalk.gray('Created:')} ${new Date(shopData.createdAt).toLocaleDateString()}`);

    // Plan Information
    console.log(chalk.cyan('\nPlan Information:'));
    console.log(`  ${chalk.gray('Plan:')} ${shopData.plan.displayName}`);
    console.log(`  ${chalk.gray('Shopify Plus:')} ${shopData.plan.shopifyPlus ? '✓ Yes' : '✗ No'}`);
    console.log(`  ${chalk.gray('Partner Development:')} ${shopData.plan.partnerDevelopment ? '✓ Yes' : '✗ No'}`);

    // Settings
    console.log(chalk.cyan('\nSettings:'));
    console.log(`  ${chalk.gray('Currency:')} ${shopData.currencyCode}`);
    console.log(`  ${chalk.gray('Timezone:')} ${shopData.timezoneAbbreviation}`);
    console.log(`  ${chalk.gray('Unit System:')} ${shopData.unitSystem}`);
    console.log(`  ${chalk.gray('Weight Unit:')} ${shopData.weightUnit}`);

    // Location
    if (shopData.billingAddress) {
      console.log(chalk.cyan('\nLocation:'));
      const location = [
        shopData.billingAddress.city,
        shopData.billingAddress.province,
        shopData.billingAddress.country
      ].filter(Boolean).join(', ');
      console.log(`  ${chalk.gray('Address:')} ${location}`);
    }

    // Features
    console.log(chalk.cyan('\nFeatures:'));
    console.log(`  ${chalk.gray('Storefront:')} ${shopData.features.storefront ? '✓ Enabled' : '✗ Disabled'}`);

    // Connection Details (from local config)
    console.log(chalk.cyan('\nLocal Configuration:'));
    console.log(`  ${chalk.gray('Config Name:')} ${shop.name}`);
    console.log(`  ${chalk.gray('API URL:')} ${shop.url}`);
    console.log(`  ${chalk.gray('Token:')} ${shop.accessToken.substring(0, 10)}...`);
    console.log(`  ${chalk.gray('Added:')} ${new Date(shop.addedAt).toLocaleString()}`);

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Authentication failed')) {
      console.error('\n' + errorMessage);
    } else {
      console.error('\n❌ Error fetching shop information:', errorMessage);
    }
    process.exit(1);
  }
}