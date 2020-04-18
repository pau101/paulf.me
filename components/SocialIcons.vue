<template>
  <div>
    <span v-for="social in socials" :key="social.name">
      &nbsp;
      <a :href="social.url" target="_blank" rel="noopener" :title="social.name">
        <SvgIcon :name="social.name" />
      </a>
      &nbsp;
    </span>
  </div>
</template>

<script>
import SvgIcon from '~/components/SvgIcon.vue'

export default {
  components: {
    SvgIcon
  },
  data() {
    return {
      socials: [
        {
          name: 'twitter',
          url: 'https://twitter.com/polimics'
        },
        {
          name: 'email',
          url: 'mailto:paul.fulham0@gmail.com'
        },
        {
          name: 'github',
          url: 'https://github.com/pau101'
        }
      ]
    }
  }
}
</script>
