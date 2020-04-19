import * as BABYLON from 'babylonjs'
import * as KeyCode from 'keycode-js'

class World {
  constructor() {
    this.mobs = []
  }

  add(mob) {
    this.mobs.push(mob)
  }

  update() {
    for (const m of this.mobs) {
      m.update()
    }
  }
}

const G = 9.81
const GRAVITY = new BABYLON.Vector3(0, -G, 0)

class Mob {
  constructor(mesh) {
    this.mesh = mesh
    this.acceleration = new BABYLON.Vector3()
    this.velocity = new BABYLON.Vector3()
    this.mass = 62
    this.volume = 0.062
    this.drag = 1.2
    this.speed = 0.0
    this.mesh.onCollide = (mesh) => this.collision(mesh)
  }

  update() {
    // gravity
    this.addAcceleration(GRAVITY)
    // const density = 997 // 1.23
    // // aerodynamic drag
    // this.addForce(
    //   new BABYLON.Vector3()
    //     .setAll(-0.5 * this.drag * density)
    //     .multiplyInPlace(this.velocity)
    //     .multiplyInPlace(this.velocity)
    // )
    // // buoyancy
    // const v =
    //   Math.min(Math.max(0.2 - this.mesh.position.y, 0.0), 0.4) * 0.4 * 0.4
    // this.addForce(new BABYLON.Vector3(0, density * v * G, 0))
    this.step()
  }

  addAcceleration(v) {
    this.acceleration.addInPlace(v)
  }

  addForce(v) {
    this.acceleration.addInPlaceFromFloats(
      v.x / this.mass,
      v.y / this.mass,
      v.z / this.mass
    )
  }

  step() {
    const dt = new BABYLON.Vector3().setAll(1.0 / 60.0)
    this.acceleration.multiplyInPlace(dt)
    this.velocity.addInPlace(this.acceleration)
    this.acceleration.setAll(0)
    const displacement = this.velocity.clone().multiplyInPlace(dt)
    this.mesh.moveWithCollisions(displacement)
  }

  collision(mesh) {
    this.addForce(
      new BABYLON.Vector3().setAll(-400.0).multiplyInPlace(this.velocity)
    )
    // FIXME
    this.velocity.y = 0
  }
}

class Human extends Mob {}

class Player extends Human {}

function deltaAngle(current, target) {
  let num = BABYLON.Scalar.Repeat(target - current, 2 * Math.PI)
  if (num > Math.PI) {
    num -= 2 * Math.PI
  }
  return num
}

class Game {
  constructor(canvas) {
    this.engine = new BABYLON.Engine(canvas, true)
    this.scene = new BABYLON.Scene(this.engine)
    this.scene.collisionsEnabled = true
    this.world = new World()
    this.camera = new BABYLON.UniversalCamera(
      'camera',
      BABYLON.Vector3.Zero(),
      this.scene
    )
    this.camera.rotation.y = -Math.PI / 4
    this.camera.rotation.x = Math.PI / 6
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA
    const zoom = 4
    const a = this.engine.getAspectRatio(this.camera)
    this.camera.orthoTop = zoom
    this.camera.orthoBottom = -zoom
    this.camera.orthoLeft = -zoom * a
    this.camera.orthoRight = zoom * a
    this.camera.minZ = -30
    this.scene.activeCamera = this.camera
    // this.camera.attachControl(canvas, true)
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
    const box = BABYLON.MeshBuilder.CreateBox(
      'box',
      { height: 0.4, width: 0.4, depth: 0.4 },
      this.scene
    )
    box.position.y = 2
    box.ellipsoid = new BABYLON.Vector3(0.2, 0.2, 0.2)
    box.checkCollisions = true
    box.material = new BABYLON.StandardMaterial('box', this.scene)
    box.material.specularColor = new BABYLON.Color3(0, 0, 0)
    const ground = BABYLON.MeshBuilder.CreateGround(
      'myGround',
      { width: 14, height: 14, subdivisions: 3 },
      this.scene
    )
    ground.checkCollisions = true
    const myMaterial = new BABYLON.StandardMaterial('myMaterial', this.scene)
    myMaterial.specularColor = new BABYLON.Color3(0, 0, 0)
    myMaterial.diffuseColor = new BABYLON.Color3(0.42, 0.83, 0.23)
    ground.material = myMaterial
    const csg = new BABYLON.ShadowGenerator(1024, sun)
    csg.usePercentageCloserFiltering = true
    csg.autoCalcDepthBounds = true
    csg.autoCalcDepthBoundsRefreshRate = 4
    csg.addShadowCaster(box)
    ground.receiveShadows = true

    this.player = new Player(box)
    this.world.add(this.player)

    this.inputs = {}
    this.engine.runRenderLoop(() => {
      let x = 0
      let z = 0
      if (this.inputs.up) x++
      if (this.inputs.down) x--
      if (this.inputs.left) z--
      if (this.inputs.right) z++
      if (x !== 0 || z !== 0) {
        this.player.mesh.rotation.y +=
          deltaAngle(
            this.player.mesh.rotation.y,
            this.camera.rotation.y + Math.atan2(z, x)
          ) * 0.2
        this.player.speed = BABYLON.Scalar.MoveTowards(this.player.speed, 16, 2)
        this.player.addAcceleration(
          new BABYLON.Vector3(
            this.player.speed * Math.sin(this.player.mesh.rotation.y),
            0.0,
            this.player.speed * Math.cos(this.player.mesh.rotation.y)
          )
        )
      }
      this.world.update()
      this.camera.position.x = this.player.mesh.position.x
      this.camera.position.z = this.player.mesh.position.z
      this.scene.render()
    })

    canvas.addEventListener('keydown', (e) => this.keydown(e))
    canvas.addEventListener('keyup', (e) => this.keyup(e))
  }

  keydown(e) {
    switch (e.keyCode) {
      case KeyCode.KEY_UP:
        this.inputs.up = true
        break
      case KeyCode.KEY_DOWN:
        this.inputs.down = true
        break
      case KeyCode.KEY_LEFT:
        this.inputs.left = true
        break
      case KeyCode.KEY_RIGHT:
        this.inputs.right = true
        break
    }
  }

  keyup(e) {
    switch (e.keyCode) {
      case KeyCode.KEY_UP:
        this.inputs.up = false
        break
      case KeyCode.KEY_DOWN:
        this.inputs.down = false
        break
      case KeyCode.KEY_LEFT:
        this.inputs.left = false
        break
      case KeyCode.KEY_RIGHT:
        this.inputs.right = false
        break
    }
  }

  dispose() {
    this.scene.dispose()
    this.engine.dispose()
  }
}

export { Game }
