/* eslint-disable no-new */
import type {
  AttrType,
  MicroAppElementType,
  AppInterface,
  OptionsType,
  NormalKey,
} from '@micro-app/types'
import microApp from './micro_app'
import dispatchLifecyclesEvent from './interact/lifecycles_event'
import globalEnv from './libs/global_env'
import {
  defer,
  formatAppName,
  formatAppURL,
  version,
  logError,
  logWarn,
  isString,
  CompletionPath,
  createURL,
  isPlainObject,
  getEffectivePath,
  getBaseHTMLElement,
} from './libs/utils'
import {
  ObservedAttrName,
  lifeCycles,
  appStates,
} from './constants'
import CreateApp, {
  appInstanceMap,
} from './create_app'
import {
  router,
  getNoHashMicroPathFromURL,
  getRouterMode,
} from './sandbox/router'

/**
 * define element
 * @param tagName element name
*/
export function defineElement (tagName: string): void {
  class MicroAppElement extends getBaseHTMLElement() implements MicroAppElementType {
    static get observedAttributes (): string[] {
      return ['name', 'url']
    }

    private isWaiting = false
    private cacheData: Record<PropertyKey, unknown> | null = null
    private connectedCount = 0
    private connectStateMap: Map<number, boolean> = new Map()
    public appName = '' // app name
    public appUrl = '' // app url
    public ssrUrl = '' // html path in ssr mode
    public version = version

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

    public connectedCallback (): void {
      const cacheCount = ++this.connectedCount
      this.connectStateMap.set(cacheCount, true)
      /**
       * In some special scenes, such as vue's keep-alive, the micro-app will be inserted and deleted twice in an instant
       * So we execute the mount method async and record connectState to prevent repeated rendering
       */
      const effectiveApp = this.appName && this.appUrl
      defer(() => {
        if (this.connectStateMap.get(cacheCount)) {
          dispatchLifecyclesEvent(
            this,
            this.appName,
            lifeCycles.CREATED,
          )
          /**
           * If insert micro-app element without name or url, and set them in next action like angular,
           * handleConnected will be executed twice, causing the app render repeatedly,
           * so we only execute handleConnected() if url and name exist when connectedCallback
           */
          effectiveApp && this.handleConnected()
        }
      })
    }

    public disconnectedCallback (): void {
      this.connectStateMap.set(this.connectedCount, false)
      this.handleDisconnected()
    }

    /**
     * Re render app from the command line
     * MicroAppElement.reload(destroy)
     */
    public reload (destroy?: boolean): Promise<boolean> {
      return new Promise((resolve) => {
        const handleAfterReload = () => {
          this.removeEventListener(lifeCycles.MOUNTED, handleAfterReload)
          this.removeEventListener(lifeCycles.AFTERSHOW, handleAfterReload)
          resolve(true)
        }
        this.addEventListener(lifeCycles.MOUNTED, handleAfterReload)
        this.addEventListener(lifeCycles.AFTERSHOW, handleAfterReload)
        this.handleDisconnected(destroy, () => {
          this.handleConnected()
        })
      })
    }

    /**
     * common action for unmount
     * @param destroy reload param
     */
    private handleDisconnected (destroy = false, callback?: CallableFunction): void {
      const app = appInstanceMap.get(this.appName)
      if (app && !app.isUnmounted() && !app.isHidden()) {
        // keep-alive
        if (this.getKeepAliveModeResult() && !destroy) {
          this.handleHiddenKeepAliveApp(callback)
        } else {
          this.unmount(destroy, callback)
        }
      }
    }

    public attributeChangedCallback (attr: ObservedAttrName, _oldVal: string, newVal: string): void {
      if (
        this.legalAttribute(attr, newVal) &&
        this[attr === ObservedAttrName.NAME ? 'appName' : 'appUrl'] !== newVal
      ) {
        if (
          attr === ObservedAttrName.URL && (
            !this.appUrl ||
            !this.connectStateMap.get(this.connectedCount) // TODO: 这里的逻辑可否再优化一下
          )
        ) {
          newVal = formatAppURL(newVal, this.appName)
          if (!newVal) {
            return logError(`Invalid attribute url ${newVal}`, this.appName)
          }
          this.appUrl = newVal
          this.handleInitialNameAndUrl()
        } else if (
          attr === ObservedAttrName.NAME && (
            !this.appName ||
            !this.connectStateMap.get(this.connectedCount) // TODO: 这里的逻辑可否再优化一下
          )
        ) {
          const formatNewName = formatAppName(newVal)

          if (!formatNewName) {
            return logError(`Invalid attribute name ${newVal}`, this.appName)
          }

          // TODO: 当micro-app还未插入文档中就修改name，逻辑可否再优化一下
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
      this.connectStateMap.get(this.connectedCount) && this.handleConnected()
    }

    /**
     * first mount of this app
     */
    private handleConnected (): void {
      if (!this.appName || !this.appUrl) return

      // remove shadowDOM function
      // if (this.getDisposeResult('shadowDOM') && !this.shadowRoot && isFunction(this.attachShadow)) {
      //   this.attachShadow({ mode: 'open' })
      // }

      this.updateSsrUrl(this.appUrl)
      if (appInstanceMap.has(this.appName)) {
        const oldApp = appInstanceMap.get(this.appName)!
        const oldAppUrl = oldApp.ssrUrl || oldApp.url
        const targetUrl = this.ssrUrl || this.appUrl
        /**
         * NOTE:
         * 1. keep-alive don't care about ssrUrl
         * 2. Even if the keep-alive app is pushed into the background, it is still active and cannot be replaced. Otherwise, it is difficult for developers to troubleshoot in case of conflict and  will leave developers at a loss
         * 3. When scopecss, useSandbox of prefetch app different from target app, delete prefetch app and create new one
         */
        if (
          oldApp.isHidden() &&
          oldApp.url === this.appUrl
        ) {
          this.handleShowKeepAliveApp(oldApp)
        } else if (
          oldAppUrl === targetUrl && (
            oldApp.isUnmounted() ||
            (
              oldApp.isPrefetch &&
              this.sameCoreOptions(oldApp)
            )
          )
        ) {
          this.handleMount(oldApp)
        } else if (oldApp.isPrefetch || oldApp.isUnmounted()) {
          if (__DEV__ && this.sameCoreOptions(oldApp)) {
            /**
             * url is different & old app is unmounted or prefetch, create new app to replace old one
             */
            logWarn(`the ${oldApp.isPrefetch ? 'prefetch' : 'unmounted'} app with url ${oldAppUrl} replaced by a new app with url ${targetUrl}`, this.appName)
          }
          this.handleCreateApp()
        } else {
          logError(`app name conflict, an app named ${this.appName} with url ${oldAppUrl} is running`)
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
        const oldApp = appInstanceMap.get(formatAttrName)
        /**
         * If oldApp exist & appName is different, determine whether oldApp is running
         */
        if (formatAttrName !== this.appName && oldApp) {
          if (!oldApp.isUnmounted() && !oldApp.isHidden() && !oldApp.isPrefetch) {
            this.setAttribute('name', this.appName)
            return logError(`app name conflict, an app named ${formatAttrName} is running`)
          }
        }

        if (formatAttrName !== this.appName || formatAttrUrl !== this.appUrl) {
          if (formatAttrName === this.appName) {
            this.unmount(true, () => {
              this.actionsForAttributeChange(formatAttrName, formatAttrUrl, oldApp)
            })
          } else if (this.getKeepAliveModeResult()) {
            this.handleHiddenKeepAliveApp()
            this.actionsForAttributeChange(formatAttrName, formatAttrUrl, oldApp)
          } else {
            this.unmount(false, () => {
              this.actionsForAttributeChange(formatAttrName, formatAttrUrl, oldApp)
            })
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
      oldApp: AppInterface | void,
    ): void {
      /**
       * do not add judgment of formatAttrUrl === this.appUrl
       */
      this.updateSsrUrl(formatAttrUrl)

      this.appName = formatAttrName
      this.appUrl = formatAttrUrl
      ;(this.shadowRoot ?? this).innerHTML = ''
      if (formatAttrName !== this.getAttribute('name')) {
        this.setAttribute('name', this.appName)
      }

      /**
       * when oldApp not null: this.appName === oldApp.name
       * scene1: if formatAttrName and this.appName are equal: exitApp is the current app, the url must be different, oldApp has been unmounted
       * scene2: if formatAttrName and this.appName are different: oldApp must be prefetch or unmounted, if url is equal, then just mount, if url is different, then create new app to replace oldApp
       * scene3: url is different but ssrUrl is equal
       * scene4: url is equal but ssrUrl is different, if url is equal, name must different
       * scene5: if oldApp is KEEP_ALIVE_HIDDEN, name must different
       */
      if (oldApp) {
        if (oldApp.isHidden()) {
          if (oldApp.url === this.appUrl) {
            this.handleShowKeepAliveApp(oldApp)
          } else {
            // the hidden keep-alive app is still active
            logError(`app name conflict, an app named ${this.appName} is running`)
          }
        /**
         * TODO:
         *  1. oldApp必是unmountApp或preFetchApp，这里还应该考虑沙箱、iframe、样式隔离不一致的情况
         *  2. unmountApp要不要判断样式隔离、沙箱、iframe，然后彻底删除并再次渲染？(包括handleConnected里的处理，先不改？)
         * 推荐：if (
         *  oldApp.url === this.appUrl &&
         *  oldApp.ssrUrl === this.ssrUrl && (
         *    oldApp.isUnmounted() ||
         *    (oldApp.isPrefetch && this.sameCoreOptions(oldApp))
         *  )
         * )
         */
        } else if (oldApp.url === this.appUrl && oldApp.ssrUrl === this.ssrUrl) {
          // mount app
          this.handleMount(oldApp)
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

    // create app instance
    private handleCreateApp (): void {
      const createAppInstance = () => new CreateApp({
        name: this.appName,
        url: this.appUrl,
        container: this.shadowRoot ?? this,
        scopecss: this.useScopecss(),
        useSandbox: this.useSandbox(),
        inline: this.getDisposeResult('inline'),
        iframe: this.getDisposeResult('iframe'),
        ssrUrl: this.ssrUrl,
        routerMode: this.getMemoryRouterMode(),
      })

      /**
       * Actions for destroy old app
       * If oldApp exist, it must be 3 scenes:
       *  1. oldApp is unmounted app (url is is different)
       *  2. oldApp is prefetch, not prerender (url, scopecss, useSandbox, iframe is different)
       *  3. oldApp is prerender (url, scopecss, useSandbox, iframe is different)
       */
      const oldApp = appInstanceMap.get(this.appName)
      if (oldApp) {
        if (oldApp.isPrerender) {
          this.unmount(true, createAppInstance)
        } else {
          oldApp.actionsForCompletelyDestroy()
          createAppInstance()
        }
      } else {
        createAppInstance()
      }
    }

    /**
     * mount app
     * some serious note before mount:
     * 1. is prefetch ?
     * 2. is remount in another container ?
     * 3. is remount with change properties of the container ?
     */
    private handleMount (app: AppInterface): void {
      app.isPrefetch = false
      /**
       * Fix error when navigate before app.mount by microApp.router.push(...)
       * Issue: https://github.com/micro-zoe/micro-app/issues/908
       */
      app.setAppState(appStates.BEFORE_MOUNT)
      // exec mount async, simulate the first render scene
      defer(() => this.mount(app))
    }

    /**
     * public mount action for micro_app_element & create_app
     */
    public mount (app: AppInterface): void {
      app.mount({
        container: this.shadowRoot ?? this,
        inline: this.getDisposeResult('inline'),
        routerMode: this.getMemoryRouterMode(),
        baseroute: this.getBaseRouteCompatible(),
        defaultPage: this.getDefaultPage(),
        disablePatchRequest: this.getDisposeResult('disable-patch-request'),
        fiber: this.getDisposeResult('fiber'),
      })
    }

    /**
     * unmount app
     * @param destroy delete cache resources when unmount
     * @param unmountcb callback
     */
    public unmount (destroy?: boolean, unmountcb?: CallableFunction): void {
      const app = appInstanceMap.get(this.appName)
      if (app && !app.isUnmounted()) {
        app.unmount({
          destroy: destroy || this.getDestroyCompatibleResult(),
          clearData: this.getDisposeResult('clear-data'),
          keepRouteState: this.getDisposeResult('keep-router-state'),
          unmountcb,
        })
      }
    }

    // hidden app when disconnectedCallback called with keep-alive
    private handleHiddenKeepAliveApp (callback?: CallableFunction): void {
      const app = appInstanceMap.get(this.appName)
      if (app && !app.isUnmounted() && !app.isHidden()) {
        app.hiddenKeepAliveApp(callback)
      }
    }

    // show app when connectedCallback called with keep-alive
    private handleShowKeepAliveApp (app: AppInterface): void {
      // must be async
      defer(() => app.showKeepAliveApp(this.shadowRoot ?? this))
    }

    /**
     * Get configuration
     * Global setting is lowest priority
     * @param name Configuration item name
     */
    private getDisposeResult <T extends keyof OptionsType> (name: T): boolean {
      return (this.compatibleProperties(name) || !!microApp.options[name]) && this.compatibleDisableProperties(name)
    }

    // compatible of disableScopecss & disableSandbox
    private compatibleProperties (name: string): boolean {
      if (name === 'disable-scopecss') {
        return this.hasAttribute('disable-scopecss') || this.hasAttribute('disableScopecss')
      } else if (name === 'disable-sandbox') {
        return this.hasAttribute('disable-sandbox') || this.hasAttribute('disableSandbox')
      }
      return this.hasAttribute(name)
    }

    // compatible of disableScopecss & disableSandbox
    private compatibleDisableProperties (name: string): boolean {
      if (name === 'disable-scopecss') {
        return this.getAttribute('disable-scopecss') !== 'false' && this.getAttribute('disableScopecss') !== 'false'
      } else if (name === 'disable-sandbox') {
        return this.getAttribute('disable-sandbox') !== 'false' && this.getAttribute('disableSandbox') !== 'false'
      }
      return this.getAttribute(name) !== 'false'
    }

    private useScopecss (): boolean {
      return !(this.getDisposeResult('disable-scopecss') || this.getDisposeResult('shadowDOM'))
    }

    private useSandbox (): boolean {
      return !this.getDisposeResult('disable-sandbox')
    }

    /**
     * Determine whether the core options of the existApp is consistent with the new one
     */
    private sameCoreOptions (app: AppInterface): boolean {
      return (
        app.scopecss === this.useScopecss() &&
        app.useSandbox === this.useSandbox() &&
        app.iframe === this.getDisposeResult('iframe')
      )
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
     * change ssrUrl in ssr mode
     */
    private updateSsrUrl (baseUrl: string): void {
      if (this.getDisposeResult('ssr')) {
        // TODO: disable-memory-router不存在了，这里需要更新一下
        if (this.getDisposeResult('disable-memory-router') || this.getDisposeResult('disableSandbox')) {
          const rawLocation = globalEnv.rawWindow.location
          this.ssrUrl = CompletionPath(rawLocation.pathname + rawLocation.search, baseUrl)
        } else {
          // get path from browser URL
          // TODO: 新版本路由系统要重新兼容ssr
          let targetPath = getNoHashMicroPathFromURL(this.appName, baseUrl)
          const defaultPagePath = this.getDefaultPage()
          if (!targetPath && defaultPagePath) {
            const targetLocation = createURL(defaultPagePath, baseUrl)
            targetPath = targetLocation.origin + targetLocation.pathname + targetLocation.search
          }
          this.ssrUrl = targetPath
        }
      } else if (this.ssrUrl) {
        this.ssrUrl = ''
      }
    }

    /**
     * get config of default page
     */
    private getDefaultPage (): string {
      return (
        router.getDefaultPage(this.appName) ||
        this.getAttribute('default-page') ||
        this.getAttribute('defaultPage') ||
        ''
      )
    }

    /**
     * get config of router-mode
     * @returns router-mode
     */
    private getMemoryRouterMode () : string {
      return getRouterMode(
        this.getAttribute('router-mode'),
        // is micro-app element set disable-memory-router, like <micro-app disable-memory-router></micro-app>
        this.compatibleProperties('disable-memory-router') && this.compatibleDisableProperties('disable-memory-router'),
      )
    }

    /**
     * rewrite micro-app.setAttribute, process attr data
     * @param key attr name
     * @param value attr value
     */
    public setAttribute (key: string, value: any): void {
      if (key === 'data') {
        if (isPlainObject(value)) {
          const cloneValue: Record<NormalKey, unknown> = {}
          Object.getOwnPropertyNames(value).forEach((ownKey: NormalKey) => {
            if (!(isString(ownKey) && ownKey.indexOf('__') === 0)) {
              cloneValue[ownKey] = value[ownKey]
            }
          })
          this.data = cloneValue
        } else if (value !== '[object Object]') {
          logWarn('property data must be an object', this.appName)
        }
      } else {
        globalEnv.rawSetAttribute.call(this, key, value)
      }
    }

    /**
     * Data from the base application
     */
    set data (value: Record<PropertyKey, unknown> | null) {
      if (this.appName) {
        microApp.setData(this.appName, value as Record<PropertyKey, unknown>)
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

    /**
     * get publicPath from a valid address,it can used in micro-app-devtools
     */
    get publicPath (): string {
      return getEffectivePath(this.appUrl)
    }

    /**
     * get baseRoute from attribute,it can used in micro-app-devtools
     */
    get baseRoute (): string {
      return this.getBaseRouteCompatible()
    }
  }

  globalEnv.rawWindow.customElements.define(tagName, MicroAppElement)
}
