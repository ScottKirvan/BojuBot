<script setup>
import manifest from '../../../manifest.json'
</script>

<template>
  <div class="version-badge-wrap">
    <a
      class="version-badge"
      :href="`https://github.com/ScottKirvan/BojuBot/releases/tag/${manifest.version}`"
      target="_blank"
      rel="noopener noreferrer"
    >v{{ manifest.version }}</a>
  </div>
</template>

<style scoped>
.version-badge-wrap {
  display: flex;
  margin-bottom: 16px;
  justify-content: center;
}

@media (min-width: 960px) {
  .version-badge-wrap {
    justify-content: flex-start;
  }
}

.version-badge {
  display: block;
  border: 1px solid transparent;
  border-radius: 6px;
  background-color: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  font-size: 16px;
  font-weight: 600;
  padding: 2px 12px;
  white-space: nowrap;
  text-decoration: none;
  transition: color 0.25s, border-color 0.25s, background-color 0.25s;
}

.version-badge:hover {
  border-color: var(--vp-button-alt-hover-border);
  color: var(--vp-button-alt-hover-text);
  background-color: var(--vp-button-alt-hover-bg);
  text-decoration: none;
}

.version-badge:active {
  border-color: var(--vp-button-alt-active-border);
  color: var(--vp-button-alt-active-text);
  background-color: var(--vp-button-alt-active-bg);
}
</style>
