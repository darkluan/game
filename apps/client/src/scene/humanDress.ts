import {
  AdditiveBlending,
  BackSide,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  Raycaster,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
  Vector3,
} from 'three';

/**
 * What is drawn in code onto the four Humans, whose bodies are model files: a dark line round the
 * figure, eyes (the models have blank faces), a light on the weapon, and something of each one's
 * own. Everything is hung on the model's bones, so it moves with the animation.
 */

/** Which of the four this is, and so what it wears. */
export type HumanDress = 'warrior' | 'ranger' | 'wizard' | 'cleric';

const ACCENT: Record<HumanDress, string> = {
  warrior: '#4aa3ff',
  ranger: '#5fe0a0',
  wizard: '#b9a6ff',
  cleric: '#ffe08a',
};

const BALL = new SphereGeometry(1, 14, 10);
const WHITE = new MeshBasicMaterial({ color: '#ffffff' });
/** The dark of an eye socket, and an old man's white hair. */
const INK = new MeshStandardMaterial({ color: '#1b1533', roughness: 0.5 });
const BEARD = new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5, flatShading: true });
/** The metal and cloth one Human's armour is cut from. */
interface Kit {
  /** The plate itself, and the same plate with every facet showing, for parts that should look cut rather than turned. */
  plate: MeshStandardMaterial;
  faceted: MeshStandardMaterial;
  /** The bright metal that edges the plate. */
  trim: MeshStandardMaterial;
  cloth: MeshStandardMaterial;
}

/** Plate, edging and cloth for each: black and silver, forest green, deep violet, ivory and gold. */
const KIT_COLOURS: Record<HumanDress, [plate: string, trim: string, cloth: string]> = {
  warrior: ['#434859', '#dfe4ee', '#2c3040'],
  ranger: ['#1d5245', '#dff3e6', '#143a30'],
  wizard: ['#3b3180', '#e3dcfa', '#231d56'],
  cleric: ['#e9e1c8', '#f0c24a', '#f4efde'],
};
const kits = new Map<HumanDress, Kit>();

function kitOf(kind: HumanDress): Kit {
  let kit = kits.get(kind);
  if (!kit) {
    const [plate, trim, cloth] = KIT_COLOURS[kind];
    // Little metalness: with no sky to mirror, true metal would show as black here.
    kit = {
      plate: new MeshStandardMaterial({ color: plate, roughness: 0.4, metalness: 0.25 }),
      faceted: new MeshStandardMaterial({ color: plate, roughness: 0.4, metalness: 0.25, flatShading: true }),
      trim: new MeshStandardMaterial({ color: trim, roughness: 0.3, metalness: 0.3 }),
      // Drawn on both faces: a hood and its skirts are open, and their insides show.
      cloth: new MeshStandardMaterial({ color: cloth, roughness: 0.85, metalness: 0, side: DoubleSide }),
    };
    kits.set(kind, kit);
  }
  return kit;
}

/** How much of the armour each one wears: which shoulders are plated and how deep, how long the point on them, how long the tails of the coat. */
const CUT: Record<
  HumanDress,
  { shoulders: string[]; layers: number; point: number; back: number; thigh: number; front: number }
> = {
  warrior: { shoulders: ['ShoulderL', 'ShoulderR'], layers: 3, point: 0.15, back: 0.4, thigh: 0.36, front: 0.27 },
  // The archer keeps her drawing arm free.
  ranger: { shoulders: ['ShoulderL'], layers: 3, point: 0.11, back: 0, thigh: 0.27, front: 0.2 },
  wizard: { shoulders: ['ShoulderL', 'ShoulderR'], layers: 2, point: 0.08, back: 0, thigh: 0.43, front: 0.38 },
  cleric: { shoulders: ['ShoulderL', 'ShoulderR'], layers: 3, point: 0, back: 0, thigh: 0.38, front: 0.34 },
};
/** The warrior's own cloth and plate, darkened to go under the armour; one copy for each of the model's materials. */
const darkened = new Map<string, MeshStandardMaterial>();
const UP_AXIS = new Vector3(0, 1, 0);
/** A coarse ball: few enough faces that each one reads as a flat of beaten metal. */
const CUT_BALL = new SphereGeometry(1, 7, 4);

/**
 * The dark line: each mesh drawn again, swollen along its normals and inside out. Written with the
 * skinning pieces of the standard shaders, so the swollen copy bends with the skeleton like the body.
 */
