import type {
  AppInterface,
  sourceLinkInfo,
} from '@micro-app/types'
import { fetchSource } from './fetch'
import {
  CompletionPath,
  pureCreateElement,
  defer,
  logError,
} from '../libs/utils'
import scopedCSS from './scoped_css'
import {
  dispatchOnLoadEvent,
  dispatchOnErrorEvent,
} from './load_event'

// Global links, reuse across apps
export const globalLinks = new Map<string, string>()

/**
 * Extract link elements
 * @param link link element
 * @param parent parent element of link
 * @param app app
 * @param microAppHead micro-app-head element
 * @param isDynamic dynamic insert
 */
export function extractLinkFromHtml (
  link: HTMLLinkElement,
  parent: Node,
  app: AppInterface,
  isDynamic = false,
): any {
  const rel = link.getAttribute('rel')
  let href = link.getAttribute('href')
  let replaceComment: Comment | null = null
  if (rel === 'stylesheet' && href) {
    href = CompletionPath(href, app.url)
    if (!isDynamic) {
      replaceComment = document.createComment(`link element with href=${href} move to micro-app-head as style element`)
      app.source.links.set(href, {
        code: '',
        placeholder: replaceComment,
        isGlobal: link.hasAttribute('global'),
      })
    } else {
      return {
        url: href,
        info: {
          code: '',
          isGlobal: link.hasAttribute('global'),
        }
      }
    }
  } else if (rel && ['prefetch', 'preload', 'prerender', 'icon', 'apple-touch-icon'].includes(rel)) {
    // preload prefetch icon ....
    if (isDynamic) {
      replaceComment = document.createComment(`link element with rel=${rel}${href ? ' & href=' + href : ''} removed by micro-app`)
    } else {
      parent.removeChild(link)
    }
  } else if (href) {
    // dns-prefetch preconnect modulepreload search ....
    link.setAttribute('href', CompletionPath(href, app.url))
  }

  if (isDynamic) {
    return { replaceComment }
  } else if (replaceComment) {
    return parent.replaceChild(replaceComment, link)
  }
}

/**
 * fetch link succeeded, replace placeholder with style tag
 * @param url resource address
 * @param info resource link info
 * @param data code
 * @param microAppHead micro-app-head
 * @param app app
 */
export function fetchLinkSuccess (
  url: string,
  info: sourceLinkInfo,
  data: string,
  microAppHead: Element,
  app: AppInterface,
): void {
  if (info.isGlobal && !globalLinks.has(url)) {
    globalLinks.set(url, data)
  }

  const styleLink = pureCreateElement('style')
  styleLink.textContent = data
  styleLink.__MICRO_APP_LINK_PATH__ = url
  styleLink.setAttribute('data-origin-href', url)

  if (info.placeholder!.parentNode) {
    info.placeholder!.parentNode.replaceChild(scopedCSS(styleLink, app), info.placeholder!)
  } else {
    microAppHead.appendChild(scopedCSS(styleLink, app))
  }

  info.placeholder = null
  info.code = data
}

/**
 * get css from dynamic link
 * @param url link address
 * @param info info
 * @param app app
 * @param originLink origin link element
 * @param replaceStyle style element which replaced origin link
 */
export function formatDynamicLink (
  url: string,
  info: sourceLinkInfo,
  app: AppInterface,
  originLink: HTMLLinkElement,
  replaceStyle: HTMLStyleElement,
): void {
  if (app.source.links.has(url)) {
    replaceStyle.textContent = app.source.links.get(url)!.code
    scopedCSS(replaceStyle, app)
    defer(() => dispatchOnLoadEvent(originLink))
    return
  }

  if (globalLinks.has(url)) {
    const code = globalLinks.get(url)!
    info.code = code
    app.source.links.set(url, info)
    replaceStyle.textContent = code
    scopedCSS(replaceStyle, app)
    defer(() => dispatchOnLoadEvent(originLink))
    return
  }

  fetchSource(url, app.name).then((data: string) => {
    info.code = data
    app.source.links.set(url, info)
    info.isGlobal && globalLinks.set(url, data)
    replaceStyle.textContent = data
    scopedCSS(replaceStyle, app)
    dispatchOnLoadEvent(originLink)
  }).catch((err) => {
    logError(err, app.name)
    dispatchOnErrorEvent(originLink)
  })
}
