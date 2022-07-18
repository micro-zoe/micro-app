import type { microAppWindowType, SandBoxInterface, plugins } from '@micro-app/types'
import {
  EventCenterForMicroApp, rebuildDataCenterSnapshot, recordDataCenterSnapshot
} from '../interact'
import globalEnv from '../libs/global_env'
import {
  getEffectivePath,
  isArray,
  isPlainObject,
  isString,
  removeDomScope,
  unique,
  throttleDeferForSetAppName,
  rawDefineProperty,
  rawDefineProperties,
  isFunction,
  rawHasOwnProperty,
  pureCreateElement,
} from '../libs/utils'
import microApp from '../micro_app'
import bindFunctionToRawObject from './bind_function'
import effect, {
  effectDocumentEvent,
  releaseEffectDocumentEvent,
} from './effect'
import {
  patchElementPrototypeMethods,
  releasePatches,
} from '../source/patch'

export type MicroAppWindowDataType = {
  __MICRO_APP_ENVIRONMENT__: boolean
  __MICRO_APP_NAME__: string
  __MICRO_APP_PUBLIC_PATH__: string
  __MICRO_APP_BASE_URL__: string
  __MICRO_APP_BASE_ROUTE__: string
  __MICRO_APP_UMD_MODE__: boolean
  microApp: EventCenterForMicroApp
  rawWindow: Window
  rawDocument: Document
  removeDomScope: () => void
}

export type MicroAppWindowType = Window & MicroAppWindowDataType

// Variables that can escape to rawWindow
const staticEscapeProperties: PropertyKey[] = [
  'System',
  '__cjsWrapper',
]

// Variables that can only assigned to rawWindow
const escapeSetterKeyList: PropertyKey[] = [
  'location',
]

const globalPropertyList: Array<PropertyKey> = ['window', 'self', 'globalThis']

export default class SandBox implements SandBoxInterface {
  static activeCount = 0 // number of active sandbox
  private recordUmdEffect!: CallableFunction
  private rebuildUmdEffect!: CallableFunction
  private releaseEffect!: CallableFunction
  /**
   * Scoped global Properties(Properties that can only get and set in microAppWindow, will not escape to rawWindow)
   * https://github.com/micro-zoe/micro-app/issues/234
   */
  private scopeProperties: PropertyKey[] = ['webpackJsonp', 'Vue']
  // Properties that can be escape to rawWindow
  private escapeProperties: PropertyKey[] = []
  // Properties newly added to microAppWindow
  private injectedKeys = new Set<PropertyKey>()
  // Properties escape to rawWindow, cleared when unmount
  private escapeKeys = new Set<PropertyKey>()
  // record injected values before the first execution of umdHookMount and rebuild before remount umd app
  private recordUmdInjectedValues?: Map<PropertyKey, unknown>
  // sandbox state
  private active = false
  proxyWindow: WindowProxy // Proxy
  microAppWindow = {} as MicroAppWindowType // Proxy target

  constructor (appName: string, url: string) {
    // get scopeProperties and escapeProperties from plugins
    this.getSpecialProperties(appName)
    // create proxyWindow with Proxy(microAppWindow)
    this.proxyWindow = this.createProxyWindow(appName)
    // inject global properties
    this.initMicroAppWindow(this.microAppWindow, appName, url)
    // Rewrite global event listener & timeout
    Object.assign(this, effect(this.microAppWindow))
  }

  start (baseRoute: string): void {
    if (!this.active) {
      this.active = true
      this.microAppWindow.__MICRO_APP_BASE_ROUTE__ = this.microAppWindow.__MICRO_APP_BASE_URL__ = baseRoute
      // BUG FIX: bable-polyfill@6.x
      globalEnv.rawWindow._babelPolyfill && (globalEnv.rawWindow._babelPolyfill = false)
      if (++SandBox.activeCount === 1) {
        effectDocumentEvent()
        patchElementPrototypeMethods()
      }
    }
  }

  stop (): void {
    if (this.active) {
      this.active = false
      this.releaseEffect()
      this.microAppWindow.microApp.clearDataListener()
      this.microAppWindow.microApp.clearGlobalDataListener()

      this.injectedKeys.forEach((key: PropertyKey) => {
        Reflect.deleteProperty(this.microAppWindow, key)
      })
      this.injectedKeys.clear()

      this.escapeKeys.forEach((key: PropertyKey) => {
        Reflect.deleteProperty(globalEnv.rawWindow, key)
      })
      this.escapeKeys.clear()

      if (--SandBox.activeCount === 0) {
        releaseEffectDocumentEvent()
        releasePatches()
      }
    }
  }

