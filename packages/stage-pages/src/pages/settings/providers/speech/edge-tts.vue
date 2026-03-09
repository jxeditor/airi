<script setup lang="ts">
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { synthesizeEdgeTTS } from '@proj-airi/stage-ui/stores/providers/edge-tts/synthesize'
import { FieldInput, FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const providerId = 'edge-tts'
const defaultModel = 'v1'

const defaultVoiceSettings = {
  pitch: 0,
  speed: 1.0,
  volume: 0,
}

const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)
const { activeSpeechProvider, activeSpeechVoiceId } = storeToRefs(speechStore)

const proxyUrl = computed({
  get: () => (providers.value[providerId]?.proxyUrl as string) ?? '',
  set: (v: string) => {
    if (!providers.value[providerId])
      providers.value[providerId] = { proxyUrl: '' }
    providers.value[providerId].proxyUrl = v
  },
})

const pitch = useLocalStorageManualReset(`settings/speech/${providerId}/pitch`, 0)
const speed = useLocalStorageManualReset(`settings/speech/${providerId}/speed`, 1.0)
const volume = useLocalStorageManualReset(`settings/speech/${providerId}/volume`, 0)

const availableVoices = computed(() => speechStore.availableVoices[providerId] || [])

const selectedVoice = computed({
  get: () => activeSpeechProvider.value === providerId ? activeSpeechVoiceId.value : '',
  set: (v: string) => {
    activeSpeechVoiceId.value = v
    // 确保 provider 也被设置
    if (v && activeSpeechProvider.value !== providerId) {
      activeSpeechProvider.value = providerId
    }
  },
})

const isEdgeBrowser = computed(() => {
  if (typeof navigator === 'undefined')
    return true
  const ua = navigator.userAgent
  return /Edg\//.test(ua) || /Edge\//.test(ua)
})

onMounted(async () => {
  await speechStore.loadVoicesForProvider(providerId)

  // 确保 provider 和 model 被设置
  if (activeSpeechProvider.value === providerId && !speechStore.activeSpeechModel) {
    speechStore.activeSpeechModel = defaultModel
  }
})

// When proxyUrl is set, use it (for Chrome/Firefox/Safari). Else use WebSocket (Edge only).
async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean): Promise<ArrayBuffer> {
  const voice = voiceId || 'zh-CN-XiaoxiaoNeural'
  const rate = speed.value === 1 ? '+0%' : `${speed.value > 1 ? '+' : ''}${Math.round((speed.value - 1) * 100)}%`
  const pitchStr = `${pitch.value >= 0 ? '+' : ''}${pitch.value}Hz`
  const volumeStr = `${volume.value >= 0 ? '+' : ''}${volume.value}%`

  const url = proxyUrl.value.trim()
  if (url) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, voice, rate, pitch: pitchStr, volume: volumeStr }),
    })
    if (!res.ok)
      throw new Error(`代理返回 ${res.status}: ${await res.text()}`)
    return await res.arrayBuffer()
  }
  return await synthesizeEdgeTTS(input, voice, { rate, pitch: pitchStr, volume: volumeStr })
}
</script>

<template>
  <!-- NOTICE: Microsoft only allows WebSocket TTS from the Edge browser; Chrome/Firefox/Safari get no audio. -->
  <div v-if="!isEdgeBrowser" class="mb-4 border border-amber-500/50 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
    {{ t('settings.pages.providers.provider.edge-tts.browser-notice') }}
  </div>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
  >
    <template #basic-settings>
      <FieldInput
        v-model="proxyUrl"
        :label="t('settings.pages.providers.provider.edge-tts.fields.field.proxy-url.label')"
        :description="t('settings.pages.providers.provider.edge-tts.fields.field.proxy-url.description')"
        placeholder="http://localhost:8765/tts"
        type="url"
      />
    </template>
    <template #voice-settings>
      <div :class="['flex', 'flex-col', 'gap-4']">
        <FieldRange
          v-model="pitch"
          :label="t('settings.pages.providers.provider.common.fields.field.pitch.label')"
          :description="t('settings.pages.providers.provider.common.fields.field.pitch.description')"
          :min="-100"
          :max="100"
          :step="1"
          :format-value="value => `${value}%`"
        />
        <FieldRange
          v-model="speed"
          :label="t('settings.pages.providers.provider.common.fields.field.speed.label')"
          :description="t('settings.pages.providers.provider.common.fields.field.speed.description')"
          :min="0.5"
          :max="2.0"
          :step="0.01"
        />
        <FieldRange
          v-model="volume"
          :label="t('settings.pages.providers.provider.common.fields.field.volume.label')"
          :description="t('settings.pages.providers.provider.common.fields.field.volume.description')"
          :min="-100"
          :max="100"
          :step="1"
          :format-value="value => `${value}%`"
        />
      </div>
    </template>

    <template #playground>
      <SpeechPlayground
        v-model:selected-voice="selectedVoice"
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="true"
        :default-text="t('settings.pages.providers.provider.edge-tts.playground.default-text')"
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
