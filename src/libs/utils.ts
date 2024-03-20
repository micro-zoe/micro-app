/* eslint-disable no-new-func, indent, no-self-compare, @typescript-eslint/explicit-module-boundary-types */
import type {
  Func,
  LocationQueryObject,
  LocationQueryValue,
  MicroLocation,
  AttrsType,
  fiberTasks,
  MicroAppElementTagNameMap,
} from '@micro-app/types'

export const version = '__MICRO_APP_VERSION__'

// do not use isUndefined
export const isBrowser = typeof window !== 'undefined'

// do not use isUndefined
export const globalThis = (typeof global !== 'undefined')
  ? global
  : (
    (typeof window !== 'undefined')
      ? window
      : (
        (typeof self !== 'undefined') ? self : Function('return this')()
      )
  )

export const noop = () => {}
export const noopFalse = () => false

// Array.isArray
export const isArray = Array.isArray
// Object.assign
export const assign = Object.assign

// Object prototype methods
export const rawDefineProperty = Object.defineProperty
export const rawDefineProperties = Object.defineProperties
export const rawToString = Object.prototype.toString
export const rawHasOwnProperty = Object.prototype.hasOwnProperty

export const toTypeString = (value: unknown): string => rawToString.call(value)

// is Undefined
export function isUndefined (target: unknown): target is undefined {
  return target === undefined
}

// is Null
export function isNull (target: unknown): target is null {
  return target === null
}

// is String
export function isString (target: unknown): target is string {
  return typeof target === 'string'
}

// is Boolean
export function isBoolean (target: unknown): target is boolean {
  return typeof target === 'boolean'
}

// is Number
export function isNumber (target: unknown): target is Number {
  return typeof target === 'number'
}

// is function
export function isFunction (target: unknown): target is Function {
  return typeof target === 'function'
}

// is PlainObject
export function isPlainObject <T = Record<PropertyKey, unknown>> (target: unknown): target is T {
  return toTypeString(target) === '[object Object]'
}

// is Object
export function isObject (target: unknown): target is Object {
  return !isNull(target) && typeof target === 'object'
}

// is Promise
export function isPromise (target: unknown): target is Promise<unknown> {
  return toTypeString(target) === '[object Promise]'
}

// is bind function
export function isBoundFunction (target: unknown): boolean {
  return isFunction(target) && target.name.indexOf('bound ') === 0 && !target.hasOwnProperty('prototype')
}

// is constructor function
export function isConstructor (target: unknown): boolean {
  if (isFunction(target)) {
    const targetStr = target.toString()
    return (
      target.prototype?.constructor === target &&
      Object.getOwnPropertyNames(target.prototype).length > 1
    ) ||
      /^function\s+[A-Z]/.test(targetStr) ||
      /^class\s+/.test(targetStr)
  }
  return false
}

// is ShadowRoot
export function isShadowRoot (target: unknown): target is ShadowRoot {
  return typeof ShadowRoot !== 'undefined' && target instanceof ShadowRoot
}

export function isURL (target: unknown): target is URL {
  return target instanceof URL || !!(target as URL)?.href
}

// iframe element not instanceof base app Element, use tagName instead
export function isElement (target: unknown): target is Element {
  return target instanceof Element || isString((target as Element)?.tagName)
}

// iframe node not instanceof base app Node, use nodeType instead
export function isNode (target: unknown): target is Node {
  return target instanceof Node || isNumber((target as Node)?.nodeType)
}

export function isLinkElement (target: unknown): target is HTMLLinkElement {
  return toTypeString(target) === '[object HTMLLinkElement]'
}

export function isStyleElement (target: unknown): target is HTMLStyleElement {
  return toTypeString(target) === '[object HTMLStyleElement]'
}

export function isScriptElement (target: unknown): target is HTMLScriptElement {
  return toTypeString(target) === '[object HTMLScriptElement]'
}

export function isIFrameElement (target: unknown): target is HTMLIFrameElement {
  return toTypeString(target) === '[object HTMLIFrameElement]'
}

export function isDivElement (target: unknown): target is HTMLDivElement {
  return toTypeString(target) === '[object HTMLDivElement]'
}

export function isImageElement (target: unknown): target is HTMLImageElement {
  return toTypeString(target) === '[object HTMLImageElement]'
}

export function isBaseElement (target: unknown): target is HTMLBaseElement {
  return toTypeString(target) === '[object HTMLBaseElement]'
}

export function isMicroAppBody (target: unknown): target is HTMLElement {
  return isElement(target) && target.tagName.toUpperCase() === 'MICRO-APP-BODY'
}

// is ProxyDocument
export function isProxyDocument (target: unknown): target is Document {
  return toTypeString(target) === '[object ProxyDocument]'
}

