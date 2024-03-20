import type {
  microAppWindowType,
  MicroEventListener,
  CommonEffectHook,
} from '@micro-app/types'
import type IframeSandbox from './index'
import globalEnv from '../../libs/global_env'
import bindFunctionToRawTarget from '../bind_function'
import {
  rawDefineProperty,
  isFunction,
  logWarn,
  includes,
  instanceOf,
} from '../../libs/utils'
import {
  GLOBAL_KEY_TO_WINDOW,
  SCOPE_WINDOW_EVENT_OF_IFRAME,
  SCOPE_WINDOW_ON_EVENT_OF_IFRAME,
} from '../../constants'
import {
  escape2RawWindowKeys,
  escape2RawWindowRegExpKeys,
  hijackInstanceOfWindowRegExpKeys,
} from './special_key'

/**
 * patch window of child app
 * @param appName app name
 * @param microAppWindow microWindow of child app
 * @param sandbox WithSandBox
 * @returns EffectHook
 */
export function patchWindow (
  appName: string,
  microAppWindow: microAppWindowType,
  sandbox: IframeSandbox,
): CommonEffectHook {
  patchWindowProperty(appName, microAppWindow)
  createProxyWindow(microAppWindow, sandbox)
  return patchWindowEffect(microAppWindow)
}
/**
 * rewrite special properties of window
 * @param appName app name
 * @param microAppWindow child app microWindow
 */
function patchWindowProperty (
  appName: string,
  microAppWindow: microAppWindowType,
):void {
  const rawWindow = globalEnv.rawWindow

  escape2RawWindowKeys.forEach((key: string) => {
    microAppWindow[key] = bindFunctionToRawTarget(rawWindow[key], rawWindow)
  })

  Object.getOwnPropertyNames(microAppWindow)
    .filter((key: string) => {
      escape2RawWindowRegExpKeys.some((reg: RegExp) => {
        if (reg.test(key) && key in microAppWindow.parent) {
          if (isFunction(rawWindow[key])) {
            microAppWindow[key] = bindFunctionToRawTarget(rawWindow[key], rawWindow)
          } else {
            const { configurable, enumerable } = Object.getOwnPropertyDescriptor(microAppWindow, key) || {
              configurable: true,
              enumerable: true,
            }
            if (configurable) {
              rawDefineProperty(microAppWindow, key, {
                configurable,
                enumerable,
                get: () => rawWindow[key],
                set: (value) => { rawWindow[key] = value },
              })
            }
          }
          return true
        }
        return false
      })

      hijackInstanceOfWindowRegExpKeys.some((reg: RegExp) => {
        if (reg.test(key) && key in rawWindow) {
          rawDefineProperty(microAppWindow[key], Symbol.hasInstance, {
            configurable: true,
            enumerable: false,
            value: (instance: unknown) => {
              return instance instanceof rawWindow[key]
                ? true
                : instanceOf(instance, microAppWindow[key])
            },
          })
          return true
        }
        return false
      })

      return /^on/.test(key) && !SCOPE_WINDOW_ON_EVENT_OF_IFRAME.includes(key)
    })
    .forEach((eventName: string) => {
      const { enumerable, writable, set } = Object.getOwnPropertyDescriptor(microAppWindow, eventName) || {
        enumerable: true,
        writable: true,
      }
      try {
        rawDefineProperty(microAppWindow, eventName, {
          enumerable,
          configurable: true,
          get: () => rawWindow[eventName],
          set: writable ?? !!set
            ? (value) => { rawWindow[eventName] = isFunction(value) ? value.bind(microAppWindow) : value }
            : undefined,
        })
      } catch (e) {
        logWarn(e, appName)
      }
    })
}

/**
 * create proxyWindow with Proxy(microAppWindow)
 * @param microAppWindow micro app window
 * @param sandbox IframeSandbox
 */
