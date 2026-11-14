#!/usr/bin/env node
/**
 * 把 `src/client/` 下的 ES 模块打成 DSH 浏览器半区要求的单一 bundle。
 *
 * 宿主用 `window.__ModuleLoader__.load({ id, factory })` 加载客户端包；
 * factory 里的 `require()` 只能解析平台 seed（见 SEED）。相对路径模块必须
 * 在构建期内联，否则运行时会抛 `require("...") missed the module table`。
 *
 * 支持的源码子集（越界在构建期报错，不静默放过）：
 *   import { a, b as c } from 'x'
 *   import * as ns from 'x'
 *   import Default from 'x'
 *   import 'x'
 *   export function|async function|class|const|let NAME
 *   export { a, b as c }
 *
 * 用法：node scripts/build-client.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = path.join(ROOT, 'src/client/index.js')
const OUT = path.join(ROOT, 'lib/client.js')

/** 平台 seed：宿主在 factory 的 require 里直接提供。 */
const SEED = new Set(['react', 'react/jsx-runtime', 'react-dom'])

const IMPORT_RE = /^import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"];?[ \t]*$/gm
const BARE_IMPORT_RE = /^import\s+['"]([^'"]+)['"];?[ \t]*$/gm
const EXPORT_DECL_RE = /^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm
const EXPORT_LIST_RE = /^export\s*\{([^}]*)\};?[ \t]*$/gm

const fail = (file, message) => {
  throw new Error(`${path.relative(ROOT, file)}: ${message}`)
}

/**
 * @param {string | undefined} clause
 * @param {string} specifier
 * @param {string} resolveExpr
 * @param {string} file
 */
function importBinding(clause, specifier, resolveExpr, file) {
  const names = []
  if (clause === undefined || clause.trim() === '') {
    return { code: `${resolveExpr};\n`, names }
  }
  const text = clause.trim()
  let code = ''
  let rest = text

  const named = /\{([\s\S]*?)\}/.exec(text)
  if (named !== null) {
    rest = rest.replace(named[0], '')
    const parts = []
    for (const raw of named[1].split(',')) {
      const piece = raw.trim()
      if (piece === '') continue
      const [importedRaw, localRaw] = piece.split(/\s+as\s+/)
      const imported = importedRaw.trim()
      const local = (localRaw ?? imported).trim()
      if (!/^[A-Za-z_$][\w$]*$/.test(imported) || !/^[A-Za-z_$][\w$]*$/.test(local)) {
        fail(file, `无法解析具名导入 "${piece}"（不支持字符串导入名）`)
      }
      parts.push(imported === local ? imported : `${imported}: ${local}`)
      names.push(local)
    }
    if (parts.length > 0) code += `const { ${parts.join(', ')} } = ${resolveExpr};\n`
  }

  const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(text)
  if (namespace !== null) {
    rest = rest.replace(namespace[0], '')
    code += `const ${namespace[1]} = ${resolveExpr};\n`
    names.push(namespace[1])
  }

  const leftover = rest.replace(/,/g, ' ').trim()
  if (leftover !== '') {
    if (!/^[A-Za-z_$][\w$]*$/.test(leftover)) fail(file, `无法解析默认导入 "${leftover}"`)
    code += `const ${leftover} = (${resolveExpr}).default ?? ${resolveExpr};\n`
    names.push(leftover)
  }
  return { code, names }
}

/**
 * @param {string} fromFile
 * @param {string} specifier
 * @param {string} file
 */
function resolveModule(fromFile, specifier, file) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), specifier)
  if (specifier.endsWith('.js')) return base
  return `${base}.js`
}

/**
 * @param {string} source
 * @param {string} file
 */
