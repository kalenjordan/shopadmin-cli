export const ASCII_ART = `
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ░                                                                                ░
  ░  ██████╗ ██╗  ██╗ ██████╗ ██████╗     █████╗ ██████╗ ███╗   ███╗██╗███╗   ██╗  ░
  ░  ██╔════╝██║  ██║██╔═══██╗██╔══██╗   ██╔══██╗██╔══██╗████╗ ████║██║████╗  ██║  ░
  ░  ███████╗███████║██║   ██║██████╔╝   ███████║██║  ██║██╔████╔██║██║██╔██╗ ██║  ░
  ░  ╚════██║██╔══██║██║   ██║██╔═══╝    ██╔══██║██║  ██║██║╚██╔╝██║██║██║╚██╗██║  ░
  ░  ███████║██║  ██║╚██████╔╝██║        ██║  ██║██████╔╝██║ ╚═╝ ██║██║██║ ╚████║  ░
  ░  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝        ╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝  ░
  ░                                                                                ░
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
`;

export const BATCH_SIZES = {
  PRODUCTS: 100,
  VARIANTS: 100,
  METAFIELDS: 250
} as const;

export const DELAYS = {
  FORCE_MODE_WARNING: 2000
} as const;

export const LINE_SEPARATORS = {
  THIN: '─'.repeat(60),
  THICK: '═'.repeat(80),
  SECTION: '─'.repeat(80)
} as const;

export const TYPE_MAPPINGS: Record<string, string> = {
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
};

export const ERROR_PATTERNS = {
  ACCESS_DENIED: /access denied|unauthorized|invalid api key|access token/i,
  RATE_LIMIT: /throttled|rate limit/i,
} as const;