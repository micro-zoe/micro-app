import type {
  microAppWindowType,
  MicroLocation,
} from '@micro-app/types'
import {
  createMicroLocation,
  updateMicroLocation,
} from '../router/location'
import {
  createMicroHistory,
} from '../router/history'
import {
  assign,
  createURL,
} from '../../libs/utils'
import globalEnv from '../../libs/global_env'

export function patchRouter (
  appName: string,
  url: string,
  microAppWindow: microAppWindowType,
  browserHost: string,
): MicroLocation {
  const childStaticLocation = createURL(url)
  const childHost = childStaticLocation.protocol + '//' + childStaticLocation.host
  const childFullPath = childStaticLocation.pathname + childStaticLocation.search + childStaticLocation.hash

  // rewrite microAppWindow.history
  const rawLocation = globalEnv.rawWindow.location
  const microHistory = microAppWindow.history
  microAppWindow.rawReplaceState = microHistory.replaceState
  assign(microHistory, {
    ...createMicroHistory(appName, microAppWindow.location),
    go (delta?: number) {
      return delta != null && +delta
        ? microHistory.go(delta)
        : rawLocation.reload()
    },
  })

  /**
   * Init microLocation before exec sandbox.start
   * NOTE:
   *  1. exec updateMicroLocation after patch microHistory
   *  2. sandbox.start will sync microLocation info to browser url
   */
  updateMicroLocation(
    appName,
    childFullPath,
    microAppWindow.location,
    'prevent'
  )

  // create proxyLocation
  return createMicroLocation(
    appName,
    url,
    microAppWindow,
    childStaticLocation,
    browserHost,
    childHost,
  )
}
