import * as THREE from 'three';

export type ClickHandler = (object: THREE.Object3D) => void;
export type HoverHandler = (object: THREE.Object3D | null) => void;

export interface InteractionManager {
  dispose: () => void;
}

export function createInteractionManager(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  clickables: THREE.Object3D[],
  onClickMap: Map<string, ClickHandler>,
  onHover?: HoverHandler,
): InteractionManager {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered: THREE.Object3D | null = null;

  const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  };

  const cast = (clientX: number, clientY: number): THREE.Object3D | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickables, true);
    if (hits.length === 0) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !onClickMap.has(obj.uuid)) {
      obj = obj.parent;
    }
    return obj ?? hits[0].object;
  };

  const onClick = (e: MouseEvent) => {
    const { x, y } = getPos(e);
    const obj = cast(x, y);
    if (!obj) return;
    const handler = onClickMap.get(obj.uuid);
    if (handler) handler(obj);
  };

  const onTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const obj = cast(touch.clientX, touch.clientY);
    if (!obj) return;
    const handler = onClickMap.get(obj.uuid);
    if (handler) handler(obj);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!onHover) return;
    const obj = cast(e.clientX, e.clientY);
    if (obj !== hovered) {
      hovered = obj;
      onHover(obj);
      renderer.domElement.style.cursor = obj ? 'pointer' : 'default';
    }
  };

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('touchend', onTouchEnd);
  if (onHover) renderer.domElement.addEventListener('mousemove', onMouseMove);

  return {
    dispose: () => {
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.style.cursor = 'default';
    },
  };
}