export function includes (target: unknown[], searchElement: unknown, fromIndex?: number): boolean {
  if (target == null) {
    throw new TypeError('includes target is null or undefined')
  }

  const O = Object(target)
  const len = parseInt(O.length, 10) || 0
  if (len === 0) return false
  // @ts-ignore
  fromIndex = parseInt(fromIndex, 10) || 0
  let i = Math.max(fromIndex >= 0 ? fromIndex : len + fromIndex, 0)
  while (i < len) {
    // NaN !== NaN
    if (searchElement === O[i] || (searchElement !== searchElement && O[i] !== O[i])) {
      return true
    }
    i++
  }
  return false
}

/**
 * format error log
 * @param msg message
 * @param appName app name, default is null
 */
export function logError (
  msg: unknown,
  appName: string | null = null,
  ...rest: unknown[]
): void {
  const appNameTip = appName && isString(appName) ? ` app ${appName}:` : ''
  if (isString(msg)) {
    console.error(`[micro-app]${appNameTip} ${msg}`, ...rest)
  } else {
    console.error(`[micro-app]${appNameTip}`, msg, ...rest)
  }
}

/**
 * format warn log
 * @param msg message
 * @param appName app name, default is null
 */
export function logWarn (
  msg: unknown,
  appName: string | null = null,
  ...rest: unknown[]
): void {
  const appNameTip = appName && isString(appName) ? ` app ${appName}:` : ''
  if (isString(msg)) {
    console.warn(`[micro-app]${appNameTip} ${msg}`, ...rest)
  } else {
    console.warn(`[micro-app]${appNameTip}`, msg, ...rest)
  }
}

/**
 * async execution
 * @param fn callback
 * @param args params
 */
export function defer (fn: Func, ...args: unknown[]): void {
  Promise.resolve().then(fn.bind(null, ...args))
}

/**
 * create URL as MicroLocation
 */
export const createURL = (function (): (path: string | URL, base?: string) => MicroLocation {
  class Location extends URL {}
  return (path: string | URL, base?: string): MicroLocation => {
    return (base ? new Location('' + path, base) : new Location('' + path)) as MicroLocation
  }
})()

/**
 * Add address protocol
 * @param url address
 */
export function addProtocol (url: string): string {
  return url.startsWith('//') ? `${globalThis.location.protocol}${url}` : url
}

/**
 * format URL address
 * note the scenes:
 * 1. micro-app -> attributeChangedCallback
 * 2. preFetch
 */
export function formatAppURL (url: string | null, appName: string | null = null): string {
  if (!isString(url) || !url) return ''

  try {
    const { origin, pathname, search } = createURL(addProtocol(url), (window.rawWindow || window).location.href)
    // If it ends with .html/.node/.php/.net/.etc, don’t need to add /
    if (/\.(\w+)$/.test(pathname)) {
      return `${origin}${pathname}${search}`
    }
    const fullPath = `${origin}${pathname}/`.replace(/\/\/$/, '/')
    return /^https?:\/\//.test(fullPath) ? `${fullPath}${search}` : ''
  } catch (e) {
    logError(e, appName)
    return ''
  }
}

/**
 * format name
 * note the scenes:
 * 1. micro-app -> attributeChangedCallback
 * 2. event_center -> EventCenterForMicroApp -> constructor
 * 3. event_center -> EventCenterForBaseApp -> all methods
 * 4. preFetch
 * 5. plugins
 * 6. router api (push, replace)
 */
export function formatAppName (name: string | null): string {
  if (!isString(name) || !name) return ''
  return name.replace(/(^\d+)|([^\w\d-_])/gi, '')
}

/**
 * Get valid address, such as https://xxx/xx/xx.html to https://xxx/xx/
 * @param url app.url
 */
export function getEffectivePath (url: string): string {
  const { origin, pathname } = createURL(url)
  if (/\.(\w+)$/.test(pathname)) {
    const fullPath = `${origin}${pathname}`
    const pathArr = fullPath.split('/')
    pathArr.pop()
    return pathArr.join('/') + '/'
  }

  return `${origin}${pathname}/`.replace(/\/\/$/, '/')
}

/**
 * Complete address
 * @param path address
 * @param baseURI base url(app.url)
 */
export function CompletionPath (path: string, baseURI: string): string {
  if (
    !path ||
    /^((((ht|f)tps?)|file):)?\/\//.test(path) ||
    /^(data|blob):/.test(path)
  ) return path

  return createURL(path, getEffectivePath(addProtocol(baseURI))).toString()
}

/**
 * Get the folder where the link resource is located,
 * which is used to complete the relative address in the css
 * @param linkPath full link address
 */
export function getLinkFileDir (linkPath: string): string {
  const pathArr = linkPath.split('/')
  pathArr.pop()
  return addProtocol(pathArr.join('/') + '/')
}

