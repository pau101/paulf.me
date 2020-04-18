<template>
  <main aria-role="main">
    <div>
      <h1>Ludum Dare 42</h1>
      <div id="game" style="width: 1088px; height: 612px"></div>
    </div>
  </main>
</template>

<script>
import * as THREE from 'three'

export default {
  data() {
    return {
      scene: undefined,
      camera: undefined,
      renderer: undefined,
      cube: undefined
    }
  },
  mounted() {
    const e = document.getElementById('game')
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      75,
      e.clientWidth / e.clientHeight,
      0.1,
      1000
    )
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(e.clientWidth, e.clientHeight)
    e.appendChild(this.renderer.domElement)
    const geometry = new THREE.BoxGeometry()
    const material = new THREE.MeshLambertMaterial({ color: '#7f7f7f' })
    this.cube = new THREE.Mesh(geometry, material)
    this.scene.add(this.cube)
    this.camera.position.z = 2
    const light = new THREE.DirectionalLight()
    light.position.set(4, 4, 4)
    this.scene.add(light)
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.15))
    this.animate()
  },
  methods: {
    animate() {
      requestAnimationFrame(this.animate)
      this.cube.rotation.x += 0.01
      this.cube.rotation.y += 0.01
      this.renderer.render(this.scene, this.camera)
    }
  }
}
</script>
