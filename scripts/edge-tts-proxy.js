#!/usr/bin/env node
/**
 * Edge TTS Proxy Server
 * Delegates synthesis to the Python edge-tts CLI which has better TLS compatibility.
 */

import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const PORT = 8765
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || null

if (PROXY_URL) {
  console.log(`Using proxy: ${PROXY_URL}`)
}

async function findEdgeTts() {
  const candidates = ['edge-tts', '/opt/homebrew/bin/edge-tts', '/usr/local/bin/edge-tts']
  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, ['--version'])
      return cmd
    }
    catch {}
  }
  throw new Error('edge-tts not found. Install with: pip3 install edge-tts')
}

const edgeTtsCmd = await findEdgeTts()
console.log(`Using edge-tts: ${edgeTtsCmd}`)

async function synthesize(text, voice, rate, pitch, volume) {
  const tmpFile = path.join(os.tmpdir(), `edge-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)
  try {
    // edge-tts rate/pitch/volume use different format: +10% → +10%  pitch: +5Hz
    const env = { ...process.env }
    if (PROXY_URL) {
      env.HTTPS_PROXY = PROXY_URL
      env.HTTP_PROXY = PROXY_URL
    }
    await execFileAsync(edgeTtsCmd, [
      '--voice',
      voice,
      '--text',
      text,
      '--rate',
      rate,
      '--pitch',
      pitch,
      '--volume',
      volume,
      '--write-media',
      tmpFile,
    ], { env, timeout: 30000 })
    const audio = await fs.readFile(tmpFile)
    return audio
  }
  finally {
    await fs.unlink(tmpFile).catch(() => {})
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/tts') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { text, voice, rate = '+0%', pitch = '+0Hz', volume = '+0%' } = JSON.parse(body)
        console.log('Request:', { text: text.substring(0, 30), voice, rate, pitch, volume })
        const audio = await synthesize(text, voice, rate, pitch, volume)
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
        res.end(audio)
      }
      catch (err) {
        console.error('Error:', err.message)
        res.writeHead(500)
        res.end(err.message)
      }
    })
  }
  else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`Edge TTS Proxy running at http://localhost:${PORT}/tts`)
})
