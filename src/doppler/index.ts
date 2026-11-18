/**
 * An optional Doppler `ConfigProvider` for a key list. Published only at
 * `@fantastic.dev/effect-config/doppler`, so apps that do not import this
 * subpath never bundle the Doppler client.
 *
 * @since 0.1.0
 */
export { DopplerConfigError, DopplerConfigErrorReason } from "./error.ts"
export {
  DopplerSecrets,
  type DopplerSelection,
  layerDoppler,
  type LayerDopplerOptions,
  layerDopplerSecrets,
  makeDopplerConfigProvider
} from "./provider.ts"
export { type DopplerEnvironment, type StageTable, stageToConfig } from "./stage.ts"
