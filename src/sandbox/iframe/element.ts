import type {
  microAppWindowType,
} from '@micro-app/types'
import type IframeSandbox from './index'
import globalEnv from '../../libs/global_env'
import microApp from '../../micro_app'
import {
  rawDefineProperty,
  CompletionPath,
  isScriptElement,
  isBaseElement,
  isElement,
  isNode,
  isMicroAppBody,
  throttleDeferForSetAppName,
  isFunction,
} from '../../libs/utils'
import {
  updateElementInfo,
} from '../adapter'
import {
  appInstanceMap,
} from '../../create_app'

/**
 * patch Element & Node of child app
 * @param appName app name
 * @param url app url
 * @param microAppWindow microWindow of child app
 * @param sandbox IframeSandbox
 */
export function patchElement (
  appName: string,
  url: string,
  microAppWindow: microAppWindowType,
  sandbox: IframeSandbox,
): void {
  patchIframeNode(appName, microAppWindow, sandbox)
  patchIframeAttribute(url, microAppWindow)
}

function patchIframeNode (
  appName: string,
  microAppWindow: microAppWindowType,
  sandbox: IframeSandbox,
): void {
  const rawRootElement = globalEnv.rawRootElement // native root Element
  const rawDocument = globalEnv.rawDocument
  const microDocument = microAppWindow.document
  const microRootNode = microAppWindow.Node
  const microRootElement = microAppWindow.Element
  // const rawMicroGetRootNode = microRootNode.prototype.getRootNode
  const rawMicroAppendChild = microRootNode.prototype.appendChild
  const rawMicroInsertBefore = microRootNode.prototype.insertBefore
  const rawMicroReplaceChild = microRootNode.prototype.replaceChild
  const rawMicroRemoveChild = microRootNode.prototype.removeChild
  const rawMicroAppend = microRootElement.prototype.append
  const rawMicroPrepend = microRootElement.prototype.prepend
  const rawMicroInsertAdjacentElement = microRootElement.prototype.insertAdjacentElement
  const rawMicroCloneNode = microRootNode.prototype.cloneNode
  const rawInnerHTMLDesc = Object.getOwnPropertyDescriptor(microRootElement.prototype, 'innerHTML') as PropertyDescriptor
  const rawParentNodeDesc = Object.getOwnPropertyDescriptor(microRootNode.prototype, 'parentNode') as PropertyDescriptor
  const rawOwnerDocumentDesc = Object.getOwnPropertyDescriptor(microRootNode.prototype, 'ownerDocument') as PropertyDescriptor

  const isPureNode = (target: unknown): boolean | void => {
    return (isScriptElement(target) || isBaseElement(target)) && target.__PURE_ELEMENT__
  }

  const getRawTarget = (parent: Node): Node => {
    if (parent === sandbox.microHead) {
      return rawDocument.head
    } else if (parent === sandbox.microBody) {
      return rawDocument.body
    }

    return parent
  }

  microRootNode.prototype.getRootNode = function getRootNode (): Node {
    return microDocument
    // TODO: 什么情况下返回原生document?
    // const rootNode = rawMicroGetRootNode.call(this, options)
    // if (rootNode === appInstanceMap.get(appName)?.container) return microDocument
    // return rootNode
  }

  microRootNode.prototype.appendChild = function appendChild <T extends Node> (node: T): T {
    // TODO: 有必要执行这么多次updateElementInfo？
    updateElementInfo(node, appName)
    if (isPureNode(node)) {
      return rawMicroAppendChild.call(this, node)
    }
    return rawRootElement.prototype.appendChild.call(getRawTarget(this), node)
  }

  microRootNode.prototype.insertBefore = function insertBefore <T extends Node> (node: T, child: Node | null): T {
    updateElementInfo(node, appName)
    if (isPureNode(node)) {
      return rawMicroInsertBefore.call(this, node, child)
    }
    return rawRootElement.prototype.insertBefore.call(getRawTarget(this), node, child)
  }

  microRootNode.prototype.replaceChild = function replaceChild <T extends Node> (node: Node, child: T): T {
    updateElementInfo(node, appName)
    if (isPureNode(node)) {
      return rawMicroReplaceChild.call(this, node, child)
    }
    return rawRootElement.prototype.replaceChild.call(getRawTarget(this), node, child)
  }

  microRootNode.prototype.removeChild = function removeChild<T extends Node> (oldChild: T): T {
    if (isPureNode(oldChild) || this.contains(oldChild)) {
      return rawMicroRemoveChild.call(this, oldChild)
    }
    return rawRootElement.prototype.removeChild.call(getRawTarget(this), oldChild)
  }

  microRootElement.prototype.append = function append (...nodes: (Node | string)[]): void {
    let i = 0; let hasPureNode = false
    while (i < nodes.length) {
      nodes[i] = isNode(nodes[i]) ? nodes[i] : microDocument.createTextNode(nodes[i])
      if (isPureNode(nodes[i])) hasPureNode = true
      i++
    }
    if (hasPureNode) {
      return rawMicroAppend.call(this, ...nodes)
    }
    return rawRootElement.prototype.append.call(getRawTarget(this), ...nodes)
  }

  microRootElement.prototype.prepend = function prepend (...nodes: (Node | string)[]): void {
    let i = 0; let hasPureNode = false
    while (i < nodes.length) {
      nodes[i] = isNode(nodes[i]) ? nodes[i] : microDocument.createTextNode(nodes[i])
      if (isPureNode(nodes[i])) hasPureNode = true
      i++
    }
    if (hasPureNode) {
      return rawMicroPrepend.call(this, ...nodes)
    }
    return rawRootElement.prototype.prepend.call(getRawTarget(this), ...nodes)
  }

  /**
   * The insertAdjacentElement method of the Element interface inserts a given element node at a given position relative to the element it is invoked upon.
   * Scenes:
   *  1. vite4 development env for style
   */
  microRootElement.prototype.insertAdjacentElement = function insertAdjacentElement (where: InsertPosition, element: Element): Element | null {
    updateElementInfo(element, appName)
    if (isPureNode(element)) {
      return rawMicroInsertAdjacentElement.call(this, where, element)
    }
    return rawRootElement.prototype.insertAdjacentElement.call(getRawTarget(this), where, element)
  }

  // patch cloneNode
  microRootNode.prototype.cloneNode = function cloneNode (deep?: boolean): Node {
    const clonedNode = rawMicroCloneNode.call(this, deep)
    return updateElementInfo(clonedNode, appName)
  }

  rawDefineProperty(microRootNode.prototype, 'ownerDocument', {
    configurable: true,
    enumerable: true,
    get () {
      if (isFunction(microApp.options.beforeHijackOwnerDocument)) {
        const nodeRawOwnerDocument = rawOwnerDocumentDesc.get!.call(this)
        if (microApp.options.beforeHijackOwnerDocument?.({ node: this, ownerDocument: nodeRawOwnerDocument, appName })) {
          return nodeRawOwnerDocument
        }
      }
      return this.__PURE_ELEMENT__ || this === microDocument
        ? rawOwnerDocumentDesc.get!.call(this)
        : microDocument
    },
  })

  rawDefineProperty(microRootElement.prototype, 'innerHTML', {
    configurable: true,
    enumerable: true,
    get () {
      return rawInnerHTMLDesc.get!.call(this)
    },
    set (code: string) {
      rawInnerHTMLDesc.set!.call(this, code)
      Array.from(this.children).forEach((child) => {
        if (isElement(child)) {
          updateElementInfo(child, appName)
        }
      })
    }
  })

  // patch parentNode
  rawDefineProperty(microRootNode.prototype, 'parentNode', {
    configurable: true,
    enumerable: true,
    get () {
      /**
       * set current appName for hijack parentNode of html
       * NOTE:
       *  1. Is there a problem with setting the current appName in iframe mode
       */
      // TODO: 去掉 throttleDeferForSetAppName
      throttleDeferForSetAppName(appName)
      const result: ParentNode = rawParentNodeDesc.get!.call(this)
      /**
        * If parentNode is <micro-app-body>, return rawDocument.body
        * Scenes:
        *  1. element-ui@2/lib/utils/vue-popper.js
        *    if (this.popperElm.parentNode === document.body) ...
        * WARNING:
        *  Will it cause other problems ?
        *  e.g. target.parentNode.remove(target)
        */
      if (isMicroAppBody(result) && appInstanceMap.get(appName)?.container) {
        return microApp.options.getRootElementParentNode?.(this, appName) || globalEnv.rawDocument.body
      }
      return result
    }
  })

  // Adapt to new image(...) scene
  const ImageProxy = new Proxy(microAppWindow.Image, {
    construct (Target, args): HTMLImageElement {
      const elementImage = new Target(...args)
      updateElementInfo(elementImage, appName)
      return elementImage
    },
  })

  rawDefineProperty(microAppWindow, 'Image', {
    configurable: true,
    writable: true,
    value: ImageProxy,
  })
}

