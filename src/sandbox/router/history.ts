/* eslint-disable no-void */
import type {
  MicroState,
  MicroLocation,
  MicroHistory,
  HistoryProxyValue,
  HandleMicroPathResult,
} from '@micro-app/types'
import globalEnv from '../../libs/global_env'
import {
  isString,
  createURL,
  isPlainObject,
  isURL,
  assign,
  removeDomScope,
  isFunction,
} from '../../libs/utils'
import {
  setMicroPathToURL,
  setMicroState,
  getMicroState,
  getMicroPathFromURL,
  isEffectiveApp,
  isRouterModePure,
  isRouterModeSearch,
  isRouterModeState,
} from './core'
import { dispatchNativeEvent } from './event'
import { updateMicroLocation } from './location'
import bindFunctionToRawTarget from '../bind_function'
import { getActiveApps } from '../../micro_app'
import { appInstanceMap, isIframeSandbox } from '../../create_app'

/**
 * create proxyHistory for microApp
 * MDN https://developer.mozilla.org/en-US/docs/Web/API/History
 * @param appName app name
 * @param microLocation microApp location(with: proxyLocation iframe: iframeWindow.location)
 */
export function createMicroHistory (appName: string, microLocation: MicroLocation): MicroHistory {
  const rawHistory = globalEnv.rawWindow.history
  function getMicroHistoryMethod (methodName: string): CallableFunction {
    return function (...rests: any[]): void {
      // TODO: 测试iframe的URL兼容isURL的情况
      if (isString(rests[2]) || isURL(rests[2])) {
        const targetLocation = createURL(rests[2], microLocation.href)
        const targetFullPath = targetLocation.pathname + targetLocation.search + targetLocation.hash
        if (!isRouterModePure(appName)) {
          navigateWithNativeEvent(
            appName,
            methodName,
            setMicroPathToURL(appName, targetLocation),
            true,
            setMicroState(appName, rests[0], targetLocation),
            rests[1],
          )
        }
        if (targetFullPath !== microLocation.fullPath) {
          updateMicroLocation(appName, targetFullPath, microLocation)
        }
        appInstanceMap.get(appName)?.sandBox.updateIframeBase?.()
      } else {
        nativeHistoryNavigate(appName, methodName, rests[2], rests[0], rests[1])
      }
    }
  }

  const pushState = getMicroHistoryMethod('pushState')
  const replaceState = getMicroHistoryMethod('replaceState')

  if (isIframeSandbox(appName)) {
    return {
      pushState,
      replaceState,
      go (delta?: number) {
        return rawHistory.go(delta)
      }
    } as MicroHistory
  }

  // TODO: history的state 会有两个历史栈？？待解决
  const customPushStateMap = new Map()
  const customReplaceStateMap = new Map()
  // 收集
  function gatherCustomState (key: string, value: unknown) {
    if (key === 'pushState') {
      const originStateValue = (customPushStateMap.get(key) || [])
      originStateValue.push(value)
      customPushStateMap.set(key, originStateValue)
    }
    if (key === 'replaceState') {
      const originStateValue = (customReplaceStateMap.get(key) || [])
      originStateValue.push(value)
      customReplaceStateMap.set(key, originStateValue)
    }
  }

  // 执行
  function executeCustomState (key: string) {
    if (key === 'pushState') {
      const originStateValue = (customPushStateMap.get(key) || [])
      originStateValue?.forEach((item: unknown) => {
        if (item && isFunction(item)) item()
      })
    }
    if (key === 'replaceState') {
      const originStateValue = (customReplaceStateMap.get(key) || [])
      originStateValue?.forEach((item: unknown) => {
        if (item && isFunction(item)) item()
      })
    }
  }


  return new Proxy(rawHistory, {
    get (target: History, key: PropertyKey): HistoryProxyValue {
      if (key === 'state') {
        return getMicroState(appName)
      } else if (key === 'pushState') {
        executeCustomState(key)
        return pushState
      } else if (key === 'replaceState') {
        executeCustomState(key)
        return replaceState
      }
      return bindFunctionToRawTarget<History, HistoryProxyValue>(Reflect.get(target, key), target, 'HISTORY')
    },
    set (target: History, key: PropertyKey, value: unknown): boolean {
      // 收集
      if (key === 'pushState' || key === 'replaceState') gatherCustomState(key, value)

      Reflect.set(target, key, value)
      /**
       * If the set() method returns false, and the assignment happened in strict-mode code, a TypeError will be thrown.
       * e.g. history.state = {}
       * TypeError: 'set' on proxy: trap returned false for property 'state'
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
  title: unknown = '',
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
 * NOTE:
 *  1. hidden keep-alive app can jump internally, but will not synchronize to browser
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
    // oldHref use for hashChangeEvent of base app
    const oldHref = result.isAttach2Hash && oldFullPath !== result.fullPath ? rawLocation.href : null
    // navigate with native history method
    nativeHistoryNavigate(appName, methodName, result.fullPath, state, title)
    // just search mode will dispatch native event
    if (oldFullPath !== result.fullPath && isRouterModeSearch(appName)) {
      dispatchNativeEvent(appName, onlyForBrowser, oldHref)
    }
  }
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
 * When path is same, keep the __MICRO_APP_STATE__ in history.state
 * Fix bug of missing __MICRO_APP_STATE__ when base app is next.js or angular
 * @param method history.pushState/replaceState
 */
function reWriteHistoryMethod (method: History['pushState' | 'replaceState']): CallableFunction {
  const rawWindow = globalEnv.rawWindow
  return function (...rests: [data: any, unused: string, url?: string]): void {
    if (
      rawWindow.history.state?.__MICRO_APP_STATE__ &&
      (!isPlainObject(rests[0]) || !rests[0].__MICRO_APP_STATE__) &&
      (isString(rests[2]) || isURL(rests[2]))
    ) {
      const currentHref = rawWindow.location.href
      const targetLocation = createURL(rests[2], currentHref)
      if (targetLocation.href === currentHref) {
        rests[0] = assign({}, rests[0], {
          __MICRO_APP_STATE__: rawWindow.history.state.__MICRO_APP_STATE__,
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
      if ((isRouterModeSearch(appName) || isRouterModeState(appName)) && !getMicroPathFromURL(appName)) {
        const app = appInstanceMap.get(appName)!
        attachRouteToBrowserURL(
          appName,
          setMicroPathToURL(appName, app.sandBox.proxyWindow.location as MicroLocation),
          setMicroState(appName, getMicroState(appName), app.sandBox.proxyWindow.location as MicroLocation),
        )
      }
    })
    // fix bug for nest app
    removeDomScope()
  }
}

/**
 * rewrite history.pushState/replaceState
 * used to fix the problem that the __MICRO_APP_STATE__ maybe missing when mainApp navigate to same path
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
