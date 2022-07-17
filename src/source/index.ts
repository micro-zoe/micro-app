import type { AppInterface, sourceLinkInfo } from '@micro-app/types'
import {
  logError,
  CompletionPath,
  pureCreateElement,
} from '../libs/utils'
import { extractLinkFromHtml, fetchLinkSuccess } from './links'
import { LinkLoader } from './loader/link'
import { extractScriptElement, fetchScriptsFromHtml, checkExcludeUrl, checkIgnoreUrl } from './scripts'
import scopedCSS from './scoped_css'

/**
 * transform html string to dom
 * @param str string dom
 */
function getWrapElement (str: string): HTMLElement {
  const wrapDiv = pureCreateElement('div')

  wrapDiv.innerHTML = str

  return wrapDiv
}

/**
 * Recursively process each child element
 * @param parent parent element
 * @param app app
 * @param microAppHead micro-app-head element
 */
function flatChildren (
  parent: HTMLElement,
  app: AppInterface,
  microAppHead: Element,
): void {
  const children = Array.from(parent.children)

  children.length && children.forEach((child) => {
    flatChildren(child as HTMLElement, app, microAppHead)
  })

  for (const dom of children) {
    if (dom instanceof HTMLLinkElement) {
      if (dom.hasAttribute('exclude') || checkExcludeUrl(dom.getAttribute('href'), app.name)) {
        parent.replaceChild(document.createComment('link element with exclude attribute ignored by micro-app'), dom)
      } else if (!(dom.hasAttribute('ignore') || checkIgnoreUrl(dom.getAttribute('href'), app.name))) {
        extractLinkFromHtml(dom, parent, app)
      } else if (dom.hasAttribute('href')) {
        dom.setAttribute('href', CompletionPath(dom.getAttribute('href')!, app.url))
      }
    } else if (dom instanceof HTMLStyleElement) {
      if (dom.hasAttribute('exclude')) {
        parent.replaceChild(document.createComment('style element with exclude attribute ignored by micro-app'), dom)
      } else if (app.scopecss && !dom.hasAttribute('ignore')) {
        scopedCSS(dom, app)
      }
    } else if (dom instanceof HTMLScriptElement) {
      extractScriptElement(dom, parent, app)
    } else if (dom instanceof HTMLMetaElement || dom instanceof HTMLTitleElement) {
      parent.removeChild(dom)
    } else if (dom instanceof HTMLImageElement && dom.hasAttribute('src')) {
      dom.setAttribute('src', CompletionPath(dom.getAttribute('src')!, app.url))
    }
  }
}

/**
 * Extract link and script, bind style scope
 * @param htmlStr html string
 * @param app app
 */
export function extractSourceDom (htmlStr: string, app: AppInterface) {
  const wrapElement = getWrapElement(htmlStr)
  const microAppHead = wrapElement.querySelector('micro-app-head')
  const microAppBody = wrapElement.querySelector('micro-app-body')

  if (!microAppHead || !microAppBody) {
    const msg = `element ${microAppHead ? 'body' : 'head'} is missing`
    app.onerror(new Error(msg))
    return logError(msg, app.name)
  }

  flatChildren(wrapElement, app, microAppHead)

  if (app.source.links.size) {
    LinkLoader.getInstance().run(app, (url: string, info: sourceLinkInfo, data: string) => {
      fetchLinkSuccess(
        url,
        info,
        data,
        microAppHead,
        app,
      )
    }, () => {
      app.onLoad(wrapElement)
    })
  } else {
    app.onLoad(wrapElement)
  }

  if (app.source.scripts.size) {
    fetchScriptsFromHtml(wrapElement, app)
  } else {
    app.onLoad(wrapElement)
  }
}
