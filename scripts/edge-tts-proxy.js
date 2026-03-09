#!/usr/bin/env node
/**
 * Edge TTS Proxy Server
 * Proxies Edge TTS requests for non-Edge browsers
 */

import crypto from 'node:crypto'
import http from 'node:http'

import { WebSocket } from 'ws'

const PORT = 8765
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/realtimestreaming/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function synthesize(text, voice, rate, pitch, volume) {
  return new Promise((resolve, reject) => {
    const connectionId = crypto.randomUUID().replaceAll('-', '')
    const requestId = crypto.randomUUID().replaceAll('-', '')
    const url = `${WSS_URL}&ConnectionId=${connectionId}`

    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      },
    })
    const audioChunks = []
    let totalBytes = 0

    ws.on('open', () => {
      const configMsg = [
        `Path:speech.config`,
        `X-RequestId:${requestId}`,
        `X-Timestamp:${new Date().toISOString()}`,
        `Content-Type:application/json`,
        ``,
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: false,
                  wordBoundaryEnabled: false,
                },
                outputFormat: OUTPUT_FORMAT,
              },
            },
          },
        }),
      ].join('\r\n')

      ws.send(configMsg)

      const ssml = [
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>`,
        `  <voice name='${voice}'>`,
        `    <prosody rate='${rate}' pitch='${pitch}' volume='${volume}'>`,
        escapeXml(text),
        `    </prosody>`,
        `  </voice>`,
        `</speak>`,
      ].join('')

      const ssmlMsg = [
        `Path:ssml`,
        `X-RequestId:${requestId}`,
        `X-Timestamp:${new Date().toISOString()}`,
        `Content-Type:application/ssml+xml`,
        ``,
        ssml,
      ].join('\r\n')

      ws.send(ssmlMsg)
    })

    ws.on('message', (data) => {
      if (Buffer.isBuffer(data)) {
        if (data.length < 2)
          return
        const headerLen = data.readUInt16LE(0)
        if (2 + headerLen >= data.length)
          return
        const headerText = data.slice(2, 2 + headerLen).toString()
        if (!headerText.includes('Path:audio'))
          return
        const chunk = data.slice(2 + headerLen)
        audioChunks.push(chunk)
        totalBytes += chunk.length
      }
      else if (typeof data === 'string' && data.includes('turn.end')) {
        ws.close()
        if (totalBytes === 0) {
          reject(new Error('No audio data received'))
          return
        }
        resolve(Buffer.concat(audioChunks))
      }
    })

    ws.on('error', err => reject(err))
    ws.on('close', (code) => {
      if (audioChunks.length === 0) {
        reject(new Error(`WebSocket closed: ${code}`))
      }
    })
  })
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
        console.log('Request:', { text, voice, rate, pitch, volume })
        const audio = await synthesize(text, voice, rate, pitch, volume)
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
        res.end(audio)
      }
      catch (err) {
        console.error('Error:', err)
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
