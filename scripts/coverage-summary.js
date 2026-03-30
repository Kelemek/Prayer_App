#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const coverageJsonPath = path.resolve(process.cwd(), 'coverage', 'coverage-final.json')

function prettyCount(n) {
  return n.toLocaleString()
}

try {
  if (!fs.existsSync(coverageJsonPath)) {
    console.error(`Coverage file not found at ${coverageJsonPath}`)
    process.exitCode = 2
    process.exit()
  }

  const raw = fs.readFileSync(coverageJsonPath, 'utf8')
  const data = JSON.parse(raw)

  // The report's top-level summary isn't stored in a single key; compute totals from statements/branches/functions/lines counts
  // But the JSON contains per-file coverage; we'll compute aggregate from statements/branches/functions/lines counts
  let totalStatements = 0
  let coveredStatements = 0
  let totalBranches = 0
  let coveredBranches = 0
  let totalFunctions = 0
  let coveredFunctions = 0
  let totalLines = 0
  let coveredLines = 0

  for (const filePath in data) {
    const entry = data[filePath]
    if (!entry || !entry.s) continue
    // statements
    if (entry.s && typeof entry.s === 'object') {
      const statCount = Object.keys(entry.s).length
      totalStatements += statCount
      coveredStatements += Object.values(entry.s).filter(v => v > 0).length
    }
    // branches
    if (entry.b && typeof entry.b === 'object') {
      const branchCounts = Object.values(entry.b).flatMap(b => Array.isArray(b) ? b : [b])
      totalBranches += branchCounts.length
      coveredBranches += branchCounts.filter(v => v > 0).length
    }
    // functions
    if (entry.f && typeof entry.f === 'object') {
      const funcCount = Object.keys(entry.f).length
      totalFunctions += funcCount
      coveredFunctions += Object.values(entry.f).filter(v => v > 0).length
    }
    // lines: approximate using statements coverage for lines if available
    if (entry.l && typeof entry.l === 'object') {
      const lineCount = Object.keys(entry.l).length
      totalLines += lineCount
      coveredLines += Object.values(entry.l).filter(v => v > 0).length
    }
  }

  // Avoid divide-by-zero
  function pct(covered, total) {
    if (total === 0) return 'N/A'
    return `${((covered / total) * 100).toFixed(2)}%`
  }

  console.log('Coverage summary (computed from coverage/coverage-final.json)')
  console.log(`Statements: ${pct(coveredStatements, totalStatements)} (${prettyCount(coveredStatements)}/${prettyCount(totalStatements)})`)
  console.log(`Branches:   ${pct(coveredBranches, totalBranches)} (${prettyCount(coveredBranches)}/${prettyCount(totalBranches)})`)
  console.log(`Functions:  ${pct(coveredFunctions, totalFunctions)} (${prettyCount(coveredFunctions)}/${prettyCount(totalFunctions)})`)
  console.log(`Lines:      ${pct(coveredLines, totalLines)} (${prettyCount(coveredLines)}/${prettyCount(totalLines)})`)

  process.exitCode = 0
} catch (err) {
  console.error('Error reading or parsing coverage JSON:', err.message)
  process.exitCode = 3
}
