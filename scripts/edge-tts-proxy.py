#!/usr/bin/env python3
"""Edge TTS Proxy Server"""
import asyncio
import edge_tts
from aiohttp import web
import aiohttp_cors

async def tts_handler(request):
    try:
        data = await request.json()
        text = data.get('text', '')
        voice = data.get('voice', 'zh-CN-XiaoxiaoNeural')
        rate = data.get('rate', '+0%')
        pitch = data.get('pitch', '+0Hz')
        volume = data.get('volume', '+0%')

        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume=volume)
        audio_data = b''
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

        return web.Response(body=audio_data, content_type='audio/mpeg')
    except Exception as e:
        return web.Response(text=str(e), status=500)

app = web.Application()
cors = aiohttp_cors.setup(app, defaults={
    "*": aiohttp_cors.ResourceOptions(
        allow_credentials=True,
        expose_headers="*",
        allow_headers="*",
        allow_methods="*"
    )
})
resource = cors.add(app.router.add_resource('/tts'))
cors.add(resource.add_route('POST', tts_handler))

if __name__ == '__main__':
    web.run_app(app, host='127.0.0.1', port=8765)
