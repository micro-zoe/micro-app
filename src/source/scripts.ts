/* eslint-disable node/no-callback-literal */
import type {
  AppInterface,
  sourceScriptInfo,
  plugins,
  Func,
} from '@micro-app/types'
import { fetchSource } from './fetch'
import {
  CompletionPath,
  promiseStream,
  createNonceSrc,
  pureCreateElement,
  defer,
  logError,
  isUndefined,
  isPlainObject,
  isArray,
  isFunction,
} from '../libs/utils'
import {
  dispatchOnLoadEvent,
  dispatchOnErrorEvent,
} from './load_event'
import microApp from '../micro_app'
import globalEnv from '../libs/global_env'
import { globalKeyToBeCached } from '../constants'

type moduleCallBack = Func & { moduleCount?: number, errorCount?: number }

const systemJSScriptTypes = ['systemjs-module', 'systemjs-importmap']

// Global scripts, reuse across apps
export const globalScripts = new Map<string, string>()

/**
 * Extract script elements
 * @param script script element
 * @param parent parent element of script
 * @param app app
 * @param isDynamic dynamic insert
 */
export function extractScriptElement (
  script: HTMLScriptElement,
  parent: Node,
  app: AppInterface,
  isDynamic = false,
): any {
  let replaceComment: Comment | null = null
  let src: string | null = script.getAttribute('src')
  if (src) {
    src = CompletionPath(src, app.url)
  }
  if (script.hasAttribute('exclude') || checkExcludeUrl(src, app.name)) {
    replaceComment = document.createComment('script element with exclude attribute removed by micro-app')
  } else if (
    (script.type && !['text/javascript', 'text/ecmascript', 'application/javascript', 'application/ecmascript', 'module', ...systemJSScriptTypes].includes(script.type)) ||
    script.hasAttribute('ignore') || checkIgnoreUrl(src, app.name)
  ) {
    return null
  } else if (
    (globalEnv.supportModuleScript && script.noModule) ||
    (!globalEnv.supportModuleScript && script.type === 'module')
  ) {
    replaceComment = document.createComment(`${script.noModule ? 'noModule' : 'module'} script ignored by micro-app`)
  } else if (src) { // remote script
    if (systemJSScriptTypes.includes(script.type)) {
      script.src = src
      return null
    }
    const info = {
      code: '',
      isExternal: true,
      isDynamic: isDynamic,
      async: script.hasAttribute('async'),
      defer: script.defer || script.type === 'module',
      module: script.type === 'module',
      isGlobal: script.hasAttribute('global'),
    }
    if (!isDynamic) {
      app.source.scripts.set(src, info)
      replaceComment = document.createComment(`script with src='${src}' extract by micro-app`)
    } else {
      return { url: src, info }
    }
  } else if (script.textContent) { // inline script
    const nonceStr: string = createNonceSrc()
    const info = {
      code: script.textContent,
      isExternal: false,
      isDynamic: isDynamic,
      async: false,
      defer: script.type === 'module',
      module: script.type === 'module',
    }
    if (!isDynamic) {
      app.source.scripts.set(nonceStr, info)
      replaceComment = document.createComment('inline script extract by micro-app')
    } else {
      return { url: nonceStr, info }
    }
  } else if (!isDynamic) {
    /**
     * script with empty src or empty script.textContent remove in static html
     * & not removed if it created by dynamic
     */
    replaceComment = document.createComment('script element removed by micro-app')
  }

  if (isDynamic) {
    return { replaceComment }
  } else {
    return parent.replaceChild(replaceComment!, script)
  }
}

/**
 * get assets plugins
 * @param appName app name
 */
export function getAssetsPlugins (appName: string): plugins['global'] {
  const globalPlugins = microApp.plugins?.global || []
  const modulePlugins = microApp.plugins?.modules?.[appName] || []

  return [...globalPlugins, ...modulePlugins]
}

/**
 * whether the url needs to be excluded
 * @param url css or js link
 * @param plugins microApp plugins
 */
export function checkExcludeUrl (url: string | null, appName: string): boolean {
  if (!url) return false
  const plugins = getAssetsPlugins(appName) || []
  return plugins.some(plugin => {
    if (!plugin.excludeChecker) return false
    return plugin.excludeChecker(url)
  })
}

/**
 * whether the url needs to be ignore
 * @param url css or js link
 * @param plugins microApp plugins
 */
export function checkIgnoreUrl (url: string | null, appName: string): boolean {
  if (!url) return false
  const plugins = getAssetsPlugins(appName) || []
  return plugins.some(plugin => {
    if (!plugin.ignoreChecker) return false
    return plugin.ignoreChecker(url)
  })
}

