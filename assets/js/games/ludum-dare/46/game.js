import * as BABYLON from 'babylonjs'
import * as KeyCode from 'keycode-js'
import Alea from 'alea'
import SimplexNoise from 'simplex-noise'

class World {
  constructor() {
    this.mobs = new Set()
    this.trees = new Set()
    this.removals = new Set()
    this.updating = new Set()
  }

  addUpdating(u) {
    this.updating.add(u)
  }

  remove(obj) {
    this.removals.add(obj)
  }

  addMob(mob) {
    mob.world = this
    this.mobs.add(mob)
    this.updating.add(mob)
  }

  addTree(tree) {
    tree.world = this
    this.trees.add(tree)
  }

  update() {
    for (const r of this.removals) {
      this.mobs.delete(r)
      this.trees.delete(r)
      this.updating.delete(r)
      r.dispose()
    }
    for (const u of this.updating) {
      u.update()
    }
  }
}

const G = 9.81
const GRAVITY = new BABYLON.Vector3(0, -G, 0)

class GameObject {
  constructor(mesh) {
    this.mesh = mesh
    this.mesh.metadata = { object: this }
    this.world = undefined
  }

  dispose() {
    this.mesh && this.mesh.dispose()
    this.mesh = undefined
  }
}

class Tree extends GameObject {
  constructor(mesh) {
    super(mesh)
    this.angularVelocity = 0
    this.angle = 0
    this.dir = 0
  }

  fall(vec) {
    this.dir = moveTowardsAngle(
      this.dir,
      Math.atan2(vec.x, vec.z),
      Math.cos(this.angle) ** 4
    )
    this.world.addUpdating(this)
  }

  update() {
    if (this.angle === Math.PI / 2) return
    const dt = 1.0 / 60.0
    this.angularVelocity += 4.0 * dt
    this.angularVelocity +=
      Math.min(
        -0.33 * this.angularVelocity * this.angularVelocity,
        this.angularVelocity
      ) * dt
    this.angle += this.angularVelocity * dt
    if (this.angle > Math.PI / 2) {
      this.angle = Math.PI / 2
    }
    this.mesh.rotation.y = this.dir
    this.mesh.rotation.x = this.angle
  }
}

