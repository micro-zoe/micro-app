import type {
  AppInterface,
  sourceType,
  SandBoxInterface,
  sourceLinkInfo,
  sourceScriptInfo,
  Func,
} from '@micro-app/types'
import { HTMLLoader } from './source/loader/html'
import { extractSourceDom } from './source/index'
import { execScripts } from './source/scripts'
import { appStates, lifeCycles, keepAliveStates } from './constants'
import SandBox from './sandbox'
import {
  isFunction,
  cloneContainer,
  isBoolean,
  isPromise,
  logError,
  getRootContainer,
} from './libs/utils'
import dispatchLifecyclesEvent, { dispatchCustomEventToMicroApp } from './interact/lifecycles_event'
import globalEnv from './libs/global_env'
import { releasePatchSetAttribute } from './source/patch'
import { getActiveApps } from './micro_app'

// micro app instances
export const appInstanceMap = new Map<string, AppInterface>()

// params of CreateApp
export interface CreateAppParam {
  name: string
  url: string
  ssrUrl?: string
  scopecss: boolean
  useBlob?: boolean
  useSandbox: boolean
  inline?: boolean
  baseroute?: string
  container?: HTMLElement | ShadowRoot
}

export default class CreateApp implements AppInterface {
  private state: string = appStates.NOT_LOADED
  private keepAliveState: string | null = null
  private keepAliveContainer: HTMLElement | null = null
  private loadSourceLevel: -1|0|1|2 = 0
  private umdHookMount: Func | null = null
  private umdHookUnmount: Func | null = null
  private libraryName: string | null = null
  umdMode = false
  isPrefetch = false
  prefetchResolve: (() => void) | null = null
  name: string
  url: string
  ssrUrl: string
  container: HTMLElement | ShadowRoot | null = null
  inline: boolean
  scopecss: boolean
  useBlob: boolean
  useSandbox: boolean
  baseroute = ''
  source: sourceType
  sandBox: SandBoxInterface | null = null

  constructor ({
    name,
    url,
    ssrUrl,
    container,
    inline,
    scopecss,
    useBlob,
    useSandbox,
    baseroute,
  }: CreateAppParam) {
    this.container = container ?? null
    this.inline = inline ?? false
    this.baseroute = baseroute ?? ''
    this.ssrUrl = ssrUrl ?? ''
    // optional during init👆
    this.name = name
    this.url = url
    this.useSandbox = useSandbox
    this.useBlob = useBlob ?? true
    this.scopecss = this.useSandbox && scopecss
    this.source = {
      links: new Map<string, sourceLinkInfo>(),
      scripts: new Map<string, sourceScriptInfo>(),
    }
    this.loadSourceCode()
    this.useSandbox && (this.sandBox = new SandBox(name, url))
  }

  // Load resources
  loadSourceCode (): void {
    this.state = appStates.LOADING_SOURCE_CODE
    HTMLLoader.getInstance().run(this, extractSourceDom)
  }

  /**
   * When resource is loaded, mount app if it is not prefetch or unmount
   */
  onLoad (html: HTMLElement): void {
    if (++this.loadSourceLevel === 2) {
      this.source.html = html

      if (this.isPrefetch) {
        this.prefetchResolve?.()
        this.prefetchResolve = null
      } else if (appStates.UNMOUNT !== this.state) {
        this.state = appStates.LOAD_SOURCE_FINISHED
        this.mount()
      }
    }
  }

  /**
   * Error loading HTML
   * @param e Error
   */
  onLoadError (e: Error): void {
    this.loadSourceLevel = -1
    if (this.prefetchResolve) {
      this.prefetchResolve()
      this.prefetchResolve = null
    }

    if (appStates.UNMOUNT !== this.state) {
      this.onerror(e)
      this.state = appStates.LOAD_SOURCE_ERROR
    }
  }

