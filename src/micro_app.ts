import type { OptionsType, MicroAppConfigType, lifeCyclesType, plugins, fetchType, AppInterface } from '@micro-app/types'
import { defineElement } from './micro_app_element'
import preFetch, { getGlobalAssets } from './prefetch'
import { logError, logWarn, isFunction, isBrowser, isPlainObject, formatAppName, getRootContainer } from './libs/utils'
import { EventCenterForBaseApp } from './interact'
import { initGlobalEnv } from './libs/global_env'
import { appInstanceMap } from './create_app'
import { appStates, keepAliveStates } from './constants'

/**
 * if app not prefetch & not unmount, then app is active
 * @param excludeHiddenApp exclude hidden keep-alive app, default is false
 * @returns active apps
 */
export function getActiveApps (excludeHiddenApp?: boolean): string[] {
  const activeApps: string[] = []
  appInstanceMap.forEach((app: AppInterface, appName: string) => {
    if (
      appStates.UNMOUNT !== app.getAppState() &&
      !app.isPrefetch &&
      (
        !excludeHiddenApp ||
        keepAliveStates.KEEP_ALIVE_HIDDEN !== app.getKeepAliveState()
      )
    ) {
      activeApps.push(appName)
    }
  })

  return activeApps
}

// get all registered apps
export function getAllApps (): string[] {
  return Array.from(appInstanceMap.keys())
}

export interface unmountAppParams {
  destroy?: boolean // destroy app, default is false
  clearAliveState?: boolean // clear keep-alive app state, default is false
}

/**
 * unmount app by appName
 * @param appName
 * @param options unmountAppParams
 * @returns Promise<void>
 */
export function unmountApp (appName: string, options?: unmountAppParams): Promise<void> {
  const app = appInstanceMap.get(formatAppName(appName))
  return new Promise((resolve) => { // eslint-disable-line
    if (app) {
      if (app.getAppState() === appStates.UNMOUNT || app.isPrefetch) {
        if (options?.destroy) {
          app.actionsForCompletelyDestroy()
        }
        resolve()
      } else if (app.getKeepAliveState() === keepAliveStates.KEEP_ALIVE_HIDDEN) {
        if (options?.destroy) {
          app.unmount(true, resolve)
        } else if (options?.clearAliveState) {
          app.unmount(false, resolve)
        } else {
          resolve()
        }
      } else {
        const container = getRootContainer(app.container!)
        const unmountHandler = () => {
          container.removeEventListener('unmount', unmountHandler)
          container.removeEventListener('afterhidden', afterhiddenHandler)
          resolve()
        }

        const afterhiddenHandler = () => {
          container.removeEventListener('unmount', unmountHandler)
          container.removeEventListener('afterhidden', afterhiddenHandler)
          resolve()
        }

        container.addEventListener('unmount', unmountHandler)
        container.addEventListener('afterhidden', afterhiddenHandler)

        if (options?.destroy) {
          let destroyAttrValue, destoryAttrValue
          container.hasAttribute('destroy') && (destroyAttrValue = container.getAttribute('destroy'))
          container.hasAttribute('destory') && (destoryAttrValue = container.getAttribute('destory'))

          container.setAttribute('destroy', 'true')
          container.parentNode!.removeChild(container)
          container.removeAttribute('destroy')

          typeof destroyAttrValue === 'string' && container.setAttribute('destroy', destroyAttrValue)
          typeof destoryAttrValue === 'string' && container.setAttribute('destory', destoryAttrValue)
        } else if (options?.clearAliveState && container.hasAttribute('keep-alive')) {
          const keepAliveAttrValue = container.getAttribute('keep-alive')!

          container.removeAttribute('keep-alive')
          container.parentNode!.removeChild(container)

          container.setAttribute('keep-alive', keepAliveAttrValue)
        } else {
          container.parentNode!.removeChild(container)
        }
      }
    } else {
      logWarn(`app ${appName} does not exist`)
      resolve()
    }
  })
}

// unmount all apps in turn
export function unmountAllApps (options?: unmountAppParams): Promise<void> {
  return Array.from(appInstanceMap.keys()).reduce((pre, next) => pre.then(() => unmountApp(next, options)), Promise.resolve())
}

export class MicroApp extends EventCenterForBaseApp implements MicroAppConfigType {
  tagName = 'micro-app'
  shadowDOM?: boolean
  destroy?: boolean
  inline?: boolean
  disableScopecss?: boolean
  disableSandbox?: boolean
  disableBlob?: boolean
  ssr?: boolean
  lifeCycles?: lifeCyclesType
  plugins?: plugins
  fetch?: fetchType
  preFetch = preFetch
  start (options?: OptionsType): void {
    if (!isBrowser || !window.customElements) {
      return logError('micro-app is not supported in this environment')
    }

    if (options?.tagName) {
      if (/^micro-app(-\S+)?/.test(options.tagName)) {
        this.tagName = options.tagName
      } else {
        return logError(`${options.tagName} is invalid tagName`)
      }
    }

    if (window.customElements.get(this.tagName)) {
      return logWarn(`element ${this.tagName} is already defined`)
    }

    initGlobalEnv()

    if (options && isPlainObject(options)) {
      this.shadowDOM = options.shadowDOM
      this.destroy = options.destroy
      /**
       * compatible with versions below 0.4.2 of destroy
       * do not merge with the previous line
       */
      // @ts-ignore
      this.destory = options.destory
      this.inline = options.inline
      this.disableBlob = options.disableBlob
      this.disableScopecss = options.disableScopecss
      this.disableSandbox = options.disableSandbox
      this.ssr = options.ssr
      isFunction(options.fetch) && (this.fetch = options.fetch)

      isPlainObject(options.lifeCycles) && (this.lifeCycles = options.lifeCycles)

      // load app assets when browser is idle
      options.preFetchApps && preFetch(options.preFetchApps)

      // load global assets when browser is idle
      options.globalAssets && getGlobalAssets(options.globalAssets)

      if (isPlainObject(options.plugins)) {
        const modules = options.plugins!.modules
        if (isPlainObject(modules)) {
          for (const appName in modules) {
            const formattedAppName = formatAppName(appName)
            if (formattedAppName && appName !== formattedAppName) {
              modules[formattedAppName] = modules[appName]
              delete modules[appName]
            }
          }
        }

        this.plugins = options.plugins
      }
    }

    // define customElement after init
    defineElement(this.tagName)
  }
}

export default new MicroApp()
