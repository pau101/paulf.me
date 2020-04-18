<template>
  <main aria-role="main">
    <div>
      <h1>{{ error.statusCode }}</h1>
      <p>{{ error.message }}</p>
      <nuxt-link to="/">Home</nuxt-link>
    </div>
  </main>
</template>

<script>
export default {
  props: {
    error: {
      type: Object,
      default: null
    }
  }
}
</script>