class Mob extends GameObject {
  constructor(mesh) {
    super(mesh)
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
    this.addForce(
      new BABYLON.Vector3().setAll(-10.0).multiplyInPlace(this.velocity)
    )
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

class Tank extends Mob {
  constructor(mesh, turret) {
    super(mesh)
    this.turret = turret
  }

  step() {
    super.step()
    if (this.world) {
      for (const tree of this.world.trees) {
        const dir = tree.mesh.position.subtract(this.mesh.position)
        if (dir.lengthSquared() < 5) {
          tree.fall(dir)
        }
      }
    }
  }
}

function deltaAngle(current, target) {
  let num = BABYLON.Scalar.Repeat(target - current, 2 * Math.PI)
  if (num > Math.PI) {
    num -= 2 * Math.PI
  }
  return num
}

function moveTowardsAngle(current, target, maxDelta) {
  const num = deltaAngle(current, target)
  let result = 0
  if (-maxDelta < num && num < maxDelta) {
    result = target
  } else {
    target = current + num
    result = BABYLON.Scalar.MoveTowards(current, target, maxDelta)
  }
  return result
}

class Game {
  constructor(canvas) {
    this.engine = new BABYLON.Engine(canvas, true)
    this.scene = new BABYLON.Scene(this.engine)
    this.scene.collisionsEnabled = true
    this.size = 64
    this.world = new World()
    this.camera = new BABYLON.UniversalCamera(
      'camera',
      BABYLON.Vector3.Zero(),
      this.scene
    )
    this.camera.rotation.y = -Math.PI / 4
    this.camera.rotation.x = Math.PI / 6
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA
    const zoom = 5
    const a = this.engine.getAspectRatio(this.camera)
    this.camera.orthoTop = zoom
    this.camera.orthoBottom = -zoom
    this.camera.orthoLeft = -zoom * a
    this.camera.orthoRight = zoom * a
    this.camera.minZ = -this.size
    this.scene.activeCamera = this.camera
    // this.camera.attachControl(canvas, true)
    // Add lights to the scene
    // eslint-disable-next-line no-new
    const ambient = new BABYLON.HemisphericLight(
      'ambient_light',
      new BABYLON.Vector3(1, 1, 0),
      this.scene
    )
    ambient.intensity = 0.5
    const sun = new BABYLON.DirectionalLight(
      'sun_light',
      new BABYLON.Vector3(-0.5, -0.8, 0).normalize(),
      this.scene
    )
    sun.intensity = 0.5
    this.shadows = new BABYLON.ShadowGenerator(1024, sun)
    this.shadows.usePercentageCloserFiltering = true
    this.shadows.autoCalcDepthBounds = true
    this.shadows.autoCalcDepthBoundsRefreshRate = 4
    // new BABYLON.PointLight(
    //   'light2',
    //   new BABYLON.Vector3(0, 10, -10),
    //   this.scene
    // )
    this.materials = {}
    this.materials.leaves = new BABYLON.StandardMaterial('leaves', this.scene)
    this.materials.leaves.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0)
    this.materials.leaves.diffuseColor = new BABYLON.Color3(0.33, 0.44, 0.16)
    this.materials.bark = new BABYLON.StandardMaterial('bark', this.scene)
    this.materials.bark.specularColor = new BABYLON.Color3(0, 0, 0)
    this.materials.bark.diffuseColor = new BABYLON.Color3(0.48, 0.35, 0.17)
    this.createWorld()
    this.player = this.createTank('player')
    this.world.addMob(this.player)

    this.inputs = {}
    this.engine.runRenderLoop(() => {
      let sx = 0
      let sz = 0
      if (this.inputs[KeyCode.KEY_W]) sx++
      if (this.inputs[KeyCode.KEY_S]) sx--
      if (this.inputs[KeyCode.KEY_A]) sz--
      if (this.inputs[KeyCode.KEY_D]) sz++
      if (sx !== 0 || sz !== 0) {
        const target = this.camera.rotation.y + Math.atan2(sz, sx)
        this.player.mesh.rotation.y = moveTowardsAngle(
          this.player.mesh.rotation.y,
          target,
          0.03
        )
        const speed =
          deltaAngle(this.player.mesh.rotation.y, target) < 1e-2 ? 10 : 5
        this.player.moving = true
        this.player.speed = BABYLON.Scalar.MoveTowards(
          this.player.speed,
          speed,
          0.8
        )
        this.player.addAcceleration(
          new BABYLON.Vector3(
            this.player.speed * Math.sin(this.player.mesh.rotation.y),
            0.0,
            this.player.speed * Math.cos(this.player.mesh.rotation.y)
          )
        )
      } else {
        if (this.player.moving) {
          this.player.addAcceleration(
            new BABYLON.Vector3()
              .setAll(-20.0)
              .multiplyInPlace(this.player.velocity)
          )
        }
        this.player.moving = false
      }
      let tx = 0
      let tz = 0
      if (this.inputs[KeyCode.KEY_UP]) tx++
      if (this.inputs[KeyCode.KEY_DOWN]) tx--
      if (this.inputs[KeyCode.KEY_LEFT]) tz--
      if (this.inputs[KeyCode.KEY_RIGHT]) tz++
      if (tx !== 0 || tz !== 0) {
        this.player.turret.rotation.y = moveTowardsAngle(
          this.player.turret.rotation.y,
          BABYLON.Scalar.Clamp(
            BABYLON.Scalar.NormalizeRadians(
              this.camera.rotation.y +
                Math.atan2(tz, tx) -
                this.player.mesh.rotation.y
            ),
            -Math.PI / 2,
            Math.PI / 2
          ),
          0.03
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

  createTank(name) {
    const options = { width: 2, height: 0.85, depth: 3.7 }
    const body = BABYLON.MeshBuilder.CreateBox(
      `${name}_box`,
      options,
      this.scene
    )
    body.position.y = 4
    body.ellipsoid = new BABYLON.Vector3(
      Math.max(options.width, options.depth) / 2,
      options.height / 2,
      Math.max(options.width, options.depth) / 2
    )
    body.checkCollisions = true
    body.material = new BABYLON.StandardMaterial(`${name}_mat`, this.scene)
    body.material.specularColor = new BABYLON.Color3(0, 0, 0)
    body.material.diffuseColor = new BABYLON.Color3(0.78, 0.74, 0.54)
    body.receiveShadows = true
    const turretDepth = 2.2
    const turret = BABYLON.MeshBuilder.CreateBox(
      `${name}_turret`,
      { width: 1.52, height: 0.54, depth: turretDepth },
      this.scene
    )
    turret.material = body.material
    turret.position.y = 0.25 + options.height / 2
    turret.parent = body
    turret.receiveShadows = true
    const barrelLen = 2.42
    const cannon = BABYLON.MeshBuilder.CreateBox(
      `${name}_cannon`,
      { width: 0.16, height: 0.16, depth: barrelLen },
      this.scene
    )
    cannon.material = body.material
    cannon.position.z = turretDepth / 2 + barrelLen / 2
    cannon.position.y = 0.015
    cannon.parent = turret
    this.shadows.addShadowCaster(body, true)
    return new Tank(body, turret)
  }

  createTree() {
    const height = 5
    const leaves = BABYLON.MeshBuilder.CreateCylinder(
      'cone',
      {
        diameterTop: 0,
        diameterBottom: height / 2,
        height,
        tessellation: 32,
        subdivisions: 8
      },
      this.scene
    )
    leaves.material = this.materials.leaves
    leaves.position.y = height
    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      'trunk',
      { tessellation: 12, height, diameter: 0.75 },
      this.scene
    )
    trunk.material = this.materials.bark
    trunk.position.y = height / 2
    return BABYLON.Mesh.MergeMeshes(
      [trunk, leaves],
      true,
      false,
      false,
      false,
      true
    )
  }

  createWorld() {
    const size = this.size
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: size, height: size, subdivisions: (size / 10) | 0 },
      this.scene
    )
    ground.checkCollisions = true
    ground.receiveShadows = true
    ground.material = new BABYLON.StandardMaterial('grass', this.scene)
    ground.material.specularColor = new BABYLON.Color3(0, 0, 0)
    ground.material.diffuseColor = new BABYLON.Color3(0.49, 0.72, 0.34)
    const rng = new Alea('alizee')
    const simplex = new SimplexNoise(rng)
    const spacing = 4
    const noiseScale = 0.03
    const prototree = this.createTree()
    prototree.registerInstancedBuffer('color', 4)
    prototree.isVisible = false
    let trees = 0
    for (let x = 0; x < size / spacing; x++) {
      for (let y = 0; y < size / spacing; y++) {
        const wx = x * spacing - size / 2
        const wy = y * spacing - size / 2
        const d = (simplex.noise2D(wx * noiseScale, wy * noiseScale) + 1) / 2
        if (rng() < d - 0.1) {
          const tree = prototree.createInstance(`tree_${++trees}`)
          tree.instancedBuffers.color = new BABYLON.Color4(
            rng() * 0.2 + 0.8,
            1.0,
            rng() * 0.2 + 0.8,
            1.0
          )
          tree.position.x = wx + (rng() / 2) * spacing
          tree.position.z = wy + (rng() / 2) * spacing
          this.world.addTree(new Tree(tree))
          this.shadows.addShadowCaster(tree)
        }
      }
    }
  }

  keydown(e) {
    this.inputs[e.keyCode] = true
  }

  keyup(e) {
    this.inputs[e.keyCode] = false
  }

  dispose() {
    this.scene.dispose()
    this.engine.dispose()
  }
}

export { Game }