function patchIframeAttribute (url: string, microAppWindow: microAppWindowType): void {
  const microRootElement = microAppWindow.Element
  const rawMicroSetAttribute = microRootElement.prototype.setAttribute

  microRootElement.prototype.setAttribute = function setAttribute (key: string, value: any): void {
    if (/^micro-app(-\S+)?/i.test(this.tagName) && key === 'data') {
      this.setAttribute(key, value)
    } else {
      if (
        ((key === 'src' || key === 'srcset') && /^(img|script)$/i.test(this.tagName)) ||
        (key === 'href' && /^link$/i.test(this.tagName))
      ) {
        value = CompletionPath(value, url)
      }
      rawMicroSetAttribute.call(this, key, value)
    }
  }

  const protoAttrList: Array<[HTMLElement, string]> = [
    [microAppWindow.HTMLImageElement.prototype, 'src'],
    [microAppWindow.HTMLScriptElement.prototype, 'src'],
    [microAppWindow.HTMLLinkElement.prototype, 'href'],
  ]

  /**
   * element.setAttribute does not trigger this actions:
   *  1. img.src = xxx
   *  2. script.src = xxx
   *  3. link.href = xxx
   */
  protoAttrList.forEach(([target, attr]) => {
    const { enumerable, configurable, get, set } = Object.getOwnPropertyDescriptor(target, attr) || {
      enumerable: true,
      configurable: true,
    }

    rawDefineProperty(target, attr, {
      enumerable,
      configurable,
      get: function () {
        return get?.call(this)
      },
      set: function (value) {
        set?.call(this, CompletionPath(value, url))
      },
    })
  })
}