  // record umd snapshot before the first execution of umdHookMount
  recordUmdSnapshot (): void {
    this.microAppWindow.__MICRO_APP_UMD_MODE__ = true
    this.recordUmdEffect()
    recordDataCenterSnapshot(this.microAppWindow.microApp)

    this.recordUmdInjectedValues = new Map<PropertyKey, unknown>()
    this.injectedKeys.forEach((key: PropertyKey) => {
      this.recordUmdInjectedValues!.set(key, Reflect.get(this.microAppWindow, key))
    })
  }

  // rebuild umd snapshot before remount umd app
  rebuildUmdSnapshot (): void {
    this.recordUmdInjectedValues!.forEach((value: unknown, key: PropertyKey) => {
      Reflect.set(this.proxyWindow, key, value)
    })
    this.rebuildUmdEffect()
    rebuildDataCenterSnapshot(this.microAppWindow.microApp)
  }

  /**
   * get scopeProperties and escapeProperties from plugins
   * @param appName app name
   */
  private getSpecialProperties (appName: string): void {
    if (!isPlainObject(microApp.plugins)) return

    this.commonActionForSpecialProperties(microApp.plugins!.global)
    this.commonActionForSpecialProperties(microApp.plugins!.modules?.[appName])
  }

  // common action for global plugins and module plugins
  private commonActionForSpecialProperties (plugins: plugins['global']) {
    if (isArray(plugins)) {
      for (const plugin of plugins) {
        if (isPlainObject(plugin)) {
          if (isArray(plugin.scopeProperties)) {
            this.scopeProperties = this.scopeProperties.concat(plugin.scopeProperties!)
          }
          if (isArray(plugin.escapeProperties)) {
            this.escapeProperties = this.escapeProperties.concat(plugin.escapeProperties!)
          }
        }
      }
    }
  }

  // create proxyWindow with Proxy(microAppWindow)
  private createProxyWindow (appName: string) {
    const rawWindow = globalEnv.rawWindow
    const descriptorTargetMap = new Map<PropertyKey, 'target' | 'rawWindow'>()
    // window.xxx will trigger proxy
    return new Proxy(this.microAppWindow, {
      get: (target: microAppWindowType, key: PropertyKey): unknown => {
        throttleDeferForSetAppName(appName)

        if (
          Reflect.has(target, key) ||
          (isString(key) && /^__MICRO_APP_/.test(key)) ||
          this.scopeProperties.includes(key)
        ) return Reflect.get(target, key)

        const rawValue = Reflect.get(rawWindow, key)

        return isFunction(rawValue) ? bindFunctionToRawObject(rawWindow, rawValue) : rawValue
      },
      set: (target: microAppWindowType, key: PropertyKey, value: unknown): boolean => {
        if (this.active) {
          if (escapeSetterKeyList.includes(key)) {
            Reflect.set(rawWindow, key, value)
          } else if (
            // target.hasOwnProperty has been rewritten
            !rawHasOwnProperty.call(target, key) &&
            rawHasOwnProperty.call(rawWindow, key) &&
            !this.scopeProperties.includes(key)
          ) {
            const descriptor = Object.getOwnPropertyDescriptor(rawWindow, key)
            const { configurable, enumerable, writable, set } = descriptor!
            // set value because it can be set
            rawDefineProperty(target, key, {
              value,
              configurable,
              enumerable,
              writable: writable ?? !!set,
            })

            this.injectedKeys.add(key)
          } else {
            Reflect.set(target, key, value)
            this.injectedKeys.add(key)
          }

          if (
            (
              this.escapeProperties.includes(key) ||
              (staticEscapeProperties.includes(key) && !Reflect.has(rawWindow, key))
            ) &&
            !this.scopeProperties.includes(key)
          ) {
            Reflect.set(rawWindow, key, value)
            this.escapeKeys.add(key)
          }
        }

        return true
      },
      has: (target: microAppWindowType, key: PropertyKey): boolean => {
        if (this.scopeProperties.includes(key)) return key in target
        return key in target || key in rawWindow
      },
      // Object.getOwnPropertyDescriptor(window, key)
      getOwnPropertyDescriptor: (target: microAppWindowType, key: PropertyKey): PropertyDescriptor|undefined => {
        if (rawHasOwnProperty.call(target, key)) {
          descriptorTargetMap.set(key, 'target')
          return Object.getOwnPropertyDescriptor(target, key)
        }

        if (rawHasOwnProperty.call(rawWindow, key)) {
          descriptorTargetMap.set(key, 'rawWindow')
          const descriptor = Object.getOwnPropertyDescriptor(rawWindow, key)
          if (descriptor && !descriptor.configurable) {
            descriptor.configurable = true
          }
          return descriptor
        }

        return undefined
      },
      // Object.defineProperty(window, key, Descriptor)
      defineProperty: (target: microAppWindowType, key: PropertyKey, value: PropertyDescriptor): boolean => {
        const from = descriptorTargetMap.get(key)
        if (from === 'rawWindow') {
          return Reflect.defineProperty(rawWindow, key, value)
        }
        return Reflect.defineProperty(target, key, value)
      },
      // Object.getOwnPropertyNames(window)
      ownKeys: (target: microAppWindowType): Array<string | symbol> => {
        return unique(Reflect.ownKeys(rawWindow).concat(Reflect.ownKeys(target)))
      },
      deleteProperty: (target: microAppWindowType, key: PropertyKey): boolean => {
        if (rawHasOwnProperty.call(target, key)) {
          this.injectedKeys.has(key) && this.injectedKeys.delete(key)
          this.escapeKeys.has(key) && Reflect.deleteProperty(rawWindow, key)
          return Reflect.deleteProperty(target, key)
        }
        return true
      },
    })
  }

