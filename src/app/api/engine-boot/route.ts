import { NextResponse } from 'next/server'
import net from 'net'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENGINE_PORT = 3003
const ENGINE_DIR = path.join(process.cwd(), 'mini-services', 'trading-engine')
const LOG_FILE = path.join(ENGINE_DIR, 'engine.log')

function isPortOpen(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.connect({ port, host: '127.0.0.1' })
    const ok = () => { s.destroy(); resolve(true) }
    const bad = () => { s.destroy(); resolve(false) }
    s.setTimeout(timeoutMs, bad)
    s.once('connect', ok)
    s.once('error', bad)
  })
}

function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise(async resolve => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await isPortOpen(port)) return resolve(true)
      await new Promise(r => setTimeout(r, 250))
    }
    resolve(false)
  })
}

/**
 * Self-healing boot for the trading engine mini-service.
 * The engine runs as a detached child of the (long-lived) Next.js server so it
 * survives sandbox cleanups that reap short-lived shell processes.
 */
export async function GET() {
  if (await isPortOpen(ENGINE_PORT)) {
    return NextResponse.json({ ok: true, alreadyRunning: true })
  }
  try {
    const out = fs.openSync(LOG_FILE, 'a')
    const child = spawn('bun', ['index.ts'], {
      cwd: ENGINE_DIR,
      detached: true,
      stdio: ['ignore', out, out],
      env: { ...process.env },
    })
    child.unref()
    const up = await waitForPort(ENGINE_PORT, 6000)
    return NextResponse.json({ ok: up, spawned: true, pid: child.pid })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
