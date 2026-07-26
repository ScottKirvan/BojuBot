<script setup>
import manifest from '../../../manifest.json'
</script>

<template>
  <a
    class="version-badge"
    :href="`https://github.com/ScottKirvan/BojuBot/releases/tag/${manifest.version}`"
    target="_blank"
    rel="noopener"
  >v{{ manifest.version }}</a>
</template>

<style scoped>
.version-badge {
  display: inline-block;
  margin: 0 0 16px;
  padding: 4px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 0.25s, color 0.25s;
}

.version-badge:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
</style>
