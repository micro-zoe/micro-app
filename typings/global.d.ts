declare module '@micro-app/types' {
  type AttrType = string | null

  type Func = (...rest: any[]) => void

  type microAppWindowType = Window & any

  interface SandBoxInterface {
    proxyWindow: WindowProxy
    microAppWindow: Window // Proxy target
    start (baseRoute: string): void
    stop (): void
    // record umd snapshot before the first execution of umdHookMount
    recordUmdSnapshot (): void
    // rebuild umd snapshot before remount umd app
    rebuildUmdSnapshot (): void
  }

  type sourceLinkInfo = {
    code: string // code
    placeholder?: Comment | null // placeholder comment
    isGlobal: boolean // is global asset
  }

  type sourceScriptInfo = {
    code: string // code
    isExternal: boolean // external script
    isDynamic: boolean // dynamic create script
    async: boolean // async script
    defer: boolean // defer script
    module: boolean // module type script
    isGlobal?: boolean // share js to global
    code2Function?: Function // code to Function
  }

  interface sourceType {
    html?: HTMLElement
    links: Map<string, sourceLinkInfo>
    scripts: Map<string, sourceScriptInfo>
  }

  // app instance
  interface AppInterface {
    isPrefetch: boolean // whether prefetch app, default is false
    prefetchResolve: (() => void) | null // prefetch callback
    name: string // app name
    url: string // app url
    ssrUrl: string // html path in ssr mode
    container: HTMLElement | ShadowRoot | null // container maybe null, micro-app, shadowRoot, DIV(keep-alive)
    inline: boolean //  whether js runs in inline script mode, default is false
    scopecss: boolean // whether use css scoped, default is true
    useSandbox: boolean // whether use js sandbox, default is true
    baseroute: string // route prefix, default is ''
    source: sourceType // sources of css, js, html
    sandBox: SandBoxInterface | null // sandbox
    umdMode: boolean // is umd mode

    // Load resources
    loadSourceCode (): void

    // resource is loaded
    onLoad (html: HTMLElement): void

    // Error loading HTML
    onLoadError (e: Error): void

    // sync style
    asyncStyleFromAppTag(microAppBody: HTMLElement): void

    // mount app
    mount (
      container?: HTMLElement | ShadowRoot,
      inline?: boolean,
      baseroute?: string,
    ): void

    // unmount app
    unmount (destroy: boolean, unmountcb?: CallableFunction): void

    // app rendering error
    onerror (e: Error): void

    // get app state
    getAppState (): string

    getKeepAliveState(): string | null

    // actions for completely destroy
    actionsForCompletelyDestroy (): void

    // hidden app when disconnectedCallback with keep-alive
    hiddenKeepAliveApp (): void

    // show app when connectedCallback with keep-alive
    showKeepAliveApp (container: HTMLElement | ShadowRoot): void
  }

  interface MicroAppElementType {
    appName: AttrType // app name
    appUrl: AttrType // app url

    // Hooks for element append to documents
    connectedCallback (): void

    // Hooks for element delete from documents
    disconnectedCallback (): void

    // Hooks for element attributes change
    attributeChangedCallback (a: 'name' | 'url', o: string, n: string): void
  }

  type prefetchParam = {
    name: string,
    url: string,
    disableScopecss?: boolean
    disableSandbox?: boolean
    shadowDOM?: boolean
  }

  // prefetch params
  type prefetchParamList = Array<prefetchParam> | (() => Array<prefetchParam>)

  // lifeCycles
  interface lifeCyclesType {
    created?(e?: CustomEvent): void
    beforemount?(e?: CustomEvent): void
    mounted?(e?: CustomEvent): void
    unmount?(e?: CustomEvent): void
    error?(e?: CustomEvent): void
  }

  type AssetsChecker = (url: string) => boolean;

  type plugins = {
    // global plugin
    global?: Array<{
      // Scoped global Properties
      scopeProperties?: Array<PropertyKey>
      // Properties that can be escape to rawWindow
      escapeProperties?: Array<PropertyKey>
      // Exclude JS or CSS
      excludeChecker?: AssetsChecker
      // Ignore JS or CSS
      ignoreChecker?: AssetsChecker
      // options for plugin as the third parameter of loader
      options?: unknown
      // handle function
      loader?: (code: string, url: string, options: unknown, info: sourceScriptInfo) => string
      // html processor
      processHtml?: (code: string, url: string, options: unknown) => string
    }>

    // plugin for special app
    modules?: {
      [name: string]: Array<{
        // Scoped global Properties
        scopeProperties?: Array<PropertyKey>
        // Properties that can be escape to rawWindow
        escapeProperties?: Array<PropertyKey>
        // Exclude JS or CSS
        excludeChecker?: AssetsChecker
        // Ignore JS or CSS
        ignoreChecker?: AssetsChecker
        // options for plugin as the third parameter of loader
        options?: unknown
        // handle function
        loader?: (code: string, url: string, options: unknown, info: sourceScriptInfo) => string
        // html processor
        processHtml?: (code: string, url: string, options: unknown) => string
      }>
    }
  }

  type fetchType = (url: string, options: Record<string, unknown>, appName: string | null) => Promise<string>

  type globalAssetsType = {
    js?: string[],
    css?: string[],
  }

  type OptionsType = {
    tagName?: string
    shadowDOM?: boolean
    destroy?: boolean
    inline?: boolean
    disableScopecss?: boolean
    disableSandbox?: boolean
    ssr?: boolean
    lifeCycles?: lifeCyclesType
    preFetchApps?: prefetchParamList
    plugins?: plugins
    fetch?: fetchType
    globalAssets?: globalAssetsType,
  }

  // MicroApp config
  interface MicroAppConfigType {
    tagName: string
    shadowDOM?: boolean
    destroy?: boolean
    inline?: boolean
    disableScopecss?: boolean
    disableSandbox?: boolean
    ssr?: boolean
    lifeCycles?: lifeCyclesType
    plugins?: plugins
    fetch?: fetchType
    preFetch(apps: prefetchParamList): void
    start(options?: OptionsType): void
  }

  // special CallableFunction for interact
  type CallableFunctionForInteract = CallableFunction & { __APP_NAME__?: string, __AUTO_TRIGGER__?: boolean }
}

declare namespace JSX {
  interface IntrinsicElements {
    'micro-app': any
  }
}

declare module '@micro-zoe/micro-app/polyfill/jsx-custom-event'

declare const __DEV__: boolean

declare const __TEST__: boolean
