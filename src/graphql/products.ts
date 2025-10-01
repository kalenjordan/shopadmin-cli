export const CREATE_PRODUCT = `
  mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
    productCreate(input: $input, media: $media) {
      product {
        id
        title
        description
        handle
        status
        variants(first: 1) {
          edges {
            node {
              id
              title
              price
              sku
              inventoryItem {
                id
              }
            }
          }
        }
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_VARIANT = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
      productVariants {
        id
        price
        sku
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_PRODUCT = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        variants(first: 1) {
          edges {
            node {
              id
              sku
              price
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_INVENTORY = `
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      userErrors {
        field
        message
      }
      inventoryAdjustmentGroup {
        createdAt
        reason
        changes {
          name
          delta
        }
      }
    }
  }
`;

export const GET_LOCATIONS = `
  query getLocations {
    locations(first: 1) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

export const ACTIVATE_INVENTORY = `
  mutation inventoryActivate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
    inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
      inventoryLevel {
        id
        quantities(names: ["available"]) {
          name
          quantity
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const PUBLISH_PRODUCT = `
  mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable {
        ... on Product {
          id
          title
          publishedOnCurrentPublication
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_PUBLICATIONS = `
  query getPublications {
    publications(first: 10) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;
