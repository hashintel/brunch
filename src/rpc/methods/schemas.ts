import { Type } from 'typebox';

export const NonBlankStringSchema = Type.String({ minLength: 1, pattern: '\\S' });
export const PositiveIntegerSchema = Type.Integer({ minimum: 1 });
export const NoParamsSchema = Type.Void({ description: 'Omit JSON-RPC params.' });
export const NonNegativeIntegerSchema = Type.Integer({ minimum: 0 });
