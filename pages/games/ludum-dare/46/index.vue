<template>
  <main aria-role="main">
    <div>
      <h1>Ludum Dare 46</h1>
      <div id="game" :style="{ height: height + 'px' }"></div>
    </div>
  </main>
</template>

<script>
import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as KeyCode from 'keycode-js'

export default {
  data() {
    return {
      width: 1088,
      height: 612,
      scene: undefined,
      camera: undefined,
      renderer: undefined,
      cube: undefined,
      plane: undefined,
      controls: undefined,
      up: false,
      down: false,
      left: false,
      right: false,
      raycaster: undefined
    }
  },
  mounted() {
    const e = document.getElementById('game')
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000
    )
    this.camera.position.set(-7, 3, 3)
    this.camera.lookAt(0, 0, 0)
    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.width, this.height)
    e.appendChild(this.renderer.domElement)
    this.raycaster = new THREE.Raycaster()
    // this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    // scene
    // this.scene.add(new THREE.AxesHelper(4))
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.0, 0.4),
      new THREE.MeshLambertMaterial({ color: '#7f3f3f' })
    )
    this.cube.geometry.computeBoundingBox()
    this.cube.position.y = 2
    this.scene.add(this.cube)
    // plane
    const size = 32
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16, size, size),
      new THREE.MeshLambertMaterial({ color: '#7f7f7f' })
    )
    this.plane.rotateX(-Math.PI / 2)
    for (let y = 0; y <= size; y++) {
      for (let x = 0; x <= size; x++) {
        this.plane.geometry.vertices[x + y * (1 + size)].z =
          (Math.cos((x * 19) / size) + Math.cos((y * 14 + x * 13) / size)) * 0.5
      }
    }
    this.plane.geometry.computeVertexNormals()
    this.plane.geometry.computeBoundingBox()
    // plane.geometry.computeFaceNormals()
    this.scene.add(this.plane)
    // lights
    const light = new THREE.DirectionalLight()
    light.position.set(65, 100, 50)
    this.scene.add(light)
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.13))
    // input
    window.addEventListener('keydown', (e) => this.keydown(e), true)
    window.addEventListener('keyup', (e) => this.keyup(e), true)
    this.animate()
  },
  destroyed() {
    this.renderer.dispose()
  },
  methods: {
    animate() {
      requestAnimationFrame(this.animate)
      const dir = new THREE.Vector3()
      if (this.up) dir.x++
      if (this.down) dir.x--
      if (this.left) dir.z--
      if (this.right) dir.z++
      this.cube.position.add(dir.normalize().multiplyScalar(0.08))
      this.raycaster.set(
        new THREE.Vector3(this.cube.position.x, 2, this.cube.position.z),
        new THREE.Vector3(0, -1, 0)
      )
      for (const intersect of this.raycaster.intersectObject(this.plane)) {
        this.cube.position.y = intersect.point.y + 0.5
      }
      // this.controls.update()
      this.renderer.render(this.scene, this.camera)
    },
    keydown(e) {
      switch (e.keyCode) {
        case KeyCode.KEY_UP:
          this.up = true
          break
        case KeyCode.KEY_DOWN:
          this.down = true
          break
        case KeyCode.KEY_LEFT:
          this.left = true
          break
        case KeyCode.KEY_RIGHT:
          this.right = true
          break
      }
    },
    keyup(e) {
      switch (e.keyCode) {
        case KeyCode.KEY_UP:
          this.up = false
          break
        case KeyCode.KEY_DOWN:
          this.down = false
          break
        case KeyCode.KEY_LEFT:
          this.left = false
          break
        case KeyCode.KEY_RIGHT:
          this.right = false
          break
      }
    }
  }
}
</script>
