/* eslint-disable no-void */
import type {
  MicroState,
  MicroLocation,
  MicroHistory,
  HistoryProxyValue,
  HandleMicroPathResult,
} from '@micro-app/types'
import globalEnv from '../../libs/global_env'
import { isString, createURL, isPlainObject, isURL, assign, isFunction, removeDomScope } from '../../libs/utils'
import { setMicroPathToURL, setMicroState, getMicroState, getMicroPathFromURL, isEffectiveApp } from './core'
import { dispatchNativeEvent } from './event'
import { updateMicroLocation } from './location'
import bindFunctionToRawObject from '../bind_function'
import { getActiveApps } from '../../micro_app'
import { appInstanceMap } from '../../create_app'

/**
 * create proxyHistory for microApp
 * MDN https://developer.mozilla.org/en-US/docs/Web/API/History
 * @param appName app name
 * @param microLocation microApp location
 */
export function createMicroHistory (appName: string, microLocation: MicroLocation): MicroHistory {
  const rawHistory = globalEnv.rawWindow.history
  function getMicroHistoryMethod (methodName: string): CallableFunction {
    return function (...rests: any[]): void {
      if (isString(rests[2]) || isURL(rests[2])) {
        const targetLocation = createURL(rests[2], microLocation.href)
        if (targetLocation.origin === microLocation.origin) {
          navigateWithNativeEvent(
            appName,
            methodName,
            setMicroPathToURL(appName, targetLocation),
            true,
            setMicroState(appName, rests[0]),
            rests[1],
          )
          const targetFullPath = targetLocation.pathname + targetLocation.search + targetLocation.hash
          if (targetFullPath !== microLocation.fullPath) {
            updateMicroLocation(appName, targetFullPath, microLocation)
          }
          return void 0
        }
      }

      nativeHistoryNavigate(appName, methodName, rests[2], rests[0], rests[1])
    }
  }

  const pushState = getMicroHistoryMethod('pushState')
  const replaceState = getMicroHistoryMethod('replaceState')

  return new Proxy(rawHistory, {
    get (target: History, key: PropertyKey): HistoryProxyValue {
      if (key === 'state') {
        return getMicroState(appName)
      } else if (key === 'pushState') {
        return pushState
      } else if (key === 'replaceState') {
        return replaceState
      }
      const rawValue = Reflect.get(target, key)
      return isFunction(rawValue) ? bindFunctionToRawObject(target, rawValue, 'HISTORY') : rawValue
    },
    set (target: History, key: PropertyKey, value: unknown): boolean {
      Reflect.set(target, key, value)
      /**
       * If the set() method returns false, and the assignment happened in strict-mode code, a TypeError will be thrown.
       * e.g. history.state = {}
       * TypeError: 'set' on proxy: trap returned falsish for property 'state'
       */
      return true
    }
  })
}

/**
 * navigate to new path base on native method of history
 * @param appName app.name
 * @param methodName pushState/replaceState
 * @param fullPath full path
 * @param state history.state, default is null
 * @param title history.title, default is ''
 */
export function nativeHistoryNavigate (
  appName: string,
  methodName: string,
  fullPath: string,
  state: unknown = null,
  title = '',
): void {
  if (isEffectiveApp(appName)) {
    const method = methodName === 'pushState' ? globalEnv.rawPushState : globalEnv.rawReplaceState
    method.call(globalEnv.rawWindow.history, state, title, fullPath)
  }
}

/**
 * Navigate to new path, and dispatch native popStateEvent/hashChangeEvent to browser
 * Use scenes:
 * 1. mount/unmount through attachRouteToBrowserURL with limited popstateEvent
 * 2. proxyHistory.pushState/replaceState with limited popstateEvent
 * 3. api microApp.router.push/replace
 * 4. proxyLocation.hash = xxx
 * @param appName app.name
 * @param methodName pushState/replaceState
 * @param result result of add/remove microApp path on browser url
 * @param onlyForBrowser only dispatch event to browser
 * @param state history.state, not required
 * @param title history.title, not required
 */
