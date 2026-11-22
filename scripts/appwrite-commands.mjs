import { readFileSync } from 'node:fs';

// Prints reviewable commands for Appwrite's signed-in web terminal. Does not run them.
// No API keys, passwords, cookies, or admin credentials are stored in this repository.
const schema = JSON.parse(readFileSync(new URL('../appwrite/schema.json', import.meta.url), 'utf8'));
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

for (const table of schema.tables) {
  const argumentsList = [
    'appwrite tablesdb create-table', '--database-id', schema.databaseId,
    '--table-id', table.id, '--name', quote(table.name), '--row-security',
    ...table.permissions.flatMap(permission => ['--permissions', quote(permission)]),
    ...table.columns.flatMap(column => ['--columns', quote(JSON.stringify(column))]),
    ...table.indexes.flatMap(index => ['--indexes', quote(JSON.stringify(index))]),
    '--json',
  ];
  process.stdout.write(`${argumentsList.join(' ')}\n\n`);
}

const bucket = schema.bucket;
process.stdout.write([
  'appwrite storage create-bucket', '--bucket-id', bucket.id, '--name', quote(bucket.name),
  '--file-security', '--enabled', '--maximum-file-size', String(bucket.maximumFileSize),
  ...bucket.permissions.flatMap(permission => ['--permissions', quote(permission)]),
  ...bucket.allowedFileExtensions.flatMap(extension => ['--allowed-file-extensions', extension]),
  '--compression none', '--encryption', '--antivirus', '--transformations=false', '--json',
].join(' ') + '\n');
