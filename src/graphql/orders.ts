export const SEARCH_CUSTOMERS = `
  query searchCustomers($query: String!, $first: Int!) {
    customers(first: $first, query: $query) {
      edges {
        node {
          id
          email
          firstName
          lastName
          displayName
          phone
          numberOfOrders
          defaultAddress {
            address1
            address2
            city
            province
            country
            zip
            phone
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const SEARCH_PRODUCTS = `
  query searchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          status
          handle
          totalInventory
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const CREATE_DRAFT_ORDER = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        status
        totalPrice
        subtotalPrice
        totalTax
        createdAt
        customer {
          id
          email
          displayName
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPrice
              variant {
                id
                title
                sku
              }
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

export const COMPLETE_DRAFT_ORDER = `
  mutation draftOrderComplete($id: ID!, $paymentPending: Boolean = true) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder {
        id
        order {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
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