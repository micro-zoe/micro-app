import { getCurrentAppName } from '../../libs/utils'

export const rawDocumentCreateElement = document.createElement

export const useProxyDocument: () => void = () => {
  beforeEach(() => {
    document.createElement = (tagName: string, options?: ElementCreationOptions) => {
      const currentAppName = getCurrentAppName()
      // @ts-ignore
      const proxyDocument = window?.__MICRO_APP_PROXY_WINDOW__?.document
      return proxyDocument && currentAppName ? proxyDocument.createElement(tagName, options) : rawDocumentCreateElement.call(document, tagName, options)
    }
  })

  afterEach(() => {
    document.createElement = rawDocumentCreateElement
  })
}