/**
 *  Get remote resources of script
 * @param wrapElement htmlDom
 * @param app app
 */
export function fetchScriptsFromHtml (
  wrapElement: HTMLElement,
  app: AppInterface,
): void {
  const scriptEntries: Array<[string, sourceScriptInfo]> = Array.from(app.source.scripts.entries())
  const fetchScriptPromise: Promise<string>[] = []
  const fetchScriptPromiseInfo: Array<[string, sourceScriptInfo]> = []
  for (const [url, info] of scriptEntries) {
    if (info.isExternal) {
      const globalScriptText = globalScripts.get(url)
      if (globalScriptText) {
        info.code = globalScriptText
      } else if ((!info.defer && !info.async) || app.isPrefetch) {
        fetchScriptPromise.push(fetchSource(url, app.name))
        fetchScriptPromiseInfo.push([url, info])
      }
    }
  }

  if (fetchScriptPromise.length) {
    promiseStream<string>(fetchScriptPromise, (res: {data: string, index: number}) => {
      fetchScriptSuccess(
        fetchScriptPromiseInfo[res.index][0],
        fetchScriptPromiseInfo[res.index][1],
        res.data,
      )
    }, (err: {error: Error, index: number}) => {
      logError(err, app.name)
    }, () => {
      app.onLoad(wrapElement)
    })
  } else {
    app.onLoad(wrapElement)
  }
}

/**
 * fetch js succeeded, record the code value
 * @param url script address
 * @param info resource script info
 * @param data code
 */
export function fetchScriptSuccess (
  url: string,
  info: sourceScriptInfo,
  data: string,
): void {
  if (info.isGlobal && !globalScripts.has(url)) {
    globalScripts.set(url, data)
  }

  info.code = data
}

/**
 * Execute js in the mount lifecycle
 * @param scriptList script list
 * @param app app
 * @param initHook callback for umd mode
 */
export function execScripts (
  scriptList: Map<string, sourceScriptInfo>,
  app: AppInterface,
  initHook: moduleCallBack,
): void {
  const scriptListEntries: Array<[string, sourceScriptInfo]> = Array.from(scriptList.entries())
  const deferScriptPromise: Array<Promise<string>|string> = []
  const deferScriptInfo: Array<[string, sourceScriptInfo]> = []
  for (const [url, info] of scriptListEntries) {
    if (!info.isDynamic) {
      // Notice the second render
      if (info.defer || info.async) {
        if (info.isExternal && !info.code) {
          deferScriptPromise.push(fetchSource(url, app.name))
        } else {
          deferScriptPromise.push(info.code)
        }
        deferScriptInfo.push([url, info])

        info.module && (initHook.moduleCount = initHook.moduleCount ? ++initHook.moduleCount : 1)
      } else {
        runScript(url, app, info, false)
        initHook(false)
      }
    }
  }

  if (deferScriptPromise.length) {
    promiseStream<string>(deferScriptPromise, (res: {data: string, index: number}) => {
      const info = deferScriptInfo[res.index][1]
      info.code = info.code || res.data
    }, (err: {error: Error, index: number}) => {
      initHook.errorCount = initHook.errorCount ? ++initHook.errorCount : 1
      logError(err, app.name)
    }, () => {
      deferScriptInfo.forEach(([url, info]) => {
        if (info.code) {
          runScript(url, app, info, false, initHook)
          !info.module && initHook(false)
        }
      })
      initHook(
        isUndefined(initHook.moduleCount) ||
        initHook.errorCount === deferScriptPromise.length
      )
    })
  } else {
    initHook(true)
  }
}

/**
 * run code
 * @param url script address
 * @param app app
 * @param info script info
 * @param isDynamic dynamically created script
 * @param callback callback of module script
 */
export function runScript (
  url: string,
  app: AppInterface,
  info: sourceScriptInfo,
  isDynamic: boolean,
  callback?: moduleCallBack,
): any {
  try {
    const code = bindScope(url, app, info.code, info)
    if (app.inline || info.module) {
      const scriptElement = pureCreateElement('script')
      runCode2InlineScript(url, code, info.module, scriptElement, callback)
      if (isDynamic) return scriptElement
      // TEST IGNORE
      app.container?.querySelector('micro-app-body')!.appendChild(scriptElement)
    } else {
      runCode2Function(code, info)
      if (isDynamic) return document.createComment('dynamic script extract by micro-app')
    }
  } catch (e) {
    console.error(`[micro-app from runScript] app ${app.name}: `, e)
  }
}

/**
 * Get dynamically created remote script
 * @param url script address
 * @param info info
 * @param app app
 * @param originScript origin script element
 */
