import * as BABYLON from 'babylonjs'
import * as GUI from 'babylonjs-gui'
import * as KeyCode from 'keycode-js'
import Alea from 'alea'
import SimplexNoise from 'simplex-noise'

// FIXME
BABYLON.GUI = GUI

const GRASS_COLOR = new BABYLON.Color3(0.49, 0.72, 0.34)
const LEAF_COLOR = new BABYLON.Color3(0.33, 0.44, 0.16)

class World {
  constructor(game, rng, sun, ambient) {
    this.game = game
    this.rng = rng
    this.sun = sun
    this.ambient = ambient
    this.mobs = new Set()
    this.trees = new Set()
    this.liveTrees = new Set()
    this.removals = new Set()
    this.updating = new Set()
    this.enemies = new Set()
    this.seeds = new Set()
    this.time = 0
    this.seedId = 0
    const size = 0.2
    this.seedMesh = BABYLON.MeshBuilder.CreateBox(
      `seed`,
      { size },
      this.game.scene
    )
    this.seedMesh.ellipsoid = new BABYLON.Vector3().setAll(size / 2)
    this.seedMesh.receiveShadows = true
    this.seedMesh.isVisible = false
    this.seedMesh.material = new BABYLON.StandardMaterial(
      'seed',
      this.game.scene
    )
    this.seedMesh.material.specularColor = new BABYLON.Color3(0, 0, 0)
    this.seedMesh.material.diffuseColor = new BABYLON.Color3(0.84, 0.59, 0.32)
    this.seedWait = 4
    this.maxSeeds = 10
  }

  createSeed() {
    const seed = new Seed(this.seedMesh.createInstance(`seed_${++this.seedId}`))
    seed.mesh.ellipsoid.copyFrom(this.seedMesh.ellipsoid)
    seed.mesh.checkCollisions = true
    this.seeds.add(seed)
    this.addMob(seed)
    return seed
  }

  hasEnemey(predicate) {
    for (const enemy of this.enemies) {
      if (predicate(enemy)) return true
    }
    return false
  }

  fall(u) {
    if (this.trees.has(u)) {
      this.liveTrees.delete(u)
      this.updating.add(u)
    }
  }

  remove(obj) {
    this.removals.add(obj)
  }

  addMob(mob) {
    mob.world = this
    this.mobs.add(mob)
    this.updating.add(mob)
    this.game.shadows.addShadowCaster(mob.mesh, true)
  }

  addEnemy(e) {
    this.enemies.add(e)
    this.addMob(e)
  }

  addTree(tree) {
    tree.world = this
    this.trees.add(tree)
    this.liveTrees.add(tree)
  }

  update(dt) {
    for (const r of this.removals) {
      if (this.mobs.delete(r)) {
        this.game.shadows.removeShadowCaster(r.mesh, true)
      }
      this.seeds.delete(r)
      this.trees.delete(r)
      this.updating.delete(r)
      r.dispose()
    }
    for (const u of this.updating) {
      u.update(dt)
    }
    this.dropSeed(dt)
    if (isNaN(this.time)) return
    this.time = this.time + (dt * (2 * Math.PI)) / (60 * 4)
    while (this.time > 2 * Math.PI) {
      this.time -= 2 * Math.PI
    }
    const source = this.time > Math.PI ? this.time - Math.PI : this.time
    BABYLON.Vector3.Right().rotateByQuaternionToRef(
      BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Forward(), source),
      this.sun.position
    )
    this.sun.position.rotateByQuaternionToRef(
      BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI / 8),
      this.sun.position
    )
    this.sun.position.scaleToRef(-1, this.sun.direction)
    this.pi = this.sun.intensity
    this.sun.intensity = BABYLON.Scalar.Denormalize(
      (Math.sin(this.time) + 1) / 2 +
        (this.time > Math.PI
          ? 0.05 * ((Math.sin(2 * this.time - Math.PI / 2) + 1) / 2)
          : 0),
      0.0,
      0.4
    )
    this.ambient.intensity = BABYLON.Scalar.Denormalize(
      this.time > Math.PI ? 0 : (Math.sin(this.time) + 1) / 2,
      0.2,
      0.4
    )
  }

  dropSeed(dt) {
    if (this.seedWait) {
      this.seedWait -= dt * this.liveTrees.size
      if (this.seedWait < 0) this.seedWait = 0
    } else if (this.liveTrees.size && this.seeds.size < this.maxSeeds) {
      this.seedWait = BABYLON.Scalar.Denormalize(this.rng(), 60, 100)
      const tree = Array.from(this.liveTrees)[
        (this.rng() * this.liveTrees.size) | 0
      ]
      const seed = this.createSeed()
      const ang = 2 * Math.PI * this.rng()
      // FIXME dynamic to tree shape
      const r = BABYLON.Scalar.Denormalize(this.rng(), 0.5, 1)
      seed.mesh.position
        .copyFrom(tree.mesh.position)
        .addInPlaceFromFloats(r * Math.cos(ang), 4, r * Math.sin(ang))
    }
  }
}

