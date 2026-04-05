export { initScene, initBasicScene, startRenderLoop } from './scene';
export type { SceneOptions, SceneResult } from './scene';

export {
  addGlowWire,
  createLinearFlow,
  createArcParticles,
  pulseEmissive,
  createGlowingMaterial,
} from './electricFlow';
export type { GlowWireOptions, FlowParticleSystem } from './electricFlow';

export {
  buildBox,
  buildCylinder,
  buildUtilityPole,
  buildMCBPanel,
  buildFloor,
  buildHouseWalls,
} from './modelBuilders';
export type { BoxSpec } from './modelBuilders';

export { createInteractionManager } from './interactions';
export type { InteractionManager, ClickHandler, HoverHandler } from './interactions';
