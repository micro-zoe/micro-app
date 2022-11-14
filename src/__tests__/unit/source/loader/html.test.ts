// @ts-ignore
import { AppInterface } from '@micro-app/types'

import { waitFor } from '../../../common/util'
import { HTMLLoader } from '../../../../source/loader/html'
import { MOCK_APP_URL } from '../../mocks/app'
import { MOCK_BASIC_HTML, MOCK_APP_HTML } from '../../mocks/html'
import { setupMockFetch } from '../../mocks/fetch'
import microApp from '../../../../micro_app'

const setup = (html: string, error?: boolean) => {
  // @ts-ignore by cangdu
  global.fetch = jest.fn().mockImplementation(setupMockFetch(html, error))
  const htmlLoader = HTMLLoader.getInstance()
  const successCb = jest.fn()
  const errorCb = jest.fn()
  const onLoadError = jest.fn()

  return {
    htmlLoader,
    successCb,
    errorCb,
    onLoadError
  }
}

describe('HTMLLoader', () => {
  beforeAll(() => {
    console.error = jest.fn()
  })

  test('给定一个 url，可以获取到 html 字符串', async () => {
    const { htmlLoader, successCb } = setup(MOCK_BASIC_HTML)
    const app = {
      name: 'app-1',
      url: MOCK_APP_URL
    } as AppInterface
    htmlLoader.run(app, successCb)

    await waitFor(() => {
      expect(successCb).toBeCalledWith(MOCK_APP_HTML, app)
    })
  })

  test('给定一个 url，获取到空的 html 字符串，应该报错', async () => {
    const { htmlLoader, successCb, errorCb, onLoadError } = setup('')
    const app = {
      name: 'app-1',
      url: MOCK_APP_URL,
      onerror: errorCb as any,
      onLoadError: onLoadError as any,
    } as AppInterface
    htmlLoader.run(app, successCb)

    const logError = jest.spyOn(console, 'error')
    await waitFor(() => {
      expect(onLoadError).not.toBeCalled()
      expect(logError).toHaveBeenLastCalledWith(`[micro-app] app ${app.name}: html is empty, please check in detail`)
      expect(errorCb).toBeCalled()
    })
  })

  test('给定一个 url，网络错误，应该报错', async () => {
    const { htmlLoader, successCb, errorCb, onLoadError } = setup(MOCK_BASIC_HTML, true)
    const app = {
      name: 'app-1',
      url: MOCK_APP_URL,
      onerror: errorCb as any,
      onLoadError: onLoadError as any,
    } as AppInterface
    htmlLoader.run(app, successCb)

    const logError = jest.spyOn(console, 'error')
    await waitFor(() => {
      expect(logError).toBeCalled()
      expect(errorCb).not.toBeCalled()
    })
  })

  describe('plugin', () => {
    afterEach(() => {
      microApp.options.plugins = undefined
    })

    test('预期插件配置里的 processHtml 可以生效', async () => {
      const processHtml = jest.fn().mockImplementation(code => code)
      microApp.options.plugins = {
        global: undefined,
        modules: {
          'app-1': [{
            processHtml
          }]
        }
      }

      const { htmlLoader, successCb } = setup(MOCK_BASIC_HTML)
      const app = {
        name: 'app-1',
        url: MOCK_APP_URL
      } as AppInterface
      htmlLoader.run(app, successCb)

      await waitFor(() => {
        expect(processHtml).toBeCalledWith(MOCK_BASIC_HTML, app.url)
      })
    })

    test('预期插件 global 配置里的 processHtml 可以生效', async () => {
      const processHtml = jest.fn().mockImplementation(code => code)
      microApp.options.plugins = {
        global: [{
          processHtml
        }]
      }

      const { htmlLoader, successCb } = setup(MOCK_BASIC_HTML)
      const app = {
        name: 'app-1',
        url: MOCK_APP_URL
      } as AppInterface
      htmlLoader.run(app, successCb)

      await waitFor(() => {
        expect(processHtml).toBeCalledWith(MOCK_BASIC_HTML, app.url)
      })
    })
  })
})