const OUTLINE = new ShaderMaterial({
  side: BackSide,
  uniforms: { thickness: { value: 0.02 } },
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    uniform float thickness;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      mvPosition.xyz += normalize(transformedNormal) * thickness;
      gl_Position = projectionMatrix * mvPosition;
    }`,
  fragmentShader: `void main() { gl_FragColor = vec4(0.035, 0.04, 0.07, 1.0); }`,
});

let glowMap: Texture | null = null;

function glowTexture(): Texture {
  if (glowMap) return glowMap;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  fade.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  glowMap = new CanvasTexture(canvas);
  glowMap.colorSpace = SRGBColorSpace;
  return glowMap;
}

function glow(parent: Object3D, color: string, size: number, at: Vector3, opacity: number): Sprite {
  const light = new Sprite(
    new SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  light.position.copy(at);
  light.scale.setScalar(size);
  parent.add(light);
  return light;
}

function ball(
  material: MeshBasicMaterial | MeshStandardMaterial,
  parent: Object3D,
  at: Vector3,
  size: Vector3,
  roll = 0,
): Mesh {
  const mesh = new Mesh(BALL, material);
  mesh.position.copy(at);
  mesh.scale.copy(size);
  mesh.rotation.z = roll;
  parent.add(mesh);
  return mesh;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** A spike with its foot at `at`, pointing along `toward`. `flat` squeezes it into a blade. */
function spike(
  material: MeshStandardMaterial,
  parent: Object3D,
  at: Vector3,
  toward: Vector3,
  length: number,
  radius: number,
  flat = 1,
  sides = 6,
): Mesh {
  const shape = new ConeGeometry(radius, length, sides);
  shape.translate(0, length / 2, 0);
  const mesh = new Mesh(shape, material);
  mesh.position.copy(at);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP_AXIS, toward.clone().normalize()));
  mesh.scale.z = flat;
  parent.add(mesh);
  return mesh;
}

/** A bar from one point to another. */
function rod(material: MeshStandardMaterial, parent: Object3D, from: Vector3, to: Vector3, radius: number): Mesh {
  const length = from.distanceTo(to);
  const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 6), material);
  mesh.position.copy(from).lerp(to, 0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP_AXIS, to.clone().sub(from).normalize()));
  parent.add(mesh);
  return mesh;
}

/**
 * A long tail of a coat hanging from `top`: dark cloth on a slightly wider leaf of bright metal, so
 * the metal shows as an edging, with a worked band above the hem. `facing` is the way its outer
 * face looks; `flare` swings its foot out that way. Returns the part to sway.
 */
function tail(
  kit: Kit,
  parent: Object3D,
  top: Vector3,
  facing: Vector3,
  length: number,
  width: number,
  spread: number,
  flare: number,
): Group {
  const turn = new Group();
  turn.position.copy(top);
  turn.rotation.y = Math.atan2(facing.x, facing.z);
  const hang = new Group();
  hang.rotation.x = -flare;
  turn.add(hang);
  const leaf = (grow: number, material: MeshStandardMaterial, back: number) => {
    const shape = new CylinderGeometry((width + grow) * 0.7, (width * spread + grow) * 0.7, length + grow, 4);
    shape.rotateY(Math.PI / 4);
    shape.translate(0, -length / 2, 0);
    const mesh = new Mesh(shape, material);
    mesh.scale.z = 0.06;
    mesh.position.z = back;
    hang.add(mesh);
  };
  leaf(0, kit.cloth, 0);
  leaf(width * 0.16, kit.trim, -width * 0.03);
  // The worked band over the hem, and a line of bright metal down the middle.
  for (const [y, tall] of [
    [0.82, 0.05],
    [0.9, 0.012],
  ]) {
    const band = new Mesh(new CylinderGeometry(1, 1, 1, 4), kit.trim);
    band.geometry.rotateY(Math.PI / 4);
    band.scale.set(width * spread * 0.62, length * tall, width * 0.05);
    band.position.set(0, -length * y, width * 0.03);
    hang.add(band);
  }
  rod(kit.trim, hang, v(0, -length * 0.08, width * 0.04), v(0, -length * 0.74, width * 0.04), width * 0.035);
  parent.add(turn);
  return hang;
}

/**
 * Dresses one Human. `root` holds the model as it stands before any animation has played, feet on
 * the ground and facing +z. Returns what must be called every frame to keep the turning parts turning.
 */
export function dressHuman(root: Group, kind: HumanDress): (delta: number) => void {
  root.updateMatrixWorld(true);
  const accent = ACCENT[kind];
  const kit = kitOf(kind);
  const { plate: PLATE, trim: SILVER, faceted: FACETED } = kit;
  const cut = CUT[kind];
  const lit = new MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6, roughness: 0.3 });
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) meshes.push(o);
  });
  // The skeleton's own tables are filled in only when it is first drawn; looking for the face needs them now.
  for (const mesh of meshes) (mesh as Mesh & { skeleton?: { update(): void } }).skeleton?.update();
  const height = new Box3().setFromObject(root).max.y;
  const fromRoot = new Matrix4().copy(root.matrixWorld).invert();

  /**
   * A holder riding on a bone whose own measure is the root's: one unit is one unit of the game,
   * up is up and forward is forward, as the model stands now. What is put in it is placed in plain
   * terms and then follows the bone.
   */
  const ride = (boneName: string): Group | null => {
    const bone = root.getObjectByName(boneName);
    if (!bone) return null;
    const holder = new Group();
    holder.applyMatrix4(new Matrix4().copy(bone.matrixWorld).invert().multiply(root.matrixWorld));
    bone.add(holder);
    return holder;
  };
  /** Where something on the model is, in the root's measure. */
  const place = (world: Vector3) => world.clone().applyMatrix4(fromRoot);

  const dimmed = new Set<unknown>();
  if (kind === 'warrior' || kind === 'ranger') {
    // Everything but the weapon goes dark, to sit under the armour: black for him, deep green for her.
    // The other two show their own faces and clothes, and keep their own colours.
    for (const mesh of meshes) {
      if (mesh.parent?.name === 'WeaponR') continue;
      const own = mesh.material as MeshStandardMaterial;
      let dark = darkened.get(own.uuid + kind);
      if (!dark) {
        dark = own.clone();
        if (kind === 'ranger') dark.color.multiply(new Color(0.34, 0.56, 0.46));
        else dark.color.multiplyScalar(0.5);
        darkened.set(own.uuid + kind, dark);
      }
      mesh.material = dark;
      dimmed.add(dark);
    }
  }

  // Brighter cloth and metal: the models' own colours are dull under this game's light.
  for (const mesh of meshes) {
    const material = mesh.material as MeshStandardMaterial;
    if (!material.map || material.userData.lifted) continue;
    material.emissive.set('#ffffff');
    material.emissiveMap = material.map;
    // The warrior's body is meant to stay dark; his sword is lit like everyone's.
    material.emissiveIntensity = dimmed.has(material) ? 0.04 : 0.22;
    material.userData.lifted = true;
  }

  for (const mesh of meshes) {
    // Only the body and the head get the line. A blade, a bowstave or a shoulder plate is thinner
    // than the line itself, which would swallow it whole and leave it black.
    const body = 'skeleton' in mesh;
    if (!body && mesh.parent?.name !== 'Head') continue;
    const line = new (mesh.constructor as typeof Mesh)(mesh.geometry, OUTLINE);
    // A skinned copy must hang on the same skeleton as the part it outlines.
    const skinned = mesh as Mesh & {
      skeleton?: unknown;
      bindMatrix?: Matrix4;
      bind?: (s: unknown, m?: Matrix4) => void;
    };
    if (skinned.skeleton) (line as typeof skinned).bind?.(skinned.skeleton, skinned.bindMatrix);
    mesh.add(line);
  }

  // The head: found by looking down on it and straight at it, since each model's is a different size.
  const head = ride('Head');
  const neck = root.getObjectByName('Head');
  const ray = new Raycaster();
  const hit = (from: Vector3, toward: Vector3): Vector3 | null => {
    ray.set(from.clone().applyMatrix4(root.matrixWorld), toward.clone().transformDirection(root.matrixWorld));
    const found = ray.intersectObjects(meshes, false)[0];
    return found ? place(found.point) : null;
  };
  let crown = height;
  if (head && neck) {
    const base = place(neck.getWorldPosition(new Vector3()));
    crown = hit(new Vector3(base.x, height * 2, base.z), new Vector3(0, -1, 0))?.y ?? height;
    const tall = crown - base.y;
    // Only the cleric's face is drawn on here: the others are behind a helm or a mask, built with their armour below.
    if (kind === 'cleric') {
      // The cleric's mask has no face: a light burns behind each eye slit.
      for (const side of [-1, 1]) {
        const eye = hit(
          new Vector3(base.x + side * tall * 0.16, base.y + tall * 0.42, height * 2),
          new Vector3(0, 0, -1),
        );
        if (!eye) continue;
        ball(
          lit,
          head,
          eye.clone().add(new Vector3(0, 0, 0.004)),
          new Vector3(tall * 0.075, tall * 0.028, tall * 0.02),
        );
        glow(head, accent, tall * 0.5, eye.clone().add(new Vector3(0, 0, 0.03)), 0.35);
      }
    }
  }

  // The weapon: a light where it is farthest from the hand, and a smaller one at the hand.
  const weaponBone = root.getObjectByName('WeaponR');
  const weapon = ride('WeaponR');
  const turning: { part: Object3D; axis: 'x' | 'y' | 'z'; speed: number }[] = [];
  if (weapon && weaponBone) {
    const grip = place(weaponBone.getWorldPosition(new Vector3()));
    const blade = meshes.find((mesh) => mesh.parent === weaponBone);
    if (blade && (kind === 'ranger' || kind === 'wizard')) {
      // A crossbow for the one and an orb and a book for the other, built further down, take the place
      // of what the models came holding.
      blade.visible = false;
    } else if (blade) {
      const box = new Box3().setFromObject(blade).applyMatrix4(fromRoot);
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
        (i) => new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z),
      );
      const far = corners.reduce((best, c) => (c.distanceTo(grip) > best.distanceTo(grip) ? c : best));
      // A sword's business end is the one far from the hand. A staff is carried by its neck: its head
      // is the short end, just past the fist on the other side from its long shaft.
      const staff = kind === 'wizard' || kind === 'cleric';
      const tip = staff
        ? grip.clone().add(
            grip
              .clone()
              .sub(far)
              .setLength(height * 0.1),
          )
        : far.lerp(box.getCenter(new Vector3()), 0.25);
      glow(weapon, accent, height * 0.42, tip, 0.5);
      glow(weapon, accent, height * 0.22, tip.clone().lerp(grip, 0.5), 0.35);
      if (kind === 'wizard' || kind === 'cleric') {
        // Sparks of the hero's colour circle the head of the staff.
        const orbit = new Group();
        orbit.position.copy(tip);
        weapon.add(orbit);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const r = height * 0.09;
          ball(
            lit,
            orbit,
            new Vector3(Math.cos(a) * r, (i - 1) * height * 0.02, Math.sin(a) * r),
            new Vector3(1, 1, 1).multiplyScalar(height * 0.013),
          );
        }
        const ring = new Mesh(new TorusGeometry(height * 0.09, height * 0.004, 5, 28), lit);
        ring.rotation.x = Math.PI / 2;
        orbit.add(ring);
        turning.push({ part: orbit, axis: 'y', speed: 2.2 });
      }
    }
  }

  if (head && neck) {
    const base = place(neck.getWorldPosition(new Vector3()));
    if (kind === 'cleric') {
      // A halo over the hood.
      const halo = new Mesh(new TorusGeometry(height * 0.085, height * 0.008, 6, 30), lit);
      halo.position.set(base.x, crown + height * 0.05, base.z);
      halo.rotation.x = Math.PI / 2;
      head.add(halo);
      glow(head, accent, height * 0.4, new Vector3(base.x, crown + height * 0.05, base.z), 0.3);
    }
  }

  const torso = ride('Torso');
  const chestBone = root.getObjectByName('Torso');

  const swaying: { part: Group; rest: number; phase: number }[] = [];
  {
    const at = (name: string) => {
      const bone = root.getObjectByName(name);
      return bone ? place(bone.getWorldPosition(new Vector3())) : null;
    };
    const H = height;
    // The models' own shoulder pieces give way to the armour's.
    for (const mesh of meshes) if (mesh.name.startsWith('ShoulderPad')) mesh.visible = false;

    // The helmet: a closed helm with a slit of light for each eye, a crest, long cheek guards and
    // two great horns that rise wide and curve in again over the crown.
    const neckAt = at('Head');
    const tall = neckAt ? crown - neckAt.y : 0;
    const r = tall * 0.56;
    const c = neckAt ? v(neckAt.x, neckAt.y + tall * 0.52, neckAt.z) : v(0, 0, 0);
    if (head && neckAt && kind === 'warrior') {
      // The skull of the helm is cut in flats, not turned round: a coarse faceted dome, narrower than
      // it is deep, with a visor that comes forward to a beak and a chin that comes down to a point.
      const dome = new Mesh(CUT_BALL, FACETED);
      dome.position.copy(c).add(v(0, r * 0.08, 0));
      dome.scale.set(r * 1.08, r * 1.16, r * 1.2);
      dome.rotation.y = Math.PI / 7;
      head.add(dome);
      spike(FACETED, head, c.clone().add(v(0, r * 0.05, r * 0.35)), v(0, -0.45, 1), r * 1.15, r * 0.78, 1, 4).rotateY(
        Math.PI / 4,
      );
      spike(FACETED, head, c.clone().add(v(0, -r * 0.35, r * 0.45)), v(0, -1, 0.25), r * 0.95, r * 0.5, 0.8, 4).rotateY(
        Math.PI / 4,
      );
      // A hard brow: two bars of bright metal meeting in a V over the nose, and a wing swept back over each temple.
      for (const side of [-1, 1]) {
        rod(
          SILVER,
          head,
          c.clone().add(v(0, r * 0.22, r * 1.12)),
          c.clone().add(v(side * r * 0.85, r * 0.5, r * 0.55)),
          r * 0.05,
        ).scale.z = 2.2;
        spike(
          FACETED,
          head,
          c.clone().add(v(side * r * 0.85, r * 0.35, r * 0.35)),
          v(side * 0.55, 0.45, -1),
          r * 1.25,
          r * 0.3,
          0.3,
          4,
        );
        spike(
          SILVER,
          head,
          c.clone().add(v(side * r * 0.9, r * 0.3, r * 0.3)),
          v(side * 0.55, 0.3, -1),
          r * 0.95,
          r * 0.09,
          0.4,
          4,
        );
      }
      for (const side of [-1, 1]) {
        ball(
          lit,
          head,
          c.clone().add(v(side * r * 0.3, r * 0.04, r * 1.07)),
          v(r * 0.2, r * 0.045, r * 0.05),
          side * 0.4,
        );
        glow(head, accent, r * 0.7, c.clone().add(v(side * r * 0.3, r * 0.04, r * 1.2)), 0.3);
        // Cheek guards hanging to the collar.
        spike(
          PLATE,
          head,
          c.clone().add(v(side * r * 0.8, -r * 0.35, r * 0.3)),
          v(side * 0.1, -1, 0.1),
          r * 1.2,
          r * 0.3,
          0.35,
        );
        spike(
          SILVER,
          head,
          c.clone().add(v(side * r * 0.84, -r * 0.4, r * 0.42)),
          v(side * 0.1, -1, 0.1),
          r * 0.9,
          r * 0.08,
          0.5,
        );
        // The horn: a chain of tapering pieces, each turned a little further in than the last.
        let holder = new Group();
        holder.position.copy(c).add(v(side * r * 0.78, r * 0.25, -r * 0.05));
        holder.rotation.z = -side * 0.75;
        head.add(holder);
        const pieces = 9;
        const step = (tall * 2.0) / pieces;
        for (let i = 0; i < pieces; i++) {
          const from = r * 0.3 * (1 - i / pieces);
          const to = r * 0.3 * (1 - (i + 1) / pieces);
          const piece = new CylinderGeometry(to, from, step * 1.08, 7);
          piece.translate(0, step / 2, 0);
          const part = new Mesh(piece, i % 3 === 2 ? SILVER : PLATE);
          part.scale.z = 0.45;
          holder.add(part);
          const next = new Group();
          next.position.y = step;
          next.rotation.z = side * 0.17;
          holder.add(next);
          holder = next;
        }
      }
      // A ridge from brow to nape, a point over the nose, and a plume of horn behind.
      // A bladed crest from brow to nape, standing in three fins.
      for (let i = 0; i < 3; i++)
        spike(
          i === 1 ? PLATE : SILVER,
          head,
          c.clone().add(v(0, r * (1.05 - i * 0.12), r * (0.45 - i * 0.5))),
          v(0, 1, -0.75 - i * 0.3),
          r * (0.7 - i * 0.08),
          r * 0.28,
          0.22,
          4,
        ).rotateY(Math.PI / 4);
    }

    if (head && neckAt && kind === 'ranger') {
      // A huntress nobody has seen the face of. A cowl cut in flats, its point trailing far behind;
      // a mask like a blade over the whole face, a slit of light for each eye; and three long
      // feathers of plate swept back from each temple.
      const cowl = new Mesh(CUT_BALL, FACETED);
      cowl.position.copy(c).add(v(0, r * 0.1, -r * 0.06));
      cowl.scale.set(r * 1.12, r * 1.18, r * 1.24);
      cowl.rotation.y = Math.PI / 7;
      head.add(cowl);
      spike(FACETED, head, c.clone().add(v(0, r * 0.8, -r * 0.35)), v(0, 0.3, -1), r * 1.9, r * 0.55, 0.6, 4);
      spike(SILVER, head, c.clone().add(v(0, r * 1.02, -r * 0.4)), v(0, 0.3, -1), r * 1.5, r * 0.1, 0.5, 4);
      const mask = spike(
        FACETED,
        head,
        c.clone().add(v(0, -r * 0.12, r * 0.55)),
        v(0, -0.12, 1),
        r * 0.85,
        r * 0.62,
        1,
        4,
      );
      mask.scale.set(1.45, 1, 1.15);
      rod(SILVER, head, c.clone().add(v(0, r * 0.45, r * 0.95)), c.clone().add(v(0, -r * 0.2, r * 1.42)), r * 0.035);
      rod(SILVER, head, c.clone().add(v(0, -r * 0.2, r * 1.42)), c.clone().add(v(0, -r * 0.85, r * 0.75)), r * 0.035);
      for (const side of [-1, 1]) {
        ball(
          lit,
          head,
          c.clone().add(v(side * r * 0.34, r * 0.08, r * 0.97)),
          v(r * 0.2, r * 0.05, r * 0.05),
          side * 0.45,
        );
        glow(head, accent, r * 0.65, c.clone().add(v(side * r * 0.34, r * 0.08, r * 1.12)), 0.32);
        // A hard brow of bright metal out to the temple.
        rod(
          SILVER,
          head,
          c.clone().add(v(0, r * 0.42, r * 1.0)),
          c.clone().add(v(side * r * 0.98, r * 0.55, r * 0.2)),
          r * 0.05,
        ).scale.z = 2;
        for (let i = 0; i < 3; i++)
          spike(
            i === 1 ? SILVER : FACETED,
            head,
            c.clone().add(v(side * r * 1.0, r * (0.5 - i * 0.3), r * 0.05)),
            v(side * (0.75 - i * 0.1), 0.6 - i * 0.35, -1),
            r * (1.9 - i * 0.4),
            r * 0.26,
            0.22,
            4,
          );
      }
    }
    if (head && neckAt && kind === 'wizard') {
      // The old man of the model, bare-headed and unmasked, as an ancient master of the art. His
      // eyes are all light, with no pupil in them; his brows run out past his temples and hang down
      // his cheeks; two long whiskers fall from his lip and a great beard to his belt, bound twice in
      // bright metal; his hair lies long down his back; and over his head, touching nothing, a crown
      // of shards of starlight turns. The model has no eyes: what is drawn on his face is found by
      // looking straight at it, so it sits on the skin.
      const e = tall * 0.1;
      const look = (x: number, y: number) => hit(v(neckAt.x + x * tall, neckAt.y + y * tall, H * 2), v(0, 0, -1));
      for (const side of [-1, 1]) {
        const eye = look(side * 0.17, 0.4);
        if (eye) {
          ball(INK, head, eye.clone().add(v(0, e * 0.12, e * 0.05)), v(e * 1.05, e * 0.3, e * 0.26), -side * 0.12);
          ball(lit, head, eye.clone().add(v(0, -e * 0.05, e * 0.2)), v(e * 0.85, e * 0.3, e * 0.2), -side * 0.12);
          glow(head, accent, e * 3.4, eye.clone().add(v(0, 0, e * 0.6)), 0.4);
          // The brow: out past the temple, then hanging.
          const inner = eye.clone().add(v(-side * e * 0.9, e * 0.85, e * 0.3));
          const outer = eye.clone().add(v(side * e * 1.7, e * 1.05, -e * 0.3));
          rod(BEARD, head, inner, outer, e * 0.24).scale.z = 0.6;
          spike(BEARD, head, outer, v(side * 0.18, -1, -0.05), e * 4.2, e * 0.24, 0.6, 4);
        }
        const lip = look(side * 0.06, 0.25);
        if (lip)
          spike(
            BEARD,
            head,
            lip.clone().add(v(side * e * 0.3, 0, e * 0.1)),
            v(side * 0.2, -1, 0.12),
            e * 7.5,
            e * 0.2,
            0.7,
            4,
          );
      }
      const chin = look(0, 0.14);
      if (chin) {
        const root = chin.clone().add(v(0, e * 0.7, -e * 0.5));
        const fall = v(0, -1, 0.17).normalize();
        spike(BEARD, head, root, fall, e * 10.5, e * 1.5, 0.55, 5);
        for (const [far, wide] of [
          [3.2, 1.08],
          [6.4, 0.62],
        ]) {
          const ring = root.clone().add(fall.clone().multiplyScalar(e * far));
          const band = rod(
            SILVER,
            head,
            ring.clone().add(fall.clone().multiplyScalar(-e * 0.2)),
            ring.clone().add(fall.clone().multiplyScalar(e * 0.2)),
            e * wide,
          );
          band.scale.z = 0.6;
        }
        ball(
          lit,
          head,
          root
            .clone()
            .add(fall.clone().multiplyScalar(e * 3.2))
            .add(v(0, 0, e * 0.75)),
          v(e * 0.26, e * 0.32, e * 0.2),
          Math.PI / 4,
        );
      }
      // Hair down the back.
      for (let i = -2; i <= 2; i++)
        spike(
          BEARD,
          head,
          c.clone().add(v(i * r * 0.3, r * 0.1, -r * (0.7 - Math.abs(i) * 0.1))),
          v(i * 0.07, -1, -0.16),
          r * (2.6 - Math.abs(i) * 0.3),
          r * 0.4,
          0.5,
          5,
        );
      // The crown that is not worn: a ring of light over his head and seven shards standing on it, turning.
      const halo = new Group();
      halo.position.set(neckAt.x, crown + r * 0.3, neckAt.z - r * 0.1);
      head.add(halo);
      const ring = new Mesh(new TorusGeometry(r * 0.8, r * 0.025, 5, 28), lit);
      ring.rotation.x = Math.PI / 2;
      halo.add(ring);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const where = v(Math.sin(a) * r * 0.8, 0, Math.cos(a) * r * 0.8);
        const high = i % 2 ? 0.34 : 0.6;
        spike(lit, halo, where, v(0, 1, 0), r * high, r * 0.09, 0.6, 4);
        spike(lit, halo, where, v(0, -1, 0), r * 0.18, r * 0.09, 0.6, 4);
      }
      glow(halo, accent, r * 2.4, v(0, r * 0.1, 0), 0.25);
      turning.push({ part: halo, axis: 'y', speed: 0.7 });
    }
    if (head && neckAt && kind === 'cleric') {
      // Behind her mask a sunburst of blades, long and short by turns, and a cut band over the brow.
      for (let i = 0; i < 11; i++) {
        const a = ((i - 5) / 5) * 1.75;
        spike(
          i % 2 ? SILVER : FACETED,
          head,
          c.clone().add(v(Math.sin(a) * r * 0.55, r * 0.15 + Math.cos(a) * r * 0.55, -r * 0.95)),
          v(Math.sin(a), Math.cos(a), -0.12),
          r * (i % 2 ? 1.05 : 1.6),
          r * 0.2,
          0.22,
          4,
        );
      }
      for (const side of [-1, 1])
        rod(
          SILVER,
          head,
          c.clone().add(v(0, r * 0.62, r * 1.02)),
          c.clone().add(v(side * r * 0.95, r * 0.42, r * 0.3)),
          r * 0.05,
        ).scale.z = 2;
      ball(lit, head, c.clone().add(v(0, r * 0.62, r * 1.04)), v(r * 0.09, r * 0.12, r * 0.06), Math.PI / 4);
    }

    // Shoulders: plates stepped down the arm, edged in bright metal, with an upturned point.
    const middle = at('Torso') ?? v(0, H * 0.6, 0);
    for (const name of cut.shoulders) {
      const holder = ride(name);
      const joint = at(name === 'ShoulderL' ? 'UpperArmL' : 'UpperArmR');
      if (!holder || !joint) continue;
      const out = Math.sign(joint.x - middle.x) || 1;
      for (let i = 0; i < cut.layers; i++) {
        const centre = joint.clone().add(v(out * (0.005 + i * 0.036) * H, (0.05 - i * 0.022) * H, 0));
        const roll = -out * (0.3 + i * 0.32);
        ball(PLATE, holder, centre, v(0.078 * H, 0.03 * H, (0.09 - i * 0.008) * H), roll);
        // A leaf of bright metal just under the plate and a little wider, which shows as its edge.
        ball(
          SILVER,
          holder,
          centre.clone().add(v(0, -0.008 * H, 0)),
          v(0.084 * H, 0.024 * H, (0.096 - i * 0.008) * H),
          roll,
        );
      }
      if (cut.point > 0)
        spike(
          SILVER,
          holder,
          joint.clone().add(v(out * 0.07 * H, 0.06 * H, 0)),
          v(out * 0.9, 1, 0),
          cut.point * H,
          0.022 * H,
          0.5,
        );
      if (kind === 'cleric') {
        // In place of points, a wing of four blades swept up and back from each shoulder.
        for (let i = 0; i < 4; i++)
          spike(
            i % 2 ? PLATE : SILVER,
            holder,
            joint.clone().add(v(out * (0.03 + i * 0.02) * H, 0.05 * H, -0.02 * H)),
            v(out * (0.5 + i * 0.3), 1 - i * 0.22, -0.5),
            (0.2 - i * 0.025) * H,
            0.03 * H,
            0.22,
            4,
          );
      }
      for (const fore of kind === 'warrior' ? [-1, 1] : [])
        spike(
          PLATE,
          holder,
          joint.clone().add(v(out * 0.09 * H, 0.03 * H, fore * 0.05 * H)),
          v(out, 0.5, fore * 0.5),
          0.11 * H,
          0.02 * H,
          0.5,
        );
    }

    // The breast: a tall collar, straps of bright metal meeting at an emblem lit in his colour, a belt.
    if (torso && chestBone) {
      const base = place(chestBone.getWorldPosition(new Vector3()));
      const breast =
        hit(v(base.x, base.y + H * 0.07, H * 2), v(0, 0, -1)) ?? v(base.x, base.y + H * 0.07, base.z + H * 0.07);
      const emblem = breast.clone().add(v(0, 0, 0.012 * H));
      for (const side of [-1, 1]) {
        rod(SILVER, torso, emblem, emblem.clone().add(v(side * 0.085 * H, 0.1 * H, -0.02 * H)), 0.007 * H);
        rod(SILVER, torso, emblem, emblem.clone().add(v(side * 0.07 * H, -0.09 * H, -0.01 * H)), 0.006 * H);
        ball(
          PLATE,
          torso,
          emblem.clone().add(v(side * 0.05 * H, 0.03 * H, -0.006 * H)),
          v(0.035 * H, 0.05 * H, 0.012 * H),
          -side * 0.5,
        );
      }
      ball(SILVER, torso, emblem, v(0.03 * H, 0.04 * H, 0.012 * H), Math.PI / 4);
      ball(lit, torso, emblem.clone().add(v(0, 0, 0.008 * H)), v(0.016 * H, 0.022 * H, 0.008 * H), Math.PI / 4);
      glow(torso, accent, 0.2 * H, emblem.clone().add(v(0, 0, 0.03 * H)), 0.4);
      if (neckAt) {
        const collar = new Mesh(new CylinderGeometry(0.062 * H, 0.05 * H, 0.05 * H, 12, 1, true), PLATE);
        collar.position.set(neckAt.x, neckAt.y + 0.005 * H, neckAt.z - 0.01 * H);
        torso.add(collar);
      }
    }

    // Vambraces with a fin sweeping back past each elbow.
    for (const [lower, fist] of [
      ['LowerArmL', 'FistL'],
      ['LowerArmR', 'FistR'],
    ]) {
      const holder = ride(lower);
      const elbow = at(lower);
      const wrist = at(fist);
      if (!holder || !elbow || !wrist) continue;
      const along = wrist.clone().sub(elbow);
      const mid = elbow.clone().lerp(wrist, 0.5);
      const out = Math.sign(elbow.x - middle.x) || 1;
      rod(PLATE, holder, elbow.clone().lerp(wrist, 0.15), elbow.clone().lerp(wrist, 0.85), 0.03 * H);
      for (const t of [0.2, 0.8])
        rod(SILVER, holder, elbow.clone().lerp(wrist, t - 0.03), elbow.clone().lerp(wrist, t + 0.03), 0.033 * H);
      if (kind === 'warrior' || kind === 'ranger') {
        spike(
          PLATE,
          holder,
          mid.clone().add(v(out * 0.02 * H, 0, -0.02 * H)),
          along
            .clone()
            .negate()
            .normalize()
            .add(v(out * 0.5, 0.3, -0.6)),
          0.14 * H,
          0.022 * H,
          0.35,
        );
        spike(
          SILVER,
          holder,
          mid.clone().add(v(out * 0.025 * H, 0, -0.02 * H)),
          along
            .clone()
            .negate()
            .normalize()
            .add(v(out * 0.5, 0.3, -0.6)),
          0.09 * H,
          0.009 * H,
          0.5,
        );
      }
    }

    // The shield on the left forearm: a tall kite cut with a notched head and a long point, dark
    // plate on a wider leaf of bright metal, barred, with a boss lit in his colour and a spike on it.
    const shieldArm = ride('LowerArmL');
    const elbowL = at('LowerArmL');
    const wristL = at('FistL');
    if (kind === 'warrior' && shieldArm && elbowL && wristL) {
      const out = Math.sign(elbowL.x - middle.x) || 1;
      const S = 0.3 * H;
      const shieldCut = (grow: number) => {
        const shape = new Shape();
        const points: [number, number][] = [
          [-0.5, 0.55],
          [-0.2, 0.44],
          [0, 0.62],
          [0.2, 0.44],
          [0.5, 0.55],
          [0.46, 0.05],
          [0.28, -0.4],
          [0, -0.85],
          [-0.28, -0.4],
          [-0.46, 0.05],
        ];
        points.forEach(([x, y], i) => {
          const [px, py] = [x * S * grow, (y + 0.1) * S * grow];
          if (i === 0) shape.moveTo(px, py);
          else shape.lineTo(px, py);
        });
        return new ExtrudeGeometry(shape, { depth: 0.018 * H, bevelEnabled: false });
      };
      const shield = new Group();
      shield.position
        .copy(elbowL)
        .lerp(wristL, 0.55)
        .add(v(out * 0.06 * H, 0.02 * H, 0.03 * H));
      // Its face looks out from the body and a little forward; its long axis stands upright.
      const face = v(out, 0, 0.45).normalize();
      const across = new Vector3().crossVectors(UP_AXIS, face).normalize();
      shield.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(across, UP_AXIS, face));
      shieldArm.add(shield);
      const plate = new Mesh(shieldCut(1), FACETED);
      shield.add(plate);
      const edge = new Mesh(shieldCut(1.1), SILVER);
      edge.position.z = -0.012 * H;
      shield.add(edge);
      const front = 0.02 * H;
      for (const side of [-1, 1]) {
        rod(SILVER, shield, v(0, 0.03 * S, front), v(side * 0.4 * S, 0.5 * S, front), 0.012 * H);
        rod(SILVER, shield, v(0, 0.03 * S, front), v(side * 0.3 * S, -0.3 * S, front), 0.01 * H);
      }
      rod(SILVER, shield, v(0, 0.03 * S, front), v(0, -0.68 * S, front), 0.012 * H);
      ball(SILVER, shield, v(0, 0.05 * S, front), v(0.13 * S, 0.13 * S, 0.03 * H));
      ball(lit, shield, v(0, 0.05 * S, front + 0.012 * H), v(0.07 * S, 0.07 * S, 0.02 * H));
      spike(SILVER, shield, v(0, 0.05 * S, front + 0.01 * H), v(0, 0, 1), 0.07 * H, 0.014 * H, 1, 4);
      glow(shield, accent, 0.22 * H, v(0, 0.05 * S, front + 0.05 * H), 0.35);
    }

    /**
     * A cloak from the shoulders: a yoke of plate across the back and three long tails under it, the
     * middle one longest. Lengths and widths are in parts of the wearer's height.
     */
    const cape = (mid: number, side: number, wide: number, apart: number) => {
      const spine = at('Torso');
      if (!torso || !spine) return;
      const yoke = spine.clone().add(v(0, 0.1 * H, -0.055 * H));
      ball(PLATE, torso, yoke, v(0.13 * H, 0.03 * H, 0.05 * H));
      ball(SILVER, torso, yoke.clone().add(v(0, -0.01 * H, 0)), v(0.137 * H, 0.022 * H, 0.055 * H));
      for (const x of [-1, 0, 1])
        swaying.push({
          part: tail(
            kit,
            torso,
            yoke.clone().add(v(x * apart * H, -0.01 * H, -0.01 * H)),
            v(x * 0.58, 0, -1),
            (x === 0 ? mid : side) * H,
            wide * H,
            1.75,
            0.2,
          ),
          rest: -0.2,
          phase: x * 1.3,
        });
    };
    /** A plate over each knee with a spur of bright metal. */
    const kneeGuards = () => {
      for (const name of ['LowerLegL', 'LowerLegR']) {
        const leg = ride(name);
        const knee = at(name);
        if (!leg || !knee) continue;
        ball(PLATE, leg, knee.clone().add(v(0, -0.01 * H, 0.03 * H)), v(0.035 * H, 0.045 * H, 0.025 * H));
        spike(SILVER, leg, knee.clone().add(v(0, 0.01 * H, 0.045 * H)), v(0, 1, 0.5), 0.07 * H, 0.014 * H, 0.5, 4);
      }
    };

    if (kind === 'cleric') {
      // The same cut as the others, in ivory and gold, and nothing of her own taken away: a cloak
      // behind, guards at the knee, and lights that circle her halo.
      cape(0.62, 0.52, 0.105, 0.072);
      kneeGuards();
      if (head && neckAt) {
        const motes = new Group();
        motes.position.set(neckAt.x, crown + H * 0.05, neckAt.z);
        head.add(motes);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const where = v(Math.sin(a) * 0.13 * H, 0, Math.cos(a) * 0.13 * H);
          spike(lit, motes, where, v(0, 1, 0), 0.035 * H, 0.011 * H, 1, 4);
          spike(lit, motes, where, v(0, -1, 0), 0.035 * H, 0.011 * H, 1, 4);
        }
        turning.push({ part: motes, axis: 'y', speed: 1.2 });
      }
    }

    if (kind === 'wizard') {
      /** A flat slab, for the boards and leaves of the book. */
      const slab = (
        material: MeshStandardMaterial | MeshBasicMaterial,
        parent: Object3D,
        at: Vector3,
        size: Vector3,
      ) => {
        const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
        mesh.position.copy(at);
        parent.add(mesh);
        return mesh;
      };
      /** A frame at the fist that looks along the forearm: x across, y over, z out past the knuckles. */
      const past = (lower: string, fistName: string): Group | null => {
        const fore = ride(lower);
        const elbow = at(lower);
        const fist = at(fistName);
        if (!fore || !elbow || !fist) return null;
        const aim = fist.clone().sub(elbow).normalize();
        const across = new Vector3().crossVectors(UP_AXIS, aim);
        if (across.lengthSq() < 0.01) across.set(1, 0, 0);
        across.normalize();
        const over = new Vector3().crossVectors(aim, across).normalize();
        const frame = new Group();
        frame.position.copy(fist);
        frame.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(across, over, aim));
        fore.add(frame);
        return frame;
      };
      const U = H * 1.25;

      // Over the right hand an orb: a heart of light in a cage of two turning rings, sparks circling
      // it, held up on three claws of bright metal.
      const right = past('LowerArmR', 'FistR');
      if (right) {
        const orbAt = v(0, 0.05 * U, 0.12 * U);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          spike(
            SILVER,
            right,
            v(Math.cos(a) * 0.02 * U, 0.01 * U, 0.03 * U + Math.sin(a) * 0.02 * U),
            v(Math.cos(a) * 0.5, 0.6, 1 + Math.sin(a) * 0.5),
            0.085 * U,
            0.01 * U,
            0.6,
            4,
          );
        }
        ball(lit, right, orbAt, v(0.05 * U, 0.05 * U, 0.05 * U));
        const shell = new Mesh(
          new SphereGeometry(0.062 * U, 8, 5),
          new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false }),
        );
        shell.position.copy(orbAt);
        right.add(shell);
        for (const [tilt, speed] of [
          [0.6, 1.8],
          [-0.9, -1.3],
        ]) {
          const cage = new Group();
          cage.position.copy(orbAt);
          cage.rotation.set(tilt, 0, tilt * 0.7);
          right.add(cage);
          const ring = new Group();
          cage.add(ring);
          const hoop = new Mesh(new TorusGeometry(0.082 * U, 0.006 * U, 4, 18), SILVER);
          hoop.rotation.x = Math.PI / 2;
          ring.add(hoop);
          ball(lit, ring, v(0.082 * U, 0, 0), v(0.012 * U, 0.012 * U, 0.012 * U));
          ball(lit, ring, v(-0.082 * U, 0, 0), v(0.009 * U, 0.009 * U, 0.009 * U));
          turning.push({ part: ring, axis: 'y', speed });
        }
        glow(right, accent, 0.36 * U, orbAt, 0.55);
      }

      // Over the left hand a book lying open in the air: two boards of plate cornered in bright
      // metal, white leaves, lines of writing that burn, and a ribbon of light hanging from the spine.
      const left = past('LowerArmL', 'FistL');
      if (left) {
        const book = new Group();
        book.position.set(0, 0.07 * U, 0.1 * U);
        // Tipped up toward the reader.
        book.rotation.set(-0.75, 0, 0);
        left.add(book);
        for (const side of [-1, 1]) {
          const half = new Group();
          half.rotation.z = side * 0.28;
          book.add(half);
          const x = side * 0.062 * U;
          slab(PLATE, half, v(x, 0, 0), v(0.12 * U, 0.014 * U, 0.16 * U));
          slab(WHITE, half, v(x, 0.011 * U, 0), v(0.108 * U, 0.012 * U, 0.146 * U));
          for (let line = 0; line < 4; line++)
            slab(
              lit,
              half,
              v(x, 0.018 * U, (line - 1.5) * 0.03 * U),
              v(0.08 * U - (line % 2) * 0.02 * U, 0.003 * U, 0.008 * U),
            );
          for (const fore of [-1, 1])
            ball(SILVER, half, v(side * 0.115 * U, 0.002 * U, fore * 0.072 * U), v(0.012 * U, 0.01 * U, 0.012 * U));
        }
        slab(SILVER, book, v(0, -0.004 * U, 0), v(0.016 * U, 0.02 * U, 0.165 * U));
        spike(lit, book, v(0, -0.01 * U, -0.07 * U), v(0, -1, -0.3), 0.1 * U, 0.012 * U, 0.3, 4);
        glow(book, accent, 0.3 * U, v(0, 0.06 * U, 0), 0.4);
      }

      // A long mantle behind, as the hunter has, and shards of starlight circling the waist.
      cape(0.68, 0.58, 0.11, 0.075);
      const spine = at('Torso');
      if (torso && spine) {
        const stars = new Group();
        stars.position.copy(spine).add(v(0, -0.04 * H, 0));
        torso.add(stars);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const where = v(Math.sin(a) * 0.24 * H, (i % 2) * 0.05 * H, Math.cos(a) * 0.24 * H);
          spike(lit, stars, where, v(0, 1, 0), 0.04 * H, 0.012 * H, 1, 4);
          spike(lit, stars, where, v(0, -1, 0), 0.04 * H, 0.012 * H, 1, 4);
        }
        turning.push({ part: stars, axis: 'y', speed: 0.9 });
      }
    }

    if (kind === 'ranger') {
      // A hunter's cloak from the shoulders to the calf: a yoke of plate across the back and three
      // long tails under it, the middle one longest.
      cape(0.6, 0.5, 0.1, 0.07);
      // Over the plated shoulder a mantle of feathers, fanned down the arm.
      const mantle = ride('ShoulderL');
      const joint = at('UpperArmL');
      if (mantle && joint) {
        const out = Math.sign(joint.x - middle.x) || 1;
        for (let i = 0; i < 6; i++)
          spike(
            i % 2 ? SILVER : FACETED,
            mantle,
            joint.clone().add(v(out * 0.035 * H, 0.03 * H, (i - 2.5) * 0.012 * H)),
            v(out, -0.25 - (i % 3) * 0.3, (i - 2.5) * 0.4),
            (0.2 - (i % 3) * 0.03) * H,
            0.034 * H,
            0.2,
            4,
          );
      }
      // The crossbow lies along her right forearm and past the fist, so it points where the arm does.
      const fore = ride('LowerArmR');
      const elbow = at('LowerArmR');
      const fist = at('FistR');
      if (fore && elbow && fist) {
        const aim = fist.clone().sub(elbow).normalize();
        const across = new Vector3().crossVectors(UP_AXIS, aim);
        if (across.lengthSq() < 0.01) across.set(1, 0, 0);
        across.normalize();
        const over = new Vector3().crossVectors(aim, across).normalize();
        const bow = new Group();
        bow.position.copy(fist);
        bow.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(across, over, aim));
        fore.add(bow);
        // Drawn large for her size, as everything is here: it has to read from high above.
        const U = H * 1.3;
        const nose = v(0, 0.03 * U, 0.2 * U);
        const latch = v(0, 0.045 * U, 0.0);
        rod(PLATE, bow, v(0, 0.03 * U, -0.12 * U), nose, 0.016 * U).scale.x = 1.5;
        rod(SILVER, bow, v(0, 0.03 * U, -0.12 * U), v(0, -0.01 * U, -0.16 * U), 0.018 * U);
        for (const side of [-1, 1]) {
          const tip = v(side * 0.16 * U, 0.03 * U, 0.12 * U);
          spike(
            FACETED,
            bow,
            nose.clone().add(v(side * 0.012 * U, 0, 0)),
            tip.clone().sub(nose),
            0.18 * U,
            0.026 * U,
            0.45,
            4,
          );
          spike(SILVER, bow, tip, v(side * 0.5, 0, 1), 0.05 * U, 0.01 * U, 1, 4);
          rod(SILVER, bow, tip, latch, 0.004 * U);
        }
        const stirrup = new Mesh(new TorusGeometry(0.024 * U, 0.006 * U, 4, 10), SILVER);
        stirrup.position.copy(nose).add(v(0, 0, 0.024 * U));
        stirrup.rotation.y = Math.PI / 2;
        bow.add(stirrup);
        // A blade under the nose, a sight on top with a point of light in it, and the bolt itself, burning.
        spike(SILVER, bow, v(0, 0.005 * U, 0.14 * U), v(0, -0.25, 1), 0.14 * U, 0.016 * U, 0.3, 4);
        rod(SILVER, bow, v(0, 0.065 * U, -0.03 * U), v(0, 0.065 * U, 0.06 * U), 0.008 * U);
        ball(lit, bow, v(0, 0.065 * U, 0.065 * U), v(0.012 * U, 0.012 * U, 0.012 * U));
        rod(lit, bow, latch, v(0, 0.048 * U, 0.24 * U), 0.006 * U);
        spike(lit, bow, v(0, 0.048 * U, 0.24 * U), v(0, 0, 1), 0.06 * U, 0.015 * U, 1, 4);
        glow(bow, accent, 0.3 * U, v(0, 0.048 * U, 0.28 * U), 0.5);
      }
      // Bolts in a case on the right thigh, fletched in light.
      const thigh = ride('UpperLegR');
      const hipR = at('UpperLegR');
      if (thigh && hipR) {
        const out = Math.sign(hipR.x - middle.x) || 1;
        const mouth = hipR.clone().add(v(out * 0.055 * H, 0.0, 0.01 * H));
        const foot = mouth.clone().add(v(out * 0.01 * H, -0.15 * H, -0.02 * H));
        rod(PLATE, thigh, mouth, foot, 0.026 * H);
        for (const t of [0.08, 0.92])
          rod(SILVER, thigh, mouth.clone().lerp(foot, t - 0.05), mouth.clone().lerp(foot, t + 0.05), 0.029 * H);
        const up = mouth.clone().sub(foot).normalize();
        for (let i = 0; i < 4; i++) {
          const from = mouth.clone().add(v((i % 2) * 0.012 * H * out, 0, (i - 1.5) * 0.01 * H));
          spike(lit, thigh, from, up, 0.06 * H, 0.012 * H, 0.3, 4);
        }
      }
      kneeGuards();
    }

    // The coat: a belt, two long tails behind from the hips, and a tail on each thigh that swings with the leg.
    const hips = ride('Hips');
    const hipAt = at('Hips');
    if (hips && hipAt) {
      const belt = new Mesh(new TorusGeometry(0.078 * H, 0.014 * H, 6, 20), PLATE);
      belt.position.copy(hipAt).add(v(0, 0.02 * H, 0));
      belt.rotation.x = Math.PI / 2;
      belt.scale.set(1, 0.78, 1);
      hips.add(belt);
      ball(SILVER, hips, hipAt.clone().add(v(0, 0.02 * H, 0.064 * H)), v(0.024 * H, 0.03 * H, 0.01 * H), Math.PI / 4);
      ball(lit, hips, hipAt.clone().add(v(0, 0.02 * H, 0.072 * H)), v(0.011 * H, 0.014 * H, 0.006 * H), Math.PI / 4);
      for (const side of cut.back > 0 ? [-1, 1] : [])
        swaying.push({
          part: tail(
            kit,
            hips,
            hipAt.clone().add(v(side * 0.045 * H, 0.01 * H, -0.05 * H)),
            v(side * 0.3, 0, -1),
            cut.back * H,
            0.085 * H,
            1.5,
            0.16,
          ),
          rest: -0.16,
          phase: side,
        });
    }
    for (const name of ['UpperLegL', 'UpperLegR']) {
      const holder = ride(name);
      const top = at(name);
      if (!holder || !top) continue;
      const out = Math.sign(top.x - middle.x) || 1;
      swaying.push({
        part: tail(
          kit,
          holder,
          top.clone().add(v(out * 0.04 * H, 0.03 * H, -0.005 * H)),
          v(out, 0, -0.15),
          cut.thigh * H,
          0.075 * H,
          1.45,
          0.12,
        ),
        rest: -0.12,
        phase: out * 2,
      });
      if (cut.front > 0)
        tail(
          kit,
          holder,
          top.clone().add(v(out * 0.012 * H, 0.03 * H, 0.045 * H)),
          v(out * 0.45, 0, 1),
          cut.front * H,
          0.05 * H,
          1.3,
          0.1,
        );
    }
  }

  let time = 0;
  return (delta: number) => {
    time += delta;
    for (const turn of turning) turn.part.rotation[turn.axis] += delta * turn.speed;
    // The tails of the coat stir a little, each to its own beat.
    for (const sway of swaying) sway.part.rotation.x = sway.rest + Math.sin(time * 1.7 + sway.phase) * 0.05;
  };
}
