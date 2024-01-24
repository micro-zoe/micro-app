/* eslint-disable no-cond-assign */
import type {
  CommonEffectHook,
  MicroEventListener,
  WithSandBoxInterface,
  microAppWindowType,
} from '@micro-app/types'
import globalEnv from '../../libs/global_env'
import bindFunctionToRawTarget from '../bind_function'
import {
  throttleDeferForSetAppName,
  isFunction,
  rawDefineProperties,
} from '../../libs/utils'
import {
  appInstanceMap,
} from '../../create_app'
import microApp from '../../micro_app'
import {
  SCOPE_DOCUMENT_EVENT,
} from '../../constants'

/**
 * create proxyDocument and MicroDocument, rewrite document of child app
 * @param appName app name
 * @param microAppWindow Proxy target
 * @returns EffectHook
 */
export function patchDocument (
  appName: string,
  microAppWindow: microAppWindowType,
  sandbox: WithSandBoxInterface,
): CommonEffectHook {
  const { proxyDocument, documentEffect } = createProxyDocument(appName, sandbox)
  const MicroDocument = createMicroDocument(appName, proxyDocument)
  rawDefineProperties(microAppWindow, {
    document: {
      configurable: false,
      enumerable: true,
      get () {
        // return globalEnv.rawDocument
        return proxyDocument
      },
    },
    Document: {
      configurable: false,
      enumerable: false,
      get () {
        // return globalEnv.rawRootDocument
        return MicroDocument
      },
    }
  })

  return documentEffect
}

/**
 * Create new document and Document
 */
