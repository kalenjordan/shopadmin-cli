import { createShopifyClient } from '../shopify-client';
import { formatShopName } from '../utils/colors';
import { Shop } from '../types';
import { CREATE_PRODUCT, UPDATE_VARIANT, ACTIVATE_INVENTORY, GET_LOCATIONS, PUBLISH_PRODUCT, GET_PUBLICATIONS } from '../graphql/products';
import chalk from 'chalk';

interface CommandOptions {
  shop: Shop;
  verbose?: boolean;
  limit?: string;
}

interface UserError {
  field?: string[];
  message: string;
}

const ADJECTIVES = [
  'Premium', 'Deluxe', 'Classic', 'Modern', 'Vintage', 'Elegant',
  'Professional', 'Ultimate', 'Essential', 'Superior', 'Advanced',
  'Luxury', 'Artisan', 'Handcrafted', 'Designer', 'Limited Edition'
];

const PRODUCT_TYPES = [
  'T-Shirt', 'Hoodie', 'Mug', 'Notebook', 'Backpack', 'Water Bottle',
  'Phone Case', 'Tote Bag', 'Cap', 'Sticker Pack', 'Poster', 'Keychain',
  'Sunglasses', 'Watch', 'Wallet', 'Headphones', 'Laptop Sleeve'
];

const COLORS = [
  'Black', 'White', 'Navy Blue', 'Forest Green', 'Burgundy', 'Charcoal',
  'Sky Blue', 'Coral', 'Sage Green', 'Slate Gray', 'Midnight Blue'
];

const DESCRIPTIONS = [
  'Crafted with attention to detail and built to last.',
  'Perfect for everyday use, combining style and functionality.',
  'Made from high-quality materials for superior durability.',
  'A timeless design that never goes out of style.',
  'Carefully designed to meet the needs of modern life.',
  'Features premium construction and elegant finishing touches.',
  'An essential addition to your collection.',
  'Designed for those who appreciate quality and craftsmanship.',
  'Combines comfort, style, and practicality in one package.',
  'The perfect blend of form and function.'
];

function generateRandomProduct() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const productType = PRODUCT_TYPES[Math.floor(Math.random() * PRODUCT_TYPES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const title = `${adjective} ${color} ${productType}`;
  const description = DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];
  const price = (Math.random() * (99.99 - 9.99) + 9.99).toFixed(2);

  return { title, description, price };
}

