import fs from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const source = process.env.OPENAPI_URL
  ? new URL(process.env.OPENAPI_URL)
  : new URL('../src/api/generated/openapi.json', import.meta.url);
const output = new URL('../src/api/generated/schema.ts', import.meta.url);

const ast = await openapiTS(source);
await fs.writeFile(output, astToString(ast));
console.log(`Generated ${output.pathname} from ${source.href}`);
