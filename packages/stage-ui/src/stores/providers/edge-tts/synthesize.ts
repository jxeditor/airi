/**
 * Microsoft Edge TTS WebSocket Synthesis
 *
 * Uses the unofficial Edge TTS streaming endpoint that powers the read-aloud
 * feature in Microsoft Edge. No API key is required.
 *
 * Protocol references:
 * - https://github.com/rany2/edge-tts (Python reference implementation)
 * - https://github.com/nickvdyck/webtts (browser WebSocket implementation)
 *
 * NOTICE: This is an unofficial/undocumented API. Microsoft does not guarantee
 * stability. The TrustedClientToken below is publicly known and embedded in
 * the Edge browser itself.
 */

// NOTICE: Publicly known token embedded in Microsoft Edge browser binary.
// See https://github.com/rany2/edge-tts/blob/master/src/edge_tts/constants.py
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/realtimestreaming/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`

// Default output format: MP3 at 24kHz, 48kbps mono
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

export interface EdgeTTSSynthesizeOptions {
  /** Speaking rate as percentage offset, e.g. +20% or -10% */
  rate?: string
  /** Pitch as percentage offset, e.g. +5% or -10% */
  pitch?: string
  /** Volume as percentage offset, e.g. +0% (range -100% to +100%) */
  volume?: string
}

/**
 * Synthesize text to speech using the Edge TTS WebSocket API.
 * Returns raw MP3 audio bytes as an ArrayBuffer.
 */
export function synthesizeEdgeTTS(
  text: string,
  voice: string,
  options?: EdgeTTSSynthesizeOptions,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const connectionId = crypto.randomUUID().replace(/-/g, '')
    const requestId = crypto.randomUUID().replace(/-/g, '')
    const url = `${WSS_URL}&ConnectionId=${connectionId}`

    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    const audioChunks: Uint8Array[] = []
    let totalBytes = 0

    ws.addEventListener('open', () => {
      // Step 1: Send synthesis configuration
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

      // Step 2: Send SSML synthesis request
      const rate = options?.rate ?? '+0%'
      const pitch = options?.pitch ?? '+0Hz'
      const volume = options?.volume ?? '+0%'

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

    ws.addEventListener('message', (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        const view = new DataView(event.data)
        if (event.data.byteLength < 2)
          return
        const headerLenLE = view.getUint16(0, true)
        const headerLenBE = view.getUint16(0, false)
        // Use the smaller reasonable value (header is usually short; wrong endian gives huge value)
        const headerLen = headerLenLE < event.data.byteLength - 2
          ? headerLenLE
          : (headerLenBE < event.data.byteLength - 2 ? headerLenBE : headerLenLE)
        if (2 + headerLen >= event.data.byteLength)
          return
        const headerBytes = new Uint8Array(event.data, 2, headerLen)
        const headerText = new TextDecoder().decode(headerBytes)
        const isAudio = headerText.includes('Path:audio') || headerText.includes('Path: audio')
        if (!isAudio)
          return
        const audioStart = 2 + headerLen
        const chunk = new Uint8Array(event.data, audioStart).slice()
        audioChunks.push(chunk)
        totalBytes += chunk.byteLength
      }
      else if (typeof event.data === 'string') {
        if (event.data.includes('turn.end')) {
          ws.close()

          if (totalBytes === 0) {
            reject(new Error('Edge TTS 未返回音频。若使用 Chrome/Firefox/Safari，微软可能仅允许 Edge 浏览器直连，请改用本机的 Microsoft Edge 打开此页面试试。'))
            return
          }

          const combined = new Uint8Array(totalBytes)
          let offset = 0
          for (const chunk of audioChunks) {
            combined.set(chunk, offset)
            offset += chunk.byteLength
          }
          resolve(combined.buffer)
        }
      }
    })

    ws.addEventListener('error', () => {
      reject(new Error('Edge TTS WebSocket connection failed. Check your network.'))
    })

    ws.addEventListener('close', (event: CloseEvent) => {
      if (!event.wasClean && audioChunks.length === 0) {
        reject(new Error(`Edge TTS WebSocket closed unexpectedly (code: ${event.code})`))
      }
    })
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
