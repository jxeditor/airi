<script setup lang="ts">
import { Callout } from '@proj-airi/ui'
</script>

<template>
  <div>
    <Callout
      :label="$t('settings.pages.scene.callout.label')"
      theme="orange"
    >
      <div>
        <i18n-t keypath="settings.pages.scene.callout.description">
          <template #githubIssuesLink>
            <a underline decoration-dotted href="https://github.com/moeru-ai/airi/issues">{{ $t('settings.pages.scene.callout.github-issues-link') }}</a>
          </template>
          <template #sourceCodeLink>
            <a underline decoration-dotted href="https://github.com/moeru-ai/airi/tree/main/apps/stage-web/src/pages/settings/scene/index.vue">{{ $t('settings.pages.scene.callout.source-code-link') }}</a>
          </template>
        </i18n-t>
      </div>
    </Callout>
  </div>
  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, y: 20 }"
    :enter="{ scale: 1, opacity: 1, y: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:armchair-2-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.scene.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.scene.description
  icon: i-solar:armchair-2-bold-duotone
  settingsEntry: true
  order: 3
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