  /**
   * inject global properties to microAppWindow
   * @param microAppWindow micro window
   * @param appName app name
   * @param url app url
   */
  private initMicroAppWindow (microAppWindow: microAppWindowType, appName: string, url: string): void {
    microAppWindow.__MICRO_APP_ENVIRONMENT__ = true
    microAppWindow.__MICRO_APP_NAME__ = appName
    microAppWindow.__MICRO_APP_PUBLIC_PATH__ = getEffectivePath(url)
    microAppWindow.__MICRO_APP_WINDOW__ = microAppWindow
    microAppWindow.microApp = Object.assign(new EventCenterForMicroApp(appName), {
      removeDomScope,
      pureCreateElement,
    })
    microAppWindow.rawWindow = globalEnv.rawWindow
    microAppWindow.rawDocument = globalEnv.rawDocument
    microAppWindow.hasOwnProperty = (key: PropertyKey) => rawHasOwnProperty.call(microAppWindow, key) || rawHasOwnProperty.call(globalEnv.rawWindow, key)
    this.setMappingPropertiesWithRawDescriptor(microAppWindow)
    this.setHijackProperties(microAppWindow, appName)
  }

  // properties associated with the native window
  private setMappingPropertiesWithRawDescriptor (microAppWindow: microAppWindowType): void {
    let topValue: Window, parentValue: Window
    const rawWindow = globalEnv.rawWindow
    if (rawWindow === rawWindow.parent) { // not in iframe
      topValue = parentValue = this.proxyWindow
    } else { // in iframe
      topValue = rawWindow.top
      parentValue = rawWindow.parent
    }

    rawDefineProperty(
      microAppWindow,
      'top',
      this.createDescriptorForMicroAppWindow('top', topValue)
    )

    rawDefineProperty(
      microAppWindow,
      'parent',
      this.createDescriptorForMicroAppWindow('parent', parentValue)
    )

    globalPropertyList.forEach((key: PropertyKey) => {
      rawDefineProperty(
        microAppWindow,
        key,
        this.createDescriptorForMicroAppWindow(key, this.proxyWindow)
      )
    })
  }

  private createDescriptorForMicroAppWindow (key: PropertyKey, value: unknown): PropertyDescriptor {
    const { configurable = true, enumerable = true, writable, set } = Object.getOwnPropertyDescriptor(globalEnv.rawWindow, key) || { writable: true }
    const descriptor: PropertyDescriptor = {
      value,
      configurable,
      enumerable,
      writable: writable ?? !!set
    }

    return descriptor
  }

  private createProxyDocument (sandboxName: string) {
    const rawDocument = globalEnv.rawDocument
    const createElement = function (tagName: string, options?: ElementCreationOptions): HTMLElement {
      const element = globalEnv.rawCreateElement.call(rawDocument, tagName, options)
      element.__MICRO_APP_NAME__ = sandboxName
      return element
    }

    // @ts-ignore
    const proxyDocument = new Proxy(rawDocument, {
      get (_target: Document, p: string | symbol): unknown {
        if (p === 'createElement') {
          return createElement
        }
        const rawValue = Reflect.get(rawDocument, p)
        return isFunction(rawValue) ? bindFunctionToRawObject(rawDocument, rawValue, 'DOCUMENT') : rawValue
      },
    })

    return proxyDocument
  }

  // set hijack Properties to microAppWindow
  private setHijackProperties (microAppWindow: microAppWindowType, appName: string): void {
    let modifiedEval: unknown, modifiedImage: unknown
    const proxyDocument = this.createProxyDocument(appName)

    rawDefineProperties(microAppWindow, {
      document: {
        get () {
          throttleDeferForSetAppName(appName)
          return proxyDocument
        },
        configurable: false,
        enumerable: true,
      },
      eval: {
        get () {
          throttleDeferForSetAppName(appName)
          return modifiedEval || eval
        },
        set: (value) => {
          modifiedEval = value
        },
        configurable: true,
        enumerable: false,
      },
      Image: {
        get () {
          throttleDeferForSetAppName(appName)
          return modifiedImage || globalEnv.ImageProxy
        },
        set: (value) => {
          modifiedImage = value
        },
        configurable: true,
        enumerable: false,
      },
    })
  }
}