const G = 9.81
const GRAVITY = new BABYLON.Vector3(0, -G, 0)

class GameObject {
  constructor(mesh) {
    this.mesh = mesh
    this.mesh.metadata = this.mesh.metadata || {}
    this.mesh.metadata.object = this
    this.world = undefined
  }

  rng() {
    return this.world.rng()
  }

  dispose() {
    this.mesh && this.mesh.dispose()
    this.mesh = undefined
  }
}

// eslint-disable-next-line no-unused-vars
class Tree extends GameObject {
  constructor(mesh) {
    super(mesh)
    this.angularVelocity = 0
    this.angle = 0
    this.dir = 0
  }

  intersects(other) {
    const trunk = this.mesh.metadata.trunk
    trunk.position.copyFrom(this.mesh.position)
    trunk.computeWorldMatrix(true)
    return trunk.intersectsMesh(other, true)
  }

  fall(vec) {
    this.dir = moveTowardsAngleRadians(
      this.dir,
      Math.atan2(vec.x, vec.z),
      Math.cos(this.angle) ** 4
    )
    this.world.fall(this)
  }

  update(dt) {
    if (this.angle === Math.PI / 2) return
    this.angularVelocity += 4 * dt
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
    this.mesh.onCollide = (mesh) => this.collision(mesh)
  }

  update(dt) {
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
    this.step(dt)
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

  step(dt) {
    const dtv = new BABYLON.Vector3().setAll(dt)
    this.acceleration.multiplyInPlace(dtv)
    this.velocity.addInPlace(this.acceleration)
    this.acceleration.setAll(0)
    this.move(this.velocity.clone().multiplyInPlace(dtv))
  }

  move(displacement) {
    this.mesh.moveWithCollisions(displacement)
  }

  collision(mesh) {
    this.velocity.multiplyInPlace(new BABYLON.Vector3().setAll(0.92))
    // this.addForce(
    //   new BABYLON.Vector3()
    //     .set(-400.0, 0, -400.0)
    //     .multiplyInPlace(this.velocity)
    // )
    // FIXME
    this.velocity.y = 0
  }
}

class Seed extends Mob {
  constructor(mesh) {
    super(mesh)
    this.mass = 8
    this.age = 0
  }

  update(dt) {
    super.update(dt)
    this.age += dt
    if (this.age > 2 * 60) {
      this.world.remove(this)
    }
  }
}

class Tank extends Mob {
  constructor(mesh, turret) {
    super(mesh)
    this.turret = turret
    this.speed = 0
    this.seeds = 10
  }

  plant() {
    if (this.seeds) {
      const mat = this.mesh.getWorldMatrix()
      const seed = this.world.createSeed()
      // FIXME: appropriate for size of tank
      BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(
        0,
        1,
        -3,
        mat,
        seed.mesh.position
      )
      this.seeds--
    }
  }

  look(target, dt) {
    this.turret.rotation.y = BABYLON.Scalar.Clamp(
      moveTowardsAngleRadians(
        this.turret.rotation.y,
        BABYLON.Scalar.NormalizeRadians(target - this.mesh.rotation.y),
        0.9 * dt
      ),
      -Math.PI / 2,
      Math.PI / 2
    )
  }

