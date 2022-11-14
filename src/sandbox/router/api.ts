import type {
  Func,
  Router,
  RouterTarget,
  navigationMethod,
  MicroLocation,
  RouterGuard,
  GuardLocation,
  AccurateGuard,
  SetDefaultPageOptions,
  AttachAllToURLParam,
} from '@micro-app/types'
import {
  encodeMicroPath,
  decodeMicroPath,
  setMicroPathToURL,
  setMicroState,
  getMicroState,
  getMicroPathFromURL,
} from './core'
import {
  logError,
  logWarn,
  formatAppName,
  createURL,
  isFunction,
  isPlainObject,
  useSetRecord,
  useMapRecord,
  requestIdleCallback,
  isString,
  noopFalse,
  removeDomScope,
  isObject,
} from '../../libs/utils'
import { appInstanceMap } from '../../create_app'
import { getActiveApps } from '../../micro_app'
import globalEnv from '../../libs/global_env'
import { attachRouteToBrowserURL, navigateWithRawHistory } from './history'
import bindFunctionToRawObject from '../bind_function'

export interface RouterApi {
  router: Router,
  executeNavigationGuard: (appName: string, to: GuardLocation, from: GuardLocation) => void
  clearRouterWhenUnmount: (appName: string) => void
}

export interface CreteBaseRouter {
  setBaseAppRouter (baseRouter: unknown): void
  getBaseAppRouter(): unknown
}

export interface CreateDefaultPage {
  setDefaultPage(options: SetDefaultPageOptions): () => boolean
  removeDefaultPage(appName: string): boolean
  getDefaultPage(key: PropertyKey): string | void
}

