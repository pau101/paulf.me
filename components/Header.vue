<template>
  <header class="header">
    <span class="header__inner">
      <Logo />
      <span class="header__right">
        <Menu />
        <span class="menu-trigger">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M0 0h24v24H0z" fill="none" />
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </span>
        <ThemeIcon />
      </span>
    </span>
  </header>
</template>

<script>
import Logo from './Logo.vue'
import Menu from './Menu.vue'
import ThemeIcon from './ThemeIcon.vue'

export default {
  name: 'Header',
  components: {
    Logo,
    Menu,
    ThemeIcon
  },
  mounted() {
    const menuTrigger = document.querySelector('.menu-trigger')
    const menu = document.querySelector('.menu')
    const mobileQuery = getComputedStyle(document.body).getPropertyValue(
      '--phoneWidth'
    )
    const isMobile = () => window.matchMedia(mobileQuery).matches
    const isMobileMenu = () => {
      menuTrigger && menuTrigger.classList.toggle('hidden', !isMobile())
      menu && menu.classList.toggle('hidden', isMobile())
    }
    isMobileMenu()
    menuTrigger &&
      menuTrigger.addEventListener(
        'click',
        () => menu && menu.classList.toggle('hidden')
      )
    window.addEventListener('resize', isMobileMenu)
  }
}
</script>