/**
 * promise stream
 * @param promiseList promise list
 * @param successCb success callback
 * @param errorCb failed callback
 * @param finallyCb finally callback
 */
export function promiseStream <T> (
  promiseList: Array<Promise<T> | T>,
  successCb: CallableFunction,
  errorCb: CallableFunction,
  finallyCb?: CallableFunction,
): void {
  let finishedNum = 0

  function isFinished () {
    if (++finishedNum === promiseList.length && finallyCb) finallyCb()
  }

  promiseList.forEach((p, i) => {
    if (isPromise(p)) {
      (p as Promise<T>).then((res: T) => {
        successCb({ data: res, index: i })
        isFinished()
      }).catch((err: Error) => {
        errorCb({ error: err, index: i })
        isFinished()
      })
    } else {
      successCb({ data: p, index: i })
      isFinished()
    }
  })
}

// Check whether the browser supports module script
export function isSupportModuleScript (): boolean {
  const s = document.createElement('script')
  return 'noModule' in s
}

// Create a random symbol string
export function createNonceSrc (): string {
  return 'inline-' + Math.random().toString(36).substr(2, 15)
}

// Array deduplication
export function unique (array: any[]): any[] {
  return array.filter(function (this: Record<PropertyKey, boolean>, item) {
    return item in this ? false : (this[item] = true)
  }, Object.create(null))
}

// requestIdleCallback polyfill
export const requestIdleCallback = globalThis.requestIdleCallback ||
  function (fn: CallableFunction) {
    const lastTime = Date.now()
    return setTimeout(function () {
      fn({
        didTimeout: false,
        timeRemaining () {
          return Math.max(0, 50 - (Date.now() - lastTime))
        },
      })
    }, 1)
  }

/**
 * Wrap requestIdleCallback with promise
 * Exec callback when browser idle
 */
export function promiseRequestIdle (callback: CallableFunction): Promise<void> {
  return new Promise((resolve) => {
    requestIdleCallback(() => {
      callback(resolve)
    })
  })
}

/**
 * Record the currently running app.name
 */
let currentMicroAppName: string | null = null
export function setCurrentAppName (appName: string | null): void {
  currentMicroAppName = appName
}

// get the currently running app.name
export function getCurrentAppName (): string | null {
  return currentMicroAppName
}

// Clear appName
let preventSetAppName = false
export function removeDomScope (force?: boolean): void {
  setCurrentAppName(null)
  if (force && !preventSetAppName) {
    preventSetAppName = true
    defer(() => {
      preventSetAppName = false
    })
  }
}

export function throttleDeferForSetAppName (appName: string) {
  if (currentMicroAppName !== appName && !preventSetAppName) {
    setCurrentAppName(appName)
    defer(() => {
      setCurrentAppName(null)
    })
  }
}

// is safari browser
export function isSafari (): boolean {
  return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
}

/**
 * Create pure elements
 */
export function pureCreateElement<K extends keyof MicroAppElementTagNameMap> (tagName: K, options?: ElementCreationOptions): MicroAppElementTagNameMap[K] {
  const element = (window.rawDocument || document).createElement(tagName, options)
  if (element.__MICRO_APP_NAME__) delete element.__MICRO_APP_NAME__
  element.__PURE_ELEMENT__ = true
  return element
}

// is invalid key of querySelector
export function isInvalidQuerySelectorKey (key: string): boolean {
  if (__TEST__) return !key || /(^\d)|([^\w\d-_$])/gi.test(key)
  return !key || /(^\d)|([^\w\d-_\u4e00-\u9fa5])/gi.test(key)
}

// unique element
export function isUniqueElement (key: string): boolean {
  return (
    /^body$/i.test(key) ||
    /^head$/i.test(key) ||
    /^html$/i.test(key) ||
    /^title$/i.test(key) ||
    /^:root$/i.test(key)
  )
}

/**
 * get micro-app element
 * @param target app container
 */
export function getRootContainer (target: HTMLElement | ShadowRoot): HTMLElement {
  return (isShadowRoot(target) ? (target as ShadowRoot).host : target) as HTMLElement
}

/**
 * trim start & end
 */
export function trim (str: string): string {
  return str ? str.replace(/^\s+|\s+$/g, '') : ''
}

export function isFireFox (): boolean {
  return navigator.userAgent.indexOf('Firefox') > -1
}

/**
 * Transforms a queryString into object.
 * @param search - search string to parse
 * @returns a query object
 */
