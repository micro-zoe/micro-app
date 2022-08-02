import { AppInterface, sourceLinkInfo } from '@micro-app/types'
import { fetchSource } from '../fetch'
import { logError, promiseStream } from '../../libs/utils'
import { globalLinks } from '../links'

export interface ILinkLoader {
  run (
    app: AppInterface,
    successCb: CallableFunction,
    finallyCb: CallableFunction
  ): void
}

export class LinkLoader implements ILinkLoader {
  private static instance: LinkLoader;
  public static getInstance (): LinkLoader {
    if (!this.instance) {
      this.instance = new LinkLoader()
    }
    return this.instance
  }

  /**
   * Get link remote resources
   * @param app app
   * @param successCb success callback
   * @param finallyCb finally callback
   */
  public run (
    app: AppInterface,
    successCb: CallableFunction,
    finallyCb: CallableFunction
  ): void {
    const {
      linkEntries,
      fetchLinkPromise
    } = this.getLinkData(app)

    promiseStream<string>(fetchLinkPromise, (res: {data: string, index: number}) => {
      const [url, info] = linkEntries[res.index]

      successCb(url, info, res.data)
    }, (err: {error: Error, index: number}) => {
      logError(err, app.name)
    }, () => {
      finallyCb?.()
    })
  }

  private getLinkData (app: AppInterface) {
    const linkEntries: Array<[string, sourceLinkInfo]> = Array.from(app.source.links.entries())

    const fetchLinkPromise: Array<Promise<string>|string> = linkEntries.map(([url]) => {
      return globalLinks.has(url) ? globalLinks.get(url)! : fetchSource(url, app.name)
    })

    return {
      linkEntries,
      fetchLinkPromise
    }
  }
}
