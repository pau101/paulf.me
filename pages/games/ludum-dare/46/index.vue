<template>
  <main aria-role="main">
    <div>
      <h1>Ludum Dare 46</h1>
      <canvas id="game" :width="width" :height="height" tabindex="1"></canvas>
    </div>
  </main>
</template>

<script>
import { Game } from '~/assets/js/games/ludum-dare/46/game.js'

export default {
  data() {
    return {
      width: 1088,
      height: 612,
      game: undefined
    }
  },
  mounted() {
    const canvas = document.getElementById('game')
    this.game = new Game(canvas)
    canvas.focus()
  },
  destroyed() {
    this.game && this.game.dispose()
    this.game = undefined
  }
}
</script>
