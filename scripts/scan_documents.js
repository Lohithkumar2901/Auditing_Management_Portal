const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'maintenance_db',
};

const BASE_DIR = '/data/files/documents';

const FOLDER_TYPE_MAP = {
  policies:   'POLICY',
  procedures: 'PROCEDURE',
  sop:        'SOP',
  formats:    'FORMAT',
  training:   'TRAINING',
};

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.pptx']);

function scanFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath));
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

function getDocumentType(filePath) {
  // extract the first folder segment under BASE_DIR
  const relative = path.relative(BASE_DIR, filePath);
  const topFolder = relative.split(path.sep)[0];
  return FOLDER_TYPE_MAP[topFolder] || topFolder.toUpperCase();
}

function getDocumentName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Connected to database.');

  // load already-inserted file paths to avoid duplicates
  const [existing] = await conn.execute('SELECT file_path FROM documents');
  const existingPaths = new Set(existing.map(r => r.file_path));

  const files = scanFiles(BASE_DIR);
  const today = new Date().toISOString().slice(0, 10);

  let inserted = 0;
  let skipped = 0;

  for (const filePath of files) {
    if (existingPaths.has(filePath)) {
      console.log(`  SKIP (duplicate): ${filePath}`);
      skipped++;
      continue;
    }

    const documentType = getDocumentType(filePath);
    const documentName = getDocumentName(filePath);

    await conn.execute(
      `INSERT INTO documents
         (document_type, document_name, uploaded_date, reviewed_date, approval_date,
          status, file_path, uploaded_by, version_no, remarks)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)`,
      [documentType, documentName, today, 'Approved', filePath, 'SYSTEM', 'v1']
    );

    console.log(`  INSERT: [${documentType}] ${documentName}`);
    inserted++;
  }

  await conn.end();
  console.log(`\nDone. Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
