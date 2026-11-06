import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { pushLog } from '../lib/logger';
import type { OverlayStyle } from './HandOverlay';

const MODEL_URL = `${import.meta.env.BASE_URL}models/ep25_rigged.glb`;
const MODEL_SCALE = 3.536; // cm per model unit (20 in length)

interface PianoModelProps {
  pressedMidi: ReadonlySet<number>;
  pressedPads: ReadonlySet<number>;
  quality: 'high' | 'low';
  overlay: OverlayStyle;
  onMeshClick?: (payload: { kind: 'key'; note: string; midi: number } | { kind: 'pad'; index: number }) => void;
}

const KEY_NOTE_TO_MIDI: Record<string, number> = {
  C4: 60, CSharp4: 61, D4: 62, DSharp4: 63, E4: 64, F4: 65, FSharp4: 66,
  G4: 67, GSharp4: 68, A4: 69, ASharp4: 70, B4: 71, C5: 72, CSharp5: 73,
  D5: 74, DSharp5: 75, E5: 76, F5: 77, FSharp5: 78, G5: 79, GSharp5: 80,
  A5: 81, ASharp5: 82, B5: 83, C6: 84,
};

function midiFromKeyName(name: string): number | undefined {
  return KEY_NOTE_TO_MIDI[name.replace(/^EP25_Key_/, '')];
}

export default function PianoView({ pressedMidi, pressedPads, quality, onMeshClick }: PianoModelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyTargets = useRef(new Map<string, THREE.Object3D>());
  const padTargets = useRef(new Map<number, THREE.Object3D>());
  const pressedRef = useRef(pressedMidi);
  const padRef = useRef(pressedPads);
  const qualityRef = useRef(quality);

  useEffect(() => { pressedRef.current = pressedMidi; }, [pressedMidi]);
  useEffect(() => { padRef.current = pressedPads; }, [pressedPads]);
  useEffect(() => {
    qualityRef.current = quality;
    const canvas = canvasRef.current;
    if (canvas) canvas.classList.toggle('quality-low', quality === 'low');
  }, [quality]);

  useEffect(() => {
    const keyTargetsMap = keyTargets.current;
    const padTargetsMap = padTargets.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#05070d', 18, 46);

    const camera = new THREE.PerspectiveCamera(33, 1, 0.5, 120);
    camera.position.set(0, 24, 34);
    camera.lookAt(0, 0, 1);

    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityRef.current === 'low' ? 1 : 1.5));
    renderer.shadowMap.enabled = qualityRef.current === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambient = new THREE.HemisphereLight(0x7b91bd, 0x0a0c12, 1.35);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.85);
    keyLight.position.set(-10, 28, 11);
    keyLight.castShadow = qualityRef.current === 'high';
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 80;
    scene.add(keyLight);

    const rim = new THREE.DirectionalLight(0x66dfff, 1.15);
    rim.position.set(16, 10, -15);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 80),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = qualityRef.current === 'high';
    scene.add(floor);

    const grid = new THREE.GridHelper(80, 40, 0x1d3440, 0x101a25);
    grid.position.y = -0.1;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.32;
    scene.add(grid);

    const root = new THREE.Group();
    root.name = 'EP25_Root';
    scene.add(root);

    const loader = new GLTFLoader();
    pushLog('info', 'scene', 'Loading rigged EP-25 GLB', { url: MODEL_URL });
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.rotation.x = -Math.PI / 2; // source is authored Z-up; three.js is Y-up
        model.scale.setScalar(MODEL_SCALE);
        model.traverse((obj) => {
          obj.castShadow = true;
          obj.receiveShadow = true;
          if ('name' in obj && typeof obj.name === 'string') {
            if (/^EP25_Key_/.test(obj.name)) keyTargetsMap.set(obj.name, obj);
            const padMatch = /^EP25_Pad_([1-6])$/.exec(obj.name);
            if (padMatch) padTargetsMap.set(Number(padMatch[1]), obj);
          }
        });
        root.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        model.position.sub(bounds.getCenter(new THREE.Vector3()));
        model.position.y += (bounds.max.y - bounds.min.y) / 2 + 0.02;
        root.rotation.y = -0.06;
        pushLog('info', 'scene', 'Rigged GLB loaded', {
          nodes: model.children.length,
          keys: keyTargetsMap.size,
          pads: padTargetsMap.size,
        });
      },
      (event) => {
        if (event.total) pushLog('debug', 'scene', 'GLB loading', { loaded: Math.round(event.loaded / 1024), total: Math.round(event.total / 1024) });
      },
      (error) => pushLog('error', 'scene', 'GLB load failed', error),
    );

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      if (!onMeshClick) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(keyTargetsMap.size || padTargetsMap.size ? [...keyTargetsMap.values(), ...padTargetsMap.values()] : [], true);
      if (hits.length === 0) return;
      const name = hits[0].object?.name ?? '';
      const keyNote = name.replace(/^EP25_Key_/, '');
      const pad = /^EP25_Pad_([1-6])$/.exec(name);
      const midi = midiFromKeyName(name);
      if (midi !== undefined) onMeshClick({ kind: 'key', note: keyNote, midi });
      else if (pad) onMeshClick({ kind: 'pad', index: Number(pad[1]) - 1 });
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = qualityRef.current === 'low' ? 1 : Math.min(2, window.devicePixelRatio || 1);
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      renderer.setPixelRatio(ratio);
      camera.aspect = Math.max(0.1, width / Math.max(1, height));
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const clock = new THREE.Clock();
    clock.start();
    const animate = () => {
      const delta = clock.getDelta();
      const pressed = pressedRef.current;
      for (const [name, object] of keyTargetsMap) {
        const midi = midiFromKeyName(name);
        const target = midi !== undefined && pressed.has(midi) ? 0.065 : 0;
        object.rotation.x += (target - object.rotation.x) * Math.min(1, delta * 11);
      }
      const padsPressed = padRef.current;
      for (const [index, object] of padTargetsMap) {
        const target = padsPressed.has(index - 1) ? 0.28 : 0;
        object.scale.z += (target ? 0.78 : 1 - object.scale.z) * Math.min(1, delta * 12);
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      observer.disconnect();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      keyTargetsMap.clear();
      padTargetsMap.clear();
    };
  }, [onMeshClick]);

  return <canvas className="piano-canvas" ref={canvasRef} aria-label="Interactive EP-25 3D model" />;
}
