// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import vueA11y from 'eslint-plugin-vuejs-accessibility'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  // Toegankelijkheidsregels voor Vue-templates (WCAG), als eerste vangnet bij het schrijven.
  // Echte toetsing met axe in de browser volgt in fase 5 en 7.
  ...vueA11y.configs['flat/recommended'],
  prettier,
  {
    rules: {
      // Onze componentnamen zijn Nederlands en bestaan soms uit één woord, zoals SiteKop
      'vue/multi-word-component-names': 'off',
    },
  },
)