function createProxyWindow (
  microAppWindow: microAppWindowType,
  sandbox: IframeSandbox,
): void {
  const rawWindow = globalEnv.rawWindow
  const customProperties = new Set<PropertyKey>()

  /**
   * proxyWindow will only take effect in certain scenes, such as window.key
   * e.g:
   *  1. window.key in normal app --> fall into proxyWindow
   *  2. window.key in module app(vite), fall into microAppWindow(iframeWindow)
   *  3. if (key)... --> fall into microAppWindow(iframeWindow)
   */
  const proxyWindow = new Proxy(microAppWindow, {
    get: (target: microAppWindowType, key: PropertyKey): unknown => {
      if (key === 'location') {
        return sandbox.proxyLocation
      }

      if (includes(GLOBAL_KEY_TO_WINDOW, key)) {
        return proxyWindow
      }

      if (customProperties.has(key)) {
        return Reflect.get(target, key)
      }

      /**
       * Same as proxyWindow, escapeProperties will only take effect in certain scenes
       * e.g:
       *  1. window.key in normal app --> fall into proxyWindow, escapeProperties will effect
       *  2. window.key in module app(vite), fall into microAppWindow(iframeWindow), escapeProperties will not take effect
       *  3. if (key)... --> fall into microAppWindow(iframeWindow), escapeProperties will not take effect
       */
      if (includes(sandbox.escapeProperties, key) && !Reflect.has(target, key)) {
        return bindFunctionToRawTarget(Reflect.get(rawWindow, key), rawWindow)
      }

      return bindFunctionToRawTarget(Reflect.get(target, key), target)
    },
    set: (target: microAppWindowType, key: PropertyKey, value: unknown): boolean => {
      if (key === 'location') {
        return Reflect.set(rawWindow, key, value)
      }

      if (!Reflect.has(target, key)) {
        customProperties.add(key)
      }

      Reflect.set(target, key, value)

      if (includes(sandbox.escapeProperties, key)) {
        !Reflect.has(rawWindow, key) && sandbox.escapeKeys.add(key)
        Reflect.set(rawWindow, key, value)
      }

      return true
    },
    has: (target: microAppWindowType, key: PropertyKey) => key in target,
    deleteProperty: (target: microAppWindowType, key: PropertyKey): boolean => {
      if (Reflect.has(target, key)) {
        sandbox.escapeKeys.has(key) && Reflect.deleteProperty(rawWindow, key)
        return Reflect.deleteProperty(target, key)
      }
      return true
    },
  })

  sandbox.proxyWindow = proxyWindow
}

function patchWindowEffect (microAppWindow: microAppWindowType): CommonEffectHook {
  const { rawWindow, rawAddEventListener, rawRemoveEventListener } = globalEnv
  const eventListenerMap = new Map<string, Set<MicroEventListener>>()
  const sstEventListenerMap = new Map<string, Set<MicroEventListener>>()

  function getEventTarget (type: string): Window {
    return SCOPE_WINDOW_EVENT_OF_IFRAME.includes(type) ? microAppWindow : rawWindow
  }

  // TODO: listener 是否需要绑定microAppWindow，否则函数中的this指向原生window
  microAppWindow.addEventListener = function (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const listenerList = eventListenerMap.get(type)
    if (listenerList) {
      listenerList.add(listener)
    } else {
      eventListenerMap.set(type, new Set([listener]))
    }
    listener && (listener.__MICRO_APP_MARK_OPTIONS__ = options)
    rawAddEventListener.call(getEventTarget(type), type, listener, options)
  }

  microAppWindow.removeEventListener = function (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const listenerList = eventListenerMap.get(type)
    if (listenerList?.size && listenerList.has(listener)) {
      listenerList.delete(listener)
    }
    rawRemoveEventListener.call(getEventTarget(type), type, listener, options)
  }

  const reset = (): void => {
    sstEventListenerMap.clear()
  }

  /**
   * NOTE:
   *  1. about timer(events & properties should record & rebuild at all modes, exclude default mode)
   *  2. record maybe call twice when unmount prerender, keep-alive app manually with umd mode
   * 4 modes: default-mode、umd-mode、prerender、keep-alive
   * Solution:
   *  1. default-mode(normal): clear events & timers, not record & rebuild anything
   *  2. umd-mode(normal): not clear timers, record & rebuild events
   *  3. prerender/keep-alive(default, umd): not clear timers, record & rebuild events
   *
   * TODO: 现在的 清除、记录和恢复操作分散的太零散，sandbox、create_app中都有分散，将代码再优化一下，集中处理
   */
  const record = (): void => {
    // record window event
    eventListenerMap.forEach((listenerList, type) => {
      if (listenerList.size) {
        const cacheList = sstEventListenerMap.get(type) || []
        sstEventListenerMap.set(type, new Set([...cacheList, ...listenerList]))
      }
    })
  }

  // rebuild event and timer before remount app
  const rebuild = (): void => {
    // rebuild window event
    sstEventListenerMap.forEach((listenerList, type) => {
      for (const listener of listenerList) {
        microAppWindow.addEventListener(type, listener, listener?.__MICRO_APP_MARK_OPTIONS__)
      }
    })

    reset()
  }

  const release = (): void => {
    // Clear window binding events
    if (eventListenerMap.size) {
      eventListenerMap.forEach((listenerList, type) => {
        for (const listener of listenerList) {
          rawRemoveEventListener.call(getEventTarget(type), type, listener)
        }
      })
      eventListenerMap.clear()
    }
  }

  return {
    reset,
    record,
    rebuild,
    release,
  }
}