function createProxyDocument (
  appName: string,
  sandbox: WithSandBoxInterface,
): {
    proxyDocument: Document,
    documentEffect: CommonEffectHook,
  } {
  const eventListenerMap = new Map<string, Set<MicroEventListener>>()
  const sstEventListenerMap = new Map<string, Set<MicroEventListener>>()
  const microAppContainer: HTMLElement | ShadowRoot | null | undefined = appInstanceMap.get(appName)?.container
  let onClickHandler: unknown = null
  let sstOnClickHandler: unknown = null
  const {
    rawDocument,
    rawCreateElement,
    rawAddEventListener,
    rawRemoveEventListener,
  } = globalEnv

  function createElement (tagName: string, options?: ElementCreationOptions): HTMLElement {
    const element = rawCreateElement.call(rawDocument, tagName, options)
    element.__MICRO_APP_NAME__ = appName
    return element
  }

  function getEventTarget (type: string, bindTarget: Document | HTMLElement | ShadowRoot): Document {
    return SCOPE_DOCUMENT_EVENT.includes(type) ? bindTarget : rawDocument
  }

  /**
   * TODO:
   *  1. listener 是否需要绑定proxyDocument，否则函数中的this指向原生window
   *  2. 相似代码提取为公共方法(with, iframe)
   *  3. 如果this不指向proxyDocument 和 rawDocument，则需要特殊处理
   */
  function addEventListener (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    const listenerList = eventListenerMap.get(type)
    if (listenerList) {
      listenerList.add(listener)
    } else {
      eventListenerMap.set(type, new Set([listener]))
    }
    listener && (listener.__MICRO_APP_MARK_OPTIONS__ = options)
    rawAddEventListener.call(getEventTarget(type, microAppContainer!), type, listener, options)
  }

  function removeEventListener (
    type: string,
    listener: MicroEventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const listenerList = eventListenerMap.get(type)
    if (listenerList?.size && listenerList.has(listener)) {
      listenerList.delete(listener)
    }
    rawRemoveEventListener.call(getEventTarget(type, microAppContainer!), type, listener, options)
  }

  // reset snapshot data
  const reset = (): void => {
    sstEventListenerMap.clear()
    sstOnClickHandler = null
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
   */
  const record = (): void => {
    /**
     * record onclick handler
     * onClickHandler maybe set again after prerender/keep-alive app hidden
     */
    sstOnClickHandler = onClickHandler || sstOnClickHandler

    // record document event
    eventListenerMap.forEach((listenerList, type) => {
      if (listenerList.size) {
        const cacheList = sstEventListenerMap.get(type) || []
        sstEventListenerMap.set(type, new Set([...cacheList, ...listenerList]))
      }
    })
  }

  // rebuild event and timer before remount app
  const rebuild = (): void => {
    // rebuild onclick event
    if (sstOnClickHandler && !onClickHandler) proxyDocument.onclick = sstOnClickHandler

    // rebuild document event
    sstEventListenerMap.forEach((listenerList, type) => {
      for (const listener of listenerList) {
        proxyDocument.addEventListener(type, listener, listener?.__MICRO_APP_MARK_OPTIONS__)
      }
    })

    reset()
  }

  // release all event listener & interval & timeout when unmount app
  const release = (): void => {
    // Clear the function bound by micro app through document.onclick
    if (isFunction(onClickHandler)) {
      rawRemoveEventListener.call(rawDocument, 'click', onClickHandler)
    }
    onClickHandler = null

    // Clear document binding event
    if (eventListenerMap.size) {
      eventListenerMap.forEach((listenerList, type) => {
        for (const listener of listenerList) {
          rawRemoveEventListener.call(getEventTarget(type, microAppContainer!), type, listener)
        }
      })
      eventListenerMap.clear()
    }
  }

  const genProxyDocumentProps = () => {
    // microApp framework built-in Proxy
    const builtInProxyProps = new Map([
      ['onclick', (value: unknown) => {
        if (isFunction(onClickHandler)) {
          rawRemoveEventListener.call(rawDocument, 'click', onClickHandler, false)
        }
        // TODO: listener 是否需要绑定proxyDocument，否则函数中的this指向原生window
        if (isFunction(value)) {
          rawAddEventListener.call(rawDocument, 'click', value, false)
        }
        onClickHandler = value
      }],
      ['onreadystatechange', (value: unknown) => {
        if (isFunction(value)) {
          rawAddEventListener.call(getEventTarget('readystatechange', microAppContainer!), 'readystatechange', value, false)
        }
      }]
    ])
    // external custom proxy
    const customProxyDocumentProps = microApp.options?.customProxyDocumentProps || new Map()
    // External has higher priority than built-in
    const mergedProxyDocumentProps = new Map([
      ...builtInProxyProps,
      ...customProxyDocumentProps,
    ])
    return mergedProxyDocumentProps
  }

  const mergedProxyDocumentProps = genProxyDocumentProps()

  const proxyDocument = new Proxy(rawDocument, {
    get: (target: Document, key: PropertyKey): unknown => {
      throttleDeferForSetAppName(appName)
      // TODO: 转换成数据形式，类似iframe的方式
      if (key === 'createElement') return createElement
      if (key === Symbol.toStringTag) return 'ProxyDocument'
      if (key === 'defaultView') return sandbox.proxyWindow
      if (key === 'onclick') return onClickHandler
      if (key === 'addEventListener') return addEventListener
      if (key === 'removeEventListener') return removeEventListener
      if (key === 'microAppElement') return appInstanceMap.get(appName)?.container
      if (key === '__MICRO_APP_NAME__') return appName
      return bindFunctionToRawTarget<Document>(Reflect.get(target, key), rawDocument, 'DOCUMENT')
    },
    set: (target: Document, key: PropertyKey, value: unknown): boolean => {
      if (mergedProxyDocumentProps.has(key)) {
        const proxyCallback = mergedProxyDocumentProps.get(key)
        proxyCallback(value)
      } else if (key !== 'microAppElement') {
        /**
         * 1. Fix TypeError: Illegal invocation when set document.title
         * 2. If the set method returns false, and the assignment happened in strict-mode code, a TypeError will be thrown.
         */
        Reflect.set(target, key, value)
      }
      return true
    }
  })

  return {
    proxyDocument,
    documentEffect: {
      reset,
      record,
      rebuild,
      release,
    }
  }
}

/**
 * create proto Document
 * @param appName app name
 * @param proxyDocument proxy(document)
 * @returns Document
 */
function createMicroDocument (appName: string, proxyDocument: Document): Function {
  const { rawDocument, rawRootDocument } = globalEnv

  class MicroDocument {
    static [Symbol.hasInstance] (target: unknown) {
      let proto = target
      while (proto) {
        proto = Object.getPrototypeOf(proto)
        if (proto === MicroDocument.prototype) {
          return true
        }
      }
      return (
        target === proxyDocument ||
        target instanceof rawRootDocument
      )
    }
  }

  /**
   * TIP:
   * 1. child class __proto__, which represents the inherit of the constructor, always points to the parent class
   * 2. child class prototype.__proto__, which represents the inherit of methods, always points to parent class prototype
   * e.g.
   * class B extends A {}
   * B.__proto__ === A // true
   * B.prototype.__proto__ === A.prototype // true
   */
  Object.setPrototypeOf(MicroDocument, rawRootDocument)
  // Object.create(rawRootDocument.prototype) will cause MicroDocument and proxyDocument methods not same when exec Document.prototype.xxx = xxx in child app
  Object.setPrototypeOf(MicroDocument.prototype, new Proxy(rawRootDocument.prototype, {
    get (target: Document, key: PropertyKey): unknown {
      throttleDeferForSetAppName(appName)
      return bindFunctionToRawTarget<Document>(Reflect.get(target, key), rawDocument, 'DOCUMENT')
    },
    set (target: Document, key: PropertyKey, value: unknown): boolean {
      Reflect.set(target, key, value)
      return true
    }
  }))

  return MicroDocument
}