export function runDynamicRemoteScript (
  url: string,
  info: sourceScriptInfo,
  app: AppInterface,
  originScript: HTMLScriptElement,
): HTMLScriptElement | Comment {
  const dispatchScriptOnLoadEvent = () => dispatchOnLoadEvent(originScript)

  // url is unique
  if (app.source.scripts.has(url)) {
    const existInfo: sourceScriptInfo = app.source.scripts.get(url)!
    !existInfo.module && defer(dispatchScriptOnLoadEvent)
    return runScript(url, app, existInfo, true, dispatchScriptOnLoadEvent)
  }

  if (globalScripts.has(url)) {
    const code = globalScripts.get(url)!
    info.code = code
    app.source.scripts.set(url, info)
    !info.module && defer(dispatchScriptOnLoadEvent)
    return runScript(url, app, info, true, dispatchScriptOnLoadEvent)
  }

  let replaceElement: Comment | HTMLScriptElement
  if (app.inline || info.module) {
    replaceElement = pureCreateElement('script')
  } else {
    replaceElement = document.createComment(`dynamic script with src='${url}' extract by micro-app`)
  }

  fetchSource(url, app.name).then((code: string) => {
    info.code = code
    app.source.scripts.set(url, info)
    info.isGlobal && globalScripts.set(url, code)
    try {
      code = bindScope(url, app, code, info)
      if (app.inline || info.module) {
        runCode2InlineScript(url, code, info.module, replaceElement as HTMLScriptElement, dispatchScriptOnLoadEvent)
      } else {
        runCode2Function(code, info)
      }
    } catch (e) {
      console.error(`[micro-app from runDynamicScript] app ${app.name}: `, e, url)
    }
    !info.module && dispatchOnLoadEvent(originScript)
  }).catch((err) => {
    logError(err, app.name)
    dispatchOnErrorEvent(originScript)
  })

  return replaceElement
}

/**
 * common handle for inline script
 * @param url script address
 * @param code bound code
 * @param module type='module' of script
 * @param scriptElement target script element
 * @param callback callback of module script
 */
function runCode2InlineScript (
  url: string,
  code: string,
  module: boolean,
  scriptElement: HTMLScriptElement,
  callback?: moduleCallBack,
): void {
  if (module) {
    // module script is async, transform it to a blob for subsequent operations
    const blob = new Blob([code], { type: 'text/javascript' })
    scriptElement.src = URL.createObjectURL(blob)
    scriptElement.setAttribute('type', 'module')
    if (callback) {
      callback.moduleCount && callback.moduleCount--
      scriptElement.onload = callback.bind(scriptElement, callback.moduleCount === 0)
    }
  } else {
    scriptElement.textContent = code
  }

  if (!url.startsWith('inline-')) {
    scriptElement.setAttribute('data-origin-src', url)
  }
}

// init & run code2Function
function runCode2Function (code: string, info: sourceScriptInfo) {
  if (!info.code2Function) {
    info.code2Function = new Function(code)
  }
  info.code2Function.call(window)
}

/**
 * bind js scope
 * @param url script address
 * @param app app
 * @param code code
 * @param info source script info
 */
function bindScope (
  url: string,
  app: AppInterface,
  code: string,
  info: sourceScriptInfo,
): string {
  if (isPlainObject(microApp.plugins)) {
    code = usePlugins(url, code, app.name, microApp.plugins!, info)
  }

  if (app.sandBox && !info.module) {
    globalEnv.rawWindow.__MICRO_APP_PROXY_WINDOW__ = app.sandBox.proxyWindow
    return `;(function(proxyWindow){with(proxyWindow.__MICRO_APP_WINDOW__){(function(${globalKeyToBeCached}){;${code}\n}).call(proxyWindow,${globalKeyToBeCached})}})(window.__MICRO_APP_PROXY_WINDOW__);`
  }

  return code
}

/**
 * Call the plugin to process the file
 * @param url script address
 * @param code code
 * @param appName app name
 * @param plugins plugin list
 * @param info source script info
 */
function usePlugins (url: string, code: string, appName: string, plugins: plugins, info: sourceScriptInfo): string {
  const newCode = processCode(plugins.global, code, url, info)

  return processCode(plugins.modules?.[appName], newCode, url, info)
}

function processCode (configs: plugins['global'], code: string, url: string, info: sourceScriptInfo) {
  if (!isArray(configs)) {
    return code
  }

  return configs.reduce((preCode, config) => {
    if (isPlainObject(config) && isFunction(config.loader)) {
      return config.loader!(preCode, url, config.options, info)
    }

    return preCode
  }, code)
}