  /**
   * mount app
   * @param container app container
   * @param inline js runs in inline mode
   * @param baseroute route prefix, default is ''
   */
  mount (
    container?: HTMLElement | ShadowRoot,
    inline?: boolean,
    baseroute?: string,
  ): void {
    if (isBoolean(inline) && inline !== this.inline) {
      this.inline = inline
    }

    this.container = this.container ?? container!
    this.baseroute = baseroute ?? this.baseroute

    if (this.loadSourceLevel !== 2) {
      this.state = appStates.LOADING_SOURCE_CODE
      return
    }

    dispatchLifecyclesEvent(
      this.container,
      this.name,
      lifeCycles.BEFOREMOUNT,
    )

    this.state = appStates.MOUNTING

    cloneContainer(this.source.html as Element, this.container as Element, !this.umdMode)

    this.sandBox?.start(this.baseroute)

    let umdHookMountResult: any // result of mount function

    if (!this.umdMode) {
      let hasDispatchMountedEvent = false
      // if all js are executed, param isFinished will be true
      execScripts(this.source.scripts, this, (isFinished: boolean) => {
        if (!this.umdMode) {
          const { mount, unmount } = this.getUmdLibraryHooks()
          // if mount & unmount is function, the sub app is umd mode
          if (isFunction(mount) && isFunction(unmount)) {
            this.umdHookMount = mount as Func
            this.umdHookUnmount = unmount as Func
            this.umdMode = true
            this.sandBox?.recordUmdSnapshot()
            try {
              umdHookMountResult = this.umdHookMount()
            } catch (e) {
              logError('an error occurred in the mount function \n', this.name, e)
            }
          }
        }

        if (!hasDispatchMountedEvent && (isFinished === true || this.umdMode)) {
          hasDispatchMountedEvent = true
          this.handleMounted(umdHookMountResult)
        }
      })
    } else {
      this.sandBox?.rebuildUmdSnapshot()
      try {
        umdHookMountResult = this.umdHookMount!()
      } catch (e) {
        logError('an error occurred in the mount function \n', this.name, e)
      }
      this.handleMounted(umdHookMountResult)
    }
  }

  /**
   * handle for promise umdHookMount
   * @param umdHookMountResult result of umdHookMount
   */
  private handleMounted (umdHookMountResult: any): void {
    if (isPromise(umdHookMountResult)) {
      umdHookMountResult
        .then(() => this.dispatchMountedEvent())
        .catch((e: Error) => this.onerror(e))
    } else {
      this.dispatchMountedEvent()
    }
  }

  /**
   * dispatch mounted event when app run finished
   */
  private dispatchMountedEvent (): void {
    if (appStates.UNMOUNT !== this.state) {
      this.state = appStates.MOUNTED
      dispatchLifecyclesEvent(
        this.container!,
        this.name,
        lifeCycles.MOUNTED,
      )
    }
  }

  /**
   * unmount app
   * @param destroy completely destroy, delete cache resources
   * @param unmountcb callback of unmount
   */
  unmount (destroy: boolean, unmountcb?: CallableFunction): void {
    if (this.state === appStates.LOAD_SOURCE_ERROR) {
      destroy = true
    }

    this.state = appStates.UNMOUNT
    this.keepAliveState = null
    this.keepAliveContainer = null

    // result of unmount function
    let umdHookUnmountResult: any
    /**
     * send an unmount event to the micro app or call umd unmount hook
     * before the sandbox is cleared
     */
    if (this.umdHookUnmount) {
      try {
        umdHookUnmountResult = this.umdHookUnmount()
      } catch (e) {
        logError('an error occurred in the unmount function \n', this.name, e)
      }
    }

    // dispatch unmount event to micro app
    dispatchCustomEventToMicroApp('unmount', this.name)

    this.handleUnmounted(destroy, umdHookUnmountResult, unmountcb)
  }

  /**
   * handle for promise umdHookUnmount
   * @param destroy completely destroy, delete cache resources
   * @param umdHookUnmountResult result of umdHookUnmount
   * @param unmountcb callback of unmount
   */
  private handleUnmounted (
    destroy: boolean,
    umdHookUnmountResult: any,
    unmountcb?: CallableFunction,
  ): void {
    if (isPromise(umdHookUnmountResult)) {
      umdHookUnmountResult
        .then(() => this.actionsForUnmount(destroy, unmountcb))
        .catch(() => this.actionsForUnmount(destroy, unmountcb))
    } else {
      this.actionsForUnmount(destroy, unmountcb)
    }
  }

