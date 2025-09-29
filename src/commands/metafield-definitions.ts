import inquirer from 'inquirer';
import { createShopifyClient } from '../shopify-client';
import { Shop } from '../types';
import {
  GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS,
  GET_VARIANTS_WITH_UNSTRUCTURED_METAFIELDS,
  CREATE_METAFIELD_DEFINITION,
  DELETE_METAFIELD_DEFINITION,
  GET_METAFIELD_DEFINITIONS,
  UnstructuredMetafield
} from '../graphql/metafields';

interface CommandOptions {
  verbose?: boolean;
  force?: boolean;
  shop: Shop;
  resourceType?: 'product' | 'variant';
}

interface ProcessedMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
  productTitle: string;
  productHandle: string;
}

export async function deleteUnstructuredMetafields(options: CommandOptions) {
  const { verbose = false, force = false, shop, resourceType = 'product' } = options;
  const isVariant = resourceType === 'variant';

  try {
    const client = createShopifyClient(shop);

    if (force) {
      console.log('\n⚠️  FORCE MODE ENABLED - All unstructured metafields will be deleted automatically!');
      console.log('    This action cannot be undone. Press Ctrl+C to cancel.\n');
      // Give user a moment to cancel if they want
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\nScanning for ${isVariant ? 'variants' : 'products'} with unstructured metafields...\n`);

    let deletedCount = 0;
    let totalResourcesScanned = 0;
    const deletedMetafields = new Set<string>();
    let cursor: string | null = null;
    let shouldRestartScan = false;

    // Keep processing until no more products
    while (true) {
      // Reset cursor if we deleted something (to start fresh)
      if (shouldRestartScan) {
        cursor = null;
        shouldRestartScan = false;
        totalResourcesScanned = 0;
        console.log('\nRestarting scan from beginning after deletion...\n');
      }

      if (verbose) {
        console.log(`\n--- Fetching batch of ${isVariant ? 'variants' : 'products'} ---`);
        console.log('Cursor:', cursor || 'start');
      }

      // Fetch batch of resources
      const query = isVariant ? GET_VARIANTS_WITH_UNSTRUCTURED_METAFIELDS : GET_PRODUCTS_WITH_UNSTRUCTURED_METAFIELDS;
      const response = await client.request(query, {
        variables: { cursor }
      });

      if (verbose) {
        console.log('Response:', JSON.stringify(response, null, 2));
      }

      // Check for errors
      if (response.errors) {
        console.error('\n❌ GraphQL Errors:');

        // Handle different error formats
        let errorMessages = '';
        if (Array.isArray(response.errors)) {
          errorMessages = response.errors.map((err: any) => err.message || err).join(', ');
        } else if (typeof response.errors === 'object') {
          errorMessages = response.errors.message || JSON.stringify(response.errors);
        } else {
          errorMessages = String(response.errors);
        }

        if (errorMessages.toLowerCase().includes('access denied') ||
            errorMessages.toLowerCase().includes('unauthorized') ||
            errorMessages.toLowerCase().includes('invalid api key or access token')) {
          console.error('🔐 Authentication Error: The access token for this shop is invalid or expired.');
          console.error('   Please update the access token using: shopadmin add -n "' + shop.name + '"');
        } else if (errorMessages.toLowerCase().includes('throttled')) {
          console.error('⏱️  Rate Limit: API rate limit exceeded. Please wait a moment and try again.');
        } else {
          console.error('Full error details:', JSON.stringify(response.errors, null, 2));
        }

        throw new Error('GraphQL query failed: ' + errorMessages);
      }

      const dataKey = isVariant ? 'productVariants' : 'products';
      if (!response.data?.[dataKey]?.edges?.length) {
        console.log(`\n✅ No more ${isVariant ? 'variants' : 'products'} to process.`);
        break;
      }

      const resources = response.data[dataKey].edges;
      const batchSize = resources.length;
      totalResourcesScanned += batchSize;

      // Show progress
      process.stdout.write(`\rScanned ${totalResourcesScanned} ${isVariant ? 'variants' : 'products'}...`);

      // Look for any resource with unstructured metafields
      let foundUnstructuredResource = null;

      for (const edge of resources) {
        const resource = edge.node;

        // Find unstructured metafields (those without definitions)
        const unstructuredMetafields = resource.metafields.edges
          .filter((mf: any) => !mf.node.definition);

        if (unstructuredMetafields.length > 0) {
          foundUnstructuredResource = {
            resource,
            unstructuredMetafields: unstructuredMetafields.map((mf: any) => ({
              ...mf.node,
              resourceTitle: isVariant ? `${resource.product.title} - ${resource.title || resource.sku}` : resource.title,
              resourceHandle: isVariant ? resource.product.handle : resource.handle
            }))
          };
          break; // Stop at first resource with unstructured metafields
        }
      }

      // If we found a resource with unstructured metafields, process it
      if (foundUnstructuredResource) {
        const { resource, unstructuredMetafields } = foundUnstructuredResource;
        const displayTitle = isVariant ? `${resource.product.title} - ${resource.title || resource.sku}` : resource.title;

        console.log(`\n\nFound ${unstructuredMetafields.length} unstructured metafield(s) in ${isVariant ? 'variant' : 'product'}: "${displayTitle}"`);

        // Process each unstructured metafield
        for (const metafield of unstructuredMetafields) {
          const metafieldKey = `${metafield.namespace}:${metafield.key}`;

          // Skip if we've already deleted this namespace:key combination
          if (deletedMetafields.has(metafieldKey)) {
            console.log(`  Skipping ${metafieldKey} (already deleted)`);
            continue;
          }

          console.log('\n────────────────────────────────────────────────────────────────────────────────');
          console.log(`\nMetafield: ${metafieldKey}`);
          console.log(`Type: ${metafield.type}`);
          console.log(`${isVariant ? 'Variant' : 'Product'}: "${metafield.resourceTitle}" (${metafield.resourceHandle})`);

          const valuePreview = metafield.value.length > 200
            ? metafield.value.substring(0, 200) + '...'
            : metafield.value;
          console.log(`Value: ${valuePreview}\n`);

          let shouldDelete = false;

          if (force) {
            console.log(`🔥 Force mode: Automatically deleting ${metafieldKey}`);
            shouldDelete = true;
          } else {
            const response = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'shouldDelete',
                message: `Delete ALL instances of ${metafieldKey} across ALL ${isVariant ? 'variants' : 'products'}?`,
                default: false
              }
            ]);
            shouldDelete = response.shouldDelete;
          }

          if (shouldDelete) {
            console.log(`\nDeleting all instances of ${metafieldKey}...`);

            try {
              // First check if a definition already exists
              const existingDefResponse = await client.request(GET_METAFIELD_DEFINITIONS, {
                variables: {
                  namespace: metafield.namespace,
                  key: metafield.key,
                  ownerType: isVariant ? 'PRODUCTVARIANT' : 'PRODUCT'
                }
              });

              let definitionId: string;

              if (existingDefResponse.data.metafieldDefinitions.edges.length > 0) {
                // Definition already exists
                definitionId = existingDefResponse.data.metafieldDefinitions.edges[0].node.id;
                console.log('Found existing definition, will delete it along with all metafields...');
              } else {
                // Map legacy types to current Shopify metafield types
                const typeMapping: { [key: string]: string } = {
                  'string': 'single_line_text_field',
                  'integer': 'number_integer',
                  'json_string': 'json',
                  'boolean': 'boolean',
                  'number_decimal': 'number_decimal',
                  'number_integer': 'number_integer',
                  'date': 'date',
                  'date_time': 'date_time',
                  'url': 'url',
                  'color': 'color',
                  'rating': 'rating',
                  'multi_line_text_field': 'multi_line_text_field',
                  'single_line_text_field': 'single_line_text_field',
                  'json': 'json',
                  // Add more mappings as needed
                };

                const mappedType = typeMapping[metafield.type] || metafield.type;

                // Create a new definition
                const createResponse = await client.request(CREATE_METAFIELD_DEFINITION, {
                  variables: {
                    definition: {
                      namespace: metafield.namespace,
                      key: metafield.key,
                      name: `${metafield.namespace} ${metafield.key}`,
                      type: mappedType,
                      ownerType: isVariant ? 'PRODUCTVARIANT' : 'PRODUCT'
                    }
                  }
                });

                if (createResponse.data.metafieldDefinitionCreate.userErrors.length > 0) {
                  console.error('Error creating definition:', createResponse.data.metafieldDefinitionCreate.userErrors);
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
              } else {
                console.log(`✓ Successfully deleted all instances of ${metafieldKey}`);
                deletedMetafields.add(metafieldKey);
                deletedCount++;
                shouldRestartScan = true; // Restart scan after deletion
              }
            } catch (error) {
              console.error(`Error processing ${metafieldKey}:`, error);
            }
          } else {
            console.log('Skipped.');
          }
        }

        // If we deleted something, restart the scan from the beginning
        if (shouldRestartScan) {
          continue; // This will restart with cursor = null
        }
      }

      // Check if there are more pages
      if (response.data[dataKey].pageInfo.hasNextPage) {
        cursor = response.data[dataKey].pageInfo.endCursor;
      } else {
        // No more pages and no unstructured metafields found
        console.log(`\n\n✅ Finished scanning all ${isVariant ? 'variants' : 'products'}.`);
        break;
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\nSummary:');
    console.log(`- Scanned ${totalResourcesScanned} ${isVariant ? 'variant(s)' : 'product(s)'}`);
    console.log(`- Deleted ${deletedCount} metafield type(s)`);

    if (deletedMetafields.size > 0) {
      console.log('\nDeleted metafields:');
      deletedMetafields.forEach(key => console.log(`  - ${key}`));
    }

  } catch (error: any) {
    // Check for specific error types
    if (error.message?.includes('Authentication Error') ||
        error.message?.toLowerCase().includes('unauthorized') ||
        error.message?.toLowerCase().includes('access denied')) {
      // Authentication error already formatted above
    } else if (error.message?.includes('Rate Limit')) {
      // Rate limit error already formatted above
    } else if (error.message?.includes('API version not configured')) {
      // Config error already has good message
      console.error('\n❌', error.message);
    } else {
      console.error('\n❌ Error:', error.message || error);
      if (verbose) {
        console.error('\nFull error:', error);
      }
    }
    process.exit(1);
  }
}