import inquirer from 'inquirer';
import { selectShop, createShopifyClient } from '../shopify-client';
import {
  GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS,
  CREATE_METAFIELD_DEFINITION,
  DELETE_METAFIELD_DEFINITION,
  GET_METAFIELD_DEFINITIONS,
  UnstructuredMetafield,
  ProductWithMetafields
} from '../graphql/metafields';

interface MetafieldGroup {
  namespace: string;
  key: string;
  type: string;
  samples: Array<{
    productTitle: string;
    productHandle: string;
    value: string;
  }>;
  totalCount: number;
}

export async function deleteUnstructuredMetafields() {
  try {
    // Select shop
    const shop = await selectShop();
    const client = createShopifyClient(shop);

    console.log('\nScanning for unstructured metafields...\n');

    // Collect all unstructured metafields across products
    const metafieldGroups: Map<string, MetafieldGroup> = new Map();
    let cursor: string | null = null;
    let productCount = 0;

    do {
      const response = await client.request(GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS, {
        variables: { cursor }
      });

      const products = response.data.products;

      for (const edge of products.edges) {
        const product = edge.node;
        productCount++;

        // Filter for unstructured metafields (no definition)
        const unstructuredMetafields = product.metafields.edges
          .filter((mf: any) => !mf.node.definition)
          .map((mf: any) => ({
            ...mf.node,
            productTitle: product.title,
            productHandle: product.handle
          }));

        // Group by namespace:key
        for (const metafield of unstructuredMetafields) {
          const key = `${metafield.namespace}:${metafield.key}`;

          if (!metafieldGroups.has(key)) {
            metafieldGroups.set(key, {
              namespace: metafield.namespace,
              key: metafield.key,
              type: metafield.type,
              samples: [],
              totalCount: 0
            });
          }

          const group = metafieldGroups.get(key)!;
          group.totalCount++;

          // Keep up to 3 samples
          if (group.samples.length < 3) {
            group.samples.push({
              productTitle: metafield.productTitle,
              productHandle: metafield.productHandle,
              value: metafield.value
            });
          }
        }
      }

      cursor = products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null;

      // Show progress
      process.stdout.write(`\rScanned ${productCount} products...`);
    } while (cursor);

    console.log(`\n\nFound ${metafieldGroups.size} unique unstructured metafield keys across ${productCount} products.\n`);

    if (metafieldGroups.size === 0) {
      console.log('No unstructured metafields found. All metafields have definitions.');
      return;
    }

    // Process each metafield group
    const deletedGroups: string[] = [];
    const skippedGroups: string[] = [];

    for (const [key, group] of metafieldGroups) {
      console.log('─'.repeat(80));
      console.log(`\nMetafield: ${group.namespace}:${group.key}`);
      console.log(`Type: ${group.type}`);
      console.log(`Found in ${group.totalCount} product(s)\n`);

      console.log('Sample values:');
      group.samples.forEach((sample, index) => {
        const valuePreview = sample.value.length > 100
          ? sample.value.substring(0, 100) + '...'
          : sample.value;
        console.log(`  ${index + 1}. Product: "${sample.productTitle}" (${sample.productHandle})`);
        console.log(`     Value: ${valuePreview}\n`);
      });

      const { shouldDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldDelete',
          message: `Delete all ${group.totalCount} instance(s) of this metafield?`,
          default: false
        }
      ]);

      if (shouldDelete) {
        console.log(`\nCreating and deleting definition for ${group.namespace}:${group.key}...`);

        try {
          // First check if a definition already exists
          const existingDefResponse = await client.request(GET_METAFIELD_DEFINITIONS, {
            variables: {
              namespace: group.namespace,
              key: group.key
            }
          });

          let definitionId: string;

          if (existingDefResponse.data.metafieldDefinitions.edges.length > 0) {
            // Definition already exists
            definitionId = existingDefResponse.data.metafieldDefinitions.edges[0].node.id;
            console.log('Found existing definition, will delete it along with all metafields...');
          } else {
            // Create a new definition
            const createResponse = await client.request(CREATE_METAFIELD_DEFINITION, {
              variables: {
                definition: {
                  namespace: group.namespace,
                  key: group.key,
                  name: `${group.namespace} ${group.key}`,
                  type: group.type,
                  ownerType: 'PRODUCT'
                }
              }
            });

            if (createResponse.data.metafieldDefinitionCreate.userErrors.length > 0) {
              console.error('Error creating definition:', createResponse.data.metafieldDefinitionCreate.userErrors);
              skippedGroups.push(key);
              continue;
            }

            definitionId = createResponse.data.metafieldDefinitionCreate.createdDefinition.id;
            console.log('Created temporary definition...');
          }

          // Delete the definition and all associated metafields
          const deleteResponse = await client.request(DELETE_METAFIELD_DEFINITION, {
            variables: {
              id: definitionId,
              deleteAllAssociatedMetafields: true
            }
          });

          if (deleteResponse.data.metafieldDefinitionDelete.userErrors.length > 0) {
            console.error('Error deleting definition:', deleteResponse.data.metafieldDefinitionDelete.userErrors);
            skippedGroups.push(key);
          } else {
            console.log(`✓ Successfully deleted all ${group.totalCount} instance(s) of ${group.namespace}:${group.key}`);
            deletedGroups.push(key);
          }
        } catch (error) {
          console.error(`Error processing ${group.namespace}:${group.key}:`, error);
          skippedGroups.push(key);
        }
      } else {
        console.log('Skipped.');
        skippedGroups.push(key);
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\nSummary:');
    console.log(`- Deleted ${deletedGroups.length} metafield type(s)`);
    console.log(`- Skipped ${skippedGroups.length} metafield type(s)`);

    if (deletedGroups.length > 0) {
      console.log('\nDeleted metafields:');
      deletedGroups.forEach(key => console.log(`  - ${key}`));
    }

    if (skippedGroups.length > 0) {
      console.log('\nSkipped metafields:');
      skippedGroups.forEach(key => console.log(`  - ${key}`));
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}