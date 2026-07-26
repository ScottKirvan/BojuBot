import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'
import VersionBadge from './VersionBadge.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(VersionBadge),
    })
  },
}
