<template>
  <main aria-role="main">
    <div>
      <h1>Paul Fulham</h1>
      <p>Software Developer</p>
      <SocialIcons />
    </div>
  </main>
</template>

<script>
import SocialIcons from '~/components/SocialIcons.vue'

export default {
  components: {
    SocialIcons
  }
}
</script>
