import type { AttrType, MicroAppElementType, AppInterface } from '@micro-app/types'
import {
  defer,
  formatAppName,
  formatAppURL,
  version,
  logError,
  logWarn,
  isString,
  isFunction,
  CompletionPath,
} from './libs/utils'
import {
  ObservedAttrName,
  appStates,
  lifeCycles,
  keepAliveStates,
} from './constants'
import CreateApp, { appInstanceMap } from './create_app'
import { patchSetAttribute } from './source/patch'
import microApp from './micro_app'
import dispatchLifecyclesEvent from './interact/lifecycles_event'
import globalEnv from './libs/global_env'

/**
 * define element
 * @param tagName element name
 */
export function defineElement (tagName: string): void {
  class MicroAppElement extends HTMLElement implements MicroAppElementType {
    static get observedAttributes (): string[] {
      return ['name', 'url']
    }

    constructor () {
      super()
      patchSetAttribute()
    }

    private isWaiting = false
    private cacheData: Record<PropertyKey, unknown> | null = null
    private hasConnected = false
    appName = '' // app name
    appUrl = '' // app url
    ssrUrl = '' // html path in ssr mode
    version = version

    // 👇 Configuration
    // name: app name
    // url: html address
    // shadowDom: use shadowDOM, default is false
    // destroy: whether delete cache resources when unmount, default is false
    // inline: whether js runs in inline script mode, default is false
    // disableScopecss: whether disable css scoped, default is false
    // disableSandbox: whether disable sandbox, default is false
    // baseRoute: route prefix, default is ''
    // keep-alive: open keep-alive mode

    connectedCallback (): void {
      this.hasConnected = true

      defer(() => dispatchLifecyclesEvent(
        this,
        this.appName,
        lifeCycles.CREATED,
      ))

      this.initialMount()
    }

    disconnectedCallback (): void {
      this.hasConnected = false
      // keep-alive
      if (this.getKeepAliveModeResult()) {
        this.handleHiddenKeepAliveApp()
      } else {
        this.handleUnmount(this.getDestroyCompatibleResult())
      }
    }

    attributeChangedCallback (attr: ObservedAttrName, _oldVal: string, newVal: string): void {
      if (
        this.legalAttribute(attr, newVal) &&
        this[attr === ObservedAttrName.NAME ? 'appName' : 'appUrl'] !== newVal
      ) {
        if (attr === ObservedAttrName.URL && !this.appUrl) {
          newVal = formatAppURL(newVal, this.appName)
          if (!newVal) {
            return logError(`Invalid attribute url ${newVal}`, this.appName)
          }
          this.appUrl = newVal
          this.handleInitialNameAndUrl()
        } else if (attr === ObservedAttrName.NAME && !this.appName) {
          const formatNewName = formatAppName(newVal)

          if (!formatNewName) {
            return logError(`Invalid attribute name ${newVal}`, this.appName)
          }

          if (this.cacheData) {
            microApp.setData(formatNewName, this.cacheData)
            this.cacheData = null
          }

          this.appName = formatNewName
          if (formatNewName !== newVal) {
            this.setAttribute('name', this.appName)
          }
          this.handleInitialNameAndUrl()
        } else if (!this.isWaiting) {
          this.isWaiting = true
          defer(this.handleAttributeUpdate)
        }
      }
    }

    // handle for connectedCallback run before attributeChangedCallback
    private handleInitialNameAndUrl (): void {
      this.hasConnected && this.initialMount()
    }

    /**
     * first mount of this app
     */
    private initialMount (): void {
      if (!this.appName || !this.appUrl) return

      if (this.getDisposeResult('shadowDOM') && !this.shadowRoot && isFunction(this.attachShadow)) {
        this.attachShadow({ mode: 'open' })
      }

      if (this.getDisposeResult('ssr')) {
        this.ssrUrl = CompletionPath(globalEnv.rawWindow.location.pathname, this.appUrl)
      } else if (this.ssrUrl) {
        this.ssrUrl = ''
      }

      if (appInstanceMap.has(this.appName)) {
        const app = appInstanceMap.get(this.appName)!
        const existAppUrl = app.ssrUrl || app.url
        const activeAppUrl = this.ssrUrl || this.appUrl
        // keep-alive don't care about ssrUrl
        // Even if the keep-alive app is pushed into the background, it is still active and cannot be replaced. Otherwise, it is difficult for developers to troubleshoot in case of conflict and  will leave developers at a loss
        if (
          app.getKeepAliveState() === keepAliveStates.KEEP_ALIVE_HIDDEN &&
          app.url === this.appUrl
        ) {
          this.handleShowKeepAliveApp(app)
        } else if (
          existAppUrl === activeAppUrl && (
            app.isPrefetch ||
            app.getAppState() === appStates.UNMOUNT
          )
        ) {
          this.handleAppMount(app)
        } else if (app.isPrefetch || app.getAppState() === appStates.UNMOUNT) {
          /**
           * url is different & old app is unmounted or prefetch, create new app to replace old one
           */
          logWarn(`the ${app.isPrefetch ? 'prefetch' : 'unmounted'} app with url: ${existAppUrl} is replaced by a new app`, this.appName)
          this.handleCreateApp()
        } else {
          logError(`app name conflict, an app named ${this.appName} is running`, this.appName)
        }
      } else {
        this.handleCreateApp()
      }
    }

    /**
     * handle for change of name an url after element init
     */
    private handleAttributeUpdate = (): void => {
      this.isWaiting = false
      const formatAttrName = formatAppName(this.getAttribute('name'))
      const formatAttrUrl = formatAppURL(this.getAttribute('url'), this.appName)
      if (this.legalAttribute('name', formatAttrName) && this.legalAttribute('url', formatAttrUrl)) {
        const existApp = appInstanceMap.get(formatAttrName)
        if (formatAttrName !== this.appName && existApp) {
          // handling of cached and non-prefetch apps
          if (
            appStates.UNMOUNT !== existApp.getAppState() &&
            keepAliveStates.KEEP_ALIVE_HIDDEN !== existApp.getKeepAliveState() &&
            !existApp.isPrefetch
          ) {
            this.setAttribute('name', this.appName)
            return logError(`app name conflict, an app named ${formatAttrName} is running`, this.appName)
          }
        }

        if (formatAttrName !== this.appName || formatAttrUrl !== this.appUrl) {
          if (formatAttrName === this.appName) {
            this.handleUnmount(true, () => {
              this.actionsForAttributeChange(formatAttrName, formatAttrUrl, existApp)
            })
          } else if (this.getKeepAliveModeResult()) {
            this.handleHiddenKeepAliveApp()
            this.actionsForAttributeChange(formatAttrName, formatAttrUrl, existApp)
          } else {
            this.handleUnmount(
              this.getDestroyCompatibleResult(),
              () => {
                this.actionsForAttributeChange(formatAttrName, formatAttrUrl, existApp)
              }
            )
          }
        }
      } else if (formatAttrName !== this.appName) {
        this.setAttribute('name', this.appName)
      }
    }

    // remount app or create app if attribute url or name change
    private actionsForAttributeChange (
      formatAttrName: string,
      formatAttrUrl: string,
      existApp: AppInterface | undefined,
    ): void {
      /**
       * change ssrUrl in ssr mode
       * do not add judgment of formatAttrUrl === this.appUrl
       */
      if (this.getDisposeResult('ssr')) {
        this.ssrUrl = CompletionPath(globalEnv.rawWindow.location.pathname, formatAttrUrl)
      } else if (this.ssrUrl) {
        this.ssrUrl = ''
      }

      this.appName = formatAttrName
      this.appUrl = formatAttrUrl
      ;(this.shadowRoot ?? this).innerHTML = ''
      if (formatAttrName !== this.getAttribute('name')) {
        this.setAttribute('name', this.appName)
      }

      /**
       * when existApp not null: this.appName === existApp.name
       * scene1: if formatAttrName and this.appName are equal: exitApp is the current app, the url must be different, existApp has been unmounted
       * scene2: if formatAttrName and this.appName are different: existApp must be prefetch or unmounted, if url is equal, then just mount, if url is different, then create new app to replace existApp
       * scene3: url is different but ssrUrl is equal
       * scene4: url is equal but ssrUrl is different, if url is equal, name must different
       * scene5: if existApp is KEEP_ALIVE_HIDDEN, name must different
       */
      if (existApp) {
        if (existApp.getKeepAliveState() === keepAliveStates.KEEP_ALIVE_HIDDEN) {
          if (existApp.url === this.appUrl) {
            this.handleShowKeepAliveApp(existApp)
          } else {
            // the hidden keep-alive app is still active
            logError(`app name conflict, an app named ${this.appName} is running`, this.appName)
          }
        } else if (existApp.url === this.appUrl && existApp.ssrUrl === this.ssrUrl) {
          // mount app
          this.handleAppMount(existApp)
        } else {
          this.handleCreateApp()
        }
      } else {
        this.handleCreateApp()
      }
    }

    /**
     * judge the attribute is legal
     * @param name attribute name
     * @param val attribute value
     */
    private legalAttribute (name: string, val: AttrType): boolean {
      if (!isString(val) || !val) {
        logError(`unexpected attribute ${name}, please check again`, this.appName)

        return false
      }

      return true
    }

    /**
     * mount app
     * some serious note before mount:
     * 1. is prefetch ?
     * 2. is remount in another container ?
     * 3. is remount with change properties of the container ?
     */
    private handleAppMount (app: AppInterface): void {
      app.isPrefetch = false
      defer(() => app.mount(
        this.shadowRoot ?? this,
        this.getDisposeResult('inline'),
        this.getBaseRouteCompatible(),
      ))
    }

    // create app instance
    private handleCreateApp (): void {
      /**
       * actions for destory old app
       * fix of unmounted umd app with disableSandbox
       */
      if (appInstanceMap.has(this.appName)) {
        appInstanceMap.get(this.appName)!.actionsForCompletelyDestroy()
      }

      const instance: AppInterface = new CreateApp({
        name: this.appName,
        url: this.appUrl,
        ssrUrl: this.ssrUrl,
        container: this.shadowRoot ?? this,
        inline: this.getDisposeResult('inline'),
        scopecss: !(this.getDisposeResult('disableScopecss') || this.getDisposeResult('shadowDOM')),
        useBlob: !this.getDisposeResult('disableBlob'),
        useSandbox: !this.getDisposeResult('disableSandbox'),
        baseroute: this.getBaseRouteCompatible(),
      })

      appInstanceMap.set(this.appName, instance)
    }

    /**
     * unmount app
     * @param destroy delete cache resources when unmount
     */
    private handleUnmount (destroy: boolean, unmountcb?: CallableFunction): void {
      const app = appInstanceMap.get(this.appName)
      if (
        app &&
        app.getAppState() !== appStates.UNMOUNT
      ) app.unmount(destroy, unmountcb)
    }

    // hidden app when disconnectedCallback called with keep-alive
    private handleHiddenKeepAliveApp () {
      const app = appInstanceMap.get(this.appName)
      if (
        app &&
        app.getAppState() !== appStates.UNMOUNT &&
        app.getKeepAliveState() !== keepAliveStates.KEEP_ALIVE_HIDDEN
      ) app.hiddenKeepAliveApp()
    }

    // show app when connectedCallback called with keep-alive
    private handleShowKeepAliveApp (app: AppInterface) {
      // must be async
      defer(() => app.showKeepAliveApp(this.shadowRoot ?? this))
    }

    /**
     * Get configuration
     * Global setting is lowest priority
     * @param name Configuration item name
     */
    private getDisposeResult (name: string): boolean {
      // @ts-ignore
      return (this.compatibleSpecialProperties(name) || microApp[name]) && this.compatibleDisableSpecialProperties(name)
    }

    // compatible of disableScopecss & disableSandbox
    private compatibleSpecialProperties (name: string): boolean {
      if (name === 'disableScopecss') {
        return this.hasAttribute('disableScopecss') || this.hasAttribute('disable-scopecss')
      } else if (name === 'disableSandbox') {
        return this.hasAttribute('disableSandbox') || this.hasAttribute('disable-sandbox')
      }
      return this.hasAttribute(name)
    }

    // compatible of disableScopecss & disableSandbox
    private compatibleDisableSpecialProperties (name: string): boolean {
      if (name === 'disableScopecss') {
        return this.getAttribute('disableScopecss') !== 'false' && this.getAttribute('disable-scopecss') !== 'false'
      } else if (name === 'disableSandbox') {
        return this.getAttribute('disableSandbox') !== 'false' && this.getAttribute('disable-sandbox') !== 'false'
      }
      return this.getAttribute(name) !== 'false'
    }

    /**
     * 2021-09-08
     * get baseRoute
     * getAttribute('baseurl') is compatible writing of versions below 0.3.1
     */
    private getBaseRouteCompatible (): string {
      return this.getAttribute('baseroute') ?? this.getAttribute('baseurl') ?? ''
    }

    // compatible of destroy
    private getDestroyCompatibleResult (): boolean {
      return this.getDisposeResult('destroy') || this.getDisposeResult('destory')
    }

    /**
     * destroy has priority over destroy keep-alive
     */
    private getKeepAliveModeResult (): boolean {
      return this.getDisposeResult('keep-alive') && !this.getDestroyCompatibleResult()
    }

    /**
     * Data from the base application
     */
    set data (value: Record<PropertyKey, unknown> | null) {
      if (this.appName) {
        microApp.setData(this.appName, value!)
      } else {
        this.cacheData = value
      }
    }

    /**
     * get data only used in jsx-custom-event once
     */
    get data (): Record<PropertyKey, unknown> | null {
      if (this.appName) {
        return microApp.getData(this.appName, true)
      } else if (this.cacheData) {
        return this.cacheData
      }
      return null
    }
  }

  window.customElements.define(tagName, MicroAppElement)
}