  steer(target, dt) {
    this.mesh.rotation.y = moveTowardsAngleRadians(
      this.mesh.rotation.y,
      target,
      0.9 * dt
    )
    const speed = BABYLON.Scalar.Lerp(
      0,
      10,
      1 - Math.abs(deltaAngleRadians(this.mesh.rotation.y, target)) / Math.PI
    )
    this.speed = BABYLON.Scalar.MoveTowards(this.speed, speed, 60 * dt)
    this.addAcceleration(
      new BABYLON.Vector3(
        this.speed * Math.sin(this.mesh.rotation.y),
        0.0,
        this.speed * Math.cos(this.mesh.rotation.y)
      )
    )
    this.moving = true
  }

  stop() {
    if (this.moving) {
      this.addAcceleration(
        new BABYLON.Vector3().setAll(-20.0).multiplyInPlace(this.velocity)
      )
      this.moving = false
    }
  }

  step(dt) {
    super.step(dt)
    for (const tree of this.world.trees) {
      const dir = tree.mesh.position.subtract(this.mesh.position)
      if (dir.lengthSquared() < 10 && tree.intersects(this.mesh)) {
        tree.fall(dir)
      }
    }
  }
}

class EnemyTank extends Tank {
  constructor(mesh, turret) {
    super(mesh, turret)
    this.wait = 0
    this.target = undefined
    this.targetLook = undefined
    this.lookWait = 0
  }