  /**
   * actions for unmount app
   * @param destroy completely destroy, delete cache resources
   * @param unmountcb callback of unmount
   */
  private actionsForUnmount (destroy: boolean, unmountcb?: CallableFunction): void {
    if (destroy) {
      this.actionsForCompletelyDestroy()
    } else if (this.umdMode && (this.container as Element).childElementCount) {
      cloneContainer(this.container as Element, this.source.html as Element, false)
    }

    // this.container maybe contains micro-app element, stop sandbox should exec after cloneContainer
    this.sandBox?.stop()
    if (!getActiveApps().length) {
      releasePatchSetAttribute()
    }

    // dispatch unmount event to base app
    dispatchLifecyclesEvent(
      this.container!,
      this.name,
      lifeCycles.UNMOUNT,
    )

    this.container!.innerHTML = ''
    this.container = null

    unmountcb && unmountcb()
  }

  // actions for completely destroy
  actionsForCompletelyDestroy (): void {
    if (!this.useSandbox && this.umdMode) {
      delete window[this.libraryName as any]
    }
    appInstanceMap.delete(this.name)
  }

  // hidden app when disconnectedCallback called with keep-alive
  hiddenKeepAliveApp (): void {
    const oldContainer = this.container

    cloneContainer(
      this.container as Element,
      this.keepAliveContainer ? this.keepAliveContainer : (this.keepAliveContainer = document.createElement('div')),
      false,
    )

    this.container = this.keepAliveContainer

    this.keepAliveState = keepAliveStates.KEEP_ALIVE_HIDDEN

    // event should dispatch before clone node
    // dispatch afterhidden event to micro-app
    dispatchCustomEventToMicroApp('appstate-change', this.name, {
      appState: 'afterhidden',
    })

    // dispatch afterhidden event to base app
    dispatchLifecyclesEvent(
      oldContainer!,
      this.name,
      lifeCycles.AFTERHIDDEN,
    )
  }

  // show app when connectedCallback called with keep-alive
  showKeepAliveApp (container: HTMLElement | ShadowRoot): void {
    // dispatch beforeshow event to micro-app
    dispatchCustomEventToMicroApp('appstate-change', this.name, {
      appState: 'beforeshow',
    })

    // dispatch beforeshow event to base app
    dispatchLifecyclesEvent(
      container,
      this.name,
      lifeCycles.BEFORESHOW,
    )

    cloneContainer(
      this.container as Element,
      container as Element,
      false,
    )

    this.container = container

    this.keepAliveState = keepAliveStates.KEEP_ALIVE_SHOW

    // dispatch aftershow event to micro-app
    dispatchCustomEventToMicroApp('appstate-change', this.name, {
      appState: 'aftershow',
    })

    // dispatch aftershow event to base app
    dispatchLifecyclesEvent(
      this.container,
      this.name,
      lifeCycles.AFTERSHOW,
    )
  }

  /**
   * app rendering error
   * @param e Error
   */
  onerror (e: Error): void {
    dispatchLifecyclesEvent(
      this.container!,
      this.name,
      lifeCycles.ERROR,
      e,
    )
  }

  // get app state
  getAppState (): string {
    return this.state
  }

  // get keep-alive state
  getKeepAliveState (): string | null {
    return this.keepAliveState
  }

  // get umd library, if it not exist, return empty object
  private getUmdLibraryHooks (): Record<string, unknown> {
    // after execScripts, the app maybe unmounted
    if (appStates.UNMOUNT !== this.state) {
      const global = (this.sandBox?.proxyWindow ?? globalEnv.rawWindow) as any
      this.libraryName = getRootContainer(this.container!).getAttribute('library') || `micro-app-${this.name}`
      // do not use isObject
      return typeof global[this.libraryName] === 'object' ? global[this.libraryName] : {}
    }

    return {}
  }
}
