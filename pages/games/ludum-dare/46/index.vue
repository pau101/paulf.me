<template>
  <main aria-role="main">
    <div>
      <h1>Ludum Dare 46</h1>
      <canvas id="game" :width="width" :height="height"></canvas>
    </div>
  </main>
</template>

<script>
import * as BABYLON from 'babylonjs'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as KeyCode from 'keycode-js'

export default {
  data() {
    return {
      width: 1088,
      height: 612,
      engine: undefined,
      scene: undefined
    }
  },
  mounted() {
    const canvas = document.getElementById('game')
    this.engine = new BABYLON.Engine(canvas, true)
    this.scene = new BABYLON.Scene(this.engine)
    const camera = new BABYLON.ArcRotateCamera(
      'Camera',
      Math.PI / 4,
      Math.PI / 3,
      2,
      new BABYLON.Vector3(5, 4, 5),
      this.scene
    )
    camera.attachControl(canvas, true)
    // Add lights to the scene
    // eslint-disable-next-line no-new
    const ambient = new BABYLON.HemisphericLight(
      'light1',
      new BABYLON.Vector3(1, 1, 0),
      this.scene
    )
    ambient.intensity = 0.5
    const sun = new BABYLON.DirectionalLight(
      'light2',
      new BABYLON.Vector3(-0.5, -1, 0).normalize(),
      this.scene
    )
    sun.intensity = 0.5
    // eslint-disable-next-line no-new
    // new BABYLON.PointLight(
    //   'light2',
    //   new BABYLON.Vector3(0, 10, -10),
    //   this.scene
    // )
    // Add and manipulate meshes in the scene
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      'sphere',
      { diameter: 2 },
      this.scene
    )
    sphere.position.y = 1
    const box = BABYLON.MeshBuilder.CreateBox(
      'box',
      { height: 2, width: 2, depth: 2 },
      this.scene
    )
    box.position.set(1, 1, 3)
    const ground = BABYLON.MeshBuilder.CreateGround(
      'myGround',
      { width: 30, height: 30, subdivisions: 32 },
      this.scene
    )
    const myMaterial = new BABYLON.StandardMaterial('myMaterial', this.scene)
    myMaterial.specularColor = new BABYLON.Color3(0, 0, 0)
    myMaterial.diffuseColor = new BABYLON.Color3(0.42, 0.83, 0.23)
    ground.material = myMaterial
    const csg = new BABYLON.CascadedShadowGenerator(1024, sun)
    csg.usePercentageCloserFiltering = true
    csg.autoCalcDepthBounds = true
    csg.autoCalcDepthBoundsRefreshRate = 4
    csg.addShadowCaster(sphere)
    csg.addShadowCaster(box)
    ground.receiveShadows = true

    this.engine.runRenderLoop(() => this.render())

    // events
    window.addEventListener('keydown', (e) => this.keydown(e), true)
    window.addEventListener('keyup', (e) => this.keyup(e), true)
  },
  destroyed() {
    this.scene.dispose()
    this.engine.dispose()
  },
  methods: {
    render() {
      this.scene.render()
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