function transform(source, file) {
  const needed = new Set()
  const slots = new Map()

  let counter = 0
  const withPlaceholders = source.replace(IMPORT_RE, (_all, clause, specifier) => {
    const key = `__RKIMPORT${counter++}__`
    needed.add(specifier)
    const resolved = resolveModule(file, specifier, file)
    slots.set(key, { clause, specifier, resolved })
    return `__PH_${key}__;`
  })

  if (BARE_IMPORT_RE.test(withPlaceholders)) fail(file, '存在未被识别的 import 语句（可能是多行写法）')
  if (/^\s*export\s+default\b/m.test(source)) fail(file, '不支持 export default（宿主只消费具名导出）')
  if (/\bimport\s*\(/.test(source)) fail(file, '不支持动态 import()')
  if (/\bmodule\.exports\b|\brequire\s*\(/.test(source)) fail(file, '源码里不允许直接使用 CJS 语法')

  const exportPairs = []
  const withoutExportKeyword = withPlaceholders.replace(EXPORT_DECL_RE, '')
  for (const match of withPlaceholders.matchAll(
    /^export\s+(?:async\s+)?(?:function\s*\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    exportPairs.push([match[1], match[1]])
  }
  const withoutExportLists = withoutExportKeyword.replace(EXPORT_LIST_RE, (_all, list) => {
    for (const raw of list.split(',')) {
      const piece = raw.trim()
      if (piece === '') continue
      const [localRaw, exportedRaw] = piece.split(/\s+as\s+/)
      exportPairs.push([localRaw.trim(), (exportedRaw ?? localRaw).trim()])
    }
    return ''
  })

  return { code: withoutExportLists, exports: exportPairs, needed, slots }
}

const modules = new Map()

/** @param {string} file */
async function collect(file) {
  const absolute = path.resolve(file)
  if (modules.has(absolute)) return modules.get(absolute)
  const source = await readFile(absolute, 'utf8').catch(() => fail(absolute, '文件不存在'))
  const record = { file: absolute, ...transform(source, absolute), id: null, dependencies: new Map() }
  modules.set(absolute, record)
  for (const [key, slot] of record.slots) {
    if (slot.resolved === null) {
      if (!SEED.has(slot.specifier)) {
        fail(absolute, `外部依赖 "${slot.specifier}" 既不是平台 seed 也不在支持的列表里（可用：${[...SEED].join(', ')}）`)
      }
      record.dependencies.set(key, { kind: 'seed', specifier: slot.specifier, resolved: null })
    } else {
      const dependency = await collect(slot.resolved)
      record.dependencies.set(key, { kind: 'local', specifier: slot.specifier, resolved: dependency.file })
    }
  }
  return record
}

const entry = await collect(ENTRY)

const ordered = []
const visited = new Set()
;(function visit(record) {
  if (visited.has(record.file)) return
  visited.add(record.file)
  for (const dependency of record.dependencies.values()) {
    if (dependency.kind === 'local') visit(modules.get(dependency.resolved))
  }
  ordered.push(record)
})(entry)

const nameOf = new Map(ordered.map((record, index) => [record.file, `__rkm${index}`]))

/** @param {any} record */
function renderModule(record) {
  const name = nameOf.get(record.file)
  let code = record.code
  for (const [key, dependency] of record.dependencies) {
    const resolveExpr = dependency.kind === 'seed'
      ? `__rkRequire(${JSON.stringify(dependency.specifier)})`
      : nameOf.get(dependency.resolved)
    const binding = importBinding(record.slots.get(key).clause, dependency.specifier, resolveExpr, record.file)
    code = code.replace(`__PH_${key}__;`, binding.code.trimEnd())
  }
  if (code.includes('__PH_')) fail(record.file, '有 import 占位符未被替换')
  const exportLines = record.exports.map(([local, exported]) => `  __rkExports[${JSON.stringify(exported)}] = ${local};`).join('\n')
  return [
    `// ---- ${path.relative(ROOT, record.file)} ----`,
    `const ${name} = (() => {`,
    `  const __rkExports = {};`,
    code,
    exportLines,
    `  return Object.freeze(__rkExports);`,
    `})();`,
  ].join('\n')
}

const body = ordered.map(renderModule).join('\n\n')
const externals = new Set()
for (const record of ordered) {
  for (const dependency of record.dependencies.values()) {
    if (dependency.kind === 'seed') externals.add(dependency.specifier)
  }
}

const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
const entryName = nameOf.get(entry.file)

const bundle = `/**
 * ${packageJson.name} 浏览器半区。
 * 构建产物，请勿直接编辑：改 src/client/*.js 后运行 \`node scripts/build-client.mjs\`。
 * 形式遵循宿主契约：window.__ModuleLoader__.load({ id, factory }) + 同步 require。
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(packageJson.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const __rkRequire = require;

${body}

    const __rkEntry = ${entryName};
    exports.name = __rkEntry.name;
    exports.inject = __rkEntry.inject;
    exports.apply = __rkEntry.apply;
    return module.exports;
  }
});
`

await writeFile(OUT, bundle)
console.log(`built ${path.relative(ROOT, OUT)} — ${ordered.length} modules, ${Buffer.byteLength(bundle)} bytes`)
console.log(`seed externals: ${[...externals].sort().join(', ') || '(none)'}`)