#!/usr/bin/env node

/**
 * validate-templates.mjs
 *
 * Guardrail script for llm-prompt-templates repo.
 * Validates that every template file (__*.md) has a PROMPT_METADATA block
 * with required fields: version, iteration_count, last_model, last_date, changelog.
 *
 * Usage:
 *   node scripts/validate-templates.mjs           # validate all templates
 *   node scripts/validate-templates.mjs --check   # same (alias)
 *   node scripts/validate-templates.mjs --fix     # add missing metadata scaffolds
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixMode = process.argv.includes('--fix');

// ── Find all template files ──────────────────────────────────
const modelDirs = ['claude', 'gemini', 'openai', 'llama', 'mistral'];
const templates = [];

for (const dir of modelDirs) {
  const dirPath = path.join(repoRoot, dir);
  if (!fs.existsSync(dirPath)) continue;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (file.startsWith('__') && file.endsWith('.md')) {
      templates.push(path.join(dir, file));
    }
  }
}

if (templates.length === 0) {
  console.log('No template files found (expected __*.md in model directories).');
  process.exit(0);
}

// ── Required metadata fields ─────────────────────────────────
const REQUIRED_FIELDS = ['version', 'iteration_count', 'last_model', 'last_date', 'changelog'];

const SCAFFOLD = `<!-- PROMPT_METADATA
version: 1.0
iteration_count: 1
last_model: UNKNOWN
last_date: ${new Date().toISOString().slice(0, 10)}
changelog:
  - v1.0 (${new Date().toISOString().slice(0, 10)}, UNKNOWN): Initial version tracking
-->

`;

// ── Validate each template ───────────────────────────────────
const errors = [];
let passed = 0;

for (const relPath of templates) {
  const absPath = path.join(repoRoot, relPath);
  const content = fs.readFileSync(absPath, 'utf8');

  // Check for PROMPT_METADATA block
  const metaMatch = content.match(/<!--\s*PROMPT_METADATA\s*\n([\s\S]*?)-->/);

  if (!metaMatch) {
    if (fixMode) {
      fs.writeFileSync(absPath, SCAFFOLD + content);
      console.log(`  fixed   ${relPath} — added PROMPT_METADATA scaffold`);
      passed++;
      continue;
    }
    errors.push({ file: relPath, issue: 'Missing PROMPT_METADATA block' });
    continue;
  }

  const metaBlock = metaMatch[1];
  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    // For changelog, check for the "changelog:" key followed by entries
    if (field === 'changelog') {
      if (!metaBlock.includes('changelog:')) {
        missing.push(field);
      }
    } else {
      const regex = new RegExp(`^${field}:\\s*.+`, 'm');
      if (!regex.test(metaBlock)) {
        missing.push(field);
      }
    }
  }

  if (missing.length > 0) {
    errors.push({ file: relPath, issue: `Missing fields: ${missing.join(', ')}` });
    continue;
  }

  // Check for placeholder values
  const warnings = [];
  if (/last_model:\s*UNKNOWN/.test(metaBlock)) {
    warnings.push('last_model is still UNKNOWN');
  }
  if (/iteration_count:\s*0\b/.test(metaBlock)) {
    warnings.push('iteration_count is 0');
  }

  if (warnings.length > 0) {
    console.log(`  ⚠  ${relPath} — ${warnings.join('; ')}`);
  }

  passed++;
  console.log(`  ✓  ${relPath}`);
}

// ── Report ───────────────────────────────────────────────────
console.log('');
if (errors.length > 0) {
  console.error(`✗ ${errors.length} template(s) failed validation:\n`);
  for (const err of errors) {
    console.error(`  ✗ ${err.file}`);
    console.error(`    ${err.issue}`);
  }
  console.error(`\nFix: Add a PROMPT_METADATA block to each file, or run:`);
  console.error(`  node scripts/validate-templates.mjs --fix\n`);
  process.exit(1);
}

console.log(`✓ All ${passed} template(s) have valid PROMPT_METADATA.`);