function createRouterApi (): RouterApi {
  /**
   * create method of router.push/replace
   * NOTE:
   * 1. The same fullPath will be blocked
   * 2. name & path is required
   * 3. path is fullPath except for the domain (the domain can be taken, but not valid)
   * @param replace use router.replace?
   */
  function createNavigationMethod (replace: boolean): navigationMethod {
    return function (to: RouterTarget): void {
      const appName = formatAppName(to.name)
      if (appName && isString(to.path)) {
        const app = appInstanceMap.get(appName)
        if (app && (!app.sandBox || !app.useMemoryRouter)) {
          return logError(`navigation failed, memory router of app ${appName} is closed`)
        }
        // active apps, include hidden keep-alive app
        if (getActiveApps({ excludePreRender: true }).includes(appName)) {
          const microLocation = app!.sandBox!.proxyWindow.location as MicroLocation
          const targetLocation = createURL(to.path, microLocation.href)
          // Only get path data, even if the origin is different from microApp
          const targetFullPath = targetLocation.pathname + targetLocation.search + targetLocation.hash
          if (microLocation.fullPath !== targetFullPath || getMicroPathFromURL(appName) !== targetFullPath) {
            const methodName = (replace && to.replace !== false) || to.replace === true ? 'replaceState' : 'pushState'
            navigateWithRawHistory(appName, methodName, targetLocation, to.state)
          }
        } else {
          /**
           * app not exit or unmounted, update browser URL with replaceState
           * use base app location.origin as baseURL
           */
          const rawLocation = globalEnv.rawWindow.location
          const targetLocation = createURL(to.path, rawLocation.origin)
          const targetFullPath = targetLocation.pathname + targetLocation.search + targetLocation.hash
          if (getMicroPathFromURL(appName) !== targetFullPath) {
            navigateWithRawHistory(
              appName,
              to.replace === false ? 'pushState' : 'replaceState',
              targetLocation,
              to.state,
            )
          }
        }
      } else {
        logError(`navigation failed, name & path are required when use router.${replace ? 'replace' : 'push'}`)
      }
    }
  }

  // create method of router.go/back/forward
  function createRawHistoryMethod (methodName: string): Func {
    return function (...rests: unknown[]): void {
      return globalEnv.rawWindow.history[methodName](...rests)
    }
  }

  const beforeGuards = useSetRecord<RouterGuard>()
  const afterGuards = useSetRecord<RouterGuard>()

  /**
   * run all of beforeEach/afterEach guards
   * NOTE:
   * 1. Modify browser url first, and then run guards,
   *    consistent with the browser forward & back button
   * 2. Prevent the element binding
   * @param appName app name
   * @param to target location
   * @param from old location
   * @param guards guards list
   */
  function runGuards (
    appName: string,
    to: GuardLocation,
    from: GuardLocation,
    guards: Set<RouterGuard>,
  ) {
    // clear element scope before execute function of parent
    removeDomScope()
    for (const guard of guards) {
      if (isFunction(guard)) {
        guard(to, from, appName)
      } else if (isPlainObject(guard) && isFunction((guard as AccurateGuard)[appName])) {
        guard[appName](to, from)
      }
    }
  }

  /**
   * global hook for router
   * update router information base on microLocation
   * @param appName app name
   * @param microLocation location of microApp
   */
  function executeNavigationGuard (
    appName: string,
    to: GuardLocation,
    from: GuardLocation,
  ): void {
    router.current.set(appName, to)

    runGuards(appName, to, from, beforeGuards.list())

    requestIdleCallback(() => {
      runGuards(appName, to, from, afterGuards.list())
    })
  }

  function clearRouterWhenUnmount (appName: string): void {
    router.current.delete(appName)
  }

  /**
   * NOTE:
   * 1. sandbox not open
   * 2. useMemoryRouter is false
   */
  function commonHandlerForAttachToURL (appName: string): void {
    const app = appInstanceMap.get(appName)!
    if (app.sandBox && app.useMemoryRouter) {
      attachRouteToBrowserURL(
        appName,
        setMicroPathToURL(appName, app.sandBox.proxyWindow.location as MicroLocation),
        setMicroState(appName, getMicroState(appName)),
      )
    }
  }

  /**
   * Attach specified active app router info to browser url
   * @param appName app name
   */
  function attachToURL (appName: string): void {
    appName = formatAppName(appName)
    if (appName && getActiveApps().includes(appName)) {
      commonHandlerForAttachToURL(appName)
    }
  }

  /**
   * Attach all active app router info to browser url
   * @param includeHiddenApp include hidden keep-alive app
   * @param includePreRender include preRender app
   */
  function attachAllToURL ({
    includeHiddenApp = false,
    includePreRender = false,
  }: AttachAllToURLParam): void {
    getActiveApps({
      excludeHiddenApp: !includeHiddenApp,
      excludePreRender: !includePreRender,
    }).forEach(appName => commonHandlerForAttachToURL(appName))
  }

  function createDefaultPageApi (): CreateDefaultPage {
    // defaultPage data
    const defaultPageRecord = useMapRecord<string>()

    /**
     * defaultPage only effect when mount, and has lower priority than query on browser url
     * SetDefaultPageOptions {
     *   @param name app name
     *   @param path page path
     * }
     */
    function setDefaultPage (options: SetDefaultPageOptions): () => boolean {
      const appName = formatAppName(options.name)
      if (!appName || !options.path) {
        if (__DEV__) {
          if (!appName) {
            logWarn(`setDefaultPage: invalid appName "${appName}"`)
          } else {
            logWarn('setDefaultPage: path is required')
          }
        }
        return noopFalse
      }

      return defaultPageRecord.add(appName, options.path)
    }

    function removeDefaultPage (appName: string): boolean {
      appName = formatAppName(appName)
      if (!appName) return false

      return defaultPageRecord.delete(appName)
    }

    return {
      setDefaultPage,
      removeDefaultPage,
      getDefaultPage: defaultPageRecord.get,
    }
  }

  function createBaseRouterApi (): CreteBaseRouter {
    /**
     * Record base app router, let child app control base app navigation
     */
    let baseRouterProxy: unknown = null
    function setBaseAppRouter (baseRouter: unknown): void {
      if (isObject(baseRouter)) {
        baseRouterProxy = new Proxy(baseRouter, {
          get (target: History, key: PropertyKey): unknown {
            removeDomScope()
            const rawValue = Reflect.get(target, key)
            return isFunction(rawValue) ? bindFunctionToRawObject(target, rawValue, 'BASEROUTER') : rawValue
          },
          set (target: History, key: PropertyKey, value: unknown): boolean {
            Reflect.set(target, key, value)
            return true
          }
        })
      } else if (__DEV__) {
        logWarn('setBaseAppRouter: Invalid base router')
      }
    }

    return {
      setBaseAppRouter,
      getBaseAppRouter: () => baseRouterProxy,
    }
  }

  // Router API for developer
  const router: Router = {
    current: new Map<string, MicroLocation>(),
    encode: encodeMicroPath,
    decode: decodeMicroPath,
    push: createNavigationMethod(false),
    replace: createNavigationMethod(true),
    go: createRawHistoryMethod('go'),
    back: createRawHistoryMethod('back'),
    forward: createRawHistoryMethod('forward'),
    beforeEach: beforeGuards.add,
    afterEach: afterGuards.add,
    attachToURL,
    attachAllToURL,
    ...createDefaultPageApi(),
    ...createBaseRouterApi(),
  }

  return {
    router,
    executeNavigationGuard,
    clearRouterWhenUnmount,
  }
}

export const {
  router,
  executeNavigationGuard,
  clearRouterWhenUnmount,
} = createRouterApi()
