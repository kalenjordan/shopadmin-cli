export const GET_CUSTOMERS_WITH_ORDER_COUNT = `
  query GetCustomersWithOrderCount(
    $numCustomers: Int!,
    $cursor: String,
    $query: String
  ) {
    customers(first: $numCustomers, after: $cursor, query: $query) {
      edges {
        node {
          id
          email
          firstName
          lastName
          numberOfOrders
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_CUSTOMER_ORDERS = `
  query GetCustomerOrders(
    $customerId: ID!,
    $numOrders: Int!,
    $cursor: String
  ) {
    customer(id: $customerId) {
      id
      email
      orders(first: $numOrders, after: $cursor) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 250) {
              edges {
                node {
                  id
                  title
                  sku
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  variant {
                    id
                    title
                    selectedOptions {
                      name
                      value
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
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;