import { GraphQLError } from '../types/graphql';
import { Shop } from '../types';
import { ERROR_PATTERNS } from '../constants';

export enum ErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  GRAPHQL = 'graphql',
  UNKNOWN = 'unknown'
}

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  suggestion?: string;
}

export function parseGraphQLErrors(errors: GraphQLError[] | unknown, shop?: Shop): ErrorInfo {
  if (!errors) {
    return {
      type: ErrorType.UNKNOWN,
      message: 'Unknown error occurred'
    };
  }

  let errorMessage = '';

  if (Array.isArray(errors)) {
    errorMessage = errors.map(err => err.message || err).join(', ');
  } else if (typeof errors === 'object') {
    errorMessage = (errors as any).message || JSON.stringify(errors);
  } else {
    errorMessage = String(errors);
  }

  if (ERROR_PATTERNS.ACCESS_DENIED.test(errorMessage)) {
    return {
      type: ErrorType.AUTHENTICATION,
      message: 'Authentication Error: The access token for this shop is invalid or expired.',
      suggestion: shop ? `Please update the access token using: shopadmin add -n "${shop.name}"` : undefined
    };
  }

  if (ERROR_PATTERNS.RATE_LIMIT.test(errorMessage)) {
    return {
      type: ErrorType.RATE_LIMIT,
      message: 'Rate Limit: API rate limit exceeded.',
      suggestion: 'Please wait a moment and try again.'
    };
  }

  return {
    type: ErrorType.GRAPHQL,
    message: `GraphQL Error: ${errorMessage}`
  };
}

export function handleError(error: unknown, verbose = false): void {
  const message = error instanceof Error ? error.message : String(error);

  console.error('\n❌ Error:', message);

  if (verbose && error instanceof Error && error.stack) {
    console.error('\nFull error:', error.stack);
  }
}