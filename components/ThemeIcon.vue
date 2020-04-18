<template>
  <span class="theme-toggle unselectable">
    <svg
      class="theme-toggler"
      width="24"
      height="24"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22 41C32.4934 41 41 32.4934 41 22C41 11.5066 32.4934 3 22 3C11.5066 3
           3 11.5066 3 22C3 32.4934 11.5066 41 22 41ZM7 22C7 13.7157 13.7157 7 22
           7V37C13.7157 37 7 30.2843 7 22Z"
      />
    </svg>
  </span>
</template>

<script>
export default {
  mounted() {
    const getTheme = window.localStorage && window.localStorage.getItem('theme')
    const themeToggle = document.querySelector('.theme-toggle')
    const isDark = getTheme === 'dark'
    const metaThemeColor = document.querySelector('meta[name=theme-color]')

    if (getTheme !== null) {
      document.body.classList.toggle('dark-theme', isDark)
      metaThemeColor.setAttribute('content', isDark ? '#252627' : '#fafafa')
    }

    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme')
      window.localStorage &&
        window.localStorage.setItem(
          'theme',
          document.body.classList.contains('dark-theme') ? 'dark' : 'light'
        )
      metaThemeColor.setAttribute(
        'content',
        document.body.classList.contains('dark-theme') ? '#252627' : '#fafafa'
      )
    })
  }
}
</script>
