export const CREATE_PRODUCT = `
  mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
    productCreate(input: $input, media: $media) {
      product {
        id
        title
        description
        handle
        status
        media(first: 10) {
          edges {
            node {
              ... on MediaImage {
                id
                image {
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
        }
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

export const GET_PRODUCT_BY_HANDLE = `
  query getProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      descriptionHtml
      handle
      status
      vendor
      productType
      tags
      createdAt
      updatedAt
      publishedAt
      onlineStoreUrl
      featuredImage {
        id
        url
        altText
        width
        height
      }
      media(first: 250) {
        edges {
          node {
            ... on MediaImage {
              id
              image {
                url
                altText
                width
                height
              }
              mediaContentType
            }
          }
        }
      }
      variants(first: 250) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            sku
            barcode
            position
            availableForSale
            inventoryPolicy
            inventoryQuantity
            inventoryItem {
              id
              tracked
            }
            selectedOptions {
              name
              value
            }
            metafields(first: 250) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                  description
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
      }
      metafields(first: 250) {
        edges {
          node {
            id
            namespace
            key
            value
            type
            description
            createdAt
            updatedAt
          }
        }
      }
      options {
        id
        name
        values
        position
      }
      seo {
        title
        description
      }
    }
  }
`;

export const GET_PRODUCT_BY_ID = `
  query getProductById($id: ID!) {
    product(id: $id) {
      id
      title
      description
      descriptionHtml
      handle
      status
      vendor
      productType
      tags
      createdAt
      updatedAt
      publishedAt
      onlineStoreUrl
      featuredImage {
        id
        url
        altText
        width
        height
      }
      media(first: 250) {
        edges {
          node {
            ... on MediaImage {
              id
              image {
                url
                altText
                width
                height
              }
              mediaContentType
            }
          }
        }
      }
      variants(first: 250) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            sku
            barcode
            position
            availableForSale
            inventoryPolicy
            inventoryQuantity
            inventoryItem {
              id
              tracked
            }
            selectedOptions {
              name
              value
            }
            metafields(first: 250) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                  description
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
      }
      metafields(first: 250) {
        edges {
          node {
            id
            namespace
            key
            value
            type
            description
            createdAt
            updatedAt
          }
        }
      }
      options {
        id
        name
        values
        position
      }
      seo {
        title
        description
      }
    }
  }
`;

export const LIST_PRODUCTS = `
  query listProducts($first: Int!, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
    products(first: $first, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          id
          title
          description
          descriptionHtml
          handle
          status
          vendor
          productType
          tags
          createdAt
          updatedAt
          publishedAt
          onlineStoreUrl
          featuredImage {
            id
            url
            altText
            width
            height
          }
          media(first: 250) {
            edges {
              node {
                ... on MediaImage {
                  id
                  image {
                    url
                    altText
                    width
                    height
                  }
                  mediaContentType
                }
              }
            }
          }
          variants(first: 250) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                barcode
                position
                availableForSale
                inventoryPolicy
                inventoryQuantity
                inventoryItem {
                  id
                  tracked
                }
                selectedOptions {
                  name
                  value
                }
                metafields(first: 250) {
                  edges {
                    node {
                      id
                      namespace
                      key
                      value
                      type
                      description
                      createdAt
                      updatedAt
                    }
                  }
                }
              }
            }
          }
          metafields(first: 250) {
            edges {
              node {
                id
                namespace
                key
                value
                type
                description
                createdAt
                updatedAt
              }
            }
          }
          options {
            id
            name
            values
            position
          }
          seo {
            title
            description
          }
        }
      }
    }
  }
`;
