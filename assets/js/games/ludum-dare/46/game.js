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
    this.mesh.metadata = this.mesh.metadata || {}
    this.mesh.metadata.object = this
    this.world = undefined
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
        if (dir.lengthSquared() < 10 && tree.intersects(this.mesh)) {
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
    this.scene.clearColor = new BABYLON.Color3(0.57, 0.74, 0.88)
    this.scene.ambientColor = new BABYLON.Color3(0.8, 0.88, 0.94)
    this.size = 48
    this.world = new World()
    this.camera = new BABYLON.UniversalCamera(
      'camera',
      BABYLON.Vector3.Zero(),
      this.scene
    )
    this.camera.rotation.y = -Math.PI / 4
    this.camera.rotation.x = Math.PI / 6
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA
    const zoom = 10
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
    ambient.intensity = 0.6
    const sun = new BABYLON.DirectionalLight(
      'sun_light',
      new BABYLON.Vector3(-0.5, -0.8, 0).normalize(),
      this.scene
    )
    sun.intensity = 0.4
    this.shadows = new BABYLON.ShadowGenerator(1024, sun)
    this.shadows.usePercentageCloserFiltering = true
    // this.shadows.autoCalcDepthBounds = true
    // this.shadows.autoCalcDepthBoundsRefreshRate = 4
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
          0.015
        )
        const speed = BABYLON.Scalar.Lerp(
          0,
          10,
          1 -
            Math.abs(deltaAngle(this.player.mesh.rotation.y, target)) / Math.PI
        )
        this.player.moving = true
        this.player.speed = BABYLON.Scalar.MoveTowards(
          this.player.speed,
          speed,
          1
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
        const target = BABYLON.Scalar.Clamp(
          BABYLON.Scalar.NormalizeRadians(
            this.camera.rotation.y +
              Math.atan2(tz, tx) -
              this.player.mesh.rotation.y
          ),
          -Math.PI / 2,
          Math.PI / 2
        )
        this.player.turret.rotation.y = moveTowardsAngle(
          this.player.turret.rotation.y,
          target,
          0.015
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
    body.material.diffuseColor = new BABYLON.Color3(0.81, 0.69, 0.36)
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
    this.shadows.addShadowCaster(body, true)
    return new Tank(body, turret)
  }

  createTree() {
    const height = 5
    const crown = BABYLON.MeshBuilder.CreateCylinder(
      'crown',
      {
        diameterTop: 0,
        diameterBottom: height / 2,
        height,
        tessellation: 32,
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
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      {
        width: this.size,
        height: this.size,
        subdivisions: (this.size / 10) | 0
      },
      this.scene
    )
    ground.checkCollisions = true
    ground.receiveShadows = true
    ground.material = new BABYLON.StandardMaterial('grass', this.scene)
    ground.material.specularColor = new BABYLON.Color3(0, 0, 0)
    ground.material.diffuseColor = new BABYLON.Color3(0.49, 0.72, 0.34)
    const subdivisions = (this.size * 2) | 0
    const dirt = BABYLON.MeshBuilder.CreateGround(
      'dirt',
      { width: this.size, height: this.size, subdivisions },
      this.scene
    )
    const positions = dirt.getVerticesData(BABYLON.VertexBuffer.PositionKind)
    const normals = dirt.getVerticesData(BABYLON.VertexBuffer.NormalKind)
    // const indices = dirt.getIndices()
    const simplex = new SimplexNoise(new Alea('foo'))
    const simplex2 = new SimplexNoise(new Alea('bar'))
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
    this.createTrees()
    this.createRocks()
  }

  createTrees() {
    const rng = new Alea('alizee')
    const simplex = new SimplexNoise(new Alea('foobar'))
    const spacing = 4
    const noiseScale = 0.04
    const prototree = this.createTree()
    // prototree.registerInstancedBuffer('color', 4)
    prototree.isVisible = false
    let trees = 0
    for (let x = 0; x < this.size / spacing; x++) {
      for (let y = 0; y < this.size / spacing; y++) {
        const wx = x * spacing - this.size / 2
        const wy = y * spacing - this.size / 2
        const d = (simplex.noise2D(wx * noiseScale, wy * noiseScale) + 1) / 2
        if (rng() < d * d * 2) {
          const tree = prototree.createInstance(`tree_${++trees}`)
          tree.metadata = { ...prototree.metadata }
          // tree.instancedBuffers.color = new BABYLON.Color4(
          //   rng() * 0.2 + 0.8,
          //   1.0,
          //   rng() * 0.2 + 0.8,
          //   1.0
          // )
          tree.position.x = wx + (rng() / 2) * spacing
          tree.position.z = wy + (rng() / 2) * spacing
          this.world.addTree(new Tree(tree))
          this.shadows.addShadowCaster(tree)
          tree.metadata.dispose = () => this.shadows.removeShadowCaster(tree)
        }
      }
    }
    this.world.desiredTrees = trees
  }

  createRocks() {
    const rng = new Alea('rocks')
    const spacing = 2
    const rockproto = BABYLON.MeshBuilder.CreateBox('rock', { size: 0.5 })
    rockproto.material = new BABYLON.StandardMaterial('grass', this.scene)
    rockproto.material.specularColor = new BABYLON.Color3(0.25, 0.25, 0.25)
    rockproto.material.diffuseColor = new BABYLON.Color3(0.42, 0.47, 0.48)
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