export function navigateWithNativeEvent (
  appName: string,
  methodName: string,
  result: HandleMicroPathResult,
  onlyForBrowser: boolean,
  state?: unknown,
  title?: string,
): void {
  if (isEffectiveApp(appName)) {
    const rawLocation = globalEnv.rawWindow.location
    const oldFullPath = rawLocation.pathname + rawLocation.search + rawLocation.hash
    const oldHref = result.isAttach2Hash && oldFullPath !== result.fullPath ? rawLocation.href : null
    // navigate with native history method
    nativeHistoryNavigate(appName, methodName, result.fullPath, state, title)
    if (oldFullPath !== result.fullPath) dispatchNativeEvent(appName, onlyForBrowser, oldHref)
  }
}

/**
 * common handler for router.push/router.replace method
 * @param appName app name
 * @param methodName replaceState/pushState
 * @param targetLocation target location
 * @param state to.state
 */
export function navigateWithRawHistory (
  appName: string,
  methodName: string,
  targetLocation: MicroLocation,
  state: unknown,
): void {
  navigateWithNativeEvent(
    appName,
    methodName,
    setMicroPathToURL(
      appName,
      targetLocation,
    ),
    false,
    setMicroState(
      appName,
      state ?? null,
    ),
  )
  // clear element scope after navigate
  removeDomScope()
}

/**
 * update browser url when mount/unmount/hidden/show/attachToURL/attachAllToURL
 * just attach microRoute info to browser, dispatch event to base app(exclude child)
 * @param appName app.name
 * @param result result of add/remove microApp path on browser url
 * @param state history.state
 */
export function attachRouteToBrowserURL (
  appName: string,
  result: HandleMicroPathResult,
  state: MicroState,
): void {
  navigateWithNativeEvent(appName, 'replaceState', result, true, state)
}

/**
 * When path is same, keep the microAppState in history.state
 * Fix bug of missing microAppState when base app is next.js or angular
 * @param method history.pushState/replaceState
 */
function reWriteHistoryMethod (method: History['pushState' | 'replaceState']): CallableFunction {
  const rawWindow = globalEnv.rawWindow
  return function (...rests: [data: any, unused: string, url?: string]): void {
    if (
      rawWindow.history.state?.microAppState &&
      (!isPlainObject(rests[0]) || !rests[0].microAppState) &&
      (isString(rests[2]) || isURL(rests[2]))
    ) {
      const currentHref = rawWindow.location.href
      const targetLocation = createURL(rests[2], currentHref)
      if (targetLocation.href === currentHref) {
        rests[0] = assign({}, rests[0], {
          microAppState: rawWindow.history.state.microAppState,
        })
      }
    }

    method.apply(rawWindow.history, rests)
    /**
     * Attach child router info to browser url when base app navigate with pushState/replaceState
     * NOTE:
     * 1. Exec after apply pushState/replaceState
     * 2. Unable to catch when base app navigate with location
     * 3. When in nest app, rawPushState/rawReplaceState has been modified by parent
     */
    getActiveApps({
      excludeHiddenApp: true,
      excludePreRender: true,
    }).forEach(appName => {
      const app = appInstanceMap.get(appName)!
      if (app.sandBox && app.useMemoryRouter && !getMicroPathFromURL(appName)) {
        attachRouteToBrowserURL(
          appName,
          setMicroPathToURL(appName, app.sandBox.proxyWindow.location as MicroLocation),
          setMicroState(appName, getMicroState(appName)),
        )
      }
    })
    // fix bug for nest app
    removeDomScope()
  }
}

/**
 * rewrite history.pushState/replaceState
 * used to fix the problem that the microAppState maybe missing when mainApp navigate to same path
 * e.g: when nextjs, angular receive popstate event, they will use history.replaceState to update browser url with a new state object
 */
export function patchHistory (): void {
  const rawWindow = globalEnv.rawWindow
  rawWindow.history.pushState = reWriteHistoryMethod(
    globalEnv.rawPushState,
  )
  rawWindow.history.replaceState = reWriteHistoryMethod(
    globalEnv.rawReplaceState,
  )
}

export function releasePatchHistory (): void {
  const rawWindow = globalEnv.rawWindow
  rawWindow.history.pushState = globalEnv.rawPushState
  rawWindow.history.replaceState = globalEnv.rawReplaceState
}
