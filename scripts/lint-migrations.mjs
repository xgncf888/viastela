#!/usr/bin/env node
/**
 * Guards for supabase/migrations/*.sql:
 * - every created table enables row level security
 * - a table with deleted_at has a *_00_forbid_update_deleted trigger
 * - GRANT to anon is rejected
 * - GRANT to authenticated is rejected unless the table is listed in
 *   scripts/lint-migrations-allowlist.txt
 * - security definer functions set search_path
 *
 * State is the result of applying every migration in filename order. A column
 * or trigger added in a later file counts. Comments, policies, and REVOKE are
 * not grants. Words inside a function body are not function options.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_PATH = 'scripts/lint-migrations-allowlist.txt';
const MIGRATIONS_DIR = 'supabase/migrations';

export function lintRepository(root = ROOT) {
  const allowlistText = readFileSync(path.join(root, ALLOWLIST_PATH), 'utf8');
  const dir = path.join(root, MIGRATIONS_DIR);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      path: `${MIGRATIONS_DIR}/${name}`,
      sql: readFileSync(path.join(dir, name), 'utf8'),
    }));
  return lintMigrationFiles(files, allowlistText);
}

export function lintMigrationFiles(files, allowlistText) {
  const allowlist = parseAllowlist(allowlistText);
  const tables = new Map();
  const findings = [];
  const definers = [];

  for (const file of files) {
    for (const statement of splitSql(file.sql)) {
      const sql = statement.sql.replace(/;\s*$/, '').trim();
      if (!sql) continue;
      analyze(sql, file.path, statement.line, tables, findings, definers, allowlist.tables);
    }
  }

  for (const [key, table] of tables) {
    if (!table.created) continue;
    if (!table.rls) {
      findings.push(
        finding(
          'missing-rls',
          table.createdAt.file,
          table.createdAt.line,
          `${table.createdAt.file} ${key}`,
          `table ${key} is created without enable row level security`,
        ),
      );
    }
    if (table.deletedAt && !hasForbidTrigger(table)) {
      const at = table.deletedAtAt ?? table.createdAt;
      findings.push(
        finding(
          'missing-forbid-update-deleted',
          at.file,
          at.line,
          `${at.file} ${key}`,
          `table ${key} has deleted_at but no *_00_forbid_update_deleted trigger`,
        ),
      );
    }
  }

  return finish(findings, allowlist, tables, definers);
}

export function parseAllowlist(text) {
  const tables = new Set();
  const violations = [];
  const lines = text.split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const hash = raw.indexOf('#');
    const code = (hash === -1 ? raw : raw.slice(0, hash)).trim();
    const comment = hash === -1 ? '' : raw.slice(hash + 1).trim();
    if (!code) continue;
    if (code.startsWith('violation ')) {
      const rest = code.slice('violation '.length).trim();
      const space = rest.indexOf(' ');
      if (space === -1) {
        throw new Error(`${ALLOWLIST_PATH}:${index + 1}: violation needs a rule and a key`);
      }
      violations.push({
        rule: rest.slice(0, space),
        key: normalize(rest.slice(space + 1)),
        comment,
        line: index + 1,
      });
      continue;
    }
    if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(code)) {
      throw new Error(`${ALLOWLIST_PATH}:${index + 1}: expected schema.table`);
    }
    tables.add(code);
  }
  return { tables, violations };
}

function analyze(sql, file, line, tables, findings, definers, allowlist) {
  if (/^create\s+(?:unlogged\s+)?table\b/i.test(sql)) {
    readCreateTable(sql, file, line, tables, findings);
    return;
  }
  if (/^alter\s+table\b/i.test(sql)) {
    readAlterTable(sql, file, line, tables, findings);
    return;
  }
  if (/^drop\s+table\b/i.test(sql)) {
    readDropTable(sql, tables);
    return;
  }
  if (/^create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\b/i.test(sql)) {
    readCreateTrigger(sql, file, line, tables, findings);
    return;
  }
  if (/^drop\s+trigger\b/i.test(sql)) {
    readDropTrigger(sql, tables);
    return;
  }
  if (/^create\s+(?:or\s+replace\s+)?function\b/i.test(sql)) {
    readCreateFunction(sql, file, line, findings, definers);
    return;
  }
  if (/^grant\b/i.test(sql)) readGrant(sql, file, line, findings, allowlist);
}

function readCreateTable(sql, file, line, tables, findings) {
  const match = /^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?/i.exec(sql);
  const qual = readQualified(sql, match[0].length);
  if (!qual) {
    findings.push(finding('parse-error', file, line, `${file} ${line} create table`, 'create table has no name'));
    return;
  }
  const key = tableKey(qual);
  const ifNotExists = /^create\s+(?:unlogged\s+)?table\s+if\s+not\s+exists\b/i.test(sql);
  const previous = tables.get(key);
  if (!(previous?.created && ifNotExists)) {
    const table = freshTable();
    table.created = true;
    table.createdAt = { file, line };
    if (previous && !previous.created) table.triggers = previous.triggers;
    tables.set(key, table);
  }
  const table = tables.get(key);
  if (/^\s*as\b/i.test(sql.slice(qual.end))) return;
  const open = sql.indexOf('(', qual.end);
  if (open === -1) return;
  const body = extractParen(sql, open);
  if (!body) {
    findings.push(
      finding('parse-error', file, line, `${file} ${line} ${key}`, `create table ${key} has an unclosed column list`),
    );
    return;
  }
  if (columnNames(body.inner).includes('deleted_at')) {
    table.deletedAt = true;
    table.deletedAtAt = { file, line };
  }
}

function readAlterTable(sql, file, line, tables, findings) {
  const match = /^alter\s+table\s+/i.exec(sql);
  let index = match[0].length;
  while (/^\s*(?:if\s+exists|only)\b/i.test(sql.slice(index))) {
    const skipped = /^\s*(?:if\s+exists|only)\b/i.exec(sql.slice(index));
    index += skipped[0].length;
  }
  const qual = readQualified(sql, index);
  if (!qual) {
    findings.push(finding('parse-error', file, line, `${file} ${line} alter table`, 'alter table has no name'));
    return;
  }
  let key = tableKey(qual);
  let table = ensure(tables, key);
  for (const action of splitCommas(sql.slice(qual.end))) {
    const body = action.trim();
    if (!body) continue;
    if (/^enable\s+row\s+level\s+security\b/i.test(body)) {
      table.rls = true;
      continue;
    }
    if (/^disable\s+row\s+level\s+security\b/i.test(body)) {
      table.rls = false;
      continue;
    }
    if (/^rename\s+to\b/i.test(body)) {
      const renamed = readQualified(body, /^rename\s+to\s+/i.exec(body)[0].length);
      if (!renamed) continue;
      const next = tableKey(renamed);
      tables.delete(key);
      tables.set(next, table);
      key = next;
      continue;
    }
    const added = parseAddColumn(body);
    if (added?.name === 'deleted_at') {
      table.deletedAt = true;
      table.deletedAtAt = { file, line };
      continue;
    }
    const dropped = parseDropColumn(body);
    if (dropped?.name === 'deleted_at') {
      table.deletedAt = false;
      continue;
    }
    if (/^rename\s+column\b/i.test(body)) {
      const from = readIdent(body, /^rename\s+column\s+/i.exec(body)[0].length);
      const toWord = from ? findWord(body, 'to', from.end) : -1;
      const to = toWord < 0 ? null : readIdent(body, toWord + 2);
      if (from?.name === 'deleted_at') table.deletedAt = false;
      if (to?.name === 'deleted_at') {
        table.deletedAt = true;
        table.deletedAtAt = { file, line };
      }
    }
  }
}

function readDropTable(sql, tables) {
  const match = /^drop\s+table\s+(?:if\s+exists\s+)?/i.exec(sql.trim());
  const rest = sql.trim().slice(match[0].length).replace(/\s+(?:cascade|restrict)\s*$/i, '');
  for (const part of splitCommas(rest)) {
    const qual = readQualified(part, 0);
    if (qual) tables.delete(tableKey(qual));
  }
}

function readCreateTrigger(sql, file, line, tables, findings) {
  const match = /^create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+/i.exec(sql);
  const name = readIdent(sql, match[0].length);
  if (!name) {
    findings.push(finding('parse-error', file, line, `${file} ${line} trigger`, 'create trigger has no name'));
    return;
  }
  const onAt = findWord(sql, 'on', name.end);
  const qual = onAt < 0 ? null : readQualified(sql, onAt + 2);
  if (!qual) {
    findings.push(
      finding('parse-error', file, line, `${file} ${line} ${name.name}`, `create trigger ${name.name} has no table`),
    );
    return;
  }
  ensure(tables, tableKey(qual)).triggers.add(name.name);
}

function readDropTrigger(sql, tables) {
  const match = /^drop\s+trigger\s+(?:if\s+exists\s+)?/i.exec(sql.trim());
  const name = readIdent(sql.trim(), match[0].length);
  if (!name) return;
  const onAt = findWord(sql, 'on', name.end);
  if (onAt < 0) return;
  const qual = readQualified(sql, onAt + 2);
  if (!qual) return;
  tables.get(tableKey(qual))?.triggers.delete(name.name);
}

function readCreateFunction(sql, file, line, findings, definers) {
  const match = /^create\s+(?:or\s+replace\s+)?function\s+/i.exec(sql);
  const qual = readQualified(sql, match[0].length);
  if (!qual) {
    findings.push(finding('parse-error', file, line, `${file} ${line} function`, 'create function has no name'));
    return;
  }
  const visible = blankStringsAndDollars(sql);
  if (!/\bsecurity\s+definer\b/i.test(visible)) return;
  const name = `${qual.schema}.${qual.name}`;
  const searchPath = /\bset\s+search_path\b/i.test(visible);
  definers.push({ name, file, line, searchPath });
  if (searchPath) return;
  findings.push(
    finding(
      'security-definer-search-path',
      file,
      line,
      `${file} ${name}`,
      `security definer function ${name} does not set search_path`,
    ),
  );
}

function readGrant(sql, file, line, findings, allowlist) {
  const toAt = findWord(sql, 'to', 0);
  if (toAt < 0) {
    findings.push(finding('parse-error', file, line, `${file} ${line} grant`, 'grant has no grantee'));
    return;
  }
  const grantees = parseGrantees(sql.slice(toAt + 2));
  if (grantees.includes('anon')) {
    findings.push(finding('grant-anon', file, line, `${file} ${normalize(sql)}`, 'grant to anon is not allowed'));
  }
  if (!grantees.includes('authenticated')) return;
  const onAt = findWord(sql, 'on', 0);
  if (onAt < 0 || onAt > toAt) return;
  const target = tableGrantTargets(sql.slice(onAt + 2, toAt).trim());
  if (target.kind === 'other') return;
  if (target.kind === 'all') {
    findings.push(
      finding(
        'grant-authenticated',
        file,
        line,
        `${file} ${target.schema}.*`,
        `grant on all tables in schema ${target.schema} to authenticated is not in ${ALLOWLIST_PATH}`,
      ),
    );
    return;
  }
  for (const key of target.tables) {
    if (allowlist.has(key)) continue;
    findings.push(
      finding(
        'grant-authenticated',
        file,
        line,
        `${file} ${key}`,
        `grant on ${key} to authenticated is not in ${ALLOWLIST_PATH}`,
      ),
    );
  }
}

function tableGrantTargets(target) {
  if (/^(?:function|procedure|routine|schema|sequence|database|tablespace|type|domain|language|foreign|large|parameter)\b/i.test(target)) {
    return { kind: 'other', tables: [] };
  }
  const all = /^all\s+tables\s+in\s+schema\s+/i.exec(target);
  if (all) {
    const schema = readIdent(target, all[0].length);
    return { kind: 'all', schema: schema?.name ?? 'public', tables: [] };
  }
  const tables = [];
  for (const part of splitCommas(target.replace(/^table\s+/i, ''))) {
    const qual = readQualified(part, 0);
    if (qual) tables.push(tableKey(qual));
  }
  return { kind: 'tables', tables };
}

function parseGrantees(clause) {
  const cut = clause
    .replace(/\s+with\s+grant\s+option\b[\s\S]*$/i, '')
    .replace(/\s+granted\s+by\b[\s\S]*$/i, '');
  const names = [];
  for (const part of splitCommas(cut)) {
    let ident = readIdent(part, 0);
    if (ident?.name === 'group') ident = readIdent(part, ident.end);
    if (ident) names.push(ident.name);
  }
  return names;
}

function parseAddColumn(action) {
  if (!/^add\b/i.test(action) || /^add\s+constraint\b/i.test(action)) return null;
  const match = /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?/i.exec(action);
  const ident = readIdent(action, match[0].length);
  if (!ident || ident.name === 'constraint') return null;
  return ident;
}

function parseDropColumn(action) {
  if (!/^drop\b/i.test(action) || /^drop\s+constraint\b/i.test(action)) return null;
  const match = /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?/i.exec(action);
  const ident = readIdent(action, match[0].length);
  if (!ident || ident.name === 'constraint') return null;
  return ident;
}

function columnNames(inner) {
  const names = [];
  for (const part of splitCommas(inner)) {
    const trimmed = part.trim();
    if (!trimmed || /^(?:constraint|primary|unique|check|foreign|exclude|like)\b/i.test(trimmed)) continue;
    const ident = readIdent(trimmed, 0);
    if (ident) names.push(ident.name);
  }
  return names;
}

function hasForbidTrigger(table) {
  for (const name of table.triggers) {
    if (/_00_forbid_update_deleted$/i.test(name)) return true;
  }
  return false;
}

function freshTable() {
  return { created: false, rls: false, deletedAt: false, deletedAtAt: null, createdAt: null, triggers: new Set() };
}

function ensure(tables, key) {
  let table = tables.get(key);
  if (!table) {
    table = freshTable();
    tables.set(key, table);
  }
  return table;
}

function tableKey(qual) {
  return `${qual.schema}.${qual.name}`;
}

function finding(rule, file, line, key, message) {
  return { rule, file, line, key: normalize(key), message };
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function finish(findings, allowlist, tables, definers) {
  const suppressed = [];
  const remaining = [];
  const used = new Set();
  for (const item of findings) {
    const matchIndex = allowlist.violations.findIndex(
      (entry, index) => !used.has(index) && entry.rule === item.rule && entry.key === item.key,
    );
    if (matchIndex === -1) {
      remaining.push(item);
      continue;
    }
    used.add(matchIndex);
    suppressed.push({ ...item, comment: allowlist.violations[matchIndex].comment });
  }
  const stale = allowlist.violations.filter((_, index) => !used.has(index));
  const byLocation = (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule);
  remaining.sort(byLocation);
  suppressed.sort(byLocation);
  return { findings: remaining, suppressed, stale, tables, definers, allowlist };
}

export function splitSql(source) {
  const statements = [];
  let buf = '';
  let line = 1;
  let stmtLine = 1;
  let started = false;
  let mode = 'code';
  let block = 0;
  let dollarTag = '';
  let index = 0;

  const push = () => {
    const sql = buf.trim();
    buf = '';
    started = false;
    if (sql) statements.push({ sql, line: stmtLine });
  };

  while (index < source.length) {
    const ch = source[index];
    const next = source[index + 1];
    if (ch === '\n') line += 1;

    if (mode === 'line-comment') {
      if (ch === '\n') mode = 'code';
      buf += ch === '\n' ? '\n' : ' ';
      index += 1;
      continue;
    }
    if (mode === 'block-comment') {
      if (ch === '/' && next === '*') {
        block += 1;
        buf += '  ';
        index += 2;
        continue;
      }
      if (ch === '*' && next === '/') {
        block -= 1;
        buf += '  ';
        index += 2;
        if (block === 0) mode = 'code';
        continue;
      }
      buf += ch === '\n' ? '\n' : ' ';
      index += 1;
      continue;
    }
    if (mode === 'string') {
      buf += ch;
      if (ch === "'" && next === "'") {
        buf += next;
        index += 2;
        continue;
      }
      if (ch === "'") mode = 'code';
      index += 1;
      continue;
    }
    if (mode === 'dollar') {
      if (source.startsWith(dollarTag, index)) {
        buf += dollarTag;
        index += dollarTag.length;
        mode = 'code';
        continue;
      }
      buf += ch;
      index += 1;
      continue;
    }
    if (mode === 'ident') {
      buf += ch;
      if (ch === '"') {
        if (next === '"') {
          buf += next;
          index += 2;
          continue;
        }
        mode = 'code';
      }
      index += 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      mode = 'line-comment';
      buf += '  ';
      index += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      mode = 'block-comment';
      block = 1;
      buf += '  ';
      index += 2;
      continue;
    }
    if (ch === "'") {
      mode = 'string';
      buf += ch;
      index += 1;
      continue;
    }
    if (ch === '"') {
      mode = 'ident';
      buf += ch;
      index += 1;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(source.slice(index));
      if (tag) {
        mode = 'dollar';
        dollarTag = tag[0];
        buf += tag[0];
        index += tag[0].length;
        continue;
      }
    }
    if (ch === ';') {
      buf += ';';
      push();
      index += 1;
      continue;
    }
    if (!started && !/\s/.test(ch)) {
      started = true;
      stmtLine = line;
    }
    buf += ch;
    index += 1;
  }
  if (buf.trim()) push();
  return statements;
}

function blankStringsAndDollars(sql) {
  let out = '';
  let mode = 'code';
  let dollarTag = '';
  let index = 0;
  while (index < sql.length) {
    const ch = sql[index];
    const next = sql[index + 1];
    if (mode === 'string') {
      out += ch === '\n' ? '\n' : ' ';
      if (ch === "'" && next === "'") {
        out += ' ';
        index += 2;
        continue;
      }
      if (ch === "'") mode = 'code';
      index += 1;
      continue;
    }
    if (mode === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        out += ' '.repeat(dollarTag.length);
        index += dollarTag.length;
        mode = 'code';
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      index += 1;
      continue;
    }
    if (ch === "'") {
      mode = 'string';
      out += ' ';
      index += 1;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(index));
      if (tag) {
        mode = 'dollar';
        dollarTag = tag[0];
        out += ' '.repeat(tag[0].length);
        index += tag[0].length;
        continue;
      }
    }
    out += ch;
    index += 1;
  }
  return out;
}

function findWord(sql, word, from) {
  const lower = word.toLowerCase();
  let depth = 0;
  let mode = 'code';
  let dollarTag = '';
  let index = 0;
  while (index < sql.length) {
    const ch = sql[index];
    const next = sql[index + 1];
    if (mode === 'string') {
      if (ch === "'" && next === "'") {
        index += 2;
        continue;
      }
      if (ch === "'") mode = 'code';
      index += 1;
      continue;
    }
    if (mode === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length;
        mode = 'code';
        continue;
      }
      index += 1;
      continue;
    }
    if (mode === 'ident') {
      if (ch === '"') {
        if (next === '"') {
          index += 2;
          continue;
        }
        mode = 'code';
      }
      index += 1;
      continue;
    }
    if (ch === "'") {
      mode = 'string';
      index += 1;
      continue;
    }
    if (ch === '"') {
      mode = 'ident';
      index += 1;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(index));
      if (tag) {
        mode = 'dollar';
        dollarTag = tag[0];
        index += tag[0].length;
        continue;
      }
    }
    if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;
    if (depth === 0 && index >= from && isWordAt(sql, index, lower)) return index;
    index += 1;
  }
  return -1;
}

function isWordAt(sql, index, word) {
  if (sql.slice(index, index + word.length).toLowerCase() !== word) return false;
  const before = index === 0 ? '' : sql[index - 1];
  const after = sql[index + word.length] ?? '';
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

function readIdent(sql, index) {
  let cursor = skipSpace(sql, index);
  if (cursor >= sql.length) return null;
  if (sql[cursor] === '"') {
    let name = '';
    cursor += 1;
    while (cursor < sql.length) {
      if (sql[cursor] === '"') {
        if (sql[cursor + 1] === '"') {
          name += '"';
          cursor += 2;
          continue;
        }
        cursor += 1;
        break;
      }
      name += sql[cursor];
      cursor += 1;
    }
    return { name, end: cursor };
  }
  const match = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(sql.slice(cursor));
  if (!match) return null;
  return { name: match[0].toLowerCase(), end: cursor + match[0].length };
}

function readQualified(sql, index) {
  const first = readIdent(sql, index);
  if (!first) return null;
  const cursor = skipSpace(sql, first.end);
  if (sql[cursor] !== '.') return { schema: 'public', name: first.name, end: first.end };
  const second = readIdent(sql, cursor + 1);
  if (!second) return null;
  return { schema: first.name, name: second.name, end: second.end };
}

function skipSpace(sql, index) {
  let cursor = index;
  while (cursor < sql.length && /\s/.test(sql[cursor])) cursor += 1;
  return cursor;
}

function extractParen(sql, openIndex) {
  let depth = 0;
  let mode = 'code';
  let dollarTag = '';
  let index = openIndex;
  while (index < sql.length) {
    const ch = sql[index];
    const next = sql[index + 1];
    if (mode === 'string') {
      if (ch === "'" && next === "'") {
        index += 2;
        continue;
      }
      if (ch === "'") mode = 'code';
      index += 1;
      continue;
    }
    if (mode === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length;
        mode = 'code';
        continue;
      }
      index += 1;
      continue;
    }
    if (ch === "'") {
      mode = 'string';
      index += 1;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(index));
      if (tag) {
        mode = 'dollar';
        dollarTag = tag[0];
        index += tag[0].length;
        continue;
      }
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { inner: sql.slice(openIndex + 1, index), end: index + 1 };
    }
    index += 1;
  }
  return null;
}

function splitCommas(sql) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let mode = 'code';
  let dollarTag = '';
  let index = 0;
  while (index < sql.length) {
    const ch = sql[index];
    const next = sql[index + 1];
    if (mode === 'string') {
      if (ch === "'" && next === "'") {
        index += 2;
        continue;
      }
      if (ch === "'") mode = 'code';
      index += 1;
      continue;
    }
    if (mode === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length;
        mode = 'code';
        continue;
      }
      index += 1;
      continue;
    }
    if (ch === "'") {
      mode = 'string';
      index += 1;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(index));
      if (tag) {
        mode = 'dollar';
        dollarTag = tag[0];
        index += tag[0].length;
        continue;
      }
    }
    if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(sql.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }
  parts.push(sql.slice(start));
  return parts;
}

function report(result) {
  for (const item of result.suppressed) {
    const why = item.comment ? ` (${item.comment})` : '';
    console.log(`allowlisted ${item.file}:${item.line}: ${item.message}${why}`);
  }
  for (const entry of result.stale) {
    console.error(`${ALLOWLIST_PATH}:${entry.line}: stale violation entry ${entry.rule} ${entry.key} matches nothing`);
  }
  for (const item of result.findings) {
    console.error(`::error file=${item.file},line=${item.line}::${item.message}`);
    console.error(`${item.file}:${item.line}: ${item.message}`);
  }
  const created = [...result.tables.values()].filter((table) => table.created).length;
  console.log(
    `lint-migrations: ${created} tables, ${result.findings.length} findings, ${result.suppressed.length} allowlisted`,
  );
  return result.findings.length > 0 || result.stale.length > 0 ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(report(lintRepository()));
