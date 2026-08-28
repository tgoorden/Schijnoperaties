#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import uploadDirectory from 'upload-to-bunny';

const SOURCE_DIRECTORY = path.resolve(process.cwd(), '_site');
const CHECK_ONLY = process.argv.includes('--check');
const ALLOWED_CLEAN_MODES = new Set(['avoid-deletes', 'simple', 'none']);
const ALLOWED_REGIONS = new Set(['', 'uk', 'ny', 'la', 'sg', 'se', 'br', 'jh', 'syd']);

function environmentValue(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function requiredEnvironmentValue(name) {
  const value = environmentValue(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normaliseTarget(value) {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function normaliseRegion(value) {
  const region = value.toLowerCase();
  if (region === 'de') return '';
  if (!ALLOWED_REGIONS.has(region)) {
    throw new Error(
      'BUNNY_STORAGE_REGION must be blank for Frankfurt, or one of: uk, ny, la, sg, se, br, jh, syd.'
    );
  }
  return region;
}

function positiveInteger(name, fallback) {
  const rawValue = environmentValue(name, String(fallback));
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function fileCount(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
    const entryPath = path.join(directory, entry.name);
    return count + (entry.isDirectory() ? fileCount(entryPath) : 1);
  }, 0);
}

async function deploy() {
  if (!fs.existsSync(SOURCE_DIRECTORY) || !fs.statSync(SOURCE_DIRECTORY).isDirectory()) {
    throw new Error('The compiled `_site` directory does not exist. Run `npm run build` first.');
  }
  if (!fs.existsSync(path.join(SOURCE_DIRECTORY, 'index.html'))) {
    throw new Error('The compiled `_site` directory does not contain index.html.');
  }

  const storageZoneName = requiredEnvironmentValue('BUNNY_STORAGE_ZONE_NAME');
  const accessKey = requiredEnvironmentValue('BUNNY_ACCESS_KEY');
  const configuredRegion = environmentValue('BUNNY_STORAGE_REGION');
  const region = normaliseRegion(configuredRegion);
  const targetDirectory = normaliseTarget(environmentValue('BUNNY_STORAGE_PATH', '/'));
  const cleanMode = environmentValue('BUNNY_CLEAN_DESTINATION', 'avoid-deletes').toLowerCase();
  const maxConcurrentUploads = positiveInteger('BUNNY_MAX_CONCURRENT_UPLOADS', 10);

  if (!ALLOWED_CLEAN_MODES.has(cleanMode)) {
    throw new Error('BUNNY_CLEAN_DESTINATION must be `avoid-deletes`, `simple`, or `none`.');
  }

  const count = fileCount(SOURCE_DIRECTORY);
  console.log(`Source: ${SOURCE_DIRECTORY} (${count} files)`);
  console.log(`Storage zone: ${storageZoneName}`);
  console.log(`Storage region: ${region || 'Frankfurt, DE (default endpoint)'}`);
  console.log(`Remote path: ${targetDirectory}`);
  console.log(`Remote cleanup: ${cleanMode}`);
  console.log(`Concurrent uploads: ${maxConcurrentUploads}`);

  if (CHECK_ONLY) {
    console.log('Configuration check passed. No files were uploaded.');
    return;
  }

  const options = {
    storageZoneName,
    accessKey,
    maxConcurrentUploads
  };
  if (region) options.region = region;
  if (cleanMode !== 'none') options.cleanDestination = cleanMode;

  await uploadDirectory(SOURCE_DIRECTORY, targetDirectory, options);
  console.log(`Uploaded ${count} files to Bunny.net.`);
}

deploy().catch((error) => {
  const cause = [error.cause?.code, error.cause?.message].filter(Boolean).join(': ');
  console.error(`Bunny.net deployment failed: ${error.message}${cause ? ` (${cause})` : ''}`);
  process.exitCode = 1;
});