  update(dt) {
    super.update(dt)
    if (this.targetLook !== undefined) {
      this.look(this.targetLook, dt)
      if (this.lookWait) {
        this.lookWait -= dt
        if (this.lookWait < 0) this.lookWait = 0
      }
      if (!this.lookWait) this.targetLook = undefined
    } else if (this.lookWait) {
      this.lookWait -= dt
      if (this.lookWait < 0) this.lookWait = 0
    } else {
      this.targetLook =
        this.mesh.rotation.y +
        BABYLON.Scalar.Denormalize(this.world.rng(), -Math.PI / 4, Math.PI / 4)
      this.lookWait = this.world.rng() * 0.2 + 1.9
    }
    if (this.wait) {
      this.wait -= dt
      if (this.wait < 0) this.wait = 0
      return
    }
    if (this.target !== undefined) {
      if (this.target.angle === 0) {
        const delta = this.target.mesh.position.subtract(this.mesh.position)
        const ang = Math.atan2(delta.x, delta.z)
        this.steer(ang, dt)
        if (delta.lengthSquared() > 10) {
          this.targetLook = ang
          this.lookWait = 1
        } else if (delta.lengthSquared() < 5) {
          this.lookWait = 0
        }
      } else {
        this.stop()
        this.target = undefined
        this.wait = this.world.rng() * 0.1 + 0.4
      }
    } else {
      this.target = undefined
      let closest = Number.POSITIVE_INFINITY
      // FIXME: performance
      for (const t of this.world.trees) {
        if (t.angle !== 0) continue
        const delta = t.mesh.position.subtract(this.mesh.position)
        const dist = delta.lengthSquared()
        if (dist < closest) {
          if (this.world.hasEnemey((buddy) => buddy.target === t)) continue
          closest = dist
          this.target = t
        }
      }
    }
  }
}

function deltaAngleRadians(current, target) {
  let num = BABYLON.Scalar.Repeat(target - current, 2 * Math.PI)
  if (num > Math.PI) {
    num -= 2 * Math.PI
  }
  return num
}

function moveTowardsAngleRadians(current, target, maxDelta) {
  const num = deltaAngleRadians(current, target)
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
    this.scene.clearColor = new BABYLON.Color3(0.57, 0.74, 0.88)
    // this.scene.ambientColor = new BABYLON.Color3(0.8, 0.88, 0.94)
    this.size = 64
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
    // UI
    this.uiScene = new BABYLON.Scene(this.engine)
    this.uiScene.autoClear = false
    this.ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      'UI',
      true,
      this.uiScene
    )
    this.uiScene.activeCamera = new BABYLON.UniversalCamera(
      'camera',
      BABYLON.Vector3.Zero(),
      this.uiScene
    )
    const fpsText = new BABYLON.GUI.TextBlock()
    fpsText.fontSize = 22
    fpsText.color = 'white'
    fpsText.fontFamily = 'Inter UI'
    fpsText.resizeToFit = true
    fpsText.paddingLeft = '20px'
    fpsText.paddingTop = '20px'
    fpsText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP
    fpsText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    fpsText.textHorizontalAlignment =
      BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
    this.ui.addControl(fpsText)
    // Add lights to the scene
    // eslint-disable-next-line no-new
    const ambient = new BABYLON.HemisphericLight(
      'ambient_light',
      new BABYLON.Vector3(1, 1, 0),
      this.scene
    )
    ambient.intensity = 0.6
    const sun = new BABYLON.DirectionalLight(
      'sun_light',
      new BABYLON.Vector3(-0.4, -0.6, -0.2).normalize(),
      this.scene
    )
    sun.intensity = 0.4
    this.world = new World(this, new Alea(), sun, ambient)
    this.world.time = Number.NaN
    this.shadows = new BABYLON.ShadowGenerator(1024, sun)
    this.shadows.usePercentageCloserFiltering = true
    // this.shadows.autoCalcDepthBounds = true
    // this.shadows.autoCalcDepthBoundsRefreshRate = 2
    // new BABYLON.PointLight(
    //   'light2',
    //   new BABYLON.Vector3(0, 10, -10),
    //   this.scene
    // )
    this.materials = {}
    this.materials.grass = new BABYLON.StandardMaterial('grass', this.scene)
    this.materials.grass.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05)
    this.materials.grass.diffuseColor = GRASS_COLOR
    this.materials.leaves = new BABYLON.StandardMaterial('leaves', this.scene)
    this.materials.leaves.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0)
    this.materials.leaves.diffuseColor = LEAF_COLOR
    this.materials.bark = new BABYLON.StandardMaterial('bark', this.scene)
    this.materials.bark.specularColor = new BABYLON.Color3(0, 0, 0)
    this.materials.bark.diffuseColor = new BABYLON.Color3(0.48, 0.35, 0.17)
    this.materials.rock = new BABYLON.StandardMaterial('rock', this.scene)
    this.materials.rock.specularColor = new BABYLON.Color3(0.25, 0.25, 0.25)
    this.materials.rock.diffuseColor = new BABYLON.Color3(0.42, 0.47, 0.48)
    this.createWorld()
    this.player = this.createTank(
      'player',
      new BABYLON.Color3(0.22, 0.22, 0.76), // 0.81, 0.69, 0.36
      (m, t) => new Tank(m, t)
    )
    this.world.addMob(this.player)
    for (let n = 0; n-- > 0; ) {
      const enemy = this.createTank(
        `enemy_${n}`,
        new BABYLON.Color3(0.66, 0.19, 0.19),
        (m, t) => new EnemyTank(m, t)
      )
      enemy.mesh.position.x =
        BABYLON.Scalar.Denormalize(this.world.rng(), -1, 1) *
        (this.size / 2 - 10)
      enemy.mesh.position.z =
        BABYLON.Scalar.Denormalize(this.world.rng(), -1, 1) *
        (this.size / 2 - 10)
      this.world.addEnemy(enemy)
    }

    this.inputs = {}
    this.engine.runRenderLoop(() => {
      const dt = this.engine.getDeltaTime() / 1000
      let sx = 0
      let sz = 0
      if (this.inputs[KeyCode.KEY_W]) sx++
      if (this.inputs[KeyCode.KEY_S]) sx--
      if (this.inputs[KeyCode.KEY_A]) sz--
      if (this.inputs[KeyCode.KEY_D]) sz++
      if (sx !== 0 || sz !== 0) {
        this.player.steer(this.camera.rotation.y + Math.atan2(sz, sx), dt)
      } else {
        this.player.stop()
      }
      let tx = 0
      let tz = 0
      if (this.inputs[KeyCode.KEY_UP]) tx++
      if (this.inputs[KeyCode.KEY_DOWN]) tx--
      if (this.inputs[KeyCode.KEY_LEFT]) tz--
      if (this.inputs[KeyCode.KEY_RIGHT]) tz++
      if (tx !== 0 || tz !== 0) {
        this.player.look(this.camera.rotation.y + Math.atan2(tz, tx), dt)
      }
      this.world.update(dt)
      this.camera.position.x = this.player.mesh.position.x
      this.camera.position.z = this.player.mesh.position.z
      this.scene.render()
      fpsText.text = `FPS: ${this.engine.performanceMonitor.averageFPS | 0}`
      this.uiScene.render()
    })

    canvas.addEventListener('keydown', (e) => this.keydown(e))
    canvas.addEventListener('keyup', (e) => this.keyup(e))
  }

  createTank(name, color, type) {
    const options = { width: 2, height: 0.86, depth: 3.7 }
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
    body.material.diffuseColor = color
    body.receiveShadows = true
    const turretDepth = 2.2
    const turret = BABYLON.MeshBuilder.CreateBox(
      `${name}_turret`,
      { width: 1.52, height: 0.56, depth: turretDepth },
      this.scene
    )
    turret.material = body.material
    turret.position.y = 0.25 + options.height / 2
    turret.parent = body
    turret.receiveShadows = true
    const barrelLen = 2.42
    const cannon = BABYLON.MeshBuilder.CreateCylinder(
      `${name}_cannon`,
      { tessellation: 8, diameter: 0.24, height: barrelLen },
      this.scene
    )
    cannon.rotation.x = -Math.PI / 2
    cannon.material = body.material
    cannon.position.z = turretDepth / 2 + barrelLen / 2
    cannon.position.y = 0.015
    cannon.parent = turret
    return type(body, turret)
  }

  createTree() {
    const height = 5
    const crown = BABYLON.MeshBuilder.CreateCylinder(
      'crown',
      {
        diameterTop: 0,
        diameterBottom: height / 2,
        height,
        tessellation: 18,
        subdivisions: 8
      },
      this.scene
    )
    crown.material = this.materials.leaves
    crown.position.y = height
    crown.isVisible = false
    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      'trunk',
      { tessellation: 12, height, diameter: 0.6 },
      this.scene
    )
    trunk.material = this.materials.bark
    trunk.position.y = height / 2
    trunk.isVisible = false
    const merged = new BABYLON.Mesh('tree', this.scene)
    merged.metadata = { trunk, crown }
    return BABYLON.Mesh.MergeMeshes(
      [trunk, crown],
      false,
      false,
      merged,
      false,
      true
    )
  }

  createWorld() {
    const rng = new Alea('alizee')
    const ground = BABYLON.MeshBuilder.CreatePlane(
      'ground',
      {
        size: this.size
      },
      this.scene
    )
    ground.rotation.x = Math.PI / 2
    ground.checkCollisions = true
    ground.receiveShadows = true
    ground.material = this.materials.grass
    this.createWalls()
    const subdivisions = (this.size * 2) | 0
    const dirt = BABYLON.MeshBuilder.CreateGround(
      'dirt',
      { width: this.size, height: this.size, subdivisions },
      this.scene
    )
    const positions = dirt.getVerticesData(BABYLON.VertexBuffer.PositionKind)
    const normals = dirt.getVerticesData(BABYLON.VertexBuffer.NormalKind)
    // const indices = dirt.getIndices()
    const simplex = new SimplexNoise(rng)
    const simplex2 = new SimplexNoise(rng)
    const ns = 0.06 * this.size
    this.ground = { dirt }
    for (let gy = 0; gy <= subdivisions; gy++) {
      for (let gx = 0; gx <= subdivisions; gx++) {
        const x = (gx / subdivisions - 0.5) * ns
        const y = (gy / subdivisions - 0.5) * ns
        const n =
          ((simplex.noise2D(x, y) + simplex2.noise2D(x / 2, y / 2) / 2) /
            (1 + 1 / 2)) *
          0.15
        positions[(gx + gy * (subdivisions + 1)) * 3 + 1] += n
      }
    }
    // BABYLON.VertexData.ComputeNormals(positions, indices, normals)
    dirt.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions)
    dirt.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals)
    dirt.receiveShadows = true
    dirt.material = new BABYLON.StandardMaterial('dirt', this.scene)
    dirt.material.specularColor = new BABYLON.Color3(0, 0, 0)
    dirt.material.diffuseColor = new BABYLON.Color3(0.55, 0.42, 0.23)
    // sand new BABYLON.Color3(0.83, 0.78, 0.5)
    this.createTrees(rng)
    this.createRocks(rng)
  }

  createWalls() {
    const h = 4
    const hb = 0.5
    const left = BABYLON.MeshBuilder.CreateBox(
      'left_wall',
      {
        width: 0.5,
        height: h + hb,
        depth: this.size + 0.5
      },
      this.scene
    )
    left.material = this.materials.rock
    left.checkCollisions = true
    left.position.x -= this.size / 2
    left.position.y -= hb
    const right = BABYLON.MeshBuilder.CreateBox(
      'left_wall',
      {
        width: 0.5,
        height: h + hb,
        depth: this.size + 0.5
      },
      this.scene
    )
    right.material = this.materials.rock
    right.checkCollisions = true
    right.position.x += this.size / 2
    right.position.y -= hb
    const forward = BABYLON.MeshBuilder.CreateBox(
      'forward_wall',
      {
        width: this.size + 0.5,
        height: h + hb,
        depth: 0.5
      },
      this.scene
    )
    forward.material = this.materials.rock
    forward.checkCollisions = true
    forward.position.z -= this.size / 2
    forward.position.y -= hb
    const back = BABYLON.MeshBuilder.CreateBox(
      'back_wall',
      {
        width: this.size + 0.5,
        height: h + hb,
        depth: 0.5
      },
      this.scene
    )
    back.material = this.materials.rock
    back.checkCollisions = true
    back.position.z += this.size / 2
    back.position.y -= hb
  }

  createTrees(rng) {
    const simplex = new SimplexNoise(rng)
    const spacing = 4
    const noiseScale = 0.04
    const gridScale = this.size - 12
    const gridSize = (gridScale / spacing) | 0
    const prototree = this.createTree()
    prototree.isVisible = false
    prototree.receiveShadows = true
    let trees = 0
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const wx = x * spacing - gridScale / 2
        const wy = y * spacing - gridScale / 2
        const d = (simplex.noise2D(wx * noiseScale, wy * noiseScale) + 1) / 2
        if (rng() < d * d * 2) {
          const tree = prototree.createInstance(`tree_${++trees}`)
          tree.metadata = { ...prototree.metadata }
          tree.position.x = wx + (rng() / 2) * spacing
          tree.position.z = wy + (rng() / 2) * spacing
          this.world.addTree(new Tree(tree))
          this.shadows.addShadowCaster(tree)
          tree.metadata.dispose = () => this.shadows.removeShadowCaster(tree)
          // break
        }
      }
    }
    this.world.desiredTrees = trees
    this.world.treeGridScale = gridScale
    this.world.treeGridSize = gridSize
  }

  createRocks(rng) {
    const spacing = 2
    const rockproto = BABYLON.MeshBuilder.CreateBox(
      'rock',
      { size: 0.5 },
      this.scene
    )
    rockproto.material = this.materials.rock
    rockproto.receiveShadows = true
    rockproto.isVisible = false
    let rocks = 0
    for (let x = 0; x < this.size / spacing; x++) {
      for (let y = 0; y < this.size / spacing; y++) {
        const wx = x * spacing - this.size / 2
        const wy = y * spacing - this.size / 2
        if (rng() < 0.4) {
          const cluster = (rng() * rng() * 4) | 0
          const cx = wx + (rng() / 2) * spacing
          const cy = wy + (rng() / 2) * spacing
          if (this.ground.dirt.getHeightAtCoordinates(cx, cy) < 0) continue
          for (let n = 0; n < cluster; n++) {
            const rock = rockproto.createInstance(`rock_${++rocks}`)
            rock.position.set(
              cx + BABYLON.Scalar.Denormalize(rng(), -0.5, 0.5),
              rng() * 0.1,
              cy + BABYLON.Scalar.Denormalize(rng(), -0.5, 0.5)
            )
            rock.rotation.x += rng() * Math.PI
            rock.rotation.y += rng() * Math.PI
            rock.rotation.z += rng() * Math.PI
            rock.scaling.setAll(BABYLON.Scalar.Denormalize(rng(), 0.6, 1.2))
            this.shadows.addShadowCaster(rock)
          }
        }
      }
    }
  }

  keydown(e) {
    this.inputs[e.keyCode] = true
    if (e.keyCode === KeyCode.KEY_F) {
      this.player.plant()
    }
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
