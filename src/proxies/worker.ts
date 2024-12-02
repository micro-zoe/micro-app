
import { appInstanceMap } from '../create_app'
import { CompletionPath, getCurrentAppName } from '../libs/utils'

interface WorkerOptions {
  name?: string;
  type?: 'classic' | 'module';
  credentials?: 'omit' | 'same-origin' | 'include';
}

interface WorkerInstance extends EventTarget {
  postMessage(message: any, transfer?: Transferable[]): void;
  terminate(): void;
}
interface Worker {
  new(url: string | URL, options?: WorkerOptions): WorkerInstance;
}

// 重写 Worker 构造函数的类型
const originalWorker = window.Worker

function isSameOrigin(url: string | URL): boolean {
  if ((url instanceof URL && url.protocol === 'blob:') || (typeof url === 'string' && url.startsWith('blob:'))) {
    // 如果 url 是 Blob URL，直接返回 true
    return true
  }

  // 检查 URL 是否与当前页面在同一个源
  try {
    const parsedUrl = new URL(url as string)
    return (
      parsedUrl.protocol === window.location.protocol &&
      parsedUrl.hostname === window.location.hostname &&
      parsedUrl.port === window.location.port
    )
  } catch (error) {
    return false
  }
}

function urlFromScript(script: string) {
  let blob
  try {
    blob = new Blob([script], {
      type: 'application/javascript'
    })
  } catch (e) {
    const BlobBuilder =
      // @ts-ignore
      window.BlobBuilder ||
      // @ts-ignore
      window.WebKitBlobBuilder ||
      // @ts-ignore
      window.MozBlobBuilder ||
      // @ts-ignore
      window.MSBlobBuilder
    const blobBuilder = new BlobBuilder()
    blobBuilder.append(script)
    blob = blobBuilder.getBlob('application/javascript')
  }

  const URL = window.URL || window.webkitURL
  return URL.createObjectURL(blob)
}

// @ts-ignore
const WorkerProxy = new Proxy<Worker>(originalWorker, {
  construct(Target, args): WorkerInstance {
    let [scriptURL, options] = args
    options = options || {}
    const appName = getCurrentAppName()
    let url = scriptURL
    if (appName) {
      const app = appInstanceMap.get(appName)
      url = CompletionPath(scriptURL, app!.url)
    }

    if (url && !isSameOrigin(url)) {
      // 如果 scriptURL 是跨域的，使用 Blob URL 加载并执行 worker
      const script = `import "${scriptURL}";`
      const workerPath = urlFromScript(script)
      options.type = 'module'
      return new Target(workerPath, options) as WorkerInstance
    } else {
      // 如果 scriptURL 是同源的，直接使用原生的 Worker 构造函数
      return new Target(scriptURL, options) as WorkerInstance
    }
  },
})

export default WorkerProxy