export async function createProduct(options: CommandOptions) {
  const { shop, verbose = false, limit = '1' } = options;
  const numberOfProducts = parseInt(limit, 10);

  if (isNaN(numberOfProducts) || numberOfProducts < 1) {
    console.error(chalk.red('Invalid limit value. Must be a positive number.'));
    process.exit(1);
  }

  try {
    const client = createShopifyClient(shop);

    if (numberOfProducts === 1) {
      console.log(`\n${chalk.cyan('Creating product for')} ${formatShopName(shop.name)}\n`);
    } else {
      console.log(`\n${chalk.cyan(`Creating ${numberOfProducts} products for`)} ${formatShopName(shop.name)}\n`);
    }

    const successCount = { count: 0 };
    const failureCount = { count: 0 };

    for (let i = 0; i < numberOfProducts; i++) {
      if (numberOfProducts > 1) {
        console.log(chalk.gray(`\n[${i + 1}/${numberOfProducts}]`));
      }

      try {
        await createSingleProduct(client, shop, verbose);
        successCount.count++;
      } catch (error) {
        failureCount.count++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`❌ Error creating product ${i + 1}:`), errorMessage);
        if (verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
    }

    if (numberOfProducts > 1) {
      console.log(chalk.green(`\n✓ Created ${successCount.count} of ${numberOfProducts} products successfully`));
      if (failureCount.count > 0) {
        console.log(chalk.red(`✗ ${failureCount.count} products failed`));
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('\n❌ Error:'), errorMessage);
    if (verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

async function createSingleProduct(client: any, shop: Shop, verbose: boolean) {
  // Generate random product data
  const { title, description, price } = generateRandomProduct();

  if (verbose) {
    console.log(chalk.gray(`Product: ${title}`));
    console.log(chalk.gray(`Description: ${description}`));
    console.log(chalk.gray(`Price: $${price}`));
  }

  // Create the product
  console.log(chalk.cyan('Creating product...'));

  const productInput = {
    title,
    descriptionHtml: `<p>${description}</p>`,
    status: 'ACTIVE'
  };

  const createResponse = await client.request(CREATE_PRODUCT, {
    variables: { input: productInput }
  });

  if (verbose) {
    console.log(chalk.gray('Response:'), JSON.stringify(createResponse, null, 2));
  }

  if (!createResponse.data) {
    throw new Error(`Product creation failed: No data returned from API. Response: ${JSON.stringify(createResponse)}`);
  }

  if (createResponse.data.productCreate.userErrors.length > 0) {
    const errors = createResponse.data.productCreate.userErrors
      .map((e: UserError) => `${e.field?.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Product creation failed:\n${errors}`);
  }

  const product = createResponse.data.productCreate.product;
  const variant = product.variants.edges[0].node;

  console.log(chalk.green(`✓ Product created: ${product.title}`));

  if (verbose) {
    console.log(chalk.gray(`  ID: ${product.id}`));
    console.log(chalk.gray(`  Handle: ${product.handle}`));
    console.log(chalk.gray(`  Status: ${product.status}`));
    console.log(chalk.gray(`  Variant ID: ${variant.id}`));
    console.log(chalk.gray(`  Created: ${new Date(product.createdAt).toLocaleString()}`));
  }

  // Update variant price
  console.log(chalk.cyan('Setting product price...'));

  const variantUpdateResponse = await client.request(UPDATE_VARIANT, {
    variables: {
      productId: product.id,
      variants: [
        {
          id: variant.id,
          price: price
        }
      ]
    }
  });

  if (verbose) {
    console.log(chalk.gray('Variant update response:'), JSON.stringify(variantUpdateResponse, null, 2));
  }

  if (!variantUpdateResponse.data) {
    throw new Error(`Variant update failed: No data returned. Response: ${JSON.stringify(variantUpdateResponse)}`);
  }

  if (variantUpdateResponse.data.productVariantsBulkUpdate.userErrors.length > 0) {
    const errors = variantUpdateResponse.data.productVariantsBulkUpdate.userErrors
      .map((e: UserError) => `${e.field?.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Variant update failed:\n${errors}`);
  }

  console.log(chalk.green(`✓ Price set to $${price}`));

  // Get location and set inventory (optional - may fail due to permissions)
  try {
    console.log(chalk.cyan('Setting inventory...'));

    const locationsResponse = await client.request(GET_LOCATIONS, {
      variables: {}
    });

    if (!locationsResponse.data) {
      console.log(chalk.yellow(`⚠ Warning: Could not get locations`));
    } else {
      const location = locationsResponse.data.locations.edges[0]?.node;

      if (location && variant.inventoryItem?.id) {
        // Activate inventory at location with initial quantity
        const activateResponse = await client.request(ACTIVATE_INVENTORY, {
          variables: {
            inventoryItemId: variant.inventoryItem.id,
            locationId: location.id,
            available: 100
          }
        });

        if (verbose) {
          console.log(chalk.gray('Inventory activate response:'), JSON.stringify(activateResponse, null, 2));
        }

        if (!activateResponse.data) {
          console.log(chalk.yellow(`⚠ Warning: Could not set inventory - no data returned`));
        } else if (activateResponse.data.inventoryActivate.userErrors.length > 0) {
          const errors = activateResponse.data.inventoryActivate.userErrors
            .map((e: UserError) => `${e.field?.join('.')}: ${e.message}`)
            .join('\n');
          console.log(chalk.yellow(`⚠ Warning: Could not set inventory:\n${errors}`));
        } else {
          console.log(chalk.green(`✓ Inventory set to 100 units`));
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`⚠ Warning: Could not set inventory: ${errorMessage}`));
  }

  // Get online store publication ID and publish (optional - may fail due to permissions)
  try {
    console.log(chalk.cyan('\nPublishing to online store...'));

    const publicationsResponse = await client.request(GET_PUBLICATIONS, {
      variables: {}
    });

    if (!publicationsResponse.data) {
      console.log(chalk.yellow('⚠ Online Store channel not found. Product created but not published.'));
    } else {
      interface PublicationEdge {
        node: {
          id: string;
          name: string;
        };
      }

      const onlineStorePublication = publicationsResponse.data.publications.edges.find(
        (edge: PublicationEdge) => edge.node.name === 'Online Store'
      );

      if (!onlineStorePublication) {
        console.log(chalk.yellow('⚠ Online Store channel not found. Product created but not published.'));
      } else {
        // Publish the product
        const publishResponse = await client.request(PUBLISH_PRODUCT, {
          variables: {
            id: product.id,
            input: [
              {
                publicationId: onlineStorePublication.node.id
              }
            ]
          }
        });

        if (!publishResponse.data) {
          console.log(chalk.yellow('⚠ Warning: Product publication failed - no data returned'));
        } else if (publishResponse.data.publishablePublish.userErrors.length > 0) {
          const errors = publishResponse.data.publishablePublish.userErrors
            .map((e: UserError) => `${e.field?.join('.')}: ${e.message}`)
            .join('\n');
          console.log(chalk.yellow(`⚠ Warning: Product publication failed:\n${errors}`));
        } else {
          console.log(chalk.green(`✓ Product published to Online Store`));
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`⚠ Warning: Could not publish product: ${errorMessage}`));
  }

  console.log(chalk.green(`\n✓ Product created successfully!`));
  console.log(chalk.gray(`  Title: ${product.title}`));
  console.log(chalk.gray(`  Price: $${price}`));
  console.log(chalk.gray(`  Description: ${description}`));
}
