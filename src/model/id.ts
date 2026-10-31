import { nanoid } from 'nanoid';

/** Short, URL-safe, opaque id. Ids never appear in the generated script. */
export function createId(): string {
  return nanoid(10);
}