export function parseQuery (search: string): LocationQueryObject {
  const result: LocationQueryObject = {}
  const queryList = search.split('&')

  // we will not decode the key/value to ensure that the values are consistent when update URL
  for (const queryItem of queryList) {
    const eqPos = queryItem.indexOf('=')
    const key = eqPos < 0 ? queryItem : queryItem.slice(0, eqPos)
    const value = eqPos < 0 ? null : queryItem.slice(eqPos + 1)

    if (key in result) {
      let currentValue = result[key]
      if (!isArray(currentValue)) {
        currentValue = result[key] = [currentValue]
      }
      currentValue.push(value)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Transforms an object to query string
 * @param queryObject - query object to stringify
 * @returns query string without the leading `?`
 */
export function stringifyQuery (queryObject: LocationQueryObject): string {
  let result = ''

  for (const key in queryObject) {
    const value = queryObject[key]
    if (isNull(value)) {
      result += (result.length ? '&' : '') + key
    } else {
      const valueList: LocationQueryValue[] = isArray(value) ? value : [value]

      valueList.forEach(value => {
        if (!isUndefined(value)) {
          result += (result.length ? '&' : '') + key
          if (!isNull(value)) result += '=' + value
        }
      })
    }
  }

  return result
}

/**
 * Register or unregister callback/guard with Set
 */
export function useSetRecord<T> () {
  const handlers: Set<T> = new Set()

  function add (handler: T): () => boolean {
    handlers.add(handler)
    return (): boolean => {
      if (handlers.has(handler)) return handlers.delete(handler)
      return false
    }
  }

  return {
    add,
    list: () => handlers,
  }
}

/**
 * record data with Map
 */
export function useMapRecord<T> () {
  const data: Map<PropertyKey, T> = new Map()

  function add (key: PropertyKey, value: T): () => boolean {
    data.set(key, value)
    return (): boolean => {
      if (data.has(key)) return data.delete(key)
      return false
    }
  }

  return {
    add,
    get: (key: PropertyKey) => data.get(key),
    delete: (key: PropertyKey): boolean => {
      if (data.has(key)) return data.delete(key)
      return false
    }
  }
}

export function getAttributes (element: Element): AttrsType {
  const attr = element.attributes
  const attrMap: AttrsType = new Map()
  for (let i = 0; i < attr.length; i++) {
    attrMap.set(attr[i].name, attr[i].value)
  }
  return attrMap
}

/**
 * if fiberTasks exist, wrap callback with promiseRequestIdle
 * if not, execute callback
 * @param fiberTasks fiber task list
 * @param callback action callback
 */
export function injectFiberTask (fiberTasks: fiberTasks, callback: CallableFunction): void {
  if (fiberTasks) {
    fiberTasks.push(() => promiseRequestIdle((resolve: PromiseConstructor['resolve']) => {
      callback()
      resolve()
    }))
  } else {
    callback()
  }
}

/**
 * serial exec fiber task of link, style, script
 * @param tasks task array or null
 */
export function serialExecFiberTasks (tasks: fiberTasks): Promise<void> | null {
  return tasks?.reduce((pre, next) => pre.then(next), Promise.resolve()) || null
}

/**
 * inline script start with inline-xxx
 * @param address source address
 */
export function isInlineScript (address: string): boolean {
  return address.startsWith('inline-')
}

/**
 * call function with try catch
 * @param fn target function
 * @param appName app.name
 * @param args arguments
 */
export function execMicroAppGlobalHook (
  fn: Func | null,
  appName: string,
  hookName: string,
  ...args: unknown[]
): void {
  try {
    isFunction(fn) && fn(...args)
  } catch (e) {
    logError(`An error occurred in app ${appName} window.${hookName} \n`, null, e)
  }
}

/**
 * remove all childNode from target node
 * @param $dom target node
 */
export function clearDOM ($dom: HTMLElement | ShadowRoot | Document): void {
  while ($dom?.firstChild) {
    $dom.removeChild($dom.firstChild)
  }
}

type BaseHTMLElementType = HTMLElement & {
  new (): HTMLElement;
  prototype: HTMLElement;
}

/**
 * get HTMLElement from base app
 * @returns HTMLElement
 */
export function getBaseHTMLElement (): BaseHTMLElementType {
  return (window.rawWindow?.HTMLElement || window.HTMLElement) as BaseHTMLElementType
}

export function instanceOf<T extends new (...args: unknown[]) => unknown>(
  instance: unknown,
  constructor: T,
): instance is T extends new (...args: unknown[]) => infer R ? R : boolean {
  if (instance === null || instance === undefined) {
    return false
  } else if (!isFunction(constructor)) {
    throw new TypeError("Right-hand side of 'instanceof' is not callable")
  }
  let proto = Object.getPrototypeOf(instance)
  while (proto) {
    if (proto === constructor.prototype) {
      return true
    }
    proto = Object.getPrototypeOf(proto)
  }
  return false
}
