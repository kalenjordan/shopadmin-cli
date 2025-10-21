export const LIST_CATALOGS = `
  query listCatalogs($first: Int!) {
    catalogs(first: $first) {
      edges {
        node {
          id
          title
          status
        }
      }
    }
  }
`;
